// The launchpad's brain: pure, DOM-free, unit-testable. The /first-patch page
// (a reactive store in patch.svelte.ts, then a Svelte view) is a thin shell over
// these functions - this file owns the stage machine, the tracker's persisted
// shape + import validation, the change-description template, and the checklist
// definition. Nothing here touches storage, the network, or the DOM. The tracker
// is the learner's own notes about ONE real patch; it never leaves the browser.

/** The stages of a first contribution, in order. The stepper walks these. */
export const STAGES = [
	'chose',
	'forked',
	'changed',
	'submitted',
	'in-review',
	'merged'
] as const;

export type Stage = (typeof STAGES)[number];

/** The plate label for each stage (what the stepper prints). */
export const STAGE_LABELS: Record<Stage, string> = {
	chose: 'CHOSE',
	forked: 'FORKED',
	changed: 'CHANGED',
	submitted: 'SUBMITTED',
	'in-review': 'IN REVIEW',
	merged: 'MERGED'
};

/** A one-line, honest note under each stage - what "done" means, quietly. */
export const STAGE_NOTES: Record<Stage, string> = {
	chose: 'You picked a real issue, small and specific.',
	forked: 'You forked the repo and made a branch for the change.',
	changed: 'You made the edit and confirmed it builds.',
	submitted: 'You opened the pull request with a clear description.',
	'in-review': 'A maintainer is looking. Silence is normal; waiting is normal.',
	merged: 'It landed. Public, permanent, and blind to your record.'
};

export const PATCH_KEY = 'thunk.patch.v1';
export const PATCH_SCHEMA = 1;

/** One pre-submit checklist item: a stable id and its quiet, real prompt. */
export interface ChecklistItem {
	id: string;
	label: string;
}

/**
 * The pre-submit checklist - the quiet list a maintainer wishes every first-time
 * contributor ran before hitting submit. Not gamified; just true.
 */
export const CHECKLIST_ITEMS: ChecklistItem[] = [
	{ id: 'builds', label: 'It builds, and the tests still pass.' },
	{ id: 'contributing', label: 'I read CONTRIBUTING (or the project’s equivalent).' },
	{ id: 'small', label: 'The change is small and focused - one thing.' },
	{ id: 'whatwhy', label: 'I said what changed and why, in plain words.' }
];

/** The learner's own record of the one patch they are working on. Local only. */
export interface PatchState {
	schema: number;
	/** Free-text project name (e.g. "ripgrep"). */
	project: string;
	/** The issue or PR link they are working against. */
	issueUrl: string;
	/** Where they are in the stage machine. */
	stage: Stage;
	/** checklist id -> ticked. */
	checklist: Record<string, boolean>;
	/** Last mutation time, or null at the zero state. */
	updatedAt: number | null;
}

export function newPatchState(): PatchState {
	return {
		schema: PATCH_SCHEMA,
		project: '',
		issueUrl: '',
		stage: 'chose',
		checklist: {},
		updatedAt: null
	};
}

/** The stage's position on the ladder (0..STAGES.length-1). */
export function stageIndex(stage: Stage): number {
	const i = STAGES.indexOf(stage);
	return i < 0 ? 0 : i;
}

/** The next stage, clamped at MERGED. */
export function nextStage(stage: Stage): Stage {
	return STAGES[Math.min(stageIndex(stage) + 1, STAGES.length - 1)];
}

/** The previous stage, clamped at CHOSE. */
export function prevStage(stage: Stage): Stage {
	return STAGES[Math.max(stageIndex(stage) - 1, 0)];
}

/** True once the tracker reads MERGED - the earned moment. */
export function isMerged(stage: Stage): boolean {
	return stage === 'merged';
}

/** A value is a real Stage (guards imports + persisted reads). */
export function isStage(v: unknown): v is Stage {
	return typeof v === 'string' && (STAGES as readonly string[]).includes(v);
}

/** Structural validation for import/restore. Rejects anything not v1-shaped. */
export function isValidPatchState(v: unknown): v is PatchState {
	if (typeof v !== 'object' || v === null) return false;
	const s = v as Record<string, unknown>;
	if (s.schema !== PATCH_SCHEMA) return false;
	if (typeof s.project !== 'string' || typeof s.issueUrl !== 'string') return false;
	if (!isStage(s.stage)) return false;
	if (typeof s.checklist !== 'object' || s.checklist === null || Array.isArray(s.checklist)) {
		return false;
	}
	if (!(s.updatedAt === null || (typeof s.updatedAt === 'number' && Number.isFinite(s.updatedAt)))) {
		return false;
	}
	return true;
}

/** The three questions a good change description answers (M7's own rule). */
export interface ChangeDescription {
	wrong: string;
	right: string;
	verified: string;
}

/**
 * Render the change-description template as plain markdown, ready to paste into a
 * pull request. Empty fields become a quiet placeholder so the shape survives a
 * half-filled copy. This is the SAME three-question frame M7 teaches: what was
 * wrong, what is right now, how you verified it.
 */
export function buildChangeDescription(d: ChangeDescription): string {
	const fill = (s: string) => (s.trim().length > 0 ? s.trim() : '_(fill this in)_');
	return [
		'### What was wrong',
		fill(d.wrong),
		'',
		'### What is right now',
		fill(d.right),
		'',
		'### How I verified it',
		fill(d.verified),
		''
	].join('\n');
}
