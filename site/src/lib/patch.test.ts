import { describe, it, expect } from 'vitest';
import {
	STAGES,
	STAGE_LABELS,
	STAGE_NOTES,
	CHECKLIST_ITEMS,
	PATCH_SCHEMA,
	newPatchState,
	stageIndex,
	nextStage,
	prevStage,
	isMerged,
	isStage,
	isValidPatchState,
	buildChangeDescription,
	type Stage
} from './patch';

describe('stage machine', () => {
	it('runs CHOSE -> ... -> MERGED in order', () => {
		expect(STAGES).toEqual(['chose', 'forked', 'changed', 'submitted', 'in-review', 'merged']);
	});

	it('has a label and a note for every stage', () => {
		for (const s of STAGES) {
			expect(STAGE_LABELS[s]).toBeTruthy();
			expect(STAGE_NOTES[s]).toBeTruthy();
		}
	});

	it('stageIndex is the position on the ladder', () => {
		expect(stageIndex('chose')).toBe(0);
		expect(stageIndex('merged')).toBe(STAGES.length - 1);
	});

	it('nextStage advances and clamps at MERGED', () => {
		expect(nextStage('chose')).toBe('forked');
		expect(nextStage('in-review')).toBe('merged');
		expect(nextStage('merged')).toBe('merged');
	});

	it('prevStage retreats and clamps at CHOSE', () => {
		expect(prevStage('merged')).toBe('in-review');
		expect(prevStage('forked')).toBe('chose');
		expect(prevStage('chose')).toBe('chose');
	});

	it('isMerged is only true at the last stage', () => {
		expect(isMerged('merged')).toBe(true);
		for (const s of STAGES.filter((x) => x !== 'merged')) expect(isMerged(s)).toBe(false);
	});

	it('walking next from CHOSE reaches MERGED in exactly five steps', () => {
		let s: Stage = STAGES[0];
		let steps = 0;
		while (!isMerged(s)) {
			s = nextStage(s);
			steps++;
			if (steps > 10) break; // guard against a broken clamp
		}
		expect(steps).toBe(5);
	});
});

describe('isStage', () => {
	it('accepts real stages and rejects everything else', () => {
		expect(isStage('merged')).toBe(true);
		expect(isStage('done')).toBe(false);
		expect(isStage(3)).toBe(false);
		expect(isStage(null)).toBe(false);
	});
});

describe('tracker state shape + import validation', () => {
	it('fresh state is valid, empty, at CHOSE', () => {
		const s = newPatchState();
		expect(isValidPatchState(s)).toBe(true);
		expect(s.schema).toBe(PATCH_SCHEMA);
		expect(s.stage).toBe('chose');
		expect(s.project).toBe('');
		expect(s.issueUrl).toBe('');
		expect(s.updatedAt).toBeNull();
	});

	it('accepts a fully-populated record', () => {
		const s = {
			schema: PATCH_SCHEMA,
			project: 'ripgrep',
			issueUrl: 'https://github.com/x/y/issues/1',
			stage: 'in-review',
			checklist: { builds: true },
			updatedAt: 123
		};
		expect(isValidPatchState(s)).toBe(true);
	});

	it('rejects wrong schema, bad stage, non-object checklist, array, and bad updatedAt', () => {
		expect(isValidPatchState(null)).toBe(false);
		expect(isValidPatchState({ ...newPatchState(), schema: 2 })).toBe(false);
		expect(isValidPatchState({ ...newPatchState(), stage: 'nope' })).toBe(false);
		expect(isValidPatchState({ ...newPatchState(), checklist: [] })).toBe(false);
		expect(isValidPatchState({ ...newPatchState(), project: 7 })).toBe(false);
		expect(isValidPatchState({ ...newPatchState(), updatedAt: 'now' })).toBe(false);
		expect(isValidPatchState('{}')).toBe(false);
	});
});

describe('pre-submit checklist', () => {
	it('has stable ids and real prompts', () => {
		expect(CHECKLIST_ITEMS.length).toBeGreaterThanOrEqual(4);
		const ids = CHECKLIST_ITEMS.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length); // unique
		for (const c of CHECKLIST_ITEMS) expect(c.label.length).toBeGreaterThan(0);
		expect(ids).toContain('builds');
		expect(ids).toContain('contributing');
	});
});

describe('change-description template', () => {
	it('renders the three-question frame in order', () => {
		const out = buildChangeDescription({
			wrong: 'the README said `make run`',
			right: 'it now says `cargo run`',
			verified: 'ran it on a clean checkout'
		});
		expect(out).toContain('### What was wrong');
		expect(out).toContain('### What is right now');
		expect(out).toContain('### How I verified it');
		expect(out.indexOf('What was wrong')).toBeLessThan(out.indexOf('What is right now'));
		expect(out.indexOf('What is right now')).toBeLessThan(out.indexOf('How I verified'));
		expect(out).toContain('the README said `make run`');
		expect(out).toContain('cargo run');
	});

	it('keeps the shape with a placeholder when a field is empty', () => {
		const out = buildChangeDescription({ wrong: '', right: '  ', verified: 'x' });
		expect(out).toContain('_(fill this in)_');
		// three headings survive regardless of fill
		expect((out.match(/^### /gm) ?? []).length).toBe(3);
	});
});
