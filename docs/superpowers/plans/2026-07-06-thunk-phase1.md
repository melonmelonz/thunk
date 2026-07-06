# thunk Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working offline `thunk` binary that teaches Module 1 (The Kernel) end-to-end from one
content source, and boots a test pattern on a simulated panel — demoable at the Aug 2026 Next
Chapter demo.

**Architecture:** A Cargo workspace of small, focused crates. `thunk-core` holds pure, tested domain
logic (content model, check evaluation, progress). `thunk-content` embeds the Module 1 curriculum at
compile time via `rust-embed`. `thunk-sim` is a deterministic pure-Rust model of an SPI bus + panel
framebuffer. `thunk-cli` (native, crossterm) and later `thunk-tui` (ratatui) render the same content.
No network, no crypto, static-musl target, `vocab-lint` gate — review-safe from task zero.

**Tech Stack:** Rust 1.88 (pinned), serde + RON (data), rust-embed (assets), clap (CLI), ratatui +
crossterm (TUI), anyhow/thiserror (errors). Reuses proven choices from `~/dev/peek`.

---

## File Structure

```
thunk/
  Cargo.toml                      # workspace manifest
  rust-toolchain.toml             # pin 1.88
  LICENSE-MIT, LICENSE-APACHE
  scripts/vocab-lint.sh           # rejects exploitation vocabulary
  thunk-core/
    src/lib.rs                    # re-exports
    src/content.rs                # Module, Lesson, Check, ChoiceId, ModuleId, LessonId
    src/check.rs                  # Check evaluation + Answer + Verdict
    src/progress.rs               # Progress, mastery, per-check state
  thunk-content/
    src/lib.rs                    # Curriculum loader over embedded assets
    modules/m1-kernel/
      module.ron                  # module metadata + lesson order
      01-programs-and-os.md ...   # lesson prose (markdown)
      checks.ron                  # Vec<Check> for M1
  thunk-sim/
    src/lib.rs                    # re-exports
    src/spi.rs                    # SpiBus trait, SimSpi, Transfer, TraceEvent
    src/panel.rs                  # Panel framebuffer (ILI9341-ish), RGB565
    src/boot.rs                   # draw a test pattern / splash to a Panel
  thunk-cli/
    Cargo.toml                    # bin name = "thunk"
    src/main.rs                   # clap entrypoint
    src/cmd/{read.rs,check.rs,progress.rs,sim.rs,mod.rs}
```

`thunk-tui` is added at Task 9. Split by responsibility: domain (`core`), assets (`content`),
hardware model (`sim`), presentation (`cli`/`tui`).

---

## Task 0: Scaffold workspace

**Files:** Create `Cargo.toml`, `rust-toolchain.toml`, `scripts/vocab-lint.sh`, `.gitignore`, crate skeletons.

- [ ] **Step 1:** `cd ~/dev/thunk && git init`.
- [ ] **Step 2:** Write workspace `Cargo.toml` with members `thunk-core, thunk-content, thunk-sim, thunk-cli` and a `[workspace.dependencies]` block (serde, ron, rust-embed, clap, anyhow, thiserror, ratatui, crossterm). Release profile: `lto="thin"`, `codegen-units=1`, `strip=true`.
- [ ] **Step 3:** Write `rust-toolchain.toml` pinning `channel = "1.88"` with rustfmt+clippy.
- [ ] **Step 4:** `cargo new --lib thunk-core && cargo new --lib thunk-content && cargo new --lib thunk-sim && cargo new thunk-cli` (fix bin name to `thunk` in `thunk-cli/Cargo.toml`).
- [ ] **Step 5:** Add MIT/Apache license files and `.gitignore` (`/target`).
- [ ] **Step 6:** Run `cargo build` — expect clean empty build.
- [ ] **Step 7:** Commit: `git add -A && git commit -m "chore: scaffold thunk workspace"`.

## Task 1: thunk-core content model

**Files:** Create `thunk-core/src/content.rs`; modify `thunk-core/src/lib.rs`.

- [ ] **Step 1: Write the failing test** in `thunk-core/src/content.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn module_lists_lessons_in_order() {
        let m = Module {
            id: ModuleId("m1-kernel".into()),
            title: "The Kernel".into(),
            lessons: vec![
                Lesson { id: LessonId("01".into()), title: "Programs and the OS".into(), body: "text".into() },
                Lesson { id: LessonId("02".into()), title: "Syscalls".into(), body: "text".into() },
            ],
        };
        assert_eq!(m.lesson_ids(), vec![LessonId("01".into()), LessonId("02".into())]);
        assert_eq!(m.lesson(&LessonId("02".into())).unwrap().title, "Syscalls");
    }
}
```

- [ ] **Step 2: Run to verify it fails.** Run: `cargo test -p thunk-core`. Expected: FAIL (types undefined).
- [ ] **Step 3: Implement** in `thunk-core/src/content.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ModuleId(pub String);
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct LessonId(pub String);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Lesson { pub id: LessonId, pub title: String, pub body: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Module { pub id: ModuleId, pub title: String, pub lessons: Vec<Lesson> }

impl Module {
    pub fn lesson_ids(&self) -> Vec<LessonId> { self.lessons.iter().map(|l| l.id.clone()).collect() }
    pub fn lesson(&self, id: &LessonId) -> Option<&Lesson> { self.lessons.iter().find(|l| &l.id == id) }
}
```

- [ ] **Step 4:** Add `pub mod content; pub use content::*;` to `thunk-core/src/lib.rs`; add `serde` dep in `thunk-core/Cargo.toml` (`serde = { workspace = true }`).
- [ ] **Step 5: Run to verify pass.** Run: `cargo test -p thunk-core`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(core): module/lesson content model`.

## Task 2: thunk-core check evaluation

**Files:** Create `thunk-core/src/check.rs`; modify `lib.rs`.

- [ ] **Step 1: Failing test:**

```rust
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
    }
    #[test]
    fn short_text_is_case_and_space_insensitive() {
        let c = Check::Short { id: CheckId("m1-q2".into()), prompt: "syscall to map memory?".into(), answers: vec!["mmap".into()] };
        assert_eq!(c.grade(&Answer::Text("  MMAP ".into())), Verdict::Correct);
    }
}
```

- [ ] **Step 2:** Run `cargo test -p thunk-core` — expect FAIL.
- [ ] **Step 3: Implement** `thunk-core/src/check.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CheckId(pub String);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Check {
    Choice { id: CheckId, prompt: String, options: Vec<String>, answer: usize },
    Short { id: CheckId, prompt: String, answers: Vec<String> },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Answer { Choice(usize), Text(String) }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Verdict { Correct, Incorrect }

impl Check {
    pub fn id(&self) -> &CheckId { match self { Check::Choice { id, .. } | Check::Short { id, .. } => id } }
    pub fn prompt(&self) -> &str { match self { Check::Choice { prompt, .. } | Check::Short { prompt, .. } => prompt } }
    pub fn grade(&self, a: &Answer) -> Verdict {
        let ok = match (self, a) {
            (Check::Choice { answer, .. }, Answer::Choice(i)) => i == answer,
            (Check::Short { answers, .. }, Answer::Text(t)) => {
                let n = t.trim().to_lowercase();
                answers.iter().any(|x| x.trim().to_lowercase() == n)
            }
            _ => false,
        };
        if ok { Verdict::Correct } else { Verdict::Incorrect }
    }
}
```

- [ ] **Step 4:** Export in `lib.rs`. **Step 5:** `cargo test -p thunk-core` PASS. **Step 6:** Commit `feat(core): check evaluation`.

## Task 3: thunk-core progress / mastery

**Files:** Create `thunk-core/src/progress.rs`.

- [ ] **Step 1: Failing test:** a `Progress` records lesson-read + per-check correctness; `module_mastered` is true only when every check in a given id list has been answered correctly at least once.

```rust
#[test]
fn mastery_requires_all_checks_correct() {
    let ids = vec![CheckId("a".into()), CheckId("b".into())];
    let mut p = Progress::default();
    p.record(&CheckId("a".into()), Verdict::Correct);
    assert!(!p.module_mastered(&ids));
    p.record(&CheckId("b".into()), Verdict::Incorrect);
    p.record(&CheckId("b".into()), Verdict::Correct);
    assert!(p.module_mastered(&ids));
}
```

- [ ] **Step 2:** run, expect FAIL. **Step 3: Implement:**

```rust
use crate::check::{CheckId, Verdict};
use crate::content::LessonId;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Progress {
    pub lessons_read: BTreeSet<LessonId>,
    pub checks_passed: BTreeSet<CheckId>,
}
impl Progress {
    pub fn read_lesson(&mut self, id: &LessonId) { self.lessons_read.insert(id.clone()); }
    pub fn record(&mut self, id: &CheckId, v: Verdict) { if v == Verdict::Correct { self.checks_passed.insert(id.clone()); } }
    pub fn module_mastered(&self, ids: &[CheckId]) -> bool { ids.iter().all(|i| self.checks_passed.contains(i)) }
}
```

- [ ] **Step 4:** export; add `LessonId`/`CheckId` derive `Ord` (needed for BTreeSet — add `PartialOrd, Ord` to their derives in content.rs/check.rs). **Step 5:** `cargo test -p thunk-core` PASS. **Step 6:** Commit `feat(core): progress + mastery`.

## Task 4: thunk-content — embed and load Module 1

**Files:** Create `thunk-content/modules/m1-kernel/{module.ron,01-programs-and-os.md,checks.ron}`, `thunk-content/src/lib.rs`.

- [ ] **Step 1:** Author `module.ron`:

```ron
( id: "m1-kernel", title: "The Kernel", lessons: ["01-programs-and-os"] )
```

- [ ] **Step 2:** Author `01-programs-and-os.md` (real lesson prose, ~40 lines, engineering-not-hacking voice; see Task 10 for the full M1 set).
- [ ] **Step 3:** Author `checks.ron` (`Vec<Check>` in RON, 3+ checks referencing lesson 01).
- [ ] **Step 4: Failing test** in `thunk-content/src/lib.rs`:

```rust
#[test]
fn loads_module_one() {
    let m = Curriculum::module_one();
    assert_eq!(m.id.0, "m1-kernel");
    assert!(!m.lessons.is_empty());
    assert!(m.lessons[0].body.contains("kernel"));
    let checks = Curriculum::module_one_checks();
    assert!(checks.len() >= 3);
    // every check's canonical answer grades Correct
    for c in &checks {
        let a = match c { Check::Choice { answer, .. } => Answer::Choice(*answer), Check::Short { answers, .. } => Answer::Text(answers[0].clone()) };
        assert_eq!(c.grade(&a), Verdict::Correct);
    }
}
```

- [ ] **Step 5:** run, expect FAIL. **Step 6: Implement** loader with `rust-embed` (folder = `modules/`), parse `module.ron` + read each lesson `.md` into `Lesson`, parse `checks.ron`. Add `thunk-core`, `serde`, `ron`, `rust-embed` deps. **Step 7:** `cargo test -p thunk-content` PASS. **Step 8:** Commit `feat(content): embed + load Module 1`.

## Task 5: thunk-sim — SPI bus model + trace

**Files:** Create `thunk-sim/src/spi.rs`, `thunk-sim/src/lib.rs`.

- [ ] **Step 1: Failing test:** an `SimSpi` records every byte written and produces a trace of `TraceEvent`s; a `SpiBus` trait exposes `write(&[u8])`.

```rust
#[test]
fn sim_spi_records_a_trace() {
    let mut bus = SimSpi::new();
    bus.write(&[0x2C, 0xF8, 0x00]);
    let t = bus.trace();
    assert_eq!(t.len(), 3);
    assert_eq!(t[0], TraceEvent::Byte(0x2C));
}
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `SpiBus` trait, `SimSpi { trace: Vec<TraceEvent> }`, `TraceEvent::Byte(u8)`. **Step 4:** PASS. **Step 5:** Commit `feat(sim): SPI bus model + trace`.

## Task 6: thunk-sim — panel framebuffer

**Files:** Create `thunk-sim/src/panel.rs`.

- [ ] **Step 1: Failing test:** a `Panel` of 240x320 RGB565 pixels; `fill(color)` sets all pixels; `set_pixel`/`get_pixel` roundtrip.

```rust
#[test]
fn panel_fills_and_addresses() {
    let mut p = Panel::new(240, 320);
    p.fill(0xF800); // red
    assert_eq!(p.get_pixel(0, 0), 0xF800);
    p.set_pixel(10, 20, 0x07E0);
    assert_eq!(p.get_pixel(10, 20), 0x07E0);
    assert_eq!(p.get_pixel(0, 0), 0xF800);
}
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `Panel { w, h, buf: Vec<u16> }` with bounds-checked accessors. **Step 4:** PASS. **Step 5:** Commit `feat(sim): panel framebuffer (RGB565)`.

## Task 7: thunk-sim — boot a test pattern

**Files:** Create `thunk-sim/src/boot.rs`.

- [ ] **Step 1: Failing test:** `boot_splash(&mut Panel)` draws a deterministic pattern (e.g., color bars); assert specific pixels are the expected bar colors and that not all pixels are equal.

```rust
#[test]
fn boot_splash_draws_color_bars() {
    let mut p = Panel::new(240, 320);
    boot_splash(&mut p);
    let left = p.get_pixel(0, 160);
    let right = p.get_pixel(239, 160);
    assert_ne!(left, right); // bars differ across width
}
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `boot_splash` drawing N vertical color bars. **Step 4:** PASS. **Step 5:** Commit `feat(sim): boot splash test pattern`.

## Task 8: thunk-cli — native entrypoint + subcommands

**Files:** Create `thunk-cli/src/main.rs`, `thunk-cli/src/cmd/{mod.rs,read.rs,check.rs,progress.rs,sim.rs}`.

- [ ] **Step 1:** clap `Cli` with subcommands `Read { lesson: Option<String> }`, `Check`, `Progress`, `Sim`, default (no subcommand) prints module overview.
- [ ] **Step 2:** `read` prints a lesson body to stdout (paginated later in TUI). `check` runs each M1 check interactively on stdin, grading with `Check::grade`. `progress` prints mastery. `sim` builds a `Panel`, runs `boot_splash`, and prints an ASCII downscaled view of the framebuffer to the terminal.
- [ ] **Step 3: Integration test** (`thunk-cli/tests/cli.rs`) using `assert_cmd`: `thunk read 01-programs-and-os` exits 0 and stdout contains "kernel".
- [ ] **Step 4:** run `cargo test -p thunk-cli` PASS. **Step 5:** `cargo run -p thunk-cli -- sim` shows color bars as ASCII. **Step 6:** Commit `feat(cli): read/check/progress/sim subcommands`.

## Task 9: thunk-tui — terminal classroom

**Files:** Create `thunk-tui/` crate; scenes for lesson reader, check, progress, and a panel view rendering the sim framebuffer as colored blocks.

- [ ] **Step 1:** Add `thunk-tui` to workspace; ratatui + crossterm (native), state driven by `thunk-core` + `thunk-content` + `thunk-sim`.
- [ ] **Step 2:** Reader scene: paginate `Lesson.body`; keys: `j/k` scroll, `n` next lesson, `c` enter checks, `s` panel/sim view, `q` quit.
- [ ] **Step 3:** Check scene: render prompt + options, capture answer, show `Verdict`, update `Progress`.
- [ ] **Step 4:** Panel scene: run `boot_splash`, draw the RGB565 framebuffer as half-block colored cells.
- [ ] **Step 5:** Unit-test the scene *state* transitions (pure), not the draw calls. **Step 6:** Wire `thunk` default subcommand to launch the TUI. **Step 7:** Commit `feat(tui): reader + check + panel scenes`.

## Task 10: Author Module 1 content in full

**Files:** `thunk-content/modules/m1-kernel/*.md` + `checks.ron`.

- [ ] **Step 1:** Author lessons 01–05: programs vs OS; the kernel and privilege; syscalls; files & devices; mmap. Engineering voice, ~40–70 lines each, "key terms" footer. (Draw on the proven arc from `~/dev/peek/peek-content/chapters` but rewritten fresh for thunk; do not copy PEEK's game framing.)
- [ ] **Step 2:** Expand `checks.ron` to >= 3 checks per lesson; every canonical answer must grade Correct (Task 4's self-validating test guards this).
- [ ] **Step 3:** Run `cargo test --workspace` PASS. **Step 4:** Commit `content(m1): full Kernel module`.

## Task 11: Review-safety gate

**Files:** `scripts/vocab-lint.sh`, `.github/workflows/ci.yml`.

- [ ] **Step 1:** Port a `vocab-lint.sh` that greps content + source for a denylist of exploitation vocabulary and exits non-zero on a hit (adapt from `~/dev/peek/scripts/vocab-lint.sh`).
- [ ] **Step 2:** Run it locally against the tree — expect clean pass.
- [ ] **Step 3:** CI workflow: `fmt --check`, `clippy -D warnings`, `test --workspace`, `vocab-lint`. **Step 4:** Commit `ci: vocab-lint + fmt/clippy/test gate`.

---

## Self-Review notes
- **Spec coverage:** modes CLI+TUI (Tasks 8,9), one content pipeline (Tasks 1,4,10), simulator slice
  boots on a panel (Tasks 5–7), true-zero M1 authored (Task 10), review-safety (Task 11). Web GUI,
  M0/M2–M5, sim-or-real hardware seam, and DOOM are **Phase 2** — intentionally out of this plan.
- **Type consistency:** `CheckId`/`LessonId`/`ModuleId` are the shared IDs across core/content/cli;
  `Check::grade(&Answer) -> Verdict` is the one grading entry point used by content tests and the CLI.
- **No placeholders:** each task above carries real types/tests; Task 10 prose is authored during
  execution, guarded by Task 4's self-validating loader test.
