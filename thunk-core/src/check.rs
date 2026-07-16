//! Checks: a small question a learner answers to prove they got the idea.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct CheckId(pub String);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Check {
    Choice {
        id: CheckId,
        prompt: String,
        options: Vec<String>,
        answer: usize,
    },
    Short {
        id: CheckId,
        prompt: String,
        answers: Vec<String>,
    },
    /// Arrange items into the correct sequence. `items` is authored in the
    /// CORRECT order; a renderer shuffles them for display and the learner
    /// reorders. The answer is the submitted permutation of item indices, and
    /// it grades Correct only when it equals the identity order (0,1,2,...).
    Order {
        id: CheckId,
        prompt: String,
        items: Vec<String>,
    },
    /// Predict an output value (a byte, a pixel, a number). Identical grading
    /// to Short - trim + lowercase against an accepted list - but authored and
    /// presented as a prediction (monospace input, often a hex/byte value).
    /// Kept a distinct variant so lessons can frame it and the UI can differ,
    /// while the grading helper stays shared so the two can never drift.
    Predict {
        id: CheckId,
        prompt: String,
        answers: Vec<String>,
        /// A short note on the expected shape (e.g. "hex byte") shown as the
        /// input's placeholder. May be empty.
        hint: String,
    },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Answer {
    Choice(usize),
    Text(String),
    /// A submitted ordering: the item indices in the order the learner placed
    /// them. Correct when it matches the authored (identity) order.
    Order(Vec<usize>),
}

/// The one short-answer normalization, shared by Short and Predict so the two
/// can never grade differently: trim + Unicode-aware lowercase, accept on any
/// listed answer. This is the exact rule the TS grader (`site/src/lib/grade.ts`)
/// and the offline `check.js` mirror.
fn answers_accept(answers: &[String], text: &str) -> bool {
    let norm = text.trim().to_lowercase();
    answers.iter().any(|x| x.trim().to_lowercase() == norm)
}

/// Whether a submitted permutation is the identity order over `n` items - the
/// authored order reproduced exactly. Length must match, and each slot must
/// hold its own index.
fn is_identity_order(perm: &[usize], n: usize) -> bool {
    perm.len() == n && perm.iter().enumerate().all(|(i, &v)| v == i)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Verdict {
    Correct,
    Incorrect,
}

impl Check {
    pub fn id(&self) -> &CheckId {
        match self {
            Check::Choice { id, .. }
            | Check::Short { id, .. }
            | Check::Order { id, .. }
            | Check::Predict { id, .. } => id,
        }
    }
    pub fn prompt(&self) -> &str {
        match self {
            Check::Choice { prompt, .. }
            | Check::Short { prompt, .. }
            | Check::Order { prompt, .. }
            | Check::Predict { prompt, .. } => prompt,
        }
    }
    /// The canonical answer, used for self-validation and demos.
    pub fn canonical_answer(&self) -> Answer {
        match self {
            Check::Choice { answer, .. } => Answer::Choice(*answer),
            Check::Short { answers, .. } => Answer::Text(answers[0].clone()),
            Check::Order { items, .. } => Answer::Order((0..items.len()).collect()),
            Check::Predict { answers, .. } => Answer::Text(answers[0].clone()),
        }
    }
    pub fn grade(&self, a: &Answer) -> Verdict {
        // Matched on `self` (not the (self, a) pair) so the compiler forces a
        // grading arm for every Check variant - no catch-all that could let a
        // new variant grade silently. Each arm accepts only its own Answer
        // shape; a cross-kind answer (e.g. Text to an Order check) is wrong,
        // never a panic.
        let ok = match self {
            Check::Choice { answer, .. } => matches!(a, Answer::Choice(i) if i == answer),
            Check::Short { answers, .. } => {
                matches!(a, Answer::Text(t) if answers_accept(answers, t))
            }
            Check::Order { items, .. } => {
                matches!(a, Answer::Order(perm) if is_identity_order(perm, items.len()))
            }
            Check::Predict { answers, .. } => {
                matches!(a, Answer::Text(t) if answers_accept(answers, t))
            }
        };
        if ok {
            Verdict::Correct
        } else {
            Verdict::Incorrect
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multiple_choice_grades() {
        let c = Check::Choice {
            id: CheckId("m1-q1".into()),
            prompt: "Which mode can touch page tables?".into(),
            options: vec!["user".into(), "kernel".into()],
            answer: 1,
        };
        assert_eq!(c.grade(&Answer::Choice(1)), Verdict::Correct);
        assert_eq!(c.grade(&Answer::Choice(0)), Verdict::Incorrect);
        assert_eq!(c.grade(&Answer::Text("kernel".into())), Verdict::Incorrect);
    }

    #[test]
    fn short_text_is_case_and_space_insensitive() {
        let c = Check::Short {
            id: CheckId("m1-q2".into()),
            prompt: "syscall to map memory?".into(),
            answers: vec!["mmap".into()],
        };
        assert_eq!(c.grade(&Answer::Text("  MMAP ".into())), Verdict::Correct);
        assert_eq!(c.grade(&Answer::Text("brk".into())), Verdict::Incorrect);
    }

    #[test]
    fn short_answer_normalizes_unicode_case_and_interior_is_left_alone() {
        // trim + to_lowercase is the whole normalization: leading/trailing
        // space and letter case do not matter, but interior content does.
        let c = Check::Short {
            id: CheckId("m2-01-drop".into()),
            prompt: "the trait that runs at scope end?".into(),
            answers: vec!["Drop".into()],
        };
        assert_eq!(c.grade(&Answer::Text("  drop ".into())), Verdict::Correct);
        assert_eq!(c.grade(&Answer::Text("DROP".into())), Verdict::Correct);
        // Unicode case-folds too: a stored answer with an accented capital is
        // matched by its lowercase form (to_lowercase is Unicode-aware).
        let uc = Check::Short {
            id: CheckId("x".into()),
            prompt: "p".into(),
            answers: vec!["Éclair".into()],
        };
        assert_eq!(uc.grade(&Answer::Text("éclair".into())), Verdict::Correct);
        // An empty answer to a non-empty bank is simply wrong, not a panic.
        assert_eq!(c.grade(&Answer::Text(String::new())), Verdict::Incorrect);
        assert_eq!(c.grade(&Answer::Text("   ".into())), Verdict::Incorrect);
    }

    #[test]
    fn a_choice_index_past_the_options_is_incorrect_not_a_panic() {
        // Grading never indexes `options`; it compares the chosen index to the
        // stored answer index. An out-of-range guess is just wrong.
        let c = Check::Choice {
            id: CheckId("m1-01-mode".into()),
            prompt: "p".into(),
            options: vec!["user".into(), "kernel".into()],
            answer: 1,
        };
        assert_eq!(c.grade(&Answer::Choice(99)), Verdict::Incorrect);
        assert_eq!(c.grade(&Answer::Choice(1)), Verdict::Correct);
        // A cross-kind answer (text to a choice check) is wrong, not a panic.
        assert_eq!(c.grade(&Answer::Text("kernel".into())), Verdict::Incorrect);
    }

    #[test]
    fn canonical_answer_of_a_multi_answer_short_is_the_first() {
        let c = Check::Short {
            id: CheckId("b".into()),
            prompt: "p".into(),
            answers: vec!["mmap".into(), "map".into()],
        };
        assert_eq!(c.canonical_answer(), Answer::Text("mmap".into()));
        assert_eq!(c.grade(&c.canonical_answer()), Verdict::Correct);
    }

    #[test]
    fn canonical_answer_always_grades_correct() {
        let checks = vec![
            Check::Choice {
                id: CheckId("a".into()),
                prompt: "p".into(),
                options: vec!["x".into(), "y".into()],
                answer: 1,
            },
            Check::Short {
                id: CheckId("b".into()),
                prompt: "p".into(),
                answers: vec!["mmap".into(), "map".into()],
            },
            Check::Order {
                id: CheckId("c".into()),
                prompt: "p".into(),
                items: vec!["one".into(), "two".into(), "three".into()],
            },
            Check::Predict {
                id: CheckId("d".into()),
                prompt: "p".into(),
                answers: vec!["0xF8".into(), "f8".into()],
                hint: "hex byte".into(),
            },
        ];
        for c in &checks {
            assert_eq!(c.grade(&c.canonical_answer()), Verdict::Correct);
        }
    }

    // --- Order ---------------------------------------------------------------

    fn order_check() -> Check {
        Check::Order {
            id: CheckId("m4-04-draw-order".into()),
            prompt: "put the steps in order".into(),
            items: vec![
                "set the column window".into(),
                "set the row window".into(),
                "send RAMWR".into(),
                "stream the pixels".into(),
            ],
        }
    }

    #[test]
    fn order_grades_correct_only_on_the_exact_authored_order() {
        let c = order_check();
        // The identity permutation is the authored order: Correct.
        assert_eq!(c.grade(&Answer::Order(vec![0, 1, 2, 3])), Verdict::Correct);
        // The canonical answer is that identity, and it round-trips.
        assert_eq!(c.canonical_answer(), Answer::Order(vec![0, 1, 2, 3]));
        assert_eq!(c.grade(&c.canonical_answer()), Verdict::Correct);
    }

    #[test]
    fn order_rejects_any_transposition_or_wrong_shape() {
        let c = order_check();
        // Any single swap is wrong.
        assert_eq!(
            c.grade(&Answer::Order(vec![1, 0, 2, 3])),
            Verdict::Incorrect
        );
        assert_eq!(
            c.grade(&Answer::Order(vec![0, 1, 3, 2])),
            Verdict::Incorrect
        );
        // A full reverse is wrong.
        assert_eq!(
            c.grade(&Answer::Order(vec![3, 2, 1, 0])),
            Verdict::Incorrect
        );
        // A too-short or too-long submission is wrong, not a panic.
        assert_eq!(c.grade(&Answer::Order(vec![0, 1, 2])), Verdict::Incorrect);
        assert_eq!(
            c.grade(&Answer::Order(vec![0, 1, 2, 3, 0])),
            Verdict::Incorrect
        );
        // A cross-kind answer (Text / Choice to an Order check) is wrong.
        assert_eq!(c.grade(&Answer::Text("0 1 2 3".into())), Verdict::Incorrect);
        assert_eq!(c.grade(&Answer::Choice(0)), Verdict::Incorrect);
    }

    // --- Predict -------------------------------------------------------------

    #[test]
    fn predict_has_short_grading_semantics_including_alternates() {
        let c = Check::Predict {
            id: CheckId("m4-02-redbyte".into()),
            prompt: "predict the first byte of pure red on the wire".into(),
            answers: vec!["0xF8".into(), "f8".into(), "248".into()],
            hint: "hex byte".into(),
        };
        // Canonical is the first accepted answer, and it round-trips Correct.
        assert_eq!(c.canonical_answer(), Answer::Text("0xF8".into()));
        assert_eq!(c.grade(&c.canonical_answer()), Verdict::Correct);
        // trim + lowercase, exactly like Short.
        assert_eq!(c.grade(&Answer::Text("  0XF8 ".into())), Verdict::Correct);
        // Every alternate is accepted.
        assert_eq!(c.grade(&Answer::Text("f8".into())), Verdict::Correct);
        assert_eq!(c.grade(&Answer::Text("248".into())), Verdict::Correct);
        // A near miss is wrong; an empty answer is wrong, not a panic.
        assert_eq!(c.grade(&Answer::Text("0xF9".into())), Verdict::Incorrect);
        assert_eq!(c.grade(&Answer::Text(String::new())), Verdict::Incorrect);
        // A cross-kind answer (Order / Choice to a Predict check) is wrong.
        assert_eq!(c.grade(&Answer::Order(vec![0])), Verdict::Incorrect);
        assert_eq!(c.grade(&Answer::Choice(0)), Verdict::Incorrect);
    }

    #[test]
    fn predict_and_short_agree_on_the_same_answer_bank() {
        // The shared helper is the whole point: a Predict and a Short with the
        // same accepted list grade identically for every input.
        let answers = vec!["ramwr".into(), "0x2c".into(), "2c".into()];
        let short = Check::Short {
            id: CheckId("s".into()),
            prompt: "p".into(),
            answers: answers.clone(),
        };
        let predict = Check::Predict {
            id: CheckId("p".into()),
            prompt: "p".into(),
            answers,
            hint: String::new(),
        };
        for probe in ["RAMWR", " 0X2C ", "2c", "caset", "", "   "] {
            let a = Answer::Text(probe.into());
            assert_eq!(
                short.grade(&a),
                predict.grade(&a),
                "short and predict disagree on {probe:?}"
            );
        }
    }
}
