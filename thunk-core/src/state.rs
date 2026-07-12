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
