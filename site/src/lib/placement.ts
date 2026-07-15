// The placement (calibration) flow's brain: pure, DOM-free, testable. It turns a
// set of graded placement answers into a per-module verdict. A module passes -
// and is marked mastered-by-placement - only when all three of its placement
// items were reached AND answered correctly. Anything short of that (a wrong
// answer, or stopping the run before reaching an item) is a SKIP, never a
// down-grade: placement only ever ADDS mastery.

import type { PlacementItem } from './content';

export type ModuleVerdict = 'pass' | 'skip';

export interface ModuleResult {
	moduleId: string;
	/** The placement check ids for this module, in run order. */
	checks: string[];
	/** How many of this module's items were answered correctly. */
	correct: number;
	verdict: ModuleVerdict;
}

/** Group placement items by module, preserving first-seen (run) order. */
export function placementGroups(items: PlacementItem[]): { moduleId: string; checks: string[] }[] {
	const groups: { moduleId: string; checks: string[] }[] = [];
	for (const it of items) {
		let g = groups.find((x) => x.moduleId === it.module);
		if (!g) {
			g = { moduleId: it.module, checks: [] };
			groups.push(g);
		}
		g.checks.push(it.check);
	}
	return groups;
}

/**
 * Per-module results from a graded run. `answered[checkId]` is true when that
 * item was answered correctly, false when answered wrong, and absent when the
 * item was never reached (the reader stopped early).
 */
export function moduleResults(
	items: PlacementItem[],
	answered: Record<string, boolean | undefined>
): ModuleResult[] {
	return placementGroups(items).map((g) => {
		const correct = g.checks.filter((c) => answered[c] === true).length;
		return {
			moduleId: g.moduleId,
			checks: g.checks,
			correct,
			verdict: correct === g.checks.length ? 'pass' : 'skip'
		};
	});
}

/** The module ids a run placed out of (all items correct). */
export function passedModuleIds(
	items: PlacementItem[],
	answered: Record<string, boolean | undefined>
): string[] {
	return moduleResults(items, answered)
		.filter((r) => r.verdict === 'pass')
		.map((r) => r.moduleId);
}
