# thunk — Session Handoff

**Read this first.** The project is designed and Phase 1 is built and green. The job for the next
session is to **build the entire product out, test-first (full TDD), with a clean README.** This doc
orients a fresh session that has none of the prior conversation.

## Where things stand (done)

- **Phase 1 built + all tests green.** Cargo workspace: `thunk-core` (content model, check grading,
  progress/mastery), `thunk-content` (Module 1: 5 lessons, 15 checks, embedded), `thunk-sim` (SPI bus
  model + trace, RGB565 panel, boot splash over the bus), `thunk-tui` (reader/checks/panel/help),
  `thunk-cli` (`thunk` binary: read/check/progress/sim/tui). **24 tests.** Offline static build,
  `scripts/vocab-lint.sh`, dual MIT/Apache license.
- **Full docs package** in markdown + HTML + PDF: pitch, 3-minute pitch, proposal, PRD, design spec,
  value proposition, mentor addendum (market realism / accessibility / retention), 15-row risk
  register. Index: `docs/README.md`. PDFs in `docs/pdf/`.
- **Value proposition (Penn's line):** "thunk is a reentry utility that teaches programming at a
  fundamental level; from 1s and 0s up through Rust, we help onboard justice-impacted individuals to
  the world of open source as a career-building initiative."
- **Name:** thunk (locked). Deferred code that runs later; also the folk past tense of think.

## The goal

Build the entire product per `docs/PRD.md` and `docs/DESIGN-SPEC.md`, test-first, so a learner can go
from **M0 (true zero) to M5 (DOOM on the simulated panel)**, with competency gates + placement, the
web GUI, the two build profiles, and the M6-M7 open-source track scaffolded. Plus a clean top-level
README. The roadmap is `docs/superpowers/plans/2026-07-10-thunk-buildout.md`.

## How we work (non-negotiables)

- **TDD, always.** Use the `superpowers:test-driven-development` skill. Failing test first, watch it
  fail, minimal impl, green, commit. The existing crates model this (pure, tested core).
- **Offline builds.** The sandbox has no network. Build/test with
  `CARGO_NET_OFFLINE=true cargo test --workspace`. The crate cache is populated from `~/dev/peek`'s
  dependencies, so deps already used by peek/thunk resolve offline. **A brand-new dependency not in
  that cache will fail offline** — prefer already-cached crates, and flag Penn if you truly need a new one.
- **Toolchain:** cargo 1.88 at `~/.cargo/bin`. Keep CI-green locally: `cargo fmt`, `cargo clippy
  --workspace --all-targets` (deny warnings), `cargo test --workspace`, `./scripts/vocab-lint.sh`.
- **Review-safety is the whole product.** Offline, no network/sockets, no crypto, no exploitation
  vocabulary. Framing is engineering, not hacking. The **inside** build must compile with no
  hardware/network code present at all (feature-gate it).
- **Docs stay uniform.** Designed HTML → PDF: `weasyprint <file>.html docs/pdf/<file>.pdf`. Markdown
  docs (PRD/spec/pitch) → PDF: `python3 docs/build/md2pdf.py`. Mirror deliverables to `~/Downloads`.
- **Prose voice.** Pitch / proposal / value-prop are **Penn's voice**: plain, concrete, **no em
  dashes**, no manufactured aphorisms or corny closings (see the `reference_penn_voice` memory —
  read `~/Documents/personal/applications/app.pdf` before writing long-form in his voice). PRD /
  spec / risk are neutral technical register.
- **Git.** Local repo, no remote yet. Commit frequently, **ASCII** commit messages. Intended remote
  is `github.com/melonmelonz/thunk` (Penn's) — **do not push without Penn asking.** Never push to an
  upstream you don't own.
- **Do not rebuild PEEK** (`~/dev/peek`). thunk is a separate, fresh project; only its *values* carry.

## Read next, in order

1. `docs/PRD.md` — requirements (functional FR-*, non-functional NFR-*).
2. `docs/DESIGN-SPEC.md` — architecture, the sim-or-real seam, the ladder, review-safety.
3. `docs/superpowers/plans/2026-07-10-thunk-buildout.md` — the build-out roadmap. Expand each
   milestone into bite-sized TDD tasks with `superpowers:writing-plans`.
4. `docs/superpowers/plans/2026-07-06-thunk-phase1.md` — the Phase 1 plan; use as the template for
   task granularity and TDD rhythm.
5. The auto-memory `project_thunk.md` loads automatically and has the full running context.

## Quick verify (run first to confirm the baseline is green)

```sh
cd ~/dev/thunk
CARGO_NET_OFFLINE=true cargo test --workspace      # expect all green (24+)
CARGO_NET_OFFLINE=true cargo clippy --workspace --all-targets
./scripts/vocab-lint.sh                             # expect: clean
CARGO_NET_OFFLINE=true cargo run -q -p thunk-cli -- sim   # boot splash as ASCII
```
