# thunk

*A systems course for justice-impacted learners. Offline, from the ground up.*

**Working title (renameable).** A free, self-contained, offline Rust course that teaches the low
level of a computer from true zero, ending with DOOM booting on a display the learner drove from the
metal up. Simulator-first, so it runs on a locked-down machine with no hardware and no network; the
same course drives real hardware (SPI display + Saleae) on the open build.

A *thunk* is a piece of code that gets set aside and run later, not thrown away.

Deliberately **not** built on the PEEK repo — new thing, course-first, no game mascot.

## Build and run

```sh
cargo run -p thunk-cli               # course overview
cargo run -p thunk-cli -- read       # read a lesson
cargo run -p thunk-cli -- check      # list Module 1 checks
cargo run -p thunk-cli -- sim        # boot the simulated panel (ASCII)
cargo test --workspace               # all tests
./scripts/vocab-lint.sh              # course-appropriate language gate
```

## Workspace

- `thunk-core` — domain logic: content model, check evaluation, progress/mastery.
- `thunk-content` — the curriculum, embedded at compile time (Module 1: The Kernel).
- `thunk-sim` — deterministic SPI bus + display panel model; the sim-or-real seam.
- `thunk-cli` — the `thunk` binary (read / check / progress / sim).

## Docs

- [`docs/PITCH.md`](docs/PITCH.md) — one-page pitch, for teachers and sponsors.
- [`docs/PROPOSAL.md`](docs/PROPOSAL.md) — full proposal (Next Chapter mentors).
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — implementation plans.
- North-star design spec: `~/docs/superpowers/specs/2026-07-06-thunk-design.md`.

## Status

Phase 1 in progress. **Done:** the four-crate workspace, Module 1 (The Kernel) authored end to end
(5 lessons, 15 checks), the content pipeline into the CLI, the first simulator slice (SPI trace +
panel framebuffer + a boot splash), offline static build, licenses, and the vocab-lint gate. All
tests pass. **Next:** the TUI classroom, then Phase 2 (full SPI/panel/DOOM simulator, the web GUI,
and the real-hardware seam). Demoable at the Aug 2026 Next Chapter demo.
