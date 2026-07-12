# thunk — Full Build-Out Roadmap (Phase 2 + 3)

> **For agentic workers:** this is a milestone roadmap, not bite-sized tasks. For each milestone, use
> `superpowers:writing-plans` to expand it into failing-test-first TDD tasks, following the format of
> `2026-07-06-thunk-phase1.md`. Then execute with `superpowers:test-driven-development`. Commit per task.

**Goal:** a learner goes from M0 (true zero) to M5 (DOOM on the simulated panel), with competency
gates + placement, the web GUI, two build profiles, and the M6-M7 open-source track scaffolded; plus a
clean README and CI. Everything offline, review-safe, TDD.

**Baseline (already built):** Phase 1 — see `HANDOFF.md`. Do not regress the 24 passing tests.

**Suggested order:** M-A → M-C → M-D → M-B → M-E → M-F → M-G → M-H. (Content and the simulator are the
highest-value; do them first. M-D has a design decision to surface to Penn — see below.)

---

## M-A · Finish the curriculum (content, low risk, high completeness)

Author the remaining modules as `thunk-content` assets (markdown lessons + RON checks), same shape as
Module 1. Engineering voice, "key terms" footer, no exploitation vocabulary.

- **M0 · Power On** — from true zero: what a computer is, 1s and 0s, bits and bytes, what a program is,
  what "code" is, what it means to run something. Read-and-check only (no code execution).
- **M2 · Rust for the Metal** — ownership/borrowing at a plain level, `no_std`, why Rust down here.
- **M3 · The Bus (SPI)** — clock/data/select, how a peripheral is spoken to, bytes on a wire.
- **M4 · The Panel** — framebuffer, pixels, RGB565, addressing a display.
- **M5 · DOOM** — what the finale is and how the pieces connect (concept lesson).
- **M6 · Intro to Open Source** — licenses, version control in the open, projects/communities, reading
  a diff, the culture of merit.
- Retune `AdvanceGate` counts in `thunk-core` to the real per-module check totals.

**TDD:** extend the self-validating loader test (every check's canonical answer grades `Correct`) to
every module; add a test asserting the module list and lesson order load; add a test that stage/module
gates are satisfiable by the authored content (no unreachable modules).
**Acceptance:** `thunk` lists M0-M6; all checks self-validate; `cargo test --workspace` green;
vocab-lint clean.

## M-B · Competency gates + placement

- `thunk-core`: module ordering and gating (module N unlocks when module N-1 is mastered). Reuse
  `Progress::module_mastered`.
- A placement diagnostic: a small set of checks whose passage marks specific modules mastered so an
  experienced learner can skip ahead.
**TDD:** pure gating logic (locked/unlocked given progress); placement logic (given diagnostic answers,
which modules are marked mastered). No I/O in the tests.
**Acceptance:** gating + placement unit-tested; the TUI shows locked/unlocked state.

## M-C · The full simulator (the keystone)

Grow `thunk-sim` from "direct set_pixel" to a real protocol model.

- Model the ILI9341-style command set over SPI: command vs data (the DC concept), init sequence,
  column/page address windows, `RAMWR`, RGB565 pixel writes.
- A `Panel` that **decodes the command/data byte stream from the bus** into framebuffer state (not a
  direct pixel API).
- A learner-facing `Display` driver that performs init + draws a framebuffer by speaking the protocol.
**TDD:** given a byte stream, assert panel state (command decoding, address windowing, pixel writes);
deterministic; the trace records the protocol. Seed-driven where randomness is involved.
**Acceptance:** driving the sim through the SPI command protocol yields the expected framebuffer;
`SimSpi` trace shows the real protocol traffic.

## M-D · DOOM on the simulated panel  *(design decision — surface to Penn)*

The finale renders moving frames to the framebuffer via the `Display` driver over the sim bus.

**Decision to raise with Penn before building:** a fully playable DOOM (doomgeneric = C + a WAD) is
heavier and raises the "game in a facility" risk (see the risk register). Options:
1. A minimal pure-Rust software-rendered "boot a graphical scene" demo (review-safe default, ships on
   the inside build).
2. Real doomgeneric behind the **open** build only, framed strictly as an engineering demonstration.
Recommended: build option 1 as the inside-build finale and gate option 2 behind the open build.
**TDD:** the frame source produces deterministic frames; frames reach the panel over the bus.
**Acceptance:** `thunk sim` boots the finale on the sim panel; inside build ships the non-game version.

## M-E · Trace view (the Saleae echo)

Render the `TraceEvent` stream as a logic-analyzer-style view (TUI first, then web).
**TDD:** trace formatting (given events, expected rendered rows) as pure functions.
**Acceptance:** a trace panel shows the bus traffic from M-C/M-D.

## M-F · The web GUI (offline)

An offline web front-end (localhost `serve` bound to 127.0.0.1, or a static wasm bundle) rendering the
reader + checks + panel + trace from the same content pipeline. Reuse peek's approach (ratzilla +
Trunk) so deps resolve offline. **No external assets, no CDN, no fonts fetched.**
**TDD:** shared render/state logic tested in the core/tui crates; the web layer is a thin adapter.
**Acceptance:** `trunk build` (or `thunk serve`) produces a fully offline experience; renders the course.

## M-G · Two build profiles (inside / open)

Cargo features: `inside` (no hardware/network code compiled in) and `open` (adds the real-hardware
`SpiBus` impl over `spidev` and the M6-M7 open-source track).
**TDD:** a build/test asserting the `inside` profile compiles with no hardware/network code paths
present (not merely disabled).
**Acceptance:** both profiles build; the inside profile contains no hardware/network code.

## M-H · Facilitator kit, clean README, CI

- Facilitator kit: static, offline pacing guide + answer keys + a progress export (no network).
- **Clean top-level `README.md`:** what it is (the value-prop line), quickstart, workspace map, the two
  build profiles, `docs/README.md` index link, license. Keep it tight and professional.
- CI (`.github/workflows/ci.yml`): `fmt --check`, `clippy -D warnings`, `test --workspace`,
  `vocab-lint`, and the wasm build. (Do not push; just define it.)
**Acceptance:** README polished; CI defined; `docs/` and PDFs regenerated and uniform.

---

## Definition of done (whole build-out)
- M0-M6 authored; every check self-validates; gates satisfiable.
- Simulator drives a real protocol; the finale boots on the sim panel; trace view works.
- Web GUI runs fully offline; TUI and CLI unchanged and green.
- Inside/open profiles build; inside has no hardware/network code.
- `cargo fmt` clean, `clippy -D warnings` clean, `cargo test --workspace` green, `vocab-lint` clean.
- Clean README; docs + PDFs uniform; everything committed locally (no push without Penn).
