import { describe, it, expect } from 'vitest';
import {
	subsequenceMatch,
	scoreMatch,
	filterItems,
	buildItems,
	type PaletteItem
} from './palette';

describe('subsequenceMatch', () => {
	it('empty query matches with no highlighted indices', () => {
		expect(subsequenceMatch('', 'THE BENCH')).toEqual([]);
	});

	it('returns the matched indices in order', () => {
		// "bnc" hits B(4), n(6), c(7) in "THE BENCH"
		expect(subsequenceMatch('bnc', 'THE BENCH')).toEqual([4, 6, 7]);
	});

	it('is case-insensitive both ways', () => {
		expect(subsequenceMatch('BENCH', 'the bench')).toEqual([4, 5, 6, 7, 8]);
		expect(subsequenceMatch('bench', 'THE BENCH')).toEqual([4, 5, 6, 7, 8]);
	});

	it('matches a contiguous prefix', () => {
		expect(subsequenceMatch('the', 'THE BENCH')).toEqual([0, 1, 2]);
	});

	it('returns null when a char is missing', () => {
		expect(subsequenceMatch('xyz', 'THE BENCH')).toBeNull();
	});

	it('returns null when order cannot be honoured', () => {
		// all chars present but not in this order
		expect(subsequenceMatch('hcneb', 'BENCH')).toBeNull();
	});

	it('never reuses a character position', () => {
		// two b's cannot both match a single b
		expect(subsequenceMatch('bb', 'bench')).toBeNull();
	});
});

describe('scoreMatch', () => {
	it('an empty match scores zero', () => {
		expect(scoreMatch([], 'anything')).toBe(0);
	});

	it('prefers an earlier first match', () => {
		const text = 'aXbc';
		const early = scoreMatch(subsequenceMatch('a', text)!, text);
		const late = scoreMatch(subsequenceMatch('b', text)!, text);
		expect(early).toBeGreaterThan(late);
	});

	it('rewards contiguous runs over spread-out matches', () => {
		const contiguous = scoreMatch(subsequenceMatch('bench', 'bench')!, 'bench');
		const spread = scoreMatch(subsequenceMatch('bnh', 'bench')!, 'bench');
		expect(contiguous).toBeGreaterThan(spread);
	});

	it('rewards a word-boundary hit', () => {
		const boundary = scoreMatch(subsequenceMatch('b', 'a b')!, 'a b');
		const mid = scoreMatch(subsequenceMatch('b', 'ab')!, 'ab');
		expect(boundary).toBeGreaterThan(mid);
	});
});

const sample: PaletteItem[] = [
	{ id: 'a', kind: 'place', label: 'THE BENCH', keywords: 'panel' },
	{ id: 'b', kind: 'place', label: 'OPERATOR', keywords: 'xp progress' },
	{ id: 'c', kind: 'channel', label: 'CH-01  The Kernel', keywords: 'm1' },
	{ id: 'd', kind: 'lesson', label: 'CH-01.02  Ring Zero', keywords: 'kernel' },
	{ id: 'e', kind: 'action', label: 'TOGGLE RAIL', keywords: 'collapse' }
];

describe('filterItems', () => {
	it('empty query returns the head in source order', () => {
		const r = filterItems(sample, '', 3);
		expect(r.map((x) => x.item.id)).toEqual(['a', 'b', 'c']);
		expect(r.every((x) => x.indices.length === 0)).toBe(true);
	});

	it('caps results at the limit', () => {
		expect(filterItems(sample, '', 2)).toHaveLength(2);
	});

	it('finds the best label match first and lights the chars', () => {
		const r = filterItems(sample, 'bench');
		expect(r[0].item.id).toBe('a');
		expect(r[0].indices).toEqual(subsequenceMatch('bench', 'THE BENCH'));
	});

	it('surfaces a keyword-only match with no highlight', () => {
		// "progress" is not a subsequence of "OPERATOR" but is a keyword
		const r = filterItems(sample, 'progress');
		expect(r.map((x) => x.item.id)).toContain('b');
		const hit = r.find((x) => x.item.id === 'b')!;
		expect(hit.indices).toEqual([]);
	});

	it('ranks a label match above a keyword-only match', () => {
		// "rail" matches TOGGLE RAIL on the label; nothing else beats it
		const r = filterItems(sample, 'rail');
		expect(r[0].item.id).toBe('e');
	});

	it('returns nothing for a query no item can satisfy', () => {
		expect(filterItems(sample, 'zzzzz')).toEqual([]);
	});
});

describe('buildItems', () => {
	it('includes the places (bench, operator, calibrate) and the base actions', () => {
		const ids = buildItems().map((i) => i.id);
		expect(ids).toContain('place-bench');
		expect(ids).toContain('place-operator');
		expect(ids).toContain('place-calibrate');
		expect(ids).toContain('act-rail');
		expect(ids).toContain('act-export');
	});

	it('omits CONTINUE at the zero state and prepends it (top) when resume is given', () => {
		expect(buildItems().some((i) => i.id === 'continue')).toBe(false);
		const items = buildItems({
			resume: { href: '/m/m1-kernel/02-ring-zero/', code: 'CH-01.02', title: 'Ring Zero' }
		});
		expect(items[0].id).toBe('continue');
		expect(items[0].href).toBe('/m/m1-kernel/02-ring-zero/');
		expect(items[0].label).toContain('CH-01.02');
		expect(items[0].label).toContain('RING ZERO');
	});

	it('includes the colophon place everywhere', () => {
		const colophon = buildItems().find((i) => i.id === 'place-colophon');
		expect(colophon?.href).toBe('/colophon/');
	});

	it('gates SCANLINES and SAVE TRACE to the bench', () => {
		expect(buildItems({ onBench: false }).some((i) => i.id === 'act-scanlines')).toBe(false);
		expect(buildItems({ onBench: true }).some((i) => i.id === 'act-scanlines')).toBe(true);
		expect(buildItems({ onBench: false }).some((i) => i.id === 'act-save-trace')).toBe(false);
		const save = buildItems({ onBench: true }).find((i) => i.id === 'act-save-trace');
		expect(save?.action).toBe('save-trace');
	});

	it('emits a channel and lessons for every module, all navigable', () => {
		const items = buildItems();
		const channels = items.filter((i) => i.kind === 'channel');
		const lessons = items.filter((i) => i.kind === 'lesson');
		expect(channels.length).toBeGreaterThan(0);
		expect(lessons.length).toBeGreaterThan(channels.length);
		for (const i of [...channels, ...lessons]) {
			expect(i.href).toMatch(/^\/m\//);
		}
	});

	it('every item is reachable by typing its label', () => {
		const items = buildItems({ onBench: true });
		for (const item of items) {
			const r = filterItems(items, item.label);
			expect(r.some((x) => x.item.id === item.id)).toBe(true);
		}
	});
});
