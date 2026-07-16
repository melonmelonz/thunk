// The command palette's brain: pure, DOM-free, unit-testable. The component
// (CommandPalette.svelte) is a thin shell over these functions - it owns focus
// and keys; this file owns "what matches, in what order, with which chars lit".
//
// Match model: a simple case-insensitive subsequence (every query char appears
// in order). No library, no Levenshtein - an instrument filter, not Spotlight.
// The matched indices come back so the view can light those chars in phosphor.

import { modules } from './content';

export type PaletteKind = 'lesson' | 'channel' | 'place' | 'action';

export interface PaletteItem {
	id: string;
	kind: PaletteKind;
	/** The primary line, and the string matched + highlighted. */
	label: string;
	/** Right-aligned mono tag (CH code, a verb, a place). */
	hint?: string;
	/** Extra searchable text folded into matching but never highlighted. */
	keywords?: string;
	/** Navigation target, for lesson/channel/place items. */
	href?: string;
	/** Action key, for action items (dispatched, not navigated). */
	action?: string;
}

export interface Ranked {
	item: PaletteItem;
	/** Indices into item.label that matched, for phosphor highlighting. */
	indices: number[];
}

/**
 * Case-insensitive subsequence match. Returns the matched character indices in
 * `text` (empty for an empty query), or null when `query` is not a subsequence.
 */
export function subsequenceMatch(query: string, text: string): number[] | null {
	const q = query.toLowerCase();
	if (q === '') return [];
	const t = text.toLowerCase();
	const out: number[] = [];
	let ti = 0;
	for (const c of q) {
		let hit = -1;
		while (ti < t.length) {
			if (t[ti] === c) {
				hit = ti;
				ti++;
				break;
			}
			ti++;
		}
		if (hit === -1) return null;
		out.push(hit);
	}
	return out;
}

/**
 * Higher is better. Rewards early matches, contiguous runs, and hits that land
 * on a word boundary (start, space, and the separators the labels use: . - / ·).
 */
export function scoreMatch(indices: number[], text: string): number {
	if (indices.length === 0) return 0;
	let score = -indices[0] * 2; // earlier first hit wins
	for (let i = 1; i < indices.length; i++) {
		const gap = indices[i] - indices[i - 1] - 1;
		if (gap === 0) score += 4; // contiguous run bonus
		else score -= gap; // spread-out match penalty
	}
	for (const i of indices) {
		const prev = i === 0 ? '' : text[i - 1];
		if (i === 0 || prev === ' ' || prev === '.' || prev === '-' || prev === '/' || prev === '·')
			score += 3; // word-boundary bonus
	}
	return score;
}

// A gentle kind bias so, all else equal, places/channels sit above the long
// tail of lessons, and actions stay last. Never enough to beat a better label
// match - just a tiebreak.
const KIND_WEIGHT: Record<PaletteKind, number> = {
	place: 6,
	channel: 4,
	lesson: 0,
	action: -2
};

/**
 * Filter + rank items for `query`. Empty query returns the head of the list in
 * source order (capped). Non-empty matches label first (highlightable); an item
 * that only matches via keywords still surfaces, lower, with no highlight.
 */
export function filterItems(items: PaletteItem[], query: string, limit = 8): Ranked[] {
	const q = query.trim();
	if (q === '') return items.slice(0, limit).map((item) => ({ item, indices: [] }));

	const scored: { item: PaletteItem; indices: number[]; score: number }[] = [];
	for (const item of items) {
		const onLabel = subsequenceMatch(q, item.label);
		if (onLabel) {
			scored.push({
				item,
				indices: onLabel,
				score: scoreMatch(onLabel, item.label) + KIND_WEIGHT[item.kind]
			});
			continue;
		}
		if (item.keywords) {
			const onKw = subsequenceMatch(q, item.keywords);
			if (onKw) {
				scored.push({
					item,
					indices: [],
					score: scoreMatch(onKw, item.keywords) + KIND_WEIGHT[item.kind] - 25
				});
			}
		}
	}
	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, limit).map(({ item, indices }) => ({ item, indices }));
}

function chCode(tag: string): string {
	return 'CH-' + String(Number(tag.replace(/\D/g, ''))).padStart(2, '0');
}

/** The furthest-lesson resume target, resolved by the caller from the store. */
export interface ResumeHint {
	href: string;
	/** CH-NN.LL code of the lesson to resume. */
	code: string;
	/** The lesson title, for the label + keyword match. */
	title: string;
}

/**
 * The full command set. Lessons + channels come from the curriculum; the places
 * and actions are fixed. `onBench` gates the SCANLINES toggle to the one route
 * where it means anything. `resume`, when present (non-zero state), prepends a
 * CONTINUE item so it surfaces as the top result.
 */
export function buildItems(opts: { onBench?: boolean; resume?: ResumeHint | null } = {}): PaletteItem[] {
	const items: PaletteItem[] = [];

	if (opts.resume) {
		items.push({
			id: 'continue',
			kind: 'place',
			label: `CONTINUE - ${opts.resume.code} ${opts.resume.title.toUpperCase()}`,
			hint: 'RESUME',
			href: opts.resume.href,
			keywords: 'resume continue last lesson pick up where'
		});
	}

	items.push(
		{ id: 'place-bench', kind: 'place', label: 'THE BENCH', hint: 'BENCH', href: '/bench/', keywords: 'panel doom sim trace' },
		{ id: 'place-operator', kind: 'place', label: 'OPERATOR', hint: 'PROGRESS', href: '/progress/', keywords: 'xp level achievements progress card' },
		{ id: 'place-calibrate', kind: 'place', label: 'CALIBRATION', hint: 'PLACE OUT', href: '/calibrate/', keywords: 'placement test out calibrate skip prior knowledge' },
		{ id: 'place-colophon', kind: 'place', label: 'COLOPHON', hint: 'ABOUT', href: '/colophon/', keywords: 'about stack colophon licenses privacy provenance how it runs build' }
	);

	modules.forEach((m) => {
		const code = chCode(m.tag);
		items.push({
			id: `ch-${m.id}`,
			kind: 'channel',
			label: `${code}  ${m.title}`,
			hint: 'CHANNEL',
			href: `/m/${m.id}/`,
			keywords: `${m.tag} module ${m.title}`
		});
		m.lessons.forEach((l, li) => {
			const lc = `${code}.${String(li + 1).padStart(2, '0')}`;
			items.push({
				id: `lesson-${m.id}-${l.id}`,
				kind: 'lesson',
				label: `${lc}  ${l.title}`,
				hint: 'LESSON',
				href: `/m/${m.id}/${l.id}/`,
				keywords: `${m.title} ${l.title}`
			});
		});
	});

	items.push(
		{ id: 'act-rail', kind: 'action', label: 'TOGGLE RAIL', hint: 'ACTION', action: 'toggle-rail', keywords: 'collapse expand sidebar channels' },
		{ id: 'act-export', kind: 'action', label: 'EXPORT PROGRESS', hint: 'ACTION', action: 'export-progress', keywords: 'download json backup operator' }
	);
	if (opts.onBench) {
		items.push(
			{
				id: 'act-save-trace',
				kind: 'action',
				label: 'SAVE TRACE',
				hint: 'ACTION',
				action: 'save-trace',
				keywords: 'download bus trace txt export log'
			},
			{
				id: 'act-scanlines',
				kind: 'action',
				label: 'TOGGLE SCANLINES',
				hint: 'ACTION',
				action: 'toggle-scanlines',
				keywords: 'crt bench panel'
			}
		);
	}

	return items;
}
