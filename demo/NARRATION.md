# thunk - narration sheet

A teleprompter for the generated film. The video does the whole run on its own -
the three-developers story, the front door, a widget you drive, the command
palette, a graded check with the XP toast, the WebAssembly bench, DOOM on the
simulated bus and its cheat-code wink, the Konami degauss, and the first-patch
tracker reaching MERGED - so all you do is talk over it.

- **Video:** `demo/out/thunk-narration.mp4` (1920x1080, 30fps, ~1:33, silent)
- **Script source:** [`../docs/DEMO-SCRIPT.md`](../docs/DEMO-SCRIPT.md) (the ~170-word VO, unchanged)
- **Beat timings:** `demo/out/markers.json` (regenerated every render)

## How to record the voiceover

Pick whichever is easier:

1. **Talk over playback (simplest).** Open the MP4, start a voice recorder, hit
   play, and read the lines below as each beat lands. One take. If you fluff a
   line, restart - it is only 90 seconds.
2. **In an editor (cleaner).** Drop the MP4 on the timeline, record or import the
   VO on an audio track, and nudge it to the timestamps below. Export.

The video is deliberately a hair longer than the 1:30 script (~1:33) because the
course section shows the bench, DOOM, and the cheat in full. That extra footage
is the "let a beat of the bench run" the script note invites - let it breathe;
you do not have to fill every second with words.

## The run, line by line

Timestamps are where each **beat starts on screen**. Start speaking the line a
beat before its timestamp so the words land with the picture. Read at a normal,
unhurried pace.

| Time | On screen | Say |
|------|-----------|-----|
| **0:00** | Three applicants side by side; only DEV 03 has a merged PR, and it lights up | "Three people apply for the same Rust job. All three can write Rust. All three have projects on their GitHub. One of them also has a merged open-source contribution. A real change, in software other people use, reviewed and accepted by strangers. That is the one who gets the call." |
| **~0:14** | The line resolves as we cut to the front door | "A personal project says trust me. A merged contribution is proof." |
| **0:15** | The thunk front door powers on (boot ritual), the definition and the stats | "thunk is for people who want to be that third developer. It is built for folks coming home from prison, and it works for anyone starting from zero." |
| **0:27** | The ladder, then a lesson opens and the Frame Budget widget is driven across the 30 fps line; the command palette; a check grades to PASS with the XP toast | "It teaches programming from the ground up, through Rust. You do not just read and answer questions. You work the machine yourself, right in the browser, so it sticks." |
| **0:49** | The bench powers up, the finale runs over the simulated bus, then DOOM boots on the same panel (a cheat-code wink flashes) | *(let it run - or ad-lib one line: "It goes all the way down to a real driver, a real bus, and yes, DOOM.")* "But that is not the point. Where it ends is the point." |
| **1:09** | The launchpad: the First Patch tracker | "thunk walks you into your first real open-source contribution. It helps you find an issue you can actually fix, gives you a template and a checklist," |
| **1:12** | The tracker steps CHOSE -> FORKED -> ... -> MERGED | "and tracks it from the day you pick it up to the day it gets merged. Not a certificate that says you showed up. A contribution with your name on it, out in the open, that anyone can check." |
| **1:23** | A quick degauss flourish, then the wordmark and the address, fading to black | "That is the difference between hoping someone believes your resume and handing them proof. Start at zero, finish with a contribution." |
| **~1:30** | On the address, held | "thunk dot goolz dot org." *(read slowly, then let it cut to black)* |

## Delivery notes (from the script)

- **THE STORY is the whole pitch.** If you only nail 20 seconds, nail the opening.
- No trailer voice. Plain and concrete - it is your resume talking, not a movie.
- Read the address slowly at the very end, over the wordmark, then stop.
- The alt payoff lines are still in [`../docs/DEMO-SCRIPT.md`](../docs/DEMO-SCRIPT.md)
  if you prefer "you graduate with a history" or the background-check line.

## Regenerating the video

```sh
cd demo
npm i                       # once (Playwright; chromium is cached at rev 1228)
# in another shell, serve the built site:  (from ../site)  npm run build && npx vite preview --port 4173
node narrate.mjs            # -> out/thunk-narration.mp4 + out/markers.json
node narrate.mjs --fast     # quick rehearsal render (~0.4x pacing)
node narrate.mjs --url=https://thunk.goolz.org   # film the deployed site instead of local
```

The driver needs `ffmpeg` on PATH (it transcodes the Playwright webm to H.264).
It writes only under `demo/out/` and reads only the site + `window.__bench`.
