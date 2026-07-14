# thunk public course site - design + product spec

**Status:** spec'd 2026-07-14. Art direction chosen by Penn: **Calibrated PVM lab**. Mandate
(verbatim intent): total redo of style/UI/UX from the ground up; gorgeous, pro SPA; slick,
nothing over the top; custom everything, no generic slop; a minimal achievement system with
experience; the virtual screen that shows bus events and eventually DOOM is the centerpiece.
Companion: `docs/research/spa-tech-research.md` (binding for stack choices).

## 1. What this is

A new public course site - a SvelteKit SPA at its own CF Pages project - that presents the whole
curriculum beautifully and runs the REAL simulator in the browser. It replaces the offline
bundle as the public face. The offline bundle (`thunk web`) remains the facility artifact and
later inherits this design language; it is not this spec's concern beyond token reuse.

Three renderers, one content source, unchanged: binary/TUI (facility), static bundle (facility
web), and this site (the world).

## 2. Architecture (per the tech research, decisive)

- SvelteKit 2 + Svelte 5 runes + Vite 7, `@sveltejs/adapter-static`, fully prerendered,
  SPA client-side nav + View Transitions (onNavigate pattern). No server logic.
- `site/` in this repo; `site/wasm/thunk-wasm` = thin wasm-bindgen crate wrapping thunk-sim
  (verified dep-free), excluded from the cargo workspace (`exclude = ["site/wasm"]`) so the
  inside build and profile-audit are untouched.
- Content: `thunk export --json` (new CLI subcommand, serde_json) emits content.json consumed
  at build; CI freshness assertion so it cannot go stale.
- The bench: thunk-wasm owns a fixed RGBA buffer, converts RGB565 in Rust, `putImageData` to a
  240x320 canvas (research: comfortably 60fps); trace crosses the boundary as flat typed
  arrays, never serde-per-event.
- Fonts self-hosted woff2 (fontsource or manual subset), preloaded, no CDN.
- Deploy: second CF Pages project (`thunk-course`), wrangler direct upload; CI `site` job
  builds node + wasm and runs the freshness check. The old `thunk` Pages project keeps serving
  the offline bundle until cutover, then redirects or retires (Penn's call at cutover).

## 3. Design language - Calibrated PVM lab

The site is an instrument that was calibrated by someone who cared. Precision, restraint,
one phosphor.

**Tokens (draft; tune on real renders):**
- bg `#0A0E13` blue-black; surface ladder `#0E1319` / `#111722` / `#151C25` (borders lighten,
  never shadows-on-black)
- text `#C9D4E0`, muted `#7C8A9C`, faint `#4A5563`
- accent: phosphor green `#3DF0A8` (the ONE color; state, focus, meters, ticks)
- alt: broadcast cyan `#64D8FF`, sparse (links in prose, secondary data series)
- danger/err only where truth requires: `#FF6B6B` desaturated in dark
- hairlines: 1px `#1C2530`; the grid is visible only where it earns it

**Type:** mono display + quiet grotesk body, both self-hosted. Candidates (pick on render):
display/mono = Commit Mono or Iosevka (Berkeley Mono is commercial; if Penn wants to buy it
later the tokens swap cleanly); body = a restrained grotesk (Switzer / General Sans class).
Tight tracking on display sizes, generous line-height on prose, tabular numerals everywhere
data appears.

**Motion:** Linear-class restraint. 120-200ms, ease-out-quint for entrances, nothing loops,
nothing bounces. View transitions between routes (subtle crossfade + 8px slide). One staggered
reveal on the index. `prefers-reduced-motion` kills all of it. No parallax, no scroll-jacking.

**Texture:** none of the warm-black grain from v1. Depth comes from the surface ladder and
hairlines. The only "screen" affordance lives on the bench canvas itself (see 5).

**The tells (custom everything):** custom focus ring (1px phosphor + 2px offset), selection
color (phosphor on ink), scrollbars (thin, surface-3), favicon + OG image in the language,
custom 404 (dead-channel SMPTE bars, muted), empty/loading states designed not defaulted,
keyboard-first (j/k lesson nav, / palette later), print stylesheet for lessons.

## 4. Product surface (routes)

- `/` - the instrument front: course identity, the ladder as a calibrated rack (each module a
  channel strip: index, title, lesson/check counts, progress meter), live micro-bench teaser
  (small canvas running the corridor, muted), XP meter in the header.
- `/m/[module]` - channel page: lesson list, module progress, gate state.
- `/m/[module]/[lesson]` - the reading instrument: prose column (research measure), checks as
  inline instruments with immediate grading (same parity rules as check.js), pass states
  recorded, keyboard next/prev.
- `/bench` - the centerpiece. Full panel canvas (the WASM sim, live), transport controls
  (run/pause/step frame), the annotated trace as a live-following readout with scrub; byte
  waveform detail on select. A quiet CRT treatment on the canvas only (subtle scanline +
  phosphor persistence shader per research 4; cheap, tasteful, toggleable).
- `/progress` - the operator card: XP, level, achievements grid, per-module meters, export
  (the same story the binary tells; localStorage only, no accounts - accounts belong to the
  after-release platform).
- `/404` - dead channel.

## 5. The bench and the DOOM arc

Phase now: the corridor finale rendered by the real `thunk-sim` pipeline - boot sequence
visible as bus traffic, then frames. The trace readout shows real decoded events (SWRESET,
SLPOUT, CASET/PASET, RAMWR streams) as they drive the panel.

Phase later (fast-follow, network session): doomgeneric compiled into the same WASM harness
feeding `Display` over the sim bus - actual DOOM on the virtual panel, on the public site,
with the bus trace still live underneath. This is the payoff artifact and it is allowed here
(the review-safety constraint binds the in-facility build only). The bench UI is designed now
with a source switch (`FINALE / DOOM`) so DOOM drops in without redesign.

## 6. XP + achievements (minimal, slick, instrument-flavored)

No confetti, no badges-as-cartoons. The register is calibration, and it must stay quiet.

- **XP:** check passed +10 (first-try +15), lesson complete +25, module mastered +100,
  placement test-out +50/module, bench: first full boot watched +10, first trace scrub +10,
  finale/DOOM watched +25. Numbers are data, tuned once real.
- **Level:** LVL 01..20, pure numbers, quadratic-ish curve. Rendered as a thin VU-style meter
  in the header: hairline track, phosphor fill, tabular `LVL 04 - 1,240 XP`. No level-up
  modal; the meter ticks and a chip slides in.
- **Achievements (~12, dry technical names, earned not given):** POWER ON (first check),
  FIRST BOOT (bench boot watched), CLEAN PASS (a module 100% first-try), SYSCALL (M1
  mastered), NO_STD (M2), BUS MASTER (M3), RAMWR (M4), IDDQD (M5), UPSTREAM (M6), FULL LADDER
  (all modules), SCOPE JOCKEY (scrub the whole boot trace), CALIBRATED (placement taken).
- **Surfacing:** one toast style: small surface-2 chip, phosphor tick glyph, name, +XP, slides
  in bottom-right 200ms, holds 3s, leaves. Achievements grid on `/progress`: earned = phosphor
  tick + date; unearned = dim outline + name only (no riddles).
- **Storage:** localStorage (versioned schema `thunk.xp.v1`); export/import as JSON from
  `/progress` so nothing is ever lost to a cache clear. The after-release platform inherits
  this schema server-side later.

## 7. Non-negotiables carried forward

Accessibility is part of "pro": semantic landmarks, aria-live on grading, full keyboard paths,
AA contrast on every token pair (phosphor on bg measured, not vibed). Performance budget:
first route < 100KB JS gzipped before wasm; wasm lazy-loaded on bench-visible; fonts subset.
Perfect Lighthouse is the floor, not the goal. Engineering voice in all copy; no em dashes in
Penn-voice strings; vocab-lint does not apply to site/ (not course content) but the register
rule does.

## 8. Phases (each gets its own TDD-appropriate plan)

- **S-A Foundation:** scaffold site/, tokens, fonts, layout shell, content export pipeline,
  index + module + lesson routes rendering real content, deploy pipeline + CI. Mockup
  checkpoint: index + lesson screenshots to Penn BEFORE building past the shell.
- **S-B The bench:** thunk-wasm crate, canvas panel, transport, live trace, scrub, waveform.
- **S-C Checks + XP:** interactive checks with parity tests, XP/level/achievements + toasts,
  /progress operator card.
- **S-D Polish pass:** view transitions, keyboard nav, 404/OG/favicon/empty states, print,
  reduced-motion audit, contrast audit, perf budget enforcement.
- **S-E Cutover:** thunk-course Pages project live, old project redirect/retire decision,
  README/docs updates, screenshots.

**Definition of gorgeous (the gate S-A..S-D must pass):** every screenshot survives the
"would Linear ship this" question; no default browser chrome visible anywhere; Penn signs off
on renders at the S-A checkpoint before S-B begins.
