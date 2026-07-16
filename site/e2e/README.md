# End-to-end suite (Playwright)

Drives the built static site in a real Chromium, exactly as a reader (or a
facility) would: `npm run build` then `vite preview`, no network past localhost.

## Run it

```sh
npm run test:e2e            # both projects, headless
npm run test:e2e -- --ui    # the Playwright UI
npm run test:e2e -- smoke   # one spec
```

Playwright's `webServer` builds and previews on port 4173. Locally it reuses an
already-running preview (`reuseExistingServer`); in CI it always builds fresh.

## Browser

`@playwright/test` is pinned to an exact version whose bundled Chromium is
revision **1228**. Locally that browser is already cached under
`~/.cache/ms-playwright`; CI installs it with
`npx playwright install --with-deps chromium`.

## Projects

- **chromium** - the bulk of the suite, under `prefers-reduced-motion: reduce`
  so transitions never race an assertion.
- **motion** - `motion.spec.ts` only, *without* reduced motion, so the animated
  boot ritual and the crossfade view transitions actually run.

Every test also carries an automatic console-error guard (see `fixtures.ts`): a
stray `console.error` or uncaught page error fails the test.

## Specs

| spec | what it proves |
| --- | --- |
| `smoke.spec.ts` | every route loads clean, correct `<title>` (CH-NN.LL on lessons), build plate renders, no horizontal overflow at 1440/390, the app shell never scrolls the document past the viewport |
| `journey.spec.ts` | `/` -> palette (`/`) -> lesson -> grade a Choice + a Short -> XP ticks + first-blood toast -> reload persists -> j/k nav |
| `mastery.spec.ts` | drive all 9 M5 (DOOM) checks correct -> MODULE MASTERED + IDDQD, rail/operator/progress meters mastered, XP exactly 310 |
| `calibrate.spec.ts` | answer all 21 placement items correct -> whole ladder placed out, CALIBRATED, `/progress` reflects it (XP 350) |
| `bench.spec.ts` | POWER paints the canvas + streams RAMWR rows, STEP/RUN advance FRAME, SAVE TRACE downloads `thunk-trace.txt`, SCANLINES toggles, the DOOM switch fetches the WAD and repaints to the Freedoom title |
| `progress.spec.ts` | EXPORT -> RESET (type-YES) -> IMPORT round-trips the record; achievements grid earned/unearned |
| `a11y.spec.ts` | axe (no serious/critical) on `/`, a lesson, `/bench`, `/progress`, `/colophon`; skip-link, `aria-current`, palette combobox/listbox |
| `motion.spec.ts` | boot ritual + a client-side view transition, run with motion ON |

## Documented allowances

- **axe `color-contrast` is disabled** (`a11y.spec.ts`). The site is a
  phosphor-on-near-black instrument; several hairline mono captions use the
  `--faint` token, which the source documents as ~4.44:1 (just shy of AA) - a
  deliberate quiet-UI choice for decoration, not body copy. Every *other*
  serious/critical rule is still asserted clean.
- **DOOM full title-paint is skipped under CI** (`bench.spec.ts`). The 10MB WAD
  plus the doomgeneric wasm boot is slow/flaky on shared runners. CI still
  asserts the source switch and the WAD fetch starting; the title-paint runs
  locally (and passes).
