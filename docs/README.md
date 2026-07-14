# thunk — Documentation Index

Everything for the thunk project lives here. Source code is in the crate folders one level up
(`thunk-core`, `thunk-content`, `thunk-sim`, `thunk-web`, `thunk-tui`, `thunk-cli`).

## Product and planning
- [`PRD.md`](PRD.md) — product requirements document.
- [`DESIGN-SPEC.md`](DESIGN-SPEC.md) — north-star design and architecture.
- [`HANDOFF.md`](HANDOFF.md) - session handoff: where things stand and what to build next.
- [`INFRA.md`](INFRA.md) - infrastructure: the two deployment worlds and the go-public checklist.
- [`PATHS.md`](PATHS.md) - running thunk: the four rungs, from in-process simulator to QEMU to a real panel.
- [`superpowers/plans/2026-07-06-thunk-phase1.md`](superpowers/plans/2026-07-06-thunk-phase1.md) — Phase 1 implementation plan.
- [`superpowers/plans/2026-07-10-thunk-buildout.md`](superpowers/plans/2026-07-10-thunk-buildout.md) - Phase 2 buildout plan (the milestone map).
- [`superpowers/plans/`](superpowers/plans/) - the six 2026-07-12 milestone plans: mA curriculum, mB gates,
  mC simulator, mD finale, mE trace, mF web.
- [`research/ui-ux-research.md`](research/ui-ux-research.md) - UI/UX research behind the web GUI (milestone M-F).
- [`screenshots/`](screenshots/) - web GUI screenshots (index in both themes, lesson, bench).

## Pitch and proposal
- [`PITCH.md`](PITCH.md) — one-page pitch.
- [`PITCH-3min.md`](PITCH-3min.md) — three-minute spoken pitch (with delivery notes).
- [`thunk-3min-pitch.html`](thunk-3min-pitch.html) - the designed three-minute pitch (open in a browser).
- [`PROPOSAL.md`](PROPOSAL.md) — full proposal, stats-backed.
- [`thunk-proposal.html`](thunk-proposal.html) — the designed proposal (open in a browser).
- [`thunk-value-proposition.html`](thunk-value-proposition.html) — value proposition (open source).
- [`thunk-addendum.html`](thunk-addendum.html) — market realism, accessibility, retention.

## Risk
- [`thunk-risk-assessment.html`](thunk-risk-assessment.html) — risk register (D/V/F, L×C scoring).
- [`thunk-risk-assessment.tsv`](thunk-risk-assessment.tsv) / [`.csv`](thunk-risk-assessment.csv) — spreadsheet-ready.
- [`thunk-risk-rows.tsv`](thunk-risk-rows.tsv) — data rows only, to paste under an existing header.
- [`beautify-risk-sheet.gs`](beautify-risk-sheet.gs) — Google Apps Script to style the sheet.

## Print-ready
- [`pdf/`](pdf/) — PDF of every designed document (proposal, pitch, value proposition, addendum, risk),
  plus the markdown-rendered set (PRD, design spec, pitch).
- [`build/md2pdf.py`](build/md2pdf.py) - renders the markdown docs (PRD, design spec, pitch) to
  uniformly styled PDFs; run `python3 docs/build/md2pdf.py` from the repo root.

## A note on register
The pitch, proposal, value proposition, and addendum are written in Penn's own voice. The PRD, design
spec, and risk assessment are deliberately in a neutral, professional technical register, which is the
norm for those documents.
