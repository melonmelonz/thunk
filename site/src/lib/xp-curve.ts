// Pure XP math + achievement definitions. No runes, no storage, no DOM - so the
// level curve and the achievement table are unit-testable in plain vitest, and
// the runes store (xp.svelte.ts) is a thin reactive wrapper over this.

export const SCHEMA = 1;
export const MAX_LEVEL = 20;

// Level curve (quadratic-ish, documented):
//
//   xpForLevel(L) = 6*(L-1)^2 + 4*(L-1)      for L in 1..20, clamped at 20.
//
// A quadratic on (L-1): the gap to the next level widens linearly, so early
// levels come fast (first passed check -> LVL 02) and the last few are earned.
// Thresholds: L1=0, L2=10, L3=32, L5=112, L10=522, L20=2242. The full ladder
// (every check first-try + every lesson + every module + bench events) tops out
// near ~2900 XP, so a completionist reaches LVL 20 with a little headroom, and
// nobody grinds a wall.
export function xpForLevel(level: number): number {
	const l = Math.min(Math.max(level, 1), MAX_LEVEL) - 1;
	return 6 * l * l + 4 * l;
}

/** Highest level (1..20) whose threshold is met by `xp`. */
export function levelForXp(xp: number): number {
	let level = 1;
	for (let l = 2; l <= MAX_LEVEL; l++) {
		if (xp >= xpForLevel(l)) level = l;
		else break;
	}
	return level;
}

/** Level, and the fill 0..1 across the current level's band (1 at LVL 20). */
export function levelProgress(xp: number): { level: number; fill: number } {
	const level = levelForXp(xp);
	if (level >= MAX_LEVEL) return { level, fill: 1 };
	const base = xpForLevel(level);
	const span = xpForLevel(level + 1) - base;
	return { level, fill: span > 0 ? (xp - base) / span : 0 };
}

// ---- XP awards (data, tuned once real) ---------------------------------------
export const AWARD = {
	CHECK: 10,
	CHECK_FIRST_TRY: 15,
	LESSON: 25,
	MODULE: 100,
	// Placement pays the spec's test-out rate: +50 per module placed out, half of
	// a full check-mastery (+100). Placing out is a shortcut, not the long road.
	PLACEMENT: 50,
	BENCH_BOOT: 10,
	BENCH_SCOPE: 10,
	BENCH_FINALE: 25
} as const;

/** Frames the finale must be watched before it counts as watched. */
export const FINALE_FRAMES = 120;

// ---- Achievements ------------------------------------------------------------
// Dry technical names, earned not given. Order here is the grid order on
// /progress. `note` shows as a micro-caption for definitions with no flow yet.

export interface Achievement {
	id: string;
	name: string;
	/** One-line, quiet. IDDQD deliberately has none - the name IS the joke. */
	blurb?: string;
	/** Shown dim under an unearnable achievement (e.g. no instrument yet). */
	note?: string;
}

export const ACHIEVEMENTS: Achievement[] = [
	{ id: 'power-on', name: 'POWER ON', blurb: 'First check passed.' },
	{ id: 'first-boot', name: 'FIRST BOOT', blurb: 'Watched the panel come up on the bench.' },
	{ id: 'clean-pass', name: 'CLEAN PASS', blurb: 'A whole module passed first-try.' },
	{ id: 'syscall', name: 'SYSCALL', blurb: 'Mastered M1 - The Kernel.' },
	{ id: 'no-std', name: 'NO_STD', blurb: 'Mastered M2 - Rust for the Metal.' },
	{ id: 'bus-master', name: 'BUS MASTER', blurb: 'Mastered M3 - The Bus.' },
	{ id: 'ramwr', name: 'RAMWR', blurb: 'Mastered M4 - The Panel.' },
	{ id: 'iddqd', name: 'IDDQD' }, // no blurb, on purpose
	{ id: 'upstream', name: 'UPSTREAM', blurb: 'Mastered M7 - First Patch.' },
	{ id: 'full-ladder', name: 'FULL LADDER', blurb: 'Every module on the ladder mastered.' },
	{ id: 'scope-jockey', name: 'SCOPE JOCKEY', blurb: 'Scoped a byte on the live bus trace.' },
	{ id: 'calibrated', name: 'CALIBRATED', blurb: 'Ran the placement calibration.' },
	// The real ending, off the ladder: a first contribution merged for real,
	// self-reported in the launchpad tracker. Dry on purpose - no new visual
	// language, the existing quiet toast.
	{ id: 'merged', name: 'MERGED', blurb: 'Your first real change, merged upstream.' }
];

/**
 * Module id -> the achievement its mastery grants. M0 has none (POWER ON covers
 * first blood); M6 (Intro to Open Source) has none either - UPSTREAM belongs to
 * M7, where you actually get a change upstream. Now that M7 (First Patch) is on
 * the site, UPSTREAM is earned by mastering it.
 */
export const MODULE_ACHIEVEMENT: Record<string, string> = {
	'm1-kernel': 'syscall',
	'm2-rust': 'no-std',
	'm3-bus': 'bus-master',
	'm4-panel': 'ramwr',
	'm5-doom': 'iddqd',
	'm7-first-patch': 'upstream'
};

// ---- Persisted state ---------------------------------------------------------
export interface PassRecord {
	firstTry: boolean;
	at: number;
}

export interface XpState {
	schema: number;
	xp: number;
	level: number;
	/** id -> pass record. A check never pays twice (idempotent by key). */
	passedChecks: Record<string, PassRecord>;
	/** Count of grade presses per id, so first-try credit is exact across reloads. */
	attempts: Record<string, number>;
	/** lesson id -> at. */
	lessonsCompleted: Record<string, number>;
	/** module id -> at. Mastered the long way: every check in the module passed. */
	modulesMastered: Record<string, number>;
	/**
	 * module id -> at. Mastered-by-placement: the calibration run passed all three
	 * of this module's placement items. Read identically to check-mastery by the
	 * meters and the ladder gate (mastered_or_placed), but paid at the placement
	 * rate (+50, not +100). A retake never removes an entry here.
	 */
	modulesPlaced: Record<string, number>;
	/** achievement id -> at. */
	achievements: Record<string, number>;
	/** bench event key -> at (firstBoot, firstScope, finale). */
	benchEvents: Record<string, number>;
	/**
	 * The furthest lesson the reader has opened, for the CONTINUE affordance. Null
	 * until the first lesson is visited. Not a required import field (older v1
	 * records predate it and default to null on import).
	 */
	lastLesson: { module: string; lesson: string } | null;
}

export function newState(): XpState {
	return {
		schema: SCHEMA,
		xp: 0,
		level: 1,
		passedChecks: {},
		attempts: {},
		lessonsCompleted: {},
		modulesMastered: {},
		modulesPlaced: {},
		achievements: {},
		benchEvents: {},
		lastLesson: null
	};
}

/** Structural validation for import. Rejects anything not shaped like v1. */
export function isValidState(v: unknown): v is XpState {
	if (typeof v !== 'object' || v === null) return false;
	const s = v as Record<string, unknown>;
	if (s.schema !== SCHEMA) return false;
	if (typeof s.xp !== 'number' || !Number.isFinite(s.xp)) return false;
	const objFields = [
		'passedChecks',
		'attempts',
		'lessonsCompleted',
		'modulesMastered',
		'achievements',
		'benchEvents'
	];
	return objFields.every(
		(k) => typeof s[k] === 'object' && s[k] !== null && !Array.isArray(s[k])
	);
}
