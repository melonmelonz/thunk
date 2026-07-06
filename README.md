# kern

*A systems course for justice-impacted learners. Offline, from the ground up.*

**Working title (renameable).** A free, self-contained, offline Rust course that teaches the low
level of a computer from true zero, ending with DOOM booting on a display the learner drove from the
metal up. Simulator-first, so it runs on a locked-down machine with no hardware and no network; the
same course drives real hardware (SPI display + Saleae) on the open build.

Deliberately **not** built on the PEEK repo — new thing, course-first, no game mascot.

## Docs

- [`docs/PITCH.md`](docs/PITCH.md) — one-page pitch, for teachers and sponsors.
- [`docs/PROPOSAL.md`](docs/PROPOSAL.md) — full proposal (Next Chapter mentors).
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — implementation plans.
- North-star design spec: `~/docs/superpowers/specs/2026-07-06-kern-design.md`.

## Status

Design complete; Phase 1 build starting. Phase 1 = content pipeline → CLI + TUI, the Kernel module
authored end to end, and a first simulator slice; demoable at the Aug 2026 Next Chapter demo.
