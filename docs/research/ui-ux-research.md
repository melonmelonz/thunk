# thunk web GUI — UI/UX research report

**Purpose:** design direction for milestone M-F (the offline local web GUI).
**Date:** 2026-07-12
**Method:** live web research (WebSearch/WebFetch succeeded on 2026-07-12) plus practitioner
knowledge. Every claim below is either backed by a fetched source (listed in §8) or explicitly
marked **[knowledge-based]**. Nothing is fabricated.

**Brief:** gorgeous, minimal, in the spirit of monkeytype.com; clean monospace, restrained palette,
"the quiet confidence of good documentation and a good oscilloscope"; not neon; no gimmicks; will
be audited by real engineers.

**Hard constraints honored throughout:** fully offline, zero external assets (fonts embedded at
compile time), must render a lesson reader + checks + simulated display panel + logic-analyzer-style
bus trace; audience includes true-zero beginners on locked-down machines; plain language; the
screen-reader gap (PRD NFR-5) must be closed, not widened.

---

## 1. Executive summary and recommended direction

The design that satisfies the brief is **an instrument, not a website**: the calm of a datasheet, the
precision of a logic analyzer, and monkeytype's discipline of hiding everything that is not the
current task. Concretely, five firm recommendations:

**R1 — Build the reader as plain semantic HTML generated from Rust; do not use ratzilla for the
reading surface.** Ratzilla's DOM backend renders a terminal character grid into `<pre>` elements
with no semantic structure. The only proven way to make a terminal grid screen-reader-usable
(xterm.js) is to maintain an entire parallel off-screen accessibility DOM with live regions — a
large, fragile subsystem thunk does not need, because thunk's web GUI is mostly *documents*. Emit
real `<h1>`–`<h3>`, `<p>`, `<ul>`, `<table>`, `<nav>`, `<main>` from the existing content pipeline.
Reserve grid/canvas rendering for the two instrument panels (display sim, bus trace), each with an
HTML text alternative. Details in §7.

**R2 — Adopt monkeytype's theming mechanic, not its look: a small closed set of CSS custom
properties that every theme must fill.** Monkeytype ships 56 themes from just ten tokens
(`--bg-color`, `--main-color`, `--sub-color`, `--text-color`, `--error-color`, …) defined at
`:root` and swapped by loading one tiny CSS file. thunk needs ~20 tokens (it adds trace/panel and
semantic state colors). Ship exactly two audited themes at launch — one dark, one light — both
passing WCAG AA. Proposal in §5.

**R3 — Two embedded OFL typefaces, one designed pairing: IBM Plex Mono for code, chrome, labels,
and the trace; IBM Plex Sans for lesson prose.** All-monospace body text looks the part but
measurably costs the true-zero reader; monospace runs ~40–70% wider per character, and the audience
includes fragile readers. Plex Mono and Plex Sans are drawn as one family, so the page still reads
"monospace instrument" while prose stays easy. Both are SIL OFL, self-hostable as woff2 with no
license friction. If a single-typeface look is later demanded, the fallback position is JetBrains
Mono everywhere with a wider measure and looser leading — but recommend the pairing. Full spec in §4.

**R4 — One centered reading column (~65ch), chrome that recedes, keyboard-first with a command
palette.** Monkeytype's signature is that the interface disappears while you work; thunk's
equivalent is a reader with no persistent sidebar, a thin header that fades on scroll/read, `j/k`
or arrow paging, and an Esc (or Ctrl+K) palette for navigation, theme, and progress — mirroring the
TUI's keybindings so the two modes teach each other. Checks appear inline in the reading flow, not
in a separate quiz screen. Details in §6.

**R5 — Motion budget of near-zero; progress as a plain instrument readout.** The only things that
animate are functional: the trace playback, the simulated panel, the caret. No badges, streaks,
confetti, mascots, or progress rings. Progress is a module/lesson map — a monospace table of what
is read, what is mastered, what is locked — which is exactly what a mastery-gated system needs and
what an auditing engineer respects. Honor `prefers-reduced-motion` globally.

Everything else in this report is elaboration and evidence for those five.

---

## 2. Monkeytype deconstructed

Fetched monkeytype.com and its THEMES.md; supplemented with search results and
**[knowledge-based]** observations from prior familiarity with the app.

### What it actually does

- **Layout.** One centered column on a flat background. No sidebar, no card borders, almost no
  chrome. The config bar sits above the work area; footer links are tiny and low-contrast. The
  hierarchy is carried entirely by color (text vs `--sub-color`) and size, not by boxes.
- **Focus mode.** While a test runs, everything but the words fades out — nav, config, footer drop
  to near-invisible. The GitHub project description lists "focus mode while typing" as a core
  feature. The effect: the app *earns* minimalism by being contextual, not by being empty.
- **Keyboard-first.** "Click here or press any key to focus"; a command line opened with Esc drives
  every setting — theme, mode, language — without a settings page visit. This is the single most
  "slick" element: power is hidden behind one key, and the default view stays clean.
- **Theming.** Ten CSS custom properties define an entire theme: `bg`, `caret`, `main`, `sub`,
  `subAlt`, `text`, `error`, `errorExtra`, `colorfulError`, `colorfulErrorExtra`. Themes are hex
  values in one TS constants file; a theme may optionally add a CSS file. Theme preview happens live
  on hover in the command line. The lesson: theming is cheap when the token set is small and closed.
- **Typography.** Roboto Mono is the default/fallback rendering font (confirmed via a monkeytype
  GitHub issue); the UI chrome uses a proportional face — even monkeytype does not set its *entire*
  UI in monospace. **[knowledge-based:** chrome font is Lexend Deca; not re-verified this session.**]**
- **Feedback.** Errors are shown by recoloring the letter itself (`--error-color`), in place, with
  no popups. State changes are quiet.

### What transfers to thunk

- The token-driven theme system (R2), wholesale.
- Focus mode as *contextual fading*: while reading, the header/footer recede; on mouse move or
  Esc they return.
- The command palette as the power-user surface, keeping the default screen almost empty.
- Color-as-hierarchy: primary text, `sub` text, and one accent do nearly all the work; borders and
  boxes are rare.
- Errors/feedback rendered in place, in the flow, without modal interruption.

### What does not transfer

- Monkeytype is a *performance* app: one short task, no long-form reading, no information
  hierarchy deeper than one screen. thunk is reading-heavy; it needs headings, tables, figures,
  and a navigable multi-module structure that monkeytype never has to solve.
- Monkeytype's 56-theme buffet and randomized themes are engagement features for enthusiasts;
  thunk ships two audited themes because every theme must pass contrast review (and facility
  review favors fewer moving parts).
- Monkeytype's ultra-low-contrast footer/nav (a deliberate aesthetic) would fail WCAG AA for a
  population that includes fragile readers; thunk's "receded" chrome must still meet 3:1 minimum
  when visible, and fading must be reversible by keyboard.
- Accounts, leaderboards, live WPM counters: none apply.

---

## 3. Exemplar analysis

Seven exemplars beyond monkeytype, chosen for engineer credibility and relevance to thunk's three
surfaces (reader, checks, instruments).

### 3.1 Saleae Logic 2 (the brief names it; the simulator imitates it)

From Saleae's site, forum, and release notes: Logic 2 records *all* traffic so you can stop and
inspect anything after the fact; measurements appear wherever the mouse points; the company
explicitly markets attention to design detail. Theme support (dark/light) arrived in Logic 2.4.2
and the team described it as thousands of UI changes with ~7 rounds of internal review — evidence
that a disciplined token system matters even to a native app. **[knowledge-based:** Logic 2's look:
near-black neutral background, channels as horizontal lanes, thin 1px waveform strokes in muted
per-channel hues, decoded protocol bytes rendered as small labeled boxes *on* the waveform, a
right-hand pane listing decoded transactions as rows, generous empty space between lanes, no
gridlines louder than the data.**]**

**Take for thunk's trace view:** lanes not charts; decoded SPI bytes as in-line labels on the
waveform; a synchronized *decoded-transaction table* beside/below the waveform (this table is also
the accessible surface, §7); hover/keyboard cursor gives time + value readout; muted per-channel
colors from theme tokens, data brighter than chrome.

### 3.2 Stripe documentation

Widely treated as the benchmark. What the teardowns credit: a stable left navigation tree, a calm
center column of prose, code on the right, and — most cited — *synchronized highlighting* between
prose and the code sample, removing the translation step between concept and implementation. The
docs "feel like an application rather than a manual" (Stripe's head of docs), with a restrained
calm palette and one consistent design language across docs/dashboard/site.

**Take for thunk:** the synchronization idea maps directly onto lesson-prose ↔ trace-view: when a
lesson paragraph discusses a MOSI byte, hovering/focusing it highlights that byte in the trace
panel. That single interaction would give thunk its "slick" moment while being 100% pedagogical.
Skip the three-column layout itself — thunk's lessons are narrative, not API reference, and true-zero
readers do better with one column.

### 3.3 mdBook / *The Rust Programming Language* book **[knowledge-based]**

The Rust Book's mdBook rendering is the most-read long-form technical reading surface in the Rust
world: single ~750px column, proportional body, monospace only for code, collapsible chapter
sidebar, five built-in themes switched by a tiny selector, zero JS required to read. Its virtue is
that nothing competes with the prose. Its weakness: the sidebar is persistent clutter and pagination
is easy to lose. thunk should keep the single column and theme selector; replace the persistent
sidebar with the command palette + a dedicated map screen.

### 3.4 MkDocs Material / "docs people love" pattern

Search-confirmed as a repeatedly recommended minimal docs stack; the pattern across loved docs
tools (Lotus Docs, Docusaurus, Material) is: clarity, white space, typography-led hierarchy, dark
mode out of the box, and excellent code blocks. **[knowledge-based:** Material's specific wins:
a 16px base with generous line-height, admonition blocks with a thin colored left border instead of
loud filled boxes, and instant keyboard search.**]** thunk should borrow the thin-left-border
admonition style for "key terms" and check-feedback blocks — quiet, scannable, printable.

### 3.5 Linear.app **[knowledge-based]**

The reference for "engineer-respected polish": dark neutral surfaces, one accent, 100%
keyboard-driven via Cmd+K palette, sub-100ms perceived response, and motion used only to preserve
context (≤150ms fades). Its restraint is why engineers call it slick. Transfer: the palette
interaction model and the discipline that *speed is the aesthetic* — a static offline bundle can be
instant, and instant reads as quality.

### 3.6 Sourcehut **[knowledge-based]**

The opposite pole worth studying: near-unstyled HTML, system fonts, no JS, loved by a certain
engineer for honesty and speed — proof that austerity alone earns respect. But it is hostile to
beginners (no hierarchy softening, dense link lists). thunk should sit between Sourcehut's honesty
and Linear's polish: semantic HTML and instant loads from the former, tokens and typographic care
from the latter.

### 3.7 Execute Program **[knowledge-based]**

The best example of mastery-gated learning UI without gamification cruft: lessons interleave short
prose with inline checks; answering immediately reveals the explanation; progress is a plain list
of concepts with review-due counts (spaced repetition made visible as a schedule, not a streak
flame). It demonstrates that immediate check feedback can feel like *conversation with the
material* rather than a quiz — the model for thunk's FR-2 checks. Its restraint: wrong answers get
a neutral explanation, never a red X slam.

### Cross-exemplar pattern summary

| Property | Common to the respected set |
|---|---|
| Layout | one dominant column; sidebars minimized or summonable |
| Hierarchy | carried by type size/weight/color, not boxes |
| Palette | neutral surfaces + one accent + small semantic set |
| Type | proportional prose, monospace strictly for code/data |
| Motion | functional only, fast, fade-not-bounce |
| Power | keyboard palette; the default screen stays bare |
| Feedback | in place, in flow, quiet |

---

## 4. Typography specification (proposal)

### Faces (all SIL OFL 1.1 — embedding, subsetting, and redistribution explicitly permitted;
verified via license search this session)

| Role | Face | Why |
|---|---|---|
| Lesson prose, check questions | **IBM Plex Sans** | Designed as one family with Plex Mono, so the page stays visually "of one metal"; excellent at 16–18px; sober, engineering-flavored, not trendy. |
| Code, key terms, trace labels, header/nav, progress table, panel chrome | **IBM Plex Mono** | The "instrument" voice; official woff2 in the IBM/plex repo; distinct 0/O and 1/l/I. |
| Fallback stacks | `ui-monospace, 'Cascadia Mono', 'Source Code Pro', Menlo, Consolas, monospace` and `system-ui, 'Segoe UI', Roboto, sans-serif` | The app must render acceptably even if font loading is disabled by an aggressive lockdown profile. |

Alternative pairing if Plex is rejected on taste: **JetBrains Mono + Inter** (both OFL; Inter's
tall x-height is very readable, JetBrains Mono is the developer favorite). Iosevka is attractive
(OFL, extremely customizable, narrow — more chars per line) but its narrowness hurts true-zero
readers; keep it as a user-selectable option later, not the default.

**Embedding:** subset to Latin, weights 400/500/700 for Sans and 400/700 for Mono, woff2 only
(universally supported since ~2017). Expect roughly 15–30 KB per subsetted weight —
**[knowledge-based estimate]** ~100–180 KB total, embedded via `include_bytes!`/static bundle,
`font-display: swap` irrelevant offline but harmless. Zero external requests, satisfying NFR-2.

### Measure, size, leading (research-backed)

The literature review (Nanavati & Bias, *Visible Language*) and subsequent guidance converge on
45–75 characters per line with ~66 as the classic ideal; WCAG sets a hard ceiling of 80ch; shorter
lines (50–60) favor careful reading and are *preferred* by readers even when not faster — which is
exactly the right trade for true-zero learners reading difficult material. Line-height 1.5 is the
accessibility floor; longer lines need more.

Proposed spec:

```css
:root {
  --font-prose: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono:  'IBM Plex Mono', ui-monospace, monospace;

  --size-base: 1.0625rem;   /* 17px — one notch above default for fragile readers */
  --size-code: 0.9375em;    /* mono runs wide; optically match prose */
  --size-small: 0.875rem;   /* captions, footer, table meta */
  --size-h1: 1.625rem;      /* modest scale: 1.25 ratio, three steps max */
  --size-h2: 1.3125rem;
  --size-h3: 1.0625rem;     /* h3 = bold + mono, size unchanged */

  --leading-prose: 1.65;
  --leading-code: 1.5;
  --measure: 65ch;          /* main column; hard cap 72ch, never 80+ */
}
```

Rules: left-aligned always (no justification — rivers hurt weak readers); paragraphs separated by
space, not indentation; `h3` and key-term labels set in mono to keep the instrument voice present
inside prose; code blocks full-measure with the thin-left-border treatment; on narrow screens
reduce font size slightly before letting the measure collapse below ~45ch.

**Plain-language note:** typography cannot rescue prose. The existing M1 lesson voice (short
declarative sentences, one idea per paragraph, bold key terms with a Key Terms recap) is already
right; the GUI should *typeset that structure* — e.g., render the Key Terms block as a two-column
mono definition table — rather than add decoration.

---

## 5. Theme-token proposal

Architecture copied from monkeytype (small closed token set at `:root`, one class or
`data-theme` attribute swap, live preview possible) but extended for thunk's semantic states and
instruments. All tokens are plain CSS custom properties — no preprocessor, no JS required to theme,
trivially auditable.

```css
/* ---- token contract: every theme defines exactly these ---- */
:root[data-theme="gantry"] {           /* dark — default */
  /* surfaces */
  --bg:            #16181d;   /* page */
  --bg-raised:     #1d2127;   /* cards: checks, panels, code blocks */
  --bg-inset:      #101216;   /* trace/panel wells — data sits in the darkest layer */
  --border:        #2a2f37;

  /* text */
  --text:          #d7dae0;   /* ~12.5:1 on --bg */
  --text-muted:    #9aa1ab;   /* ~5.9:1 — secondary, still AA */
  --text-faint:    #6b727d;   /* decorative only, never for content */

  /* identity */
  --accent:        #d9a962;   /* quiet phosphor amber — the one brand color */
  --on-accent:     #16181d;
  --link:          #8fb4c9;   /* desaturated instrument cyan */
  --focus-ring:    #d9a962;

  /* semantic state */
  --ok:            #8fb573;   /* check passed, module mastered */
  --err:           #d08770;   /* check missed — warm, not alarm-red */
  --info:          #8fb4c9;

  /* instruments */
  --trace-grid:    #23272e;
  --trace-cursor:  #d9a962;
  --sig-1:         #8fb573;   /* SCLK  */
  --sig-2:         #8fb4c9;   /* MOSI  */
  --sig-3:         #c78fb4;   /* MISO  */
  --sig-4:         #d9a962;   /* CS    */
  --panel-bezel:   #0b0c0f;   /* simulated display surround */

  /* selection */
  --sel-bg:        #2c3a45;
  --sel-text:      #d7dae0;
}

:root[data-theme="datasheet"] {        /* light — paper, not white glare */
  --bg:            #f6f5f1;
  --bg-raised:     #fdfdfb;
  --bg-inset:      #ecebe5;
  --border:        #d9d6cd;

  --text:          #26282c;
  --text-muted:    #585e66;
  --text-faint:    #8b8f96;

  --accent:        #8a5f17;   /* the same amber, carried down to AA on paper */
  --on-accent:     #f6f5f1;
  --link:          #2d6a84;
  --focus-ring:    #8a5f17;

  --ok:            #3d6b35;
  --err:           #a13d2d;
  --info:          #2d6a84;

  --trace-grid:    #e2e0d8;
  --trace-cursor:  #8a5f17;
  --sig-1:         #3d6b35;
  --sig-2:         #2d6a84;
  --sig-3:         #8a3d6b;
  --sig-4:         #8a5f17;
  --panel-bezel:   #26282c;

  --sel-bg:        #d8e4ea;
  --sel-text:      #26282c;
}
```

Design rules for the token system:

- **Closed set.** Components may only reference tokens, never hex — the whole app rethemes from
  one block, and an auditor can review the entire palette in 40 lines.
- **Contrast is a build gate, not a hope.** The values above are *targets* chosen to clear WCAG AA
  (≥4.5:1 body text, ≥3:1 large text and UI components/focus indicators). Add a tiny CI check (a
  pure-Rust relative-luminance function, ~30 lines) that computes ratios for every
  (text-token × surface-token) pair a theme uses and fails the build on violation — in the spirit
  of vocab-lint. Verify final values with a checker before shipping; do not trust the eyeball.
- **One accent.** Amber does brand, focus, cursor, and CS line; everything else is neutral or
  semantic. "Not neon" is enforced by keeping every hue's saturation low and letting the *data*
  (trace signals) be the most colorful thing on screen — the Saleae/oscilloscope move.
- **Dark default, light equal.** Default to `gantry`; respect `prefers-color-scheme` on first run;
  persist the choice in local state (no accounts, NFR-4). Two themes only at launch; the token
  contract makes community themes possible later exactly as monkeytype does.
- Theme switching lives in the command palette and a visible toggle; both work without JS if the
  GUI ships as static pages (checkbox/`:has()` trick or a page-reload fallback). **[knowledge-based]**

---

## 6. Interaction principles

1. **The reader is the app.** Default view: header (thin, mono, module/lesson breadcrumb + progress
   fraction like `M1 · 3/5 · checks 9/15`), the prose column, and nothing else. On scroll or after
   a few seconds of reading, the header drops to `--text-faint` (monkeytype's fade, but never below
   3:1 while interactive, and disabled under `prefers-reduced-motion` and for keyboard focus).

2. **Keyboard-first, mirrored with the TUI.** `j/k` / arrows scroll, `n/p` or `←/→` change lesson,
   `Esc`/`Ctrl+K` opens the command palette (go to lesson, open trace, theme, progress, help),
   `?` shows keys. Same verbs as the TUI so skills transfer between modes. Everything also works by
   mouse — true-zero learners must never *need* the shortcuts (discoverability via visible hints,
   `?`, and the palette itself).

3. **Checks are conversation, not examination.** A check renders inline where the content pipeline
   places it: a `--bg-raised` block with a thin `--accent` left border. Answering gives immediate,
   quiet feedback in place — border turns `--ok`/`--err`, a one-sentence explanation appears
   below (Execute Program's model). No timers, no scores-per-question, no red X, no modal. Missed
   checks simply remain unmastered and reappear; the copy never says "wrong," it explains. This
   satisfies FR-2/FR-6 without quiz-app texture.

4. **Progress is an instrument readout.** One "map" screen: a mono table of modules → lessons →
   check counts, states rendered as plain marks (`read`, `mastered`, `locked` — words or simple
   glyphs like `●/○/–`, no color-only signaling). Mastery gates (FR-3) shown as a fact ("passes 12
   of 15 — 13 needed to open M2"), not a fanfare. The only celebratory moment in the whole app is
   the earned one: DOOM booting on the panel.

5. **Instruments are panels, prose is the floor.** The trace view and display panel open as
   full-width panels beneath or beside the lesson (lesson-driven: a lesson beat says "watch the
   bus" and the panel is right there), sitting on `--bg-inset` with mono labels. Trace interactions:
   horizontal zoom/pan, a cursor with time/byte readout, decoded SPI bytes labeled on the waveform,
   and a synchronized decoded-transaction table (§3.1). The Stripe-style prose↔trace highlight
   link (§3.2) is the one signature interaction worth building well.

6. **Motion budget.** Allowed: trace playback/panning, the simulated panel's own output, ≤150ms
   opacity fades on chrome and palette. Forbidden: parallax, springs, skeleton shimmer, animated
   progress fills, hover growth. `prefers-reduced-motion: reduce` collapses all fades to instant
   state changes and pauses any autoplaying trace.

7. **Instant is the aesthetic.** Static, local, zero network: page transitions should be
   indistinguishable from instantaneous. No spinners anywhere — if something takes long enough to
   need one, fix the something. This is also the honest signal to an auditing engineer that the
   bundle does what it claims.

---

## 7. Accessibility findings

### The ratzilla question (answered)

Research findings:

- Ratzilla's `DomBackend` renders the Ratatui buffer into the DOM as `<pre>`-based monospace text;
  a WebGL2 backend also exists. No official documentation or issue discussion of ARIA semantics or
  screen-reader testing was found for ratzilla.
- The DOM backend is *better than canvas* (text at least exists as text) but a terminal grid still
  has no headings, no landmarks, no list/table semantics, no focus order, and re-renders whole
  regions — a screen reader sees an undifferentiated, constantly-mutating wall of characters.
- The proof of scale: xterm.js, the most mature web terminal, had to build a dedicated
  `AccessibilityManager` — an off-screen parallel accessibility DOM with an assertive live region,
  a keystroke-echo queue to distinguish typed input from program output, and per-frame tree
  updates — just to reach basic usability, and still has open issues (e.g. screen-reader text
  selection blocked by `user-select: none`). That is the cost of making a character grid
  accessible after the fact.

**Conclusion:** ratzilla is a fine curiosity and a poor foundation for thunk's web GUI, whose
content is overwhelmingly *documents*. Closing PRD NFR-5's screen-reader gap is nearly free with
semantic HTML and nearly impossible with a rendered terminal grid.

**Recommended architecture:** a Rust static generator (or the existing pipeline + `thunk serve`
on 127.0.0.1) emitting plain semantic HTML + one embedded stylesheet + minimal hand-written JS for
checks, palette, and instruments. Leptos/Yew (WASM) are viable if heavy interactivity emerges, and
both produce real DOM elements — but a full WASM framework adds megabytes and audit surface for
what is mostly static content; plain HTML + small JS is the review-safest and most auditable
option, in keeping with §10 of the design spec. The TUI keeps Ratatui; the web GUI should not.

### The accessibility budget (cheap, high-yield items)

- **Semantics first:** `<main>`, `<nav>`, one `<h1>` per page, ordered heading levels, `<table>`
  for the progress map and decoded-transaction list, `<button>`/`<a>` never div-with-onclick,
  skip-to-content link, `lang="en"`.
- **Checks:** a `<form>` with `<fieldset>/<legend>` per question; feedback injected into an
  `aria-live="polite"` region so screen readers hear the result without focus theft.
- **Keyboard:** visible `:focus-visible` ring in `--focus-ring` (≥3:1 against surroundings); the
  palette is a proper dialog (focus trap, Esc closes, focus returns); no keyboard traps elsewhere;
  all single-key shortcuts have menu/palette equivalents.
- **Instruments:** trace canvas/SVG gets `role="img"` with a meaningful `aria-label`, and — the
  real answer — the synchronized decoded-transaction HTML table *is* the accessible trace. The
  simulated panel likewise pairs with a text status line ("panel: splash rendered, 240×320").
  DOOM-on-panel is inherently visual; provide an honest text description of state rather than
  pretending otherwise.
- **Contrast & color:** AA ratios enforced in CI (§5); never color-only state (marks + words
  accompany `--ok`/`--err`); ≤80ch (WCAG), 1.5+ line-height, left-aligned, real text everywhere
  (no text-in-images).
- **Motion & preferences:** `prefers-reduced-motion` (§6), `prefers-color-scheme` default,
  browser zoom to 200% without horizontal scroll (use `rem`/`ch`, no fixed pixel layouts).
- **Plain language is accessibility:** the M1 voice already reads at the right level; keep UI copy
  in the same register ("3 checks left in this lesson," never "Complete assessment modules").

All of the above works offline with zero external dependencies and adds essentially no weight.

---

## 8. Sources

Pages actually fetched or returned by live search this session (2026-07-12):

- https://monkeytype.com — fetched; layout/interaction observations
- https://github.com/monkeytypegame/monkeytype/blob/master/docs/THEMES.md — fetched; exact theme token names and process
- https://github.com/monkeytypegame/monkeytype — project description (focus mode, minimalism) via search
- https://deepwiki.com/monkeytypegame/monkeytype/3.3-theming-and-styling — theme architecture details via search
- https://github.com/monkeytypegame/monkeytype/issues/6251 — Roboto Mono default/fallback confirmation
- https://github.com/ratatui/ratzilla · https://docs.rs/ratzilla/latest/ratzilla/ · https://ratatui.rs/ecosystem/ratzilla/ — DOM/WebGL2 backends, `<pre>` rendering; absence of accessibility docs
- https://github.com/xtermjs/xterm.js/wiki/Design-Document:-Screen-Reader-Mode — accessibility-tree/live-region design
- https://github.com/xtermjs/xterm.js/issues/4656 — screen-reader selection issue
- https://www.saleae.com/logic · https://discuss.saleae.com/t/logic-2-4-2/1886 · https://discuss.saleae.com/t/analog-ui-recommendations/733 — Logic 2 positioning, theme rollout, community UI discussion
- https://apidog.com/blog/stripe-docs/ · https://www.moesif.com/blog/best-practices/api-product-management/the-stripe-developer-experience-and-docs-teardown/ · https://www.mintlify.com/blog/stripe-docs — Stripe docs analysis (three-column, synchronized highlighting, design language)
- https://journals.uc.edu/index.php/vl/article/view/5765 (Nanavati & Bias) · https://baymard.com/blog/line-length-readability · https://pimpmytype.com/line-length-line-height/ · https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/ — line length/leading research
- https://accessibility.huit.harvard.edu/design-readability — leading/readability guidance
- https://www.jetbrains.com/lp/mono/ · https://github.com/jetbrains/jetbrainsmono · https://github.com/IBM/plex/tree/master/packages/plex-mono/fonts/complete/woff2 · https://gwfh.mranftl.com/fonts/ibm-plex-mono?subsets=latin — OFL licensing and self-host woff2 availability
- https://www.learndash.com/blog/how-to-improve-course-completion-rates-with-focus-mode/ · https://viartisan.com/2025/05/27/elearning-ui-ux-design/ · https://userguiding.com/blog/progress-trackers-and-indicators — focus mode and non-gamified progress evidence
- https://herothemes.com/blog/documentation-website-templates/ · https://dev.to/therealmrmumba/top-10-tools-to-create-beautiful-docs-in-2025-for-developers-teams-2c4j — docs-tool landscape (Lotus Docs, Material, Docusaurus)

Knowledge-based (not fetched this session; marked inline throughout): monkeytype chrome font
identity; Saleae Logic 2 visual details; mdBook/Rust Book rendering; MkDocs Material admonition
style; Linear.app interaction character; Sourcehut aesthetic; Execute Program check flow; font
subset size estimates; specific hex values (original to this proposal, contrast targets to be
CI-verified); no-JS theme-switch fallback techniques.
