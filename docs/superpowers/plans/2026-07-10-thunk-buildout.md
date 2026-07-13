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

**Status: DONE 2026-07-12.** M0-M6 authored (7 modules, 31 lessons, 93 checks); validation suite (ladder order, self-validating checks, per-lesson coverage, unique ids, orphan detection, gate satisfiability); CLI spans the ladder; workspace at 32 tests, clippy and vocab-lint clean. AdvanceGate note: no such type existed; per-module counts are data-driven via load_checks(); gating itself is M-B.

## M-B · Competency gates + placement

- `thunk-core`: module ordering and gating (module N unlocks when module N-1 is mastered). Reuse
  `Progress::module_mastered`.
- A placement diagnostic: a small set of checks whose passage marks specific modules mastered so an
  experienced learner can skip ahead.
**TDD:** pure gating logic (locked/unlocked given progress); placement logic (given diagnostic answers,
which modules are marked mastered). No I/O in the tests.
**Acceptance:** gating + placement unit-tested; the TUI shows locked/unlocked state.

**Status: DONE 2026-07-12.** Gating (`ladder_state`) + placement (`evaluate_placement`, a 21-item
diagnostic drawn from existing banks) pure and unit-tested in `thunk-core`; progress persists to a
local RON state file (`THUNK_STATE_DIR`/XDG override, no I/O in core); the TUI home is the gated
module ladder with a placement scene; `thunk progress` prints the gated ladder. Workspace at 77+
tests.

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

**Status: DONE 2026-07-12.** Bus models select edges + DC (trace-complete); `Ili9341` decodes the
byte stream (SWRESET/SLPOUT/DISPON/DISPOFF/CASET/PASET/RAMWR/COLMOD, window wrap, replay);
learner-facing `Display` speaks init/window/RAMWR with batched writes; splash renders end-to-end
through the protocol; CLI `sim` reports the traffic (153,620 events); TUI panel decodes from the
trace. Workspace at 50 tests, clippy + vocab-lint clean.

## M-D · DOOM on the simulated panel  *(design decision — surface to Penn)*

The finale renders moving frames to the framebuffer via the `Display` driver over the sim bus.

**Decision (Penn, 2026-07-12): resolved.** Option 1 ships as the inside-build finale; playable DOOM
lives on the **open** build only ("doom part could even be on the outside"). Original options kept
for the record:
1. A minimal pure-Rust software-rendered "boot a graphical scene" demo (review-safe default, ships on
   the inside build).
2. Real doomgeneric behind the **open** build only, framed strictly as an engineering demonstration.
**TDD:** the frame source produces deterministic frames; frames reach the panel over the bus.
**Acceptance:** `thunk sim` boots the finale on the sim panel; inside build ships the non-game version.

**Design notes inherited from the M-C review (address in the M-D plan):**
- `SimSpi` trace growth is unbounded (~300 KB per full frame). Animation needs a drain-style API
  (`take_trace()` or a consumed cursor); `Ili9341::replay` is already incremental-friendly.
- `Display<'b, B>` borrows its bus; persistent animation state will fight the lifetime. A blanket
  `impl<B: SpiBus + ?Sized> SpiBus for &mut B` lets `Display<B>` own the bus generically.
- Seam policy decision for the open build: `SpiBus` is infallible and timeless by design (real
  impl wraps errors/delays outside the trait) - document it, or grow the trait before a second
  implementor exists. SWRESET/SLPOUT settle delays live outside the sim.

**Status: DONE 2026-07-12.** The inside-build finale is a deterministic integer-math corridor scene
rendered through the Display driver over the bus (boot_finale/finale_tick + take_trace drain);
`thunk sim` boots it (--splash keeps the bars); the TUI panel scene animates it at a 60ms tick.
Playable DOOM remains open-build work under M-G, per Penn's decision. Workspace at 60+ tests,
clippy + vocab-lint clean.

## M-E · Trace view (the Saleae echo)

Render the `TraceEvent` stream as a logic-analyzer-style view (TUI first, then web).
**TDD:** trace formatting (given events, expected rendered rows) as pure functions.
**Acceptance:** a trace panel shows the bus traffic from M-C/M-D.

**Status: DONE 2026-07-12.** Pure formatting in `thunk-sim/src/trace.rs`: `annotate()` (named
commands + glosses, select edges, data runs grouped to one row) and `waveform()` (a byte as the M3
lesson diagram; hand-derived literals machine-checked by a 256-value property test); the command
byte table lives in `trace.rs` and the `Ili9341` decoder imports it (one table, two users). TUI
Trace scene (`t` from the panel; j/k cursor with a per-row waveform; boot transaction at start,
latest frame after each tick; annotation on demand, never on Tick) plus `thunk sim --trace` for
the CLI. Web rendering stays M-F's job. Workspace at 96 tests, clippy + vocab-lint clean.

## M-F · The web GUI (offline)

An offline web front-end (localhost `serve` bound to 127.0.0.1, or a static wasm bundle) rendering the
reader + checks + panel + trace from the same content pipeline. Reuse peek's approach (ratzilla +
Trunk) so deps resolve offline. **No external assets, no CDN, no fonts fetched.**
**TDD:** shared render/state logic tested in the core/tui crates; the web layer is a thin adapter.
**Acceptance:** `trunk build` (or `thunk serve`) produces a fully offline experience; renders the course.

**Status: DONE 2026-07-13** (built 2026-07-12; sweep closed 07-13). Deviation from the text above,
recorded: the UI/UX research (`docs/research/ui-ux-research.md`) overturned ratzilla+Trunk/wasm on
accessibility grounds; M-F shipped plain Rust-generated semantic HTML instead. `thunk-web` crate
(pure functions to HTML/CSS: constrained markdown renderer, page shell + design tokens, course
pages, client-side check grading with aria-live verdicts, run-length panel SVG + annotated trace);
`thunk web --out DIR` writes the site (42 files, works from file://), `thunk serve` binds 127.0.0.1
only; hermetic CI `web` job (zero external URLs, enforced by test AND grep); two themes (dark
gantry / light datasheet) with screenshots in `docs/screenshots/`. One open follow-up: fonts are
deliberately system-stack until IBM Plex files can be added and subset offline. Workspace at 118
tests, clippy + vocab-lint clean.

## M-G · Two build profiles (inside / open)

Cargo features: `inside` (no hardware/network code compiled in) and `open` (adds the real-hardware
`SpiBus` impl over `spidev` and the M6-M7 open-source track).
**TDD:** a build/test asserting the `inside` profile compiles with no hardware/network code paths
present (not merely disabled).
**Acceptance:** both profiles build; the inside profile contains no hardware/network code.

**Status: DONE 2026-07-13.** The inside profile is the *default build*: the hardware crate is
absent from its dependency graph, not disabled (asserted by `scripts/profile-audit.sh` via
`cargo tree`, run locally and by the CI `profiles` job, which also builds and tests the open
profile). `--features open` adds `thunk-hw` (hand-rolled spidev + GPIO v2 char-device backend
over libc - the spidev crate is not in the offline cache; ioctl numbers and struct layouts
pinned to the kernel ABI by tests, verified against this box's uapi headers) behind the same
infallible `SpiBus` seam (first-error latch + `take_error()`; SWRESET/SLPOUT settle inside the
bus, long resets in the caller), plus `thunk hw` (drives the finale on real wires; manual test
is the BeaglePlay bench) and the M7 First Patch module (three lessons + nine checks living in
`modules-open/`, a second cfg-gated embed root - rust-embed's `exclude` needs globset, absent
offline). Placement stays M0-M6 on every build. On the acceptance line's
"no network code": the inside binary's only socket surface is M-F's deliberate loopback-only
`serve` (binds 127.0.0.1 explicitly, tested); there are no network dependencies in the inside
graph. Playable DOOM on the open build remains the named follow-up: doomgeneric + a WAD need
network access this sandbox does not have. Workspace at 127 tests inside / 130 open, clippy +
vocab-lint + profile-audit clean.

## M-H · Facilitator kit, clean README, CI

- Facilitator kit: static, offline pacing guide + answer keys + a progress export (no network).
- **Clean top-level `README.md`:** what it is (the value-prop line), quickstart, workspace map, the two
  build profiles, `docs/README.md` index link, license. Keep it tight and professional.
- CI (`.github/workflows/ci.yml`): `fmt --check`, `clippy -D warnings`, `test --workspace`,
  `vocab-lint`, and the wasm build. (Do not push; just define it.)
**Acceptance:** README polished; CI defined; `docs/` and PDFs regenerated and uniform.

---

## Penn's directives (2026-07-12, verbatim intent)

Recorded from Penn at build-out kickoff; these steer M-D through M-H and add follow-on spec work:

- **Review posture:** all fine with the review as designed. The DOOM part can live on the outside
  (open build); the in-facility material stays very real.
- **In-facility deliverables are real:** budgets, real hardware lists, a real program document for
  facilities.
- **Lean heavy on after-release** in case facility access never lands. A separate hosted website for
  people once they are out (accounts, security, cutting-edge stack) is on the table as its own
  spec - it is *not* part of the offline core, which stays self-contained Rust, totally offline.
- **UI/UX:** gorgeous web GUI in the minimal spirit of monkeytype.com (the inspiration is the slick,
  unique, distraction-free feel, not the typing product). Do real UI/UX research before M-F; nothing
  gimmicky, no AI slop; the repo will be audited by real engineers.
- **Modes:** web GUI, TUI/CLI, and a MUD-style interface are all in scope as packagings of the one
  content source.
- **Curriculum flavor:** starts at 1s and 0s, builds toward systems thinking; onboards people to open
  source, contributions, Linux, heavy command-line fluency, possibly vim.
- **Craft:** secure by default, clean idiosyncratic code, TDD throughout with screenshots of the TDD
  rhythm in the repo, Penn's prose voice kept throughout.

## Definition of done (whole build-out)
- M0-M6 authored; every check self-validates; gates satisfiable.
- Simulator drives a real protocol; the finale boots on the sim panel; trace view works.
- Web GUI runs fully offline; TUI and CLI unchanged and green.
- Inside/open profiles build; inside has no hardware/network code.
- `cargo fmt` clean, `clippy -D warnings` clean, `cargo test --workspace` green, `vocab-lint` clean.
- Clean README; docs + PDFs uniform; everything committed locally (no push without Penn).
