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
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Answer {
    Choice(usize),
    Text(String),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Verdict {
    Correct,
    Incorrect,
}

impl Check {
    pub fn id(&self) -> &CheckId {
        match self {
            Check::Choice { id, .. } | Check::Short { id, .. } => id,
        }
    }
    pub fn prompt(&self) -> &str {
        match self {
            Check::Choice { prompt, .. } | Check::Short { prompt, .. } => prompt,
        }
    }
    /// The canonical answer, used for self-validation and demos.
    pub fn canonical_answer(&self) -> Answer {
        match self {
            Check::Choice { answer, .. } => Answer::Choice(*answer),
            Check::Short { answers, .. } => Answer::Text(answers[0].clone()),
        }
    }
    pub fn grade(&self, a: &Answer) -> Verdict {
        let ok = match (self, a) {
            (Check::Choice { answer, .. }, Answer::Choice(i)) => i == answer,
            (Check::Short { answers, .. }, Answer::Text(t)) => {
                let norm = t.trim().to_lowercase();
                answers.iter().any(|x| x.trim().to_lowercase() == norm)
            }
            _ => false,
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
        ];
        for c in &checks {
            assert_eq!(c.grade(&c.canonical_answer()), Verdict::Correct);
        }
    }
}
