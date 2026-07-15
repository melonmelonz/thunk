import { describe, it, expect } from 'vitest';
import { placementGroups, moduleResults, passedModuleIds } from './placement';
import type { PlacementItem } from './content';

const items: PlacementItem[] = [
	{ module: 'm0', check: 'm0-a' },
	{ module: 'm0', check: 'm0-b' },
	{ module: 'm0', check: 'm0-c' },
	{ module: 'm1', check: 'm1-a' },
	{ module: 'm1', check: 'm1-b' },
	{ module: 'm1', check: 'm1-c' }
];

describe('placementGroups', () => {
	it('groups by module in run order, 3 checks each', () => {
		const g = placementGroups(items);
		expect(g.map((x) => x.moduleId)).toEqual(['m0', 'm1']);
		expect(g[0].checks).toEqual(['m0-a', 'm0-b', 'm0-c']);
	});
});

describe('moduleResults', () => {
	it('passes a module only when all three items are correct', () => {
		const answered = { 'm0-a': true, 'm0-b': true, 'm0-c': true, 'm1-a': true, 'm1-b': false };
		const r = moduleResults(items, answered);
		expect(r[0]).toMatchObject({ moduleId: 'm0', correct: 3, verdict: 'pass' });
		expect(r[1]).toMatchObject({ moduleId: 'm1', correct: 1, verdict: 'skip' });
	});

	it('treats an unreached item (stopped early) as a skip, not a pass', () => {
		// Only m0 fully answered; m1 never reached.
		const answered = { 'm0-a': true, 'm0-b': true, 'm0-c': true };
		expect(passedModuleIds(items, answered)).toEqual(['m0']);
	});

	it('one wrong answer skips the whole module', () => {
		const answered = { 'm0-a': true, 'm0-b': true, 'm0-c': false };
		expect(passedModuleIds(items, answered)).toEqual([]);
	});

	it('places out of everything when the whole run is correct', () => {
		const answered = Object.fromEntries(items.map((i) => [i.check, true]));
		expect(passedModuleIds(items, answered)).toEqual(['m0', 'm1']);
	});
});
