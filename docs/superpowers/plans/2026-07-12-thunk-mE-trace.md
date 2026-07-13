# thunk M-E: Trace View (the Saleae Echo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logic-analyzer-style view of the bus traffic: pure formatting functions in `thunk-sim`
(annotated protocol rows with command names and grouped data runs; a per-byte waveform matching the
M3 lesson diagrams), a TUI Trace scene fed by the live sim traffic, and `thunk sim --trace` for the
CLI. The learner sees the same trace the M3/M4 lessons taught them to read.

**Architecture:** All formatting is pure functions over `&[TraceEvent]` in a new
`thunk-sim/src/trace.rs` (TDD with exact expected strings). The TUI keeps two traces on `App`: the
boot transaction (init + frame 0) captured at startup, and the most recent animation frame's
drained trace; the Trace scene (key `t` from the Panel scene) renders annotated rows with a
selectable cursor and shows the selected byte's waveform. Command names come from the same
constants the decoder uses (single source of truth: re-export or share them).

**Tech Stack:** Rust 1.88, zero new dependencies.

**Status: executed 2026-07-12; all 4 tasks done.** Task 2's waveform literals were re-derived on
paper as instructed (37 columns, 4-char cells; the plan's illustrative strings were inconsistent)
and machine-checked by a 256-value property test. Command constants live in `trace.rs`; the
decoder imports them.

---

## File Structure

```
thunk-sim/src/trace.rs   # NEW: annotate(), waveform(), shared command-name lookup
thunk-sim/src/ili9341.rs # MODIFY: pub(crate) command consts move to a shared location or
                         #         a `pub fn command_name(u8) -> Option<&'static str>` in trace.rs
thunk-sim/src/lib.rs     # exports
thunk-tui/src/app.rs     # MODIFY: boot_trace + frame_trace fields, Scene::Trace, Action::OpenTrace
thunk-tui/src/ui.rs      # MODIFY: render_trace
thunk-tui/src/lib.rs     # MODIFY: key map ('t' in Panel; j/k/Esc in Trace)
thunk-cli/src/main.rs    # MODIFY: sim gains --trace
```

---

### Task 1: `annotate` - protocol rows with names and grouped data runs

**Files:** Create `thunk-sim/src/trace.rs`; modify `lib.rs`, `ili9341.rs`.

- [ ] **Step 1: Failing tests:**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::spi::{Dc, TraceEvent};

    fn byte(value: u8, dc: Dc) -> TraceEvent {
        TraceEvent::Byte { value, dc }
    }

    #[test]
    fn annotate_names_commands_and_groups_data() {
        let events = vec![
            TraceEvent::SelectLow,
            byte(0x2A, Dc::Command),
            byte(0x00, Dc::Data),
            byte(0x0A, Dc::Data),
            byte(0x00, Dc::Data),
            byte(0x14, Dc::Data),
            byte(0x2C, Dc::Command),
            byte(0xF8, Dc::Data),
            byte(0x00, Dc::Data),
            byte(0x07, Dc::Data),
            byte(0xE0, Dc::Data),
            TraceEvent::SelectHigh,
        ];
        assert_eq!(
            annotate(&events),
            vec![
                "select v  (transaction begins)".to_string(),
                "cmd  2A  CASET  (column window)".to_string(),
                "data 00 0A 00 14".to_string(),
                "cmd  2C  RAMWR  (pixel stream follows)".to_string(),
                "data F8 00 07 E0".to_string(),
                "select ^  (transaction ends)".to_string(),
            ]
        );
    }

    #[test]
    fn long_data_runs_are_summarized() {
        let mut events = vec![TraceEvent::SelectLow, byte(0x2C, Dc::Command)];
        events.extend((0..64).map(|i| byte(i as u8, Dc::Data)));
        events.push(TraceEvent::SelectHigh);
        let rows = annotate(&events);
        assert_eq!(rows.len(), 4);
        assert_eq!(rows[2], "data 00 01 02 03 04 05 06 07 ... (64 bytes)");
    }

    #[test]
    fn unknown_commands_are_still_shown() {
        let rows = annotate(&[byte(0xD9, Dc::Command)]);
        assert_eq!(rows, vec!["cmd  D9  (unknown)".to_string()]);
    }
}
```

- [ ] **Step 2:** COMPILE FAIL; observe.
- [ ] **Step 3: Implement.** `pub fn command_name(c: u8) -> Option<&'static str>` (SWRESET, SLPOUT,
DISPOFF, DISPON, CASET, PASET, RAMWR, COLMOD) with the parenthetical glosses used above living in a
second lookup `fn command_gloss(c: u8) -> &'static str` ("column window", "page window",
"pixel stream follows", "16-bit color" for COLMOD, "wake", "reset", "display on"/"off", "" for
unknown - match the test strings exactly where tested; untested glosses are your call but keep them
short and engineering-plain). `annotate` walks events, folds consecutive Data bytes into one row
(first 8 shown, then `... (N bytes)` when N > 8; exact format per the tests). Refactor
`ili9341.rs`'s private consts to use `trace::command_name`-compatible values or simply leave the
decoder's consts and define the names in trace.rs - do NOT duplicate the hex values in two match
tables reviewers must keep synchronized; one table, used by both (decoder matches on consts,
trace.rs owns `const SWRESET: u8` etc. re-exported to the decoder, or vice versa - pick one, note it).
- [ ] **Step 4:** PASS; workspace green. **Step 5: Commit:** `feat(sim): trace annotation - named commands, grouped data runs`

---

### Task 2: `waveform` - one byte as the M3 lesson diagram

- [ ] **Step 1: Failing test:**

```rust
#[test]
fn waveform_draws_the_m3_lesson_diagram() {
    let w = waveform(0x2C);
    assert_eq!(
        w,
        [
            "bit    0   0   1   0   1   1   0   0".to_string(),
            "clk  _/\\__/\\__/\\__/\\__/\\__/\\__/\\__/\\_".to_string(),
            "data ____________/~~~\\____/~~~~~~~\\______".to_string(),
        ]
    );
}
```

Wait - hand-verify before writing the expected `data` row: 8 ticks, MSB first, 0x2C = 00101100.
Data high during bits 3 (value 1), 5 and 6 (11). Draw each tick as a 4-char cell; data cell is
`~~~~` when the bit is 1, `____` when 0, with `/` and `\\` transitions where the level changes.
Derive the exact expected strings by hand in the test (the three rows must be mutually consistent:
same cell width, aligned columns; adjust the literal above to whatever your 4-char-cell derivation
produces BEFORE running - the test is the specification, so get it right on paper first, then make
the code match it). Rules: `bit` row shows the 8 bits centered per cell; `clk` row shows one
`_/\\_`-style pulse per cell; `data` row holds level per bit with clean transitions.

- [ ] **Step 2:** FAIL; observe. **Step 3: Implement** `pub fn waveform(byte: u8) -> [String; 3]`.
- [ ] **Step 4:** PASS. Also add a property test: for every byte value 0..=255, the three rows have
equal display width. **Step 5: Commit:** `feat(sim): per-byte waveform - the lesson diagram as a function`

---

### Task 3: TUI Trace scene

- [ ] **Step 1: Failing tests** (app.rs, using the established `test_app()` harness):

```rust
#[test]
fn the_trace_scene_opens_from_the_panel_and_returns() {
    let mut app = test_app();
    app.update(Action::OpenPanel);
    app.update(Action::OpenTrace);
    assert_eq!(app.scene, Scene::Trace);
    app.update(Action::Back);
    assert_eq!(app.scene, Scene::Panel);
}

#[test]
fn the_boot_trace_is_kept_and_annotated() {
    let app = test_app();
    let rows = app.trace_rows();
    assert!(rows.iter().any(|r| r.contains("RAMWR")), "boot trace shows the write:\n{rows:?}");
    assert!(rows.iter().any(|r| r.contains("153600 bytes") || r.contains("bytes)")),
        "pixel run is grouped:\n{rows:?}");
}

#[test]
fn trace_cursor_moves_and_selects_a_byte_waveform() {
    let mut app = test_app();
    app.update(Action::OpenPanel);
    app.update(Action::OpenTrace);
    let before = app.trace_sel;
    app.update(Action::SelectNext);
    assert_eq!(app.trace_sel, before + 1);
    // the selected row's first byte, if any, has a waveform
    assert!(app.selected_waveform().is_some() || app.trace_rows().len() <= 1);
}
```

- [ ] **Step 2:** COMPILE FAIL; observe.
- [ ] **Step 3: Implement** (shape): `App` keeps `boot_trace: Vec<TraceEvent>` (captured in
`with_state_dir` instead of discarding after replay - clone before replay or replay from the kept
vec), and replaces it with the latest frame's drained trace on each `Tick` (field rename:
`trace: Vec<TraceEvent>` holding "the most recent transaction's events": boot at start, latest
frame afterward). `trace_rows()` = `thunk_sim::trace::annotate(&self.trace)`. `trace_sel: usize`
clamped to rows; `selected_waveform()` finds the first `Byte` event backing the selected row and
returns `waveform(value)`. `Scene::Trace`; `Action::OpenTrace`; keys: `t` in Panel opens, `j/k`
move the cursor, `Esc`/`Back` returns to Panel. ui.rs `render_trace`: annotated rows as a list
(cursor highlighted), the selected byte's three waveform rows in a block beneath, and a one-line
hint ("this is the traffic your driver put on the bus; M3 taught you to read it").
- [ ] **Step 4:** Green; clippy; fmt. Note: keeping a full frame trace (~154k events) on App is
~600 KB - acceptable; do NOT annotate it eagerly per frame (annotate() grouping makes it ~10 rows;
compute in trace_rows() on demand, and only when the Trace scene is visible if profiling shows it
matters - it should not, grouping is O(n) over 154k = fine per keypress but NOT per Tick: ensure
render only calls trace_rows() in the Trace scene, and Tick does not).
- [ ] **Step 5: Commit:** `feat(tui): trace scene - the Saleae echo, live from the sim bus`

---

### Task 4: CLI `sim --trace` + sweep

- [ ] **Step 1: Failing test:**

```rust
#[test]
fn sim_trace_prints_annotated_protocol_rows() {
    let s = sim(false, true);
    for needle in ["SWRESET", "CASET", "RAMWR", "bytes)"] {
        assert!(s.contains(needle), "missing {needle:?}:\n{s}");
    }
}
```

- [ ] **Step 2:** FAIL (sim signature). **Step 3:** `Sim { splash: bool, /// Print the annotated bus trace instead of the panel. #[arg(long)] trace: bool }`;
`sim(splash, trace)`: when `trace`, print the annotated rows (all of them - grouping keeps it
short) instead of the ASCII panel, after the same drive. Existing tests updated for the signature.
- [ ] **Step 4:** Green; eyeball `cargo run -q -p thunk-cli -- sim --trace` (include in report).
- [ ] **Step 5:** Full sweep (fmt, clippy -D warnings, workspace tests, vocab-lint). Annotate M-E
in the buildout roadmap: **Status: DONE 2026-07-12** + substance. Annotate this plan's header.
- [ ] **Step 6: Commit:** `feat(cli): sim --trace; chore(mE): sweep` (split if cleaner).

---

## Self-Review notes

- **Spec coverage vs M-E:** trace formatting as pure functions with exact-expectation TDD (Tasks
  1-2); a TUI trace panel showing the real M-C/M-D traffic (Task 3); web rendering of the trace is
  M-F's job by design. CLI access as a bonus (Task 4).
- **Type consistency:** `annotate(&[TraceEvent]) -> Vec<String>`, `waveform(u8) -> [String; 3]`,
  `command_name(u8) -> Option<&'static str>` used identically across tasks.
- **One risk called out:** Task 2's expected strings must be hand-derived before implementation;
  the plan instructs the implementer to fix the literals on paper first (the M3 diagrams went
  through the same discipline and a machine check).
- **No placeholders:** exact tests everywhere; Task 3's shape list names every field/action/key.
