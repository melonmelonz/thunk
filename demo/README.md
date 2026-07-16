# thunk - film-driver runbook

`film.mjs` is a Playwright driver that performs a flawless, repeatable on-screen
run of the live site while you record it with OBS. It realizes the 12-beat shot
list in `../docs/DEMO-VIDEO.md`, paces each beat to that plan's timings, drives
the real bench + DOOM deterministically, and writes `markers.json` so the editor
can snap cuts and captions to exact frames.

It targets the deployed URL - no repo coupling. You film the real thing: the
wasm simulator, the live bus trace, and the DOOM WAD fetch and all.

## Install

```
cd demo
npm i
node film.mjs            # the slow, on-camera take (what OBS records)
```

`npm i` pulls Playwright (chromium is already cached on this machine at
rev 1228). If chromium is missing on a fresh box: `npx playwright install chromium`.

## Run

| Command | What it does |
|---------|--------------|
| `node film.mjs` | Slow, on-camera take. Paces to the DEMO-VIDEO.md windows (~105s), plays the boot ritual + view transitions, holds the DOOM climax. `--wad=show` by default. |
| `node film.mjs --mode=smoke` | Fast rehearsal (~20s). Hits every beat and asserts every condition (grade PASS, panel lit, WAD loaded, DOOM frames change). Run this after any deploy to prove the sequence still works. Pre-warms the WAD for speed. |
| `node film.mjs --wad=warm` | Pre-caches the DOOM module + WAD before the take so the reveal (scene 8) boots near-instant. |
| `node film.mjs --wad=show` | (default in slow) No pre-warm: scene 8 does a genuine cold WAD fetch so the `FETCHING WAD` line reads for real (~1.5s). Honest and it teaches. |
| `node film.mjs --url=https://thunk.goolz.org` | Point at the custom domain once it resolves. Default is `https://thunk-course.pages.dev`. |

Other flags: `--countdown=N` (seconds of neutral hold before BEAT 1 so you can
confirm OBS is capturing; default 2, `0` in smoke), `--hold=N` (seconds the
window stays up after the take before it closes; default 2).

The take proper begins at BEAT 1 / `t=0` - pre-warm and the countdown happen
before that, so trim your edit-in point to the first front-door frame.

## OBS setup (recap of DEMO-VIDEO.md section 2)

- **Canvas / output:** 1920x1080 @ **60fps** (60 matters - the bench and DOOM are
  motion). Encoder: x264 `veryslow` CRF 16 or NVENC HQ for the master.
- **Source:** one **Window Capture** of the Playwright chromium window. The driver
  launches it at exactly 1920x1080, DPR 1, scrollbars hidden, so pixels are 1:1 -
  do not let OBS rescale it (no blur on the mono type or the panel).
- **Cursor:** the run reads as the UI responding on its own; hide the cursor in the
  Window Capture properties. (A styled click-ring is optional for scenes 4/6/8.)
- **Camera moves:** all push-ins/pans are done in OBS on the browser source with the
  **Move** plugin (or Advanced Scene Switcher), never a real browser zoom - always
  upscale the 1080p source inside the 1080p canvas so text stays crisp, keep
  push-ins <=8%. Key the Move transitions to the `tStartMs` values in `markers.json`.
- **Color:** sRGB, full range. No LUT, no "cinematic" filter - the design is the look.
- **Rung montage (scene 9):** the driver prints `CUE: RUNGS MONTAGE` and holds on the
  bench. Cut here in the edit to your terminal / QEMU serial / hardware footage.

## markers.json -> caption / cut map

Each beat prints `[t=SS.SS] BEAT n: <name>` to stdout and is written to
`markers.json` as `{ beat, label, caption, tStartMs }`. Snap each caption's fade
and each camera move to `tStartMs`. Captions are the PVM-quiet lower-left
lower-thirds from DEMO-VIDEO.md.

| Beat | Plan window (s) | On screen | Caption (mono, lower-left) |
|------|-----------------|-----------|----------------------------|
| 1 | 0.0-6.0 | Boot ritual warms, front door fades in (wordmark, `thunk (n.)`, truth badges) | `// a systems course` |
| 2 | 6.0-12.0 | Stat readout 07/31/93, INIT SEQ, the ladder | `from 1s and 0s, up through Rust` |
| 3 | 12.0-18.0 | Enter the app: rack compresses into the left rail, lesson opens on "The Machine" | `learn the machine itself` |
| 4 | 18.0-27.0 | Grade the "What is memory?" check -> PASS, XP meter ticks, milestone toast | `graded here. nothing sent anywhere.` |
| 5 | 27.0-33.0 | /progress (operator card) then the rail's THE BENCH | `your run stays in this browser` |
| 6 | 33.0-46.0 | Bench POWER: boot trace streams, the finale lights the panel | `the real simulator, in WebAssembly` |
| 7 | 46.0-56.0 | RUN the corridor finale, SCANLINES on, trace + FRAME tick | `every frame travels a simulated SPI bus` |
| 8 | 56.0-70.0 | The reveal: FINALE -> DOOM. FETCHING WAD, Freedoom title boots, trace keeps streaming | `DOOM. on the same bus.` |
| 9 | 70.0-82.0 | DOOM E1M1: movement + pistol + HUD, then the RUNGS MONTAGE cue | `browser. binary. a booted kernel. real hardware.` |
| 10 | 82.0-92.0 | Colophon build plate (`BUILD <sha> - N TESTS GREEN - AIR-GAPPED`) | `air-gapped. no accounts. no telemetry.` |
| 11 | 92.0-99.0 | Front door again, clean, the definition line | `thunk (n.) - code set aside to run later` |
| 12 | 99.0-105.0 | Wordmark + `thunk.goolz.org` + the phosphor tick, cut to black | `thunk.goolz.org` |

## What the driver seeds + verifies

- **Seed:** before load it writes a believable prior run to `localStorage`
  (`thunk.xp.v1`): M0 partly done, one whole lesson complete, a couple M1 checks,
  LVL ~3-4, three achievements - so the meters read alive but not maxed. The
  on-camera check (beat 4) is the last one in "The Machine", so grading it
  completes the lesson and fires a real LESSON COMPLETE / level-up toast + XP tick.
- **Verify (smoke):** asserts the lesson grades PASS, the bench powers and the
  panel lights, the DOOM WAD loads, a movement key visibly changes the panel
  pixels (hash + non-black delta), the RAMWR trace streams during DOOM, and
  `markers.json` is written with all 12 beats. Proof stills land in `stills/`.

## Notes

- `demo/` is standalone: no Cargo.toml, outside `site/`, not a cargo workspace
  member - it never touches the Rust build or the site build.
- The driver only reads the deployed site + `window.__bench` (the bench's
  deterministic control surface). It writes nothing back to the repo.
