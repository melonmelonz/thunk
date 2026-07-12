# thunk M-B: Competency Gates + Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mastery gating (module N unlocks when N-1 is mastered), a placement diagnostic that lets
an experienced learner test out of modules, local progress persistence so gating survives a
restart, and a TUI that shows the ladder with locked/unlocked/mastered state and can run the
diagnostic. FR-3, FR-4, FR-5.

**Architecture:** All decision logic is pure and lives in `thunk-core`: `gate::ladder_state`
computes per-module status from `(module, check-ids)` pairs plus `Progress`; placement adds a
`modules_placed` set to `Progress` (mastered = all checks passed OR placed) and a pure
`evaluate_placement`. Content contributes `placement.ron`, a per-module selection of three
existing check ids, validated by the same data-driven suite pattern as the ladder. Persistence is
a small RON save/load on `Progress` (path from `THUNK_STATE_DIR` env override, else
`$XDG_DATA_HOME/thunk`, else `~/.local/share/thunk`; pure std, no new deps). The TUI grows a
Modules scene (the home screen: ladder + status, enter an unlocked module) and a Placement scene
that reuses the existing check-answering actions. The CLI `progress` command reads the saved state
and prints the ladder.

**Tech Stack:** Rust 1.88, serde + ron (already workspace deps), zero new dependencies.

---

## File Structure

```
thunk-core/src/
  gate.rs        # NEW: ModuleStatus, ladder_state()
  placement.rs   # NEW: PlacementItem, evaluate_placement()
  progress.rs    # MODIFY: modules_placed field, place_module(), mastered_or_placed()
  lib.rs         # exports
thunk-content/
  modules/placement.ron        # NEW: per-module diagnostic check ids
  src/lib.rs                   # loader Curriculum::placement() + validation tests
thunk-cli/src/main.rs          # MODIFY: progress prints the ladder with status from saved state
thunk-cli/src/state.rs         # NEW: progress file path + load/save (used by cli and tui? no -
                               #      tui depends on core only; put state.rs in thunk-core? NO:
                               #      keep core I/O-free. Put it in a new tiny module in
                               #      thunk-content? Also wrong. It goes in thunk-tui AND cli?
                               #      -> It goes in thunk-core behind fn signatures that take
                               #      paths? See Task 4: `progress_io` lives in thunk-core as
                               #      pure-ish serde helpers + a path resolver using only std env;
                               #      core stays testable (path resolver is a pure function of a
                               #      provided env snapshot).
thunk-tui/src/app.rs           # MODIFY: multi-module state, Modules + Placement scenes, save on quit
thunk-tui/src/ui.rs            # MODIFY: draw the two new scenes
thunk-tui/src/lib.rs           # MODIFY: key maps for the new scenes
```

Resolution of the state-module question (final): `thunk-core/src/state.rs` holds
`progress_to_ron`/`progress_from_ron` (pure string conversions) and
`state_path(env_state_dir: Option<&str>, env_xdg: Option<&str>, env_home: Option<&str>) -> PathBuf`
(pure function of its inputs). Actual `fs::read/write` calls stay in `thunk-cli`/`thunk-tui`
(4-line helpers), so `thunk-core` performs no I/O and every decision remains unit-testable.

---

### Task 1: Gating - `ModuleStatus` and `ladder_state`

**Files:**
- Create: `thunk-core/src/gate.rs`
- Modify: `thunk-core/src/lib.rs`

- [ ] **Step 1: Failing tests** in gate.rs:

```rust
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
        assert_eq!(s, vec![ModuleStatus::Unlocked, ModuleStatus::Locked, ModuleStatus::Locked]);
    }

    #[test]
    fn mastering_a_module_unlocks_the_next() {
        let mut p = Progress::default();
        p.record(&CheckId("a".into()), Verdict::Correct);
        let s = ladder_state(&ladder(), &p);
        assert_eq!(s, vec![ModuleStatus::Mastered, ModuleStatus::Unlocked, ModuleStatus::Locked]);
    }

    #[test]
    fn placement_counts_as_mastery_for_gating() {
        let mut p = Progress::default();
        p.place_module(&ModuleId("m0".into()));
        p.place_module(&ModuleId("m1".into()));
        let s = ladder_state(&ladder(), &p);
        assert_eq!(s, vec![ModuleStatus::Mastered, ModuleStatus::Mastered, ModuleStatus::Unlocked]);
    }
}
```

- [ ] **Step 2:** `CARGO_NET_OFFLINE=true cargo test -p thunk-core` - COMPILE FAIL. Observe.
- [ ] **Step 3: Implement.** In progress.rs add the field + methods (serde `#[serde(default)]` so
old saved files still load):

```rust
    /// Modules mastered by placement rather than by passing every check.
    #[serde(default)]
    pub modules_placed: BTreeSet<ModuleId>,
```

```rust
    pub fn place_module(&mut self, id: &ModuleId) {
        self.modules_placed.insert(id.clone());
    }
    /// Mastered the long way or the placement way.
    pub fn mastered_or_placed(&self, id: &ModuleId, checks: &[CheckId]) -> bool {
        self.modules_placed.contains(id) || self.module_mastered(checks)
    }
```

(import `crate::content::ModuleId`). In gate.rs:

```rust
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
```

- [ ] **Step 4:** Export `pub mod gate; pub use gate::{ladder_state, ModuleStatus};` in lib.rs.
Tests PASS; workspace green (the new Progress field must not break content/tui tests - `#[serde(default)]` and `Default` cover it).
- [ ] **Step 5: Commit:** `feat(core): competency gates - ladder_state over progress`

---

### Task 2: Placement evaluation

**Files:**
- Create: `thunk-core/src/placement.rs`
- Modify: `thunk-core/src/lib.rs`

- [ ] **Step 1: Failing tests:**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::check::{Answer, Check, CheckId};
    use crate::content::ModuleId;

    fn item(module: &str, check_id: &str, answer: usize) -> PlacementItem {
        PlacementItem {
            module: ModuleId(module.into()),
            check: Check::Choice {
                id: CheckId(check_id.into()),
                prompt: "p".into(),
                options: vec!["x".into(), "y".into()],
                answer,
            },
        }
    }

    #[test]
    fn a_module_places_only_when_all_its_items_are_correct() {
        let items = vec![item("m1", "q1", 0), item("m1", "q2", 1), item("m2", "q3", 0)];
        let answers = vec![Answer::Choice(0), Answer::Choice(1), Answer::Choice(1)];
        let placed = evaluate_placement(&items, &answers);
        assert_eq!(placed, vec![ModuleId("m1".into())]); // m2's one item was wrong
    }

    #[test]
    fn unanswered_items_do_not_place() {
        let items = vec![item("m1", "q1", 0), item("m1", "q2", 1)];
        let answers = vec![Answer::Choice(0)]; // second item never answered
        assert!(evaluate_placement(&items, &answers).is_empty());
    }
}
```

- [ ] **Step 2:** COMPILE FAIL. Observe. **Step 3: Implement:**

```rust
//! The placement diagnostic: answer a module's items correctly and you have
//! shown you do not need the module. Nobody is held back; nobody is bored.

use crate::check::{Answer, Check, Verdict};
use crate::content::ModuleId;

/// One diagnostic question, tagged with the module it stands in for.
#[derive(Clone, Debug)]
pub struct PlacementItem {
    pub module: ModuleId,
    pub check: Check,
}

/// Which modules did these answers place out of? A module places only when
/// every one of its items was answered, and answered correctly. Answers pair
/// with items by position; missing answers fail their items.
pub fn evaluate_placement(items: &[PlacementItem], answers: &[Answer]) -> Vec<ModuleId> {
    let mut order: Vec<ModuleId> = Vec::new();
    let mut all_correct: std::collections::BTreeMap<ModuleId, bool> = Default::default();
    for (i, item) in items.iter().enumerate() {
        let correct = answers
            .get(i)
            .map(|a| item.check.grade(a) == Verdict::Correct)
            .unwrap_or(false);
        if !all_correct.contains_key(&item.module) {
            order.push(item.module.clone());
        }
        let entry = all_correct.entry(item.module.clone()).or_insert(true);
        *entry = *entry && correct;
    }
    order.into_iter().filter(|m| all_correct[m]).collect()
}
```

- [ ] **Step 4:** Export; tests PASS. **Step 5: Commit:**
`feat(core): placement evaluation - test out of what you already know`

---

### Task 3: The diagnostic content + loader

**Files:**
- Create: `thunk-content/modules/placement.ron`
- Modify: `thunk-content/src/lib.rs`

- [ ] **Step 1: Failing tests** (append to thunk-content tests):

```rust
#[test]
fn placement_covers_every_module_with_three_existing_checks() {
    let items = Curriculum::placement();
    for dir in LADDER {
        let m = Curriculum::load_module(dir);
        let count = items.iter().filter(|i| i.module.0 == m.id.0).count();
        assert_eq!(count, 3, "module {dir} needs exactly 3 placement items");
        let bank = Curriculum::load_checks(dir);
        for item in items.iter().filter(|i| i.module.0 == m.id.0) {
            assert!(
                bank.iter().any(|c| c == &item.check),
                "placement item {:?} is not in {dir}'s bank",
                item.check.id()
            );
        }
    }
    assert_eq!(items.len(), LADDER.len() * 3);
}
```

- [ ] **Step 2:** COMPILE FAIL. Observe.
- [ ] **Step 3: Author `placement.ron`** - a RON `Vec<(String, String)>` of
`(module_dir, check_id)` pairs, three per module, in ladder order. Choose the three checks per
module that best separate "already knows this" from "needs the module" (concept checks over recall
checks; e.g. for m0: `m0-03-same`, `m0-02-range`, `m0-05-run`; pick equivalents per module by
reading each bank). Loader:

```rust
pub fn placement() -> Vec<PlacementItem> {
    let pairs: Vec<(String, String)> =
        ron::from_str(&read("placement.ron")).expect("valid placement.ron");
    pairs
        .iter()
        .map(|(dir, check_id)| {
            let check = Self::load_checks(dir)
                .into_iter()
                .find(|c| c.id().0 == *check_id)
                .unwrap_or_else(|| panic!("placement references unknown check {check_id} in {dir}"));
            PlacementItem { module: ModuleId(dir.clone()), check }
        })
        .collect()
}
```

(rust-embed's `#[folder = "modules/"]` already embeds the new file; import `PlacementItem`,
`ModuleId` from thunk-core.)
- [ ] **Step 4:** Tests PASS; vocab-lint clean.
- [ ] **Step 5: Commit:** `feat(content): placement diagnostic - three items per module`

---

### Task 4: Progress persistence (state file)

**Files:**
- Create: `thunk-core/src/state.rs`
- Modify: `thunk-core/src/lib.rs`

- [ ] **Step 1: Failing tests:**

```rust
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
        assert_eq!(state_path(None, None, None), PathBuf::from("thunk-progress.ron"));
    }
}
```

- [ ] **Step 2:** COMPILE FAIL. Observe. **Step 3: Implement:**

```rust
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
```

thunk-core needs `ron` as a dependency now (`ron = { workspace = true }` - already a workspace
dep, so offline-safe).
- [ ] **Step 4:** Export (`pub mod state;` + `pub use state::{progress_from_ron, progress_to_ron, state_path};`).
Tests PASS; also derive/confirm `PartialEq` on `Progress` (it already has it). Workspace green.
- [ ] **Step 5: Commit:** `feat(core): progress persistence - RON state file, local only`

---

### Task 5: The TUI - Modules home, gating, placement scene, save on quit

**Files:**
- Modify: `thunk-tui/src/app.rs`, `thunk-tui/src/ui.rs`, `thunk-tui/src/lib.rs`

The largest task; the state machine stays pure and tested, terminal I/O stays thin.

- [ ] **Step 1: Failing tests** (app.rs; these define the behavior):

```rust
#[test]
fn the_home_scene_is_the_module_ladder() {
    let app = App::new();
    assert_eq!(app.scene, Scene::Modules);
    assert_eq!(app.ladder.len(), 7);
    assert_eq!(app.module_status()[0], ModuleStatus::Unlocked);
    assert_eq!(app.module_status()[1], ModuleStatus::Locked);
}

#[test]
fn entering_a_locked_module_is_refused() {
    let mut app = App::new();
    app.module_sel = 3; // m3-bus, locked at start
    app.update(Action::EnterModule);
    assert_eq!(app.scene, Scene::Modules, "locked module refused");
    app.module_sel = 0;
    app.update(Action::EnterModule);
    assert_eq!(app.scene, Scene::Reader);
    assert_eq!(app.module.id.0, "m0-power-on");
}

#[test]
fn mastering_a_module_unlocks_the_next_in_the_tui() {
    let mut app = App::new();
    // pass every m0 check directly on progress
    for c in Curriculum::load_checks("m0-power-on") {
        app.progress.record(c.id(), c.grade(&c.canonical_answer()));
    }
    assert_eq!(app.module_status()[0], ModuleStatus::Mastered);
    assert_eq!(app.module_status()[1], ModuleStatus::Unlocked);
}

#[test]
fn the_placement_scene_places_and_unlocks() {
    let mut app = App::new();
    app.update(Action::OpenPlacement);
    assert_eq!(app.scene, Scene::Placement);
    // answer every item with its canonical answer
    let items = app.placement.clone();
    for item in &items {
        match &item.check {
            Check::Choice { answer, .. } => {
                app.selected = *answer;
                app.update(Action::Submit);
            }
            Check::Short { answers, .. } => {
                app.input = answers[0].clone();
                app.update(Action::Submit);
            }
        }
        app.update(Action::NextCheck);
    }
    // finishing the run applies placement: everything mastered
    assert!(app.module_status().iter().all(|s| *s == ModuleStatus::Mastered));
}

#[test]
fn progress_survives_a_save_load_round_trip() {
    let dir = std::env::temp_dir().join(format!("thunk-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let mut app = App::new();
    app.progress.record(&CheckId("m0-01-processor".into()), Verdict::Correct);
    app.save_progress_to(&dir);
    let loaded = App::load_progress_from(&dir);
    assert!(loaded.checks_passed.contains(&CheckId("m0-01-processor".into())));
    std::fs::remove_dir_all(&dir).ok();
}
```

- [ ] **Step 2:** COMPILE FAIL. Observe.
- [ ] **Step 3: Implement** (shape, not exhaustive):
  - `Scene` gains `Modules` and `Placement`. `Action` gains `EnterModule`, `OpenPlacement`,
    `OpenModules` (back to home).
  - `App` gains: `ladder: Vec<(ModuleId, Vec<CheckId>)>` (built once from `Curriculum::all()` +
    `load_checks` per module), `module_sel: usize`, `placement: Vec<PlacementItem>`
    (`Curriculum::placement()`), `placement_answers: Vec<Answer>` (grown as the learner submits in
    the Placement scene), and helpers `module_status() -> Vec<ModuleStatus>` (thin call to
    `ladder_state`), `save_progress_to(&Path)`, `load_progress_from(&Path) -> Progress`.
  - `App::new()`: scene starts at `Modules`; `module`/`checks` load from the first unlocked
    module (m0 on a fresh start; from saved progress otherwise); progress loads via
    `load_progress_from(state dir from env)` using `thunk_core::state_path(
    env("THUNK_STATE_DIR").as_deref(), env("XDG_DATA_HOME").as_deref(), env("HOME").as_deref())`.
  - `EnterModule`: only when `module_status()[module_sel] != Locked`: load that module's
    `Module` + checks into the existing fields, reset lesson/scroll, scene = Reader.
  - Placement scene reuses `selected`/`input`/`Submit`/`NextCheck` machinery but records into
    `placement_answers` (not `progress`); when the last item is answered (`placement_answers.len()
    == placement.len()`), apply `evaluate_placement`, `place_module` each result, save progress,
    and return to `Modules`.
  - `Submit` in Reader/Checks scenes: after recording, save progress (cheap: only on Correct).
  - `Quit`: save progress before setting `should_quit`.
  - ui.rs: `Scene::Modules` draws the ladder list - `M0 Power On          mastered` /
    `M2 Rust for the Metal   locked` etc., selection highlight, footer keys
    (`enter` open, `p` placement, `q` quit). `Scene::Placement` reuses the checks-scene renderer
    with a "placement diagnostic - item i of N" title and a note that answers here do not affect
    module progress.
  - lib.rs `map_key`: Modules scene (`j/k` select, `Enter` enter, `p` placement, `q` quit);
    Placement scene maps like Checks plus `Esc` back to Modules; Reader gains `m`/`Esc` back to
    Modules (keep existing keys).
- [ ] **Step 4:** All TUI tests PASS; workspace green; clippy clean. The old
`new_marks_first_lesson_read` test will need updating: marking-read now happens on entering a
module, not in `App::new()` - adjust the test to enter m0 first, keeping its meaning.
- [ ] **Step 5: Commit:** `feat(tui): module ladder home, gated entry, placement scene, saved progress`

---

### Task 6: CLI progress + sweep

**Files:**
- Modify: `thunk-cli/src/main.rs`
- Modify: `docs/superpowers/plans/2026-07-10-thunk-buildout.md`

- [ ] **Step 1: Failing test:**

```rust
#[test]
fn progress_prints_the_ladder_with_status() {
    let s = progress();
    for needle in ["M0", "M6", "unlocked", "locked"] {
        assert!(s.contains(needle), "missing {needle:?}:\n{s}");
    }
}
```

- [ ] **Step 2:** FAIL. **Step 3: Implement:** `progress()` loads saved `Progress` (same env
resolution as the TUI; fresh default when absent), builds the ladder from `Curriculum`, calls
`ladder_state`, prints one row per module: tag, title, `mastered | unlocked | locked`, plus
`passed/total checks` for unlocked modules, and a closing line naming the state file location.
- [ ] **Step 4:** Workspace green; eyeball `cargo run -q -p thunk-cli -- progress` (fresh state:
M0 unlocked, M1-M6 locked).
- [ ] **Step 5:** Full sweep: fmt, clippy `-D warnings`, `cargo test --workspace`, vocab-lint.
Annotate M-B in the buildout roadmap: **Status: DONE 2026-07-12** + substance line.
- [ ] **Step 6: Commit:** `feat(cli): progress shows the gated ladder; chore(mB): sweep`
(two commits if cleaner: the cli feat, then the sweep/annotation chore.)

---

## Self-Review notes

- **Spec coverage vs M-B:** gating logic pure + unit-tested (Task 1), placement logic pure +
  unit-tested (Task 2, content Task 3), TUI shows locked/unlocked (Task 5), and the additions that
  make gating real rather than ornamental: persistence (Task 4, FR-5) and a runnable diagnostic
  (Task 5's Placement scene, FR-4). CLI visibility (Task 6).
- **Type consistency:** `ladder_state(&[(ModuleId, Vec<CheckId>)], &Progress) -> Vec<ModuleStatus>`
  is used identically in Tasks 1, 5, 6; `PlacementItem { module, check }` in Tasks 2, 3, 5;
  `state_path(Option<&str>, Option<&str>, Option<&str>)` in Tasks 4, 5, 6.
- **Compat risk called out:** `Progress` gains `modules_placed` with `#[serde(default)]`, so
  pre-M-B saved files (none exist in the wild, but tests serialize) still parse.
- **No placeholders:** Task 5's Step 3 is a shape list rather than full code because it touches an
  existing state machine the implementer must read first; every named field, action, scene, and
  behavior is specified, and Step 1's tests pin the behavior exactly.
