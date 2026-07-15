// The XP + achievements engine: a runes store persisted to localStorage
// `thunk.xp.v1`. Pure math and the achievement table live in xp-curve.ts; this
// file is the reactive, side-effecting wrapper - awards, idempotency, the toast
// queue, and export/import.
//
// Toast policy (kept quiet, on purpose): a passed check ticks the meter but does
// NOT toast - checks are frequent and a chip per check would read as gamified.
// Milestones toast: lesson complete, module mastered, bench events, achievements,
// and level-ups. Everything queues; nothing stacks louder than a hairline chip.

import { browser } from '$app/environment';
import { modules } from './content';
import type { Check, Module } from './content';
import {
	newState,
	isValidState,
	levelForXp,
	levelProgress,
	AWARD,
	ACHIEVEMENTS,
	MODULE_ACHIEVEMENT,
	type XpState
} from './xp-curve';

const KEY = 'thunk.xp.v1';

export interface Toast {
	id: number;
	kind: 'xp' | 'ach' | 'level';
	label: string;
	xp?: number;
}

// ---- Static content indices (built once, no browser needed) ------------------
const CHECK_LESSON = new Map<string, string>(); // checkId -> lessonId
const CHECK_MODULE = new Map<string, string>(); // checkId -> moduleId
const LESSON_CHECKS = new Map<string, string[]>(); // lessonId -> checkIds
const MODULE_CHECKS = new Map<string, string[]>(); // moduleId -> checkIds
for (const m of modules) {
	const mc: string[] = [];
	for (const l of m.lessons) {
		const lc = l.checks.map((c) => c.id);
		LESSON_CHECKS.set(l.id, lc);
		for (const c of l.checks) {
			CHECK_LESSON.set(c.id, l.id);
			CHECK_MODULE.set(c.id, m.id);
			mc.push(c.id);
		}
	}
	MODULE_CHECKS.set(m.id, mc);
}

export interface ModuleStat {
	passed: number;
	total: number;
	pct: number; // 0..100 integer
	mastered: boolean;
	unlocked: boolean;
}

class XpStore {
	state = $state<XpState>(newState());
	toasts = $state<Toast[]>([]);
	#seq = 0;
	#loaded = false;

	// The persisted record is loaded in hydrate(), called from the global layout's
	// onMount - NOT in the constructor. Prerendered HTML renders the empty state
	// (0 XP, NO SIGNAL); loading after hydration keeps the first client render
	// matching the server markup, then the meters tick up reactively.
	hydrate(): void {
		this.#load();
	}

	// ---- Reactive readouts --------------------------------------------------
	get xp(): number {
		return this.state.xp;
	}
	get level(): number {
		return levelForXp(this.state.xp);
	}
	get fill(): number {
		return levelProgress(this.state.xp).fill * 100;
	}
	get achievements(): Record<string, number> {
		return this.state.achievements;
	}

	isPassed(id: string): boolean {
		return !!this.state.passedChecks[id];
	}
	isFirstTry(id: string): boolean {
		return !!this.state.passedChecks[id]?.firstTry;
	}
	hasAchievement(id: string): boolean {
		return !!this.state.achievements[id];
	}

	/** Per-module tally for the rail, index, and operator card. */
	moduleStat(module: Module, indexInLadder: number): ModuleStat {
		const ids = MODULE_CHECKS.get(module.id) ?? [];
		const passed = ids.filter((id) => this.isPassed(id)).length;
		const total = ids.length;
		const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
		const prev = modules[indexInLadder - 1];
		return {
			passed,
			total,
			pct,
			mastered: !!this.state.modulesMastered[module.id],
			// Visual gate only. Module N unlocks when N-1 is mastered; the first is
			// always open. Navigation is NEVER blocked here - a reader can open any
			// lesson by URL. Gating is the facility binary's job; the site only
			// *shows* the ladder rule. (See spec section 5 / deliverable 5.)
			unlocked: indexInLadder === 0 || !!(prev && this.state.modulesMastered[prev.id])
		};
	}

	// ---- Awards -------------------------------------------------------------
	/** Grade press for a check: `correct` decides the award. Idempotent per id. */
	gradeCheck(check: Check, correct: boolean): void {
		if (!browser) return;
		this.state.attempts[check.id] = (this.state.attempts[check.id] ?? 0) + 1;
		if (correct && !this.state.passedChecks[check.id]) {
			const firstTry = this.state.attempts[check.id] === 1;
			this.state.passedChecks[check.id] = { firstTry, at: Date.now() };
			this.#award(firstTry ? AWARD.CHECK_FIRST_TRY : AWARD.CHECK); // silent
			if (Object.keys(this.state.passedChecks).length === 1) this.#grant('power-on');
			this.#settleLesson(check.id);
			this.#settleModule(check.id);
		}
		this.#persist();
	}

	benchBoot(): void {
		if (!browser || this.state.benchEvents.firstBoot) return;
		this.state.benchEvents.firstBoot = Date.now();
		this.#award(AWARD.BENCH_BOOT);
		this.#grant('first-boot');
		this.#persist();
	}
	benchScope(): void {
		if (!browser || this.state.benchEvents.firstScope) return;
		this.state.benchEvents.firstScope = Date.now();
		this.#award(AWARD.BENCH_SCOPE);
		this.#grant('scope-jockey');
		this.#persist();
	}
	benchFinale(): void {
		if (!browser || this.state.benchEvents.finale) return;
		this.state.benchEvents.finale = Date.now();
		this.#award(AWARD.BENCH_FINALE, { kind: 'xp', label: 'FINALE WATCHED', xp: AWARD.BENCH_FINALE });
		this.#persist();
	}

	// ---- Award internals ----------------------------------------------------
	#award(n: number, toast?: Omit<Toast, 'id'>): void {
		const before = levelForXp(this.state.xp);
		this.state.xp += n;
		this.state.level = levelForXp(this.state.xp);
		if (toast) this.#push(toast);
		if (this.state.level > before) {
			this.#push({ kind: 'level', label: `LVL ${String(this.state.level).padStart(2, '0')}` });
		}
	}

	#settleLesson(checkId: string): void {
		const lessonId = CHECK_LESSON.get(checkId);
		if (!lessonId || this.state.lessonsCompleted[lessonId]) return;
		const ids = LESSON_CHECKS.get(lessonId) ?? [];
		if (ids.length > 0 && ids.every((id) => this.isPassed(id))) {
			this.state.lessonsCompleted[lessonId] = Date.now();
			this.#award(AWARD.LESSON, { kind: 'xp', label: 'LESSON COMPLETE', xp: AWARD.LESSON });
		}
	}

	#settleModule(checkId: string): void {
		const moduleId = CHECK_MODULE.get(checkId);
		if (!moduleId || this.state.modulesMastered[moduleId]) return;
		const ids = MODULE_CHECKS.get(moduleId) ?? [];
		if (ids.length === 0 || !ids.every((id) => this.isPassed(id))) return;

		this.state.modulesMastered[moduleId] = Date.now();
		this.#award(AWARD.MODULE, { kind: 'xp', label: 'MODULE MASTERED', xp: AWARD.MODULE });

		const ach = MODULE_ACHIEVEMENT[moduleId];
		if (ach) this.#grant(ach);

		// CLEAN PASS: this module was passed entirely first-try.
		if (ids.every((id) => this.isFirstTry(id))) this.#grant('clean-pass');

		// FULL LADDER: every module mastered.
		if (modules.every((m) => this.state.modulesMastered[m.id])) this.#grant('full-ladder');
	}

	#grant(id: string): void {
		if (this.state.achievements[id]) return;
		this.state.achievements[id] = Date.now();
		const def = ACHIEVEMENTS.find((a) => a.id === id);
		this.#push({ kind: 'ach', label: def?.name ?? id });
	}

	// ---- Toast queue --------------------------------------------------------
	#push(t: Omit<Toast, 'id'>): void {
		const id = ++this.#seq;
		this.toasts = [...this.toasts, { ...t, id }].slice(-4);
		if (browser) {
			// Hold 3s past the 200ms slide-in, then retire. The chip's own out
			// transition plays as it leaves the array.
			setTimeout(() => this.dismiss(id), 3200);
		}
	}
	dismiss(id: number): void {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	// ---- Persistence + transfer ---------------------------------------------
	#load(): void {
		if (this.#loaded || !browser) return;
		this.#loaded = true;
		try {
			const raw = localStorage.getItem(KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (isValidState(parsed)) this.state = { ...newState(), ...parsed };
		} catch {
			// corrupt or denied: start clean, never throw into a render.
		}
	}
	#persist(): void {
		if (!browser) return;
		try {
			localStorage.setItem(KEY, JSON.stringify(this.state));
		} catch {
			// storage denied (private mode): awards still work in-session.
		}
	}

	/** The operator card export: the whole record as pretty JSON. */
	exportJson(): string {
		return JSON.stringify(this.state, null, 2);
	}

	/** Import a previously exported record. Rejects anything not shaped like v1. */
	importJson(text: string): { ok: boolean; error?: string } {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return { ok: false, error: 'not valid JSON' };
		}
		if (!isValidState(parsed)) return { ok: false, error: 'not a thunk.xp.v1 record' };
		this.state = { ...newState(), ...parsed };
		this.#persist();
		return { ok: true };
	}

	/** Two-step reset (the UI gates this behind a typed confirm). */
	reset(): void {
		this.state = newState();
		this.toasts = [];
		this.#persist();
	}
}

export const xp = new XpStore();
