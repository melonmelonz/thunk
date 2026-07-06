//! Checks: a small question a learner answers to prove they got the idea.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct CheckId(pub String);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Check {
    Choice { id: CheckId, prompt: String, options: Vec<String>, answer: usize },
    Short { id: CheckId, prompt: String, answers: Vec<String> },
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
        if ok { Verdict::Correct } else { Verdict::Incorrect }
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
    fn canonical_answer_always_grades_correct() {
        let checks = vec![
            Check::Choice { id: CheckId("a".into()), prompt: "p".into(), options: vec!["x".into(), "y".into()], answer: 1 },
            Check::Short { id: CheckId("b".into()), prompt: "p".into(), answers: vec!["mmap".into(), "map".into()] },
        ];
        for c in &checks {
            assert_eq!(c.grade(&c.canonical_answer()), Verdict::Correct);
        }
    }
}
