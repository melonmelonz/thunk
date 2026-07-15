import { describe, it, expect } from 'vitest';
import { grade, gradeChoice, gradeShort, normalize, type Response } from './grade';
import { curriculum } from './content';
import type { Check } from './content';

// Flatten the real curriculum so parity is tested against the shipped bank, not
// hand-written fixtures. The grader must agree with thunk_core::Check::grade for
// every check the site can render.
const allChecks: Check[] = curriculum.modules.flatMap((m) =>
	m.lessons.flatMap((l) => l.checks)
);

function byId(id: string): Check {
	const c = allChecks.find((x) => x.id === id);
	if (!c) throw new Error(`no such check: ${id}`);
	return c;
}

describe('normalize', () => {
	it('trims and lowercases (Rust trim().to_lowercase())', () => {
		expect(normalize('  RAMWR ')).toBe('ramwr');
		expect(normalize('A Bit')).toBe('a bit');
		expect(normalize('')).toBe('');
		expect(normalize('   ')).toBe('');
	});
});

describe('gradeChoice - index equality parity', () => {
	it('passes only on the answer index', () => {
		expect(gradeChoice(1, 1)).toBe(true);
		expect(gradeChoice(0, 1)).toBe(false);
		expect(gradeChoice(2, 1)).toBe(false);
	});
	it('returns null when nothing is picked', () => {
		expect(gradeChoice(-1, 1)).toBe(null);
	});
});

describe('gradeShort - normalized accept-list parity', () => {
	it('accepts any listed answer, case- and space-insensitively', () => {
		expect(gradeShort('bit', ['bit', 'a bit'])).toBe(true);
		expect(gradeShort('  A BIT  ', ['bit', 'a bit'])).toBe(true);
		expect(gradeShort('byte', ['bit', 'a bit'])).toBe(false);
	});
	it('returns null on empty / whitespace-only input', () => {
		expect(gradeShort('', ['git'])).toBe(null);
		expect(gradeShort('   ', ['git'])).toBe(null);
	});
});

describe('grade() dispatch over real checks', () => {
	// Every accepted answer of every short check must PASS; the byte-or-name
	// alternates (e.g. m4-04-ramwr: ramwr | 0x2c | 2c | ram write | ...) are the
	// exact "c.i. / good-first-issue style" alternate lists the parity must honor.
	it('every accepted short answer passes (all alternates)', () => {
		for (const c of allChecks) {
			if (c.kind !== 'short') continue;
			for (const a of c.answers) {
				const r: Response = { text: a };
				expect(grade(c, r), `${c.id} <= "${a}"`).toBe(true);
				// Case/space perturbation must still pass.
				expect(grade(c, { text: `  ${a.toUpperCase()} ` }), `${c.id} <= perturbed`).toBe(true);
			}
		}
	});

	it('the correct choice index passes, every other index fails', () => {
		for (const c of allChecks) {
			if (c.kind !== 'choice') continue;
			for (let i = 0; i < c.options.length; i++) {
				expect(grade(c, { picked: i }), `${c.id} pick ${i}`).toBe(i === c.answer);
			}
		}
	});

	it('empty responses grade to null (nothing to grade yet)', () => {
		for (const c of allChecks) {
			const empty: Response = c.kind === 'choice' ? { picked: -1 } : { text: '' };
			expect(grade(c, empty), c.id).toBe(null);
		}
	});

	// Named alternate spot-checks: the multi-alternate cases carry the parity risk.
	it('m4-04-ramwr accepts name and byte spellings, rejects near-misses', () => {
		const c = byId('m4-04-ramwr');
		for (const ok of ['ramwr', 'RAMWR', '0x2c', '2c', 'ram write', 'memory write', 'memory-write']) {
			expect(grade(c, { text: ok }), ok).toBe(true);
		}
		for (const no of ['2d', 'caset', 'ram', '0x2b']) {
			expect(grade(c, { text: no }), no).toBe(false);
		}
	});

	it('m6-03-commit accepts the article variants only', () => {
		const c = byId('m6-03-commit');
		expect(grade(c, { text: 'commit' })).toBe(true);
		expect(grade(c, { text: 'A Commit' })).toBe(true);
		expect(grade(c, { text: 'the commit' })).toBe(true);
		expect(grade(c, { text: 'commits' })).toBe(false);
	});
});
