# thunk - the capstone: try your own open-source contribution

**Status:** spec'd 2026-07-16. Penn: "we ultimately want the end to have the[m] try their own
open source contribution." This is the project's designed north star - **M7 First Patch** - made
real on the public site. Scope chosen (Penn away, recommended option): **practice + launchpad** -
a safe simulated first PR to rehearse the mechanics, then a real launchpad that scaffolds them all
the way to opening their own PR. NO external-account wiring: the site stays no-accounts,
no-telemetry, fully static; the launchpad LINKS out, it never integrates or phones home.

## Why this fits (not a new idea - the activation of the existing one)

M7 "First Patch" is already authored (3 lessons: picking a project, a first docs fix,
review-and-merge; 9 checks) and gated to the `open` build because it needs the internet. The
public SPA *is* the internet - it is the natural home. The air-gapped facility bundle stays
M0-M6; the online course goes all the way to M7 and ends by walking the learner into a real
contribution.

## 1. Activate M7 on the public site (foundation)

- The site's content pipeline exports WITH the open feature so M7 is present:
  `cargo run -p thunk-cli --features open -- export` (the offline `thunk web` bundle stays default
  = M0-M6; only the SPA content includes M7). Update the CI `site` job's export step + the content
  freshness check to use `--features open`.
- M7 becomes **CH-07** across the ladder, rail, routes, sitemap. The course front-door stats and
  the sitemap URL count update (M7 adds lessons).
- **Gating/placement unchanged in spirit:** placement (test-out) stays M0-M6 - you cannot test out
  of doing your first contribution (already the design). M7 unlocks visually after M6, navigation
  stays free (site never blocks a reader).
- M7's lessons render like any other (prose + checks + any widgets), no special-casing beyond
  being the last channel. Verify all 3 M7 lessons render on the site with their checks.

## 2. The Practice PR (a simulated first contribution - rehearsal, zero stakes)

A new interactive component (widget/depth spirit; `first-pr`), embedded in M7's docs-fix lesson.
A safe, fully-faked walkthrough of the real mechanics so the learner rehearses before the real
thing:
- A small fake project + a file with an obvious docs defect (a stale command, a typo).
- The flow, one honest step at a time (state machine, keyboard-first): FORK -> EDIT the line ->
  see the DIFF you made (+/- colored, real diff feel) -> write a change description (a template) ->
  OPEN PR -> a reviewer leaves a comment ("nit: wrap at 80 cols" / "good catch - can you also
  fix the next line?") -> ADDRESS it -> APPROVED -> MERGED, with the honest beats M7 teaches
  (review judges the patch not the person; silence/waiting is normal; a merged change is public
  and permanent with your name on it).
- It teaches the mechanics (fork/branch/edit/diff/PR/review/merge) with zero risk. Pure state
  machine in TS with vitest tests; PVM-quiet; reduced-motion-safe; aria-live for each step.

## 3. The Launchpad (the real capstone - try YOUR own)

The true ending: a page/section (route `/first-patch` in the app shell, and/or embedded in M7's
review-and-merge lesson) that scaffolds a real contribution:
- **Find a first issue:** curated, real, out-linking searches (target=_blank, rel=noopener) - the
  on-ramps M7 already names: GitHub `good-first-issue`/`good first issue` label searches,
  kernelnewbies.org, the Linux Kernel Mentorship Program, Outreachy, and "docs of a tool you
  already use." Honest guidance on picking something small and real.
- **The change description template:** a fillable, copyable template (what was wrong / what is
  right now / how you verified). Client-side only; a COPY button.
- **Pre-submit checklist:** the quiet, real list (does it build? did you read CONTRIBUTING? is the
  change small and focused? did you describe what and why?). Checkboxes, localStorage.
- **My First Patch tracker:** a personal, local-only tracker of the one patch they're working on -
  project, issue link, and a stage stepper (CHOSE -> FORKED -> CHANGED -> SUBMITTED -> IN REVIEW
  -> MERGED). localStorage (`thunk.patch.v1`), export/import like progress. When they reach
  MERGED, a quiet, earned moment (a dry achievement `MERGED`, the existing toast style - no
  confetti). This is the emotional payoff the whole course builds to, kept honest.
- **Never** stores or transmits anything; all links open externally; no account, no API.

## 4. XP / achievement

One new dry achievement `MERGED` (marking their real first contribution as done, self-reported in
the tracker) plus the existing `UPSTREAM` (M7 mastery). The practice PR completion can fire a
small `FIRST PR` if it fits the locked economy - keep it quiet, no new visual language.

## 5. Non-negotiables

Site stays no-accounts / no-telemetry / static / hermetic. Single source of truth: M7 content in
the Rust crate; the launchpad's copy in the crate or the site per what fits (out-links are data).
Grader parity holds. PVM restraint, keyboard-first, reduced-motion, a11y. The honest framing from
M7's existing lessons carries through - this course does not promise a merge is easy or fast; it
promises it is public, permanent, and blind to your record.

## 6. Phases

- **C-1 Activate M7** on the public site (content pipeline `--features open`, ladder/rail/sitemap
  8-module, CI, render-verify). Foundation.
- **C-2 Practice PR** (`first-pr` simulated contribution) in M7's docs-fix lesson.
- **C-3 Launchpad + tracker** (`/first-patch`, curated out-links, template, checklist, tracker,
  MERGED achievement) - the real ending.
- **C-4 Polish + demo:** the demo film-driver gains a closing beat (the learner reaching the
  launchpad / MERGED), tying the video's arc to the real payoff; a11y/perf/screenshots.

**World-class gate:** the ending should make a learner feel they can actually do this - concrete,
honest, and theirs. Not a certificate; a launchpad.
