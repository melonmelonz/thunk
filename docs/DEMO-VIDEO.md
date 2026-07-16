# thunk - 1:45 tech demo, production plan

**Goal:** a gorgeous, tightly-cut 105-second demo that earns the phrase "pull out all the
stops" without a single wasted second. The story is already there: **true zero to DOOM, every
pixel over a simulated bus.** We film the real site (thunk.goolz.org / thunk-course.pages.dev),
not a mockup, and we drive it deterministically so the take is flawless and repeatable.

The climax is fixed: **FINALE -> DOOM on the virtual panel while the bus trace keeps streaming.**
Everything before it builds to that; the ~15 seconds after it lands the meaning.

---

## 1. The cut (scene-by-scene, timings sum to 105s)

Each row: elapsed window, what's on screen, the camera move, and the on-screen caption
(PVM-quiet lower-third, mono, phosphor key word). Voiceover optional - the captions carry it;
if a VO is used, keep it sparse and plain (Penn's voice, no hype).

| # | t (s) | On screen | Camera / motion | Caption (mono, lower-left) |
|---|-------|-----------|-----------------|----------------------------|
| 1 | 0.0-6.0 | Black. The phosphor tick warms up (the once-per-session boot ritual), then the front door fades in - wordmark, the `thunk (n.)` definition, the truth badges. | Hold, no move. Let the boot ritual breathe. | `// a systems course` |
| 2 | 6.0-12.0 | The stat readout (07 / 31 / 93) and the INIT SEQ hex strip draw in; the ladder rises (staggered). | Slow 4% push-in on the ladder. | `from 1s and 0s, up through Rust` |
| 3 | 12.0-18.0 | Enter the app: rack compresses into the left rail (view transition), lesson pane opens on "The Machine". | The transition IS the move; settle. | `learn the machine itself` |
| 4 | 18.0-27.0 | Scroll the lesson pane a touch; land on a check; pick the right answer; GRADE; verdict PASS in phosphor; the XP meter ticks 0 -> 15; a toast slides in (`POWER ON  +15 XP`). | Zoom-to-region on the check card during grade, ease back out on the toast. | `graded here. nothing sent anywhere.` |
| 5 | 27.0-33.0 | Cut to /progress for ~2s (LVL 01, the operator card, achievements grid) then to the rail's THE BENCH. | Quick, confident cuts. | `your run stays in this browser` |
| 6 | 33.0-46.0 | The Bench, pre-boot: dark panel, NO SIGNAL, the trace log empty. Press POWER. The boot trace streams in (SWRESET, SLPOUT, COLMOD, CASET/PASET, RAMWR) and the corridor finale lights the panel. | Push in on the panel as it lights; the trace log scrolls in peripheral view. | `the real simulator, in WebAssembly` |
| 7 | 46.0-56.0 | RUN. The corridor animates; the trace streams RAMWR live underneath; the WINDOW register + FRAME counter tick. Toggle SCANLINES on for the CRT bloom. | Slow orbit-feel: pan from panel to trace and back (OBS crop/pan, not a real 3D move). | `every frame travels a simulated SPI bus` |
| 8 | 56.0-70.0 | **The reveal.** Flip the source switch FINALE -> DOOM. `FETCHING WAD` ticks, then the panel boots the Freedoom title, then E1M1: movement, the pistol, the HUD. The bus trace keeps streaming RAMWR the entire time. | Hold WIDE so both the DOOM panel and the live trace are in frame together - the whole point is that they coexist. Tiny push-in as gameplay starts. | `DOOM. on the same bus.` |
| 9 | 70.0-82.0 | Gameplay continues ~4s (fire a few shots), then a montage of the OTHER rungs: a terminal running `thunk tui` / `thunk sim --trace`; the QEMU boot smoke serial log scrolling to `THUNK-QEMU-OK`; a still/photo of the BeaglePlay panel (if available) or the `thunk hw` command. | Fast, rhythmic cuts on the beat. Each rung ~3s. | `browser. binary. a booted kernel. real hardware.` |
| 10 | 82.0-92.0 | Back to the site: the colophon or the ladder, the build plate (`BUILD <sha> · N TESTS GREEN · AIR-GAPPED`), the badges. | Settle, ease out. | `air-gapped. no accounts. no telemetry.` |
| 11 | 92.0-99.0 | The front door again, clean, the definition line centered. | Slow pull-back. | `thunk (n.) - code set aside to run later` |
| 12 | 99.0-105.0 | Wordmark + `thunk.goolz.org` + the phosphor tick. Cut to black on the last beat. | Hold. | `thunk.goolz.org` |

**Pacing rule:** the first 33s is setup (calm, deliberate), 33-56 is the instrument (building),
56-70 is the DOOM climax (hold, don't rush it - it's the shot people remember), 70-92 is the
"and it's real everywhere" flex (fast), 92-105 is the exhale.

---

## 2. OBS setup

- **Canvas / output:** 1920x1080 @ 60fps (60 matters - the bench and DOOM are motion). If the
  display and disk allow, capture 2160p and downscale on export for crisper text; 1080p60 is the
  safe default. Encoder: x264 `veryslow`/CRF 16 or NVENC HEVC high-quality for the master; export
  a clean H.264 for sharing.
- **Sources:**
  - A single **Browser Source** (or Window Capture of the browser) pointed at the live site,
    kiosk/fullscreen, at exactly 1920x1080 so pixels are 1:1 (no scaling blur). Prefer a Chromium
    kiosk (`--kiosk --hide-scrollbars --force-device-scale-factor=1`) over OBS's built-in browser
    if you want the wasm + DOOM to run at full speed.
  - A **terminal** source (Window Capture) for the rung montage (scene 9): a dark terminal with a
    matching mono font and near-black bg so it cuts cleanly against the site.
  - Optional **still image** sources for the BeaglePlay/hardware beat.
- **The camera moves** are done in OBS with the **crop/pad + transform** on the browser source, or
  the `Move` plugin (recommended) to keyframe smooth push-ins/pans. No real zoom of the browser -
  always scale the 1080p source up within a 1080p canvas so text stays crisp; keep push-ins subtle
  (<=8%) so upscaling never softens the type. The `Advanced Scene Switcher` or `Move` plugin lets
  you script the pans to hit the timings above.
- **Cursor:** hide it except when a click is the point (scenes 4, 6, 8). A styled large cursor or a
  subtle click-ring (OBS `Mouse Highlight`-style) reads intentional; a jittery default pointer does
  not. If driving deterministically (section 4), the cursor can be hidden entirely and the actions
  read as the UI responding on its own - often cleaner.
- **Color:** set OBS color space to sRGB, full range; the PVM palette is calibrated for that. Do
  not apply a LUT or "cinematic" filter - the design already is the look. A *very* faint film-grain
  filter (2-4% opacity) over the whole comp is the only grade worth considering, and only if it
  doesn't crawl on the flat blacks.

---

## 3. Sound

- **Music:** cool-jazz / downtempo instrumental, ~85-95 BPM, brushed drums + upright bass + a
  little Rhodes - Bebop *in the bones*, not a needle-drop of a Bebop track (and not anything
  copyrighted for a public post). The DOOM reveal (t=56) should land on a musical lift - arrange
  the cut so scene 8 starts on a downbeat or a cymbal swell. Silence for the first ~1s over black,
  then the tick warms in with the first note.
- **Diegetic:** consider letting a couple seconds of actual DOOM audio (if the wasm build has sound
  - the current headless port does NOT) OR a single soft "power-on" whir under scene 6's boot. Keep
  it subtle; the trace is a visual instrument, it doesn't need SFX on every byte.
- **Captions** double as the rhythm track - time each caption's fade to a musical phrase.

---

## 4. The deterministic "film run" (pull out all the stops)

Do NOT hand-drive the browser on the take - one fumbled click ruins 105 seconds. Instead, a
**Playwright film-driver script** performs the exact on-screen run at scripted speeds while OBS
records the browser window. This is the single biggest quality multiplier and it is buildable
against the live site (no repo coupling):

- The script opens the site at 1920x1080, DPR 1, and executes the beats with human-feeling pacing:
  it seeds a bit of prior progress (so meters aren't all zero), navigates, hovers, clicks GRADE,
  waits for the toast, opens the bench, presses POWER, RUNs, waits for the finale to settle, flips
  to DOOM, waits for the title + a few gameplay ticks, and drives DOOM input for the on-camera
  movement/fire - all with deliberate `waitForTimeout`s tuned to the caption timings above.
- It emits **timestamp markers** to the console (or a JSON) at each beat, so the editor can snap
  cuts and captions to exact frames.
- Two modes: a **slow, on-camera** run (what OBS records) and a **fast smoke** run (to rehearse and
  to prove the sequence still works after any deploy).
- Because it drives the *deployed* site, it films the real thing - DOOM WAD fetch and all. Pre-warm
  the WAD (load /bench and flip to DOOM once before the take) so scene 8's `FETCHING WAD` is either
  shown deliberately for ~1.5s or already cached for an instant boot - director's choice; I'd show
  ~1.5s of the progress line because it's honest and it teaches.

I will build this film-driver script after the current hardening + features work merges (so it
films the final site including the colophon and any new bench controls). It lives outside the repo
(or in a `demo/` dir excluded from the build) and targets the live URL. Deliverable: `demo/film.mjs`
(+ `demo/README.md` with the OBS record-then-run steps and the marker->caption mapping).

---

## 5. Pre-production checklist (before the take)

- Deploy is final and green; `thunk.goolz.org` resolving (or film the pages.dev alias).
- Seed a demo progress state in localStorage so LVL/meters look alive but not maxed (the film-driver
  does this).
- Pre-warm the DOOM WAD once so the reveal is instant or a controlled 1.5s.
- Browser at 1920x1080, DPR 1, kiosk, scrollbars hidden, extensions off, a clean profile.
- Reduced-motion OFF for the take (we WANT the boot ritual and transitions); it's the one time.
- Disk space + a test 10s capture to confirm 60fps with no dropped frames while DOOM runs.
- Music bed picked and roughly laid so cuts can hit the DOOM downbeat.

---

## 6. If a voiceover is wanted (optional script, ~40 words, plain)

> "This is thunk. It teaches computing from ones and zeros, up through Rust. You read a lesson,
> you answer, it grades right here. Then the bench: a real simulator, in your browser. Watch the
> bus. ... And that's DOOM, on the same bus. Air-gapped. Open source. thunk dot goolz dot org."

Keep it under the music, let the DOOM reveal have a beat of near-silence before "and that's DOOM."
