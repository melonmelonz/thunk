# thunk - lesson depth spec (interactive, hands-on, world-class)

**Status:** spec'd 2026-07-16. Penn's mandate (verbatim): "add depth. not just walls of text and
multiple choice." and "this needs to be world class." The bar is Bartosz Ciechanowski /
joshwcomeau-grade interactive explanation, executed in the PVM-lab language, with the killer
advantage that **the real simulator already runs in the browser** - so learners don't read about
the machine, they touch it, and every widget is a rung toward the bench.

## 1. The thesis

Right now a lesson is prose + Choice/Short checks. World-class systems education is *manipulable*:
you flip a bit and watch a byte change, you drag a value and watch the SPI clock latch it, you
pick a color and see the 5/6/5 split. thunk should let a learner operate the machine at every
layer, hands-on, building intuition the prose alone can't. The interactivity is not decoration -
each widget teaches the exact concept its lesson names, and several reuse `thunk-sim` directly.

Restraint still binds: PVM-lab palette, one phosphor accent, hairlines, quiet motion, tabular
numerals. A widget is an instrument panel, not a game. No confetti, no mascots.

## 2. Architecture - single source of truth, graceful degrade

Content stays authored in the Rust `thunk-content` crate (the offline bundle, TUI, and site all
derive from it). Widgets embed via a **directive in the lesson markdown** that both renderers
understand:

```
:::widget spi-scope
:::
```

- The constrained markdown renderer (Rust, `thunk-web::markdown`, used by the offline bundle AND
  the site's build-time HTML) turns the directive into a labeled placeholder:
  `<figure class="widget" data-widget="spi-scope"><figcaption>...static fallback caption...</figcaption></figure>`.
  The offline/facility build shows the caption + (where cheap) a static SVG still - it is JS-free
  by design and loses nothing essential.
- The **site** hydrates every `figure.widget[data-widget]` after load with the matching Svelte
  component from a registry (`$lib/widgets/registry.ts`: id -> lazy component). Widgets are
  **code-split and lazy-loaded per lesson** (dynamic import on hydrate) so they never touch the
  first-route JS budget.
- `thunk-content`'s validation suite gains a test: every `:::widget <id>` referenced in any lesson
  is in the known registry set (a shared list), and no lesson references an unknown widget. This
  keeps content and code from drifting - a lesson can't ship a widget the site can't render.
- `content.json` export already carries `bodyHtml`; the placeholders ride along in it, so the site
  needs no new pipeline - just the hydration pass + registry.

Widgets never gate reading and never phone home (localStorage only, same as everything).

## 3. The widget set (one flagship per layer; each teaches its lesson's concept)

- **M0 Power On - Bit Lab** (`bit-lab`): eight toggle switches; live readout of the byte as
  binary / decimal / hex / ASCII. A prompt line ("make 0x2C") that lights when matched. Bits ->
  bytes, felt.
- **M0 - Byte Decoder** (`byte-decoder`): enter a value in any base, see it in all four + the char.
- **M1 The Kernel - Volatile** (`volatile-memory`): a grid of memory cells and storage cells; a
  POWER toggle - cut power and memory clears while storage keeps its bytes. The desk-vs-shelf
  lesson, visceral.
- **M2 Rust for the Metal - Move/Borrow** (`ownership-move`): two bindings and a value; MOVE grays
  the source out and marks it unusable; BORROW draws a reference arrow; attempt mutate-while-shared
  and the checker stops you with the real reason. The borrow checker as a toy you can't break.
- **M3 The Bus - SPI Scope** (`spi-scope`, FLAGSHIP): drag/enter a byte 0x00-0xFF; CLK, MOSI, and
  CS lines draw the real waveform; step the clock and watch each bit latch on the rising edge;
  toggle DC (command vs data). **Reuses `thunk_sim::trace::waveform`** (already in the wasm crate) -
  the exact signal the bench speaks. This is the on-ramp to the bench.
- **M4 The Panel - Pixel Forge** (`pixel-forge`): RGB565 sliders (5/6/5); see the 16-bit word, the
  high/low byte pair, and the resulting swatch; a small framebuffer you paint and watch the RAMWR
  byte stream fill - the same RAMWR the bench streams.
- **M5 DOOM - the bench, inline** (`bench-teaser`): a small live panel (reuse the bench wasm) that
  boots the finale, with a "drive the whole thing on the bench ->" link. The payoff, previewed.
- **M6 Open Source - Diff Reader** (`diff-reader`): a real small unified diff rendered with +/-
  coloring and hunk headers; a "what does this patch change?" read with a reveal.

## 4. New check types (beyond Choice/Short)

Authored in `thunk-content` as new `Check` variants, graded with the same parity discipline
(Rust `Check::grade` + the site's TS grader stay in lockstep; both get tests):

- **Order** (`Order`): arrange items into the correct sequence (the ILI9341 init order
  SWRESET->SLPOUT->COLMOD->DISPON; the fetch-decode-execute cycle). Keyboard-operable (move
  up/down), not drag-only.
- **Predict** (`Predict`): given inputs/state, predict the output (a byte, a value, a pixel color).
  Graded exact against a canonical answer, like Short but framed as prediction.
- **Widget-set** (`Wire`): the answer IS a widget's state - "set the switches to 0x2C", "draw the
  window CASET 0-239". Graded from the widget's emitted value. The most hands-on check.

Each new type: a Svelte instrument matching CheckCard's register, aria-live verdicts, XP parity
(same economy - pass +10 / first-try +15), and the palette/keyboard flows unchanged.

## 5. Phases

- **D-A Foundation + flagship** (first, ship + Penn checkpoint BEFORE expanding): the directive ->
  placeholder -> registry -> lazy-hydrate mechanism end to end; `thunk-content` widget-id
  validation; the **SPI Scope** (`spi-scope`) and **Bit Lab** (`bit-lab`) widgets authored into
  their lessons; one new check type (**Order**) with full grader parity + tests. E2E + vitest +
  Rust tests + screenshots. STOP for Penn's eyes on the flagship before D-B.
- **D-B Widget breadth**: Byte Decoder, Volatile, Move/Borrow, Pixel Forge, Diff Reader, bench
  teaser; the Predict + Wire check types. Author each into its lesson.
- **D-C Depth polish**: XP/achievements for interactive checks (a new dry achievement, e.g.
  `SCOPED` for driving the SPI scope, `LIT` for the pixel forge - fit the existing quiet toast);
  a11y audit of every widget (keyboard, reduced-motion, aria); perf (all widgets lazy, budget
  holds); update the E2E suite to drive 2-3 widgets; refresh the demo film-driver to show a widget
  moment; regenerate screenshots.

**World-class gate (every phase):** would Ciechanowski/Comeau/Linear ship this widget? Does it
teach the concept better than the paragraph it sits next to? Is it quiet, keyboard-operable, and
does it degrade cleanly in the offline bundle? If not, it doesn't land.

## 6. Non-negotiables carried forward

Single source of truth in the crate; offline bundle stays JS-free and valid; hermetic build;
first-route JS budget holds (widgets lazy); grader parity Rust<->TS with tests; PVM restraint;
localStorage-only, no telemetry. Accessibility is part of "world-class," not a follow-up.
