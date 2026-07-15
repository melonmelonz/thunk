import { describe, it, expect } from 'vitest';
import {
	xpForLevel,
	levelForXp,
	levelProgress,
	MAX_LEVEL,
	ACHIEVEMENTS,
	MODULE_ACHIEVEMENT,
	newState,
	isValidState,
	SCHEMA
} from './xp-curve';

describe('level curve', () => {
	it('matches the documented thresholds', () => {
		expect(xpForLevel(1)).toBe(0);
		expect(xpForLevel(2)).toBe(10);
		expect(xpForLevel(3)).toBe(32);
		expect(xpForLevel(5)).toBe(112);
		expect(xpForLevel(10)).toBe(522);
		expect(xpForLevel(20)).toBe(2242);
	});
	it('is strictly increasing to the cap', () => {
		for (let l = 2; l <= MAX_LEVEL; l++) {
			expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1));
		}
	});
	it('clamps beyond LVL 20', () => {
		expect(xpForLevel(21)).toBe(xpForLevel(20));
		expect(xpForLevel(0)).toBe(0);
	});
	it('levelForXp inverts the curve', () => {
		expect(levelForXp(0)).toBe(1);
		expect(levelForXp(9)).toBe(1);
		expect(levelForXp(10)).toBe(2);
		expect(levelForXp(31)).toBe(2);
		expect(levelForXp(32)).toBe(3);
		expect(levelForXp(100000)).toBe(20);
	});
	it('levelProgress fills 0..1 and saturates at LVL 20', () => {
		expect(levelProgress(10).level).toBe(2);
		expect(levelProgress(10).fill).toBeCloseTo(0);
		const mid = levelProgress(21); // band 10..32
		expect(mid.level).toBe(2);
		expect(mid.fill).toBeGreaterThan(0);
		expect(mid.fill).toBeLessThan(1);
		expect(levelProgress(5000)).toEqual({ level: 20, fill: 1 });
	});
});

describe('achievements table', () => {
	it('has the twelve spec achievements in grid order', () => {
		expect(ACHIEVEMENTS.map((a) => a.name)).toEqual([
			'POWER ON',
			'FIRST BOOT',
			'CLEAN PASS',
			'SYSCALL',
			'NO_STD',
			'BUS MASTER',
			'RAMWR',
			'IDDQD',
			'UPSTREAM',
			'FULL LADDER',
			'SCOPE JOCKEY',
			'CALIBRATED'
		]);
	});
	it('IDDQD carries no blurb (the name is the joke)', () => {
		const iddqd = ACHIEVEMENTS.find((a) => a.id === 'iddqd');
		expect(iddqd?.blurb).toBeUndefined();
	});
	it('CALIBRATED has its blurb now that the placement flow is built', () => {
		const cal = ACHIEVEMENTS.find((a) => a.id === 'calibrated');
		expect(cal?.blurb).toBeTruthy();
		expect(cal?.note).toBeUndefined();
	});
	it('every module-mastery achievement id exists in the table', () => {
		for (const id of Object.values(MODULE_ACHIEVEMENT)) {
			expect(ACHIEVEMENTS.some((a) => a.id === id)).toBe(true);
		}
	});
});

describe('state shape + import validation', () => {
	it('fresh state is valid and empty', () => {
		const s = newState();
		expect(isValidState(s)).toBe(true);
		expect(s.xp).toBe(0);
		expect(s.schema).toBe(SCHEMA);
	});
	it('rejects wrong schema, non-objects, and array fields', () => {
		expect(isValidState(null)).toBe(false);
		expect(isValidState({ ...newState(), schema: 2 })).toBe(false);
		expect(isValidState({ ...newState(), xp: 'lots' })).toBe(false);
		expect(isValidState({ ...newState(), passedChecks: [] })).toBe(false);
		expect(isValidState('{}')).toBe(false);
	});
});
