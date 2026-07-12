//! Competency gates: a module opens when the one before it is mastered.

use crate::check::CheckId;
use crate::content::ModuleId;
use crate::progress::Progress;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModuleStatus {
    /// Every check passed (or placed out): done, and it opens the next door.
    Mastered,
    /// Open to work in now.
    Unlocked,
    /// The previous module is not mastered yet.
    Locked,
}

/// Walk the ladder in order: the first module is always open; each later one
/// opens when everything before it is mastered.
pub fn ladder_state(ladder: &[(ModuleId, Vec<CheckId>)], p: &Progress) -> Vec<ModuleStatus> {
    let mut out = Vec::with_capacity(ladder.len());
    let mut all_before_mastered = true;
    for (id, checks) in ladder {
        let mastered = p.mastered_or_placed(id, checks);
        out.push(if mastered {
            ModuleStatus::Mastered
        } else if all_before_mastered {
            ModuleStatus::Unlocked
        } else {
            ModuleStatus::Locked
        });
        all_before_mastered = all_before_mastered && mastered;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::check::{CheckId, Verdict};
    use crate::content::ModuleId;
    use crate::progress::Progress;

    fn ladder() -> Vec<(ModuleId, Vec<CheckId>)> {
        vec![
            (ModuleId("m0".into()), vec![CheckId("a".into())]),
            (ModuleId("m1".into()), vec![CheckId("b".into())]),
            (ModuleId("m2".into()), vec![CheckId("c".into())]),
        ]
    }

    #[test]
    fn first_module_is_always_open_rest_are_locked() {
        let s = ladder_state(&ladder(), &Progress::default());
        assert_eq!(
            s,
            vec![
                ModuleStatus::Unlocked,
                ModuleStatus::Locked,
                ModuleStatus::Locked
            ]
        );
    }

    #[test]
    fn mastering_a_module_unlocks_the_next() {
        let mut p = Progress::default();
        p.record(&CheckId("a".into()), Verdict::Correct);
        let s = ladder_state(&ladder(), &p);
        assert_eq!(
            s,
            vec![
                ModuleStatus::Mastered,
                ModuleStatus::Unlocked,
                ModuleStatus::Locked
            ]
        );
    }

    #[test]
    fn placement_counts_as_mastery_for_gating() {
        let mut p = Progress::default();
        p.place_module(&ModuleId("m0".into()));
        p.place_module(&ModuleId("m1".into()));
        let s = ladder_state(&ladder(), &p);
        assert_eq!(
            s,
            vec![
                ModuleStatus::Mastered,
                ModuleStatus::Mastered,
                ModuleStatus::Unlocked
            ]
        );
    }
}
