//! Saving and loading progress: plain RON in a plain file, local only.
//! No accounts, no network, nothing leaves the machine (NFR-4). This module
//! does no I/O itself; callers read and write the file.

use crate::progress::Progress;
use std::path::PathBuf;

pub fn progress_to_ron(p: &Progress) -> Option<String> {
    ron::ser::to_string_pretty(p, ron::ser::PrettyConfig::default()).ok()
}

/// A missing or unreadable file is not an error, it is a fresh start.
pub fn progress_from_ron(s: &str) -> Option<Progress> {
    ron::from_str(s).ok()
}

/// Where progress lives: `THUNK_STATE_DIR` override (tests, facilitators),
/// else `$XDG_DATA_HOME/thunk`, else `~/.local/share/thunk`, else the
/// current directory. Pure function of its inputs so it is testable.
pub fn state_path(
    state_dir: Option<&str>,
    xdg_data_home: Option<&str>,
    home: Option<&str>,
) -> PathBuf {
    match (state_dir, xdg_data_home, home) {
        (Some(d), _, _) => PathBuf::from(d).join("progress.ron"),
        (None, Some(x), _) => PathBuf::from(x).join("thunk").join("progress.ron"),
        (None, None, Some(h)) => PathBuf::from(h)
            .join(".local")
            .join("share")
            .join("thunk")
            .join("progress.ron"),
        (None, None, None) => PathBuf::from("thunk-progress.ron"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::check::{CheckId, Verdict};
    use crate::progress::Progress;
    use std::path::PathBuf;

    #[test]
    fn progress_round_trips_through_ron() {
        let mut p = Progress::default();
        p.record(&CheckId("m0-01-processor".into()), Verdict::Correct);
        p.place_module(&crate::content::ModuleId("m2-rust".into()));
        let s = progress_to_ron(&p).expect("serializes");
        let back = progress_from_ron(&s).expect("parses");
        assert_eq!(p, back);
    }

    #[test]
    fn garbage_state_reads_as_a_fresh_start() {
        assert!(progress_from_ron("not ron at all").is_none());
    }

    #[test]
    fn a_state_file_from_before_placement_still_loads() {
        // Old schema: written by a build that predates `modules_placed`. The
        // `#[serde(default)]` on that field must let the file load, degrading
        // to "nothing placed" rather than failing the whole parse.
        let old = r#"(lessons_read:[("01-intro")],checks_passed:[("m0-01-x")])"#;
        let p = progress_from_ron(old).expect("old-schema file still parses");
        assert!(
            p.modules_placed.is_empty(),
            "absent field defaults to empty"
        );
        assert!(p
            .checks_passed
            .contains(&crate::check::CheckId("m0-01-x".into())));
    }

    #[test]
    fn a_type_mismatched_state_file_degrades_to_none_not_a_panic() {
        // A field with the wrong shape (a number where a set belongs) is
        // corruption, not an old schema: it must read as None (fresh start),
        // never panic. The CLI turns None into `Progress::default()`.
        assert!(progress_from_ron("(lessons_read:42,checks_passed:[])").is_none());
        // A truncated file (cut off mid-write) is corruption too.
        assert!(progress_from_ron("(lessons_read:[(\"a").is_none());
    }

    #[test]
    fn an_empty_progress_round_trips_and_reloads_as_default() {
        let s = progress_to_ron(&Progress::default()).expect("serializes");
        assert_eq!(progress_from_ron(&s), Some(Progress::default()));
    }

    #[test]
    fn state_path_prefers_the_override_then_xdg_then_home() {
        assert_eq!(
            state_path(Some("/tmp/t"), Some("/x"), Some("/h")),
            PathBuf::from("/tmp/t/progress.ron")
        );
        assert_eq!(
            state_path(None, Some("/x"), Some("/h")),
            PathBuf::from("/x/thunk/progress.ron")
        );
        assert_eq!(
            state_path(None, None, Some("/h")),
            PathBuf::from("/h/.local/share/thunk/progress.ron")
        );
        assert_eq!(
            state_path(None, None, None),
            PathBuf::from("thunk-progress.ron")
        );
    }
}
