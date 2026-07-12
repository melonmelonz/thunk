//! Progress: what a learner has read and which checks they have passed.

use crate::check::{CheckId, Verdict};
use crate::content::{LessonId, ModuleId};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Progress {
    pub lessons_read: BTreeSet<LessonId>,
    pub checks_passed: BTreeSet<CheckId>,
    /// Modules mastered by placement rather than by passing every check.
    #[serde(default)]
    pub modules_placed: BTreeSet<ModuleId>,
}

impl Progress {
    pub fn read_lesson(&mut self, id: &LessonId) {
        self.lessons_read.insert(id.clone());
    }
    pub fn record(&mut self, id: &CheckId, v: Verdict) {
        if v == Verdict::Correct {
            self.checks_passed.insert(id.clone());
        }
    }
    /// Mastery: every check in the given list has been passed at least once.
    pub fn module_mastered(&self, ids: &[CheckId]) -> bool {
        !ids.is_empty() && ids.iter().all(|i| self.checks_passed.contains(i))
    }
    pub fn place_module(&mut self, id: &ModuleId) {
        self.modules_placed.insert(id.clone());
    }
    /// Mastered the long way or the placement way.
    pub fn mastered_or_placed(&self, id: &ModuleId, checks: &[CheckId]) -> bool {
        self.modules_placed.contains(id) || self.module_mastered(checks)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mastery_requires_all_checks_correct() {
        let ids = vec![CheckId("a".into()), CheckId("b".into())];
        let mut p = Progress::default();
        p.record(&CheckId("a".into()), Verdict::Correct);
        assert!(!p.module_mastered(&ids));
        // a wrong attempt does not pass; a later correct one does
        p.record(&CheckId("b".into()), Verdict::Incorrect);
        assert!(!p.module_mastered(&ids));
        p.record(&CheckId("b".into()), Verdict::Correct);
        assert!(p.module_mastered(&ids));
    }

    #[test]
    fn empty_list_is_not_mastery() {
        let p = Progress::default();
        assert!(!p.module_mastered(&[]));
    }
}
