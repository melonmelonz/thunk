# thunk M-H: Facilitator Kit + Clean README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The optional facilitator layer (FR-18) as a generated static kit plus a progress
export, and the repo's front door (README.md) rewritten to describe the finished product. CI is
already ahead of M-H's bullet (check + web + profiles + static-musl); no CI work here.

**Architecture:** The kit is *generated from the embedded curriculum*, never hand-maintained:
pure functions in a new `thunk-cli/src/kit.rs` render `pacing.md` and `answer-key.md` from
`Curriculum`, and `thunk kit --out DIR` writes them (mirroring `write_site`). The progress view
is `thunk progress --export`: CSV of per-module mastery from the existing RON state, printed to
stdout so a facilitator can redirect it. No network, no new deps, works identically on both
profiles (the kit covers whatever LADDER the build carries).

**Tech Stack:** Rust 1.88, offline, zero new dependencies.

---

### Task 1: kit.rs - the generated pacing guide + answer key

**Files:**
- Create: `thunk-cli/src/kit.rs`
- Modify: `thunk-cli/src/main.rs` (add `mod kit;`)

- [ ] **Step 1: Failing tests** (in kit.rs):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_pacing_guide_covers_the_whole_ladder() {
        let md = pacing_md();
        for m in thunk_content::Curriculum::all() {
            assert!(md.contains(&m.title), "pacing guide missing {}", m.title);
        }
        assert!(md.contains("placement"), "pacing guide must explain placement");
        assert!(!md.contains("http://") && !md.contains("https://"), "kit must be hermetic");
    }

    #[test]
    fn the_answer_key_carries_every_check_and_its_canonical_answer() {
        let md = answer_key_md();
        for m in thunk_content::Curriculum::all() {
            for c in thunk_content::Curriculum::load_checks(&m.id.0) {
                assert!(md.contains(&c.id().0), "answer key missing {}", c.id().0);
                assert!(
                    md.contains(c.canonical_answer().trim()),
                    "answer key missing the answer to {}",
                    c.id().0
                );
            }
        }
        assert!(!md.contains("http://") && !md.contains("https://"));
    }
}
```

Check `thunk-core`'s `Check` API first: the test assumes `canonical_answer() -> String` (it
exists; the content suite uses it). If it returns a `&str` or needs display formatting for
Choice options, adapt the assertion to whatever grades `Correct` - the key must show the answer
a facilitator reads aloud, not an index.

- [ ] **Step 2:** `CARGO_NET_OFFLINE=true cargo test -p thunk-cli` - COMPILE FAIL; observe.
- [ ] **Step 3: Implement** pure generators:
  - `pub fn pacing_md() -> String`: header explaining the kit is generated and offline; a
    "How pacing works" section (self-paced mastery, module gate = every check correct, the
    21-item placement diagnostic lets experienced learners skip ahead - reuse the language of
    `thunk progress`); then one section per module from `Curriculum::all()`: tag, title, the
    lesson list with titles, lesson/check counts, and a suggested rhythm line (one lesson +
    its checks per sitting; the module gate as the session after the last lesson).
  - `pub fn answer_key_md() -> String`: header warning this file is for facilitators; per
    module, per lesson (group checks by the `mN-NN-` prefix convention used everywhere), each
    check as: id, prompt, then the canonical answer (for Choice: the text of the correct
    option; for Short: the canonical accepted answer, with the alternates listed).
  Both derive everything from `thunk_content::Curriculum` - no hardcoded module lists.
- [ ] **Step 4:** PASS; fmt + clippy clean.
- [ ] **Step 5: Commit:** `feat(cli): kit generators - pacing guide + answer key from the curriculum`

---

### Task 2: `thunk kit` + `thunk progress --export`

**Files:** `thunk-cli/src/main.rs`

- [ ] **Step 1: Failing tests** (next to the existing CLI tests):

```rust
#[test]
fn kit_writes_the_facilitator_files_to_disk() {
    let dir = std::env::temp_dir().join(format!("thunk-kit-{}", std::process::id()));
    write_kit(&dir).expect("kit written");
    assert!(dir.join("pacing.md").exists());
    assert!(dir.join("answer-key.md").exists());
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn progress_export_is_csv_with_one_row_per_module() {
    let csv = export_csv(&thunk_core::Progress::default());
    let mut lines = csv.lines();
    assert_eq!(lines.next(), Some("module,title,checks_passed,checks_total,mastered"));
    let ladder = thunk_content::Curriculum::ladder();
    assert_eq!(csv.lines().count(), ladder.len() + 1, "header + one row per module");
    let first = csv.lines().nth(1).unwrap();
    assert!(first.starts_with("m0-power-on,"));
    assert!(first.ends_with(",no"), "empty progress masters nothing");
}
```

(`export_csv` lives in kit.rs with the other pure functions; `write_kit` in main.rs beside
`write_site`, following its exact shape. Check how `progress` currently loads `Progress` from
the state file and reuse that path for the flag. `checks_passed` = count of that module's check
ids the progress marks passed - mirror however `thunk progress` computes its ladder display;
read that code first and reuse its helpers rather than inventing parallel logic.)

- [ ] **Step 2:** COMPILE FAIL; observe.
- [ ] **Step 3: Implement:**
  - kit.rs: `pub fn export_csv(p: &thunk_core::Progress) -> String` - header row exactly as the
    test pins, then per `Curriculum::ladder()` entry: dir, title (comma-safe: titles contain no
    commas today; assert or escape by quoting if one ever does), passed/total, `yes`/`no`.
  - main.rs: `Kit { #[arg(long, default_value = "thunk-kit")] out: PathBuf }` subcommand +
    `write_kit` (create dir, write both files, print the one-line summary like `web` does);
    `--export` flag on the existing `Progress` subcommand: when set, print `export_csv` of the
    loaded progress instead of the ladder view.
- [ ] **Step 4:** PASS. Full gates: fmt, clippy --workspace --all-targets, cargo test --workspace,
  clippy/test with `-p thunk-cli --features open` (the kit must compile and its tests pass under
  the open profile too - the generators follow LADDER, so open output simply includes M7),
  vocab-lint. Eyeball: `cargo run -q -p thunk-cli -- kit --out /tmp/kit-check && head -40
  /tmp/kit-check/pacing.md /tmp/kit-check/answer-key.md`, and `cargo run -q -p thunk-cli --
  progress --export`.
- [ ] **Step 5: Commit:** `feat(cli): thunk kit + progress --export - the facilitator layer`

---

### Task 3: The clean README

**Files:** `README.md` (top-level)

Rewrite to describe the finished product. Required shape (roadmap M-H): what it is with the
value-prop line, quickstart, workspace map, the two build profiles, docs index link, license.
Tight and professional; plain sentences; no em dashes; no hype adjectives; nothing the repo
cannot back.

- [ ] Content contract (verify each claim against the repo while writing):
  - Title + the canonical value-prop line (from `docs/thunk-value-proposition.html`).
  - What it is: 7 modules M0-M6 (M7 on the open build), fully offline, three front-ends (CLI,
    TUI, local web), the simulator finale, competency gates + placement.
  - Quickstart: build offline note (`CARGO_NET_OFFLINE=true cargo build --release`), then
    `thunk tui` / `read` / `check` / `progress` (+ `--export`) / `sim` (+ `--trace`) / `web` /
    `serve` / `kit`, one line each.
  - The two build profiles: default = inside (no hardware code in the graph, enforced by
    `scripts/profile-audit.sh` + CI); `--features open` adds the real SPI/GPIO backend
    (`thunk hw`) and M7 First Patch.
  - Workspace map: all 7 crates, one line each.
  - Verification: the gates (fmt, clippy -D warnings, test, vocab-lint, profile-audit) and the
    current test count - read it from a fresh `cargo test --workspace` run, do not guess.
  - Docs: link `docs/README.md`. License: MIT OR Apache-2.0, link both files.
  - Status: built and tested; local repo; the finale is the simulated corridor scene (playable
    DOOM is an open-build follow-up); facilitator kit generated by `thunk kit`.
- [ ] Gate + commit: `docs: README for the finished product - profiles, kit, the whole ladder`

---

### Task 4: Sweep

- [ ] Full gate both profiles (fmt, clippy x2, test x2, vocab-lint, profile-audit). Annotate M-H
DONE in the buildout roadmap (note CI was already complete before M-H started; kit + README were
the delivered halves) and this plan's header. Update `docs/README.md` index if the kit warrants a
line (it is a generated artifact, not a doc - likely no entry; decide and say so in the commit).
Commit: `chore(mH): verification sweep - the buildout definition of done, met`

---

## Self-Review notes

- FR-18 coverage: pacing (Task 1), answer keys (Task 1), progress view (Task 2's export; the TUI
  ladder remains the learner-facing view). "Static, offline, no network" enforced by the hermetic
  assertions in both Task 1 tests.
- No placeholders: tests are concrete; the two API uncertainty points (canonical_answer's exact
  type, progress's load path) are flagged with explicit read-first instructions rather than
  invented signatures.
- Type consistency: `pacing_md()/answer_key_md() -> String`, `export_csv(&Progress) -> String`,
  `write_kit(&Path) -> io::Result<()>` shaped like `write_site`.
