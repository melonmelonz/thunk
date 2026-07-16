import { describe, it, expect } from 'vitest';
import { grade, gradeChoice, gradeOrder, gradeShort, normalize, type Response } from './grade';
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

describe('gradeOrder - identity-permutation parity', () => {
	it('passes only on the exact authored (identity) order', () => {
		expect(gradeOrder([0, 1, 2, 3], 4)).toBe(true);
		expect(gradeOrder([1, 0, 2, 3], 4)).toBe(false);
		expect(gradeOrder([3, 2, 1, 0], 4)).toBe(false);
	});
	it('returns null when the submission is not a full-length ordering', () => {
		expect(gradeOrder([0, 1, 2], 4)).toBe(null);
		expect(gradeOrder([], 4)).toBe(null);
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

	// Predict shares Short's normalization; assert every accepted predict answer
	// passes (and a perturbed spelling too), the same parity Short gets.
	it('every accepted predict answer passes (all alternates)', () => {
		let seen = 0;
		for (const c of allChecks) {
			if (c.kind !== 'predict') continue;
			seen++;
			for (const a of c.answers) {
				expect(grade(c, { text: a }), `${c.id} <= "${a}"`).toBe(true);
				expect(grade(c, { text: `  ${a.toUpperCase()} ` }), `${c.id} <= perturbed`).toBe(true);
			}
		}
		expect(seen, 'the curriculum ships at least one Predict check').toBeGreaterThan(0);
	});

	// Order: the identity order passes, any transposition fails, every graded
	// order is full-length so it never reads as null.
	it('the authored order passes, transpositions fail', () => {
		let seen = 0;
		for (const c of allChecks) {
			if (c.kind !== 'order') continue;
			seen++;
			const n = c.items.length;
			const identity = Array.from({ length: n }, (_, i) => i);
			expect(grade(c, { order: identity }), `${c.id} identity`).toBe(true);
			// Swap the first two -> wrong.
			const swapped = identity.slice();
			[swapped[0], swapped[1]] = [swapped[1], swapped[0]];
			expect(grade(c, { order: swapped }), `${c.id} swapped`).toBe(false);
		}
		expect(seen, 'the curriculum ships at least one Order check').toBeGreaterThan(0);
	});

	it('empty responses grade to null (nothing to grade yet)', () => {
		for (const c of allChecks) {
			const empty: Response =
				c.kind === 'choice' ? { picked: -1 } : c.kind === 'order' ? { order: [] } : { text: '' };
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

	// The two authored D-B2 checks, named, so the exact content cases are pinned.
	it('m4-02-redbyte predicts the high byte of pure red (hex or decimal)', () => {
		const c = byId('m4-02-redbyte');
		expect(c.kind).toBe('predict');
		for (const ok of ['0xF8', '0xf8', 'f8', '248', '11111000', '  F8 ']) {
			expect(grade(c, { text: ok }), ok).toBe(true);
		}
		for (const no of ['0x00', 'f9', '249', 'F8 00']) {
			expect(grade(c, { text: no }), no).toBe(false);
		}
	});

	it('m4-04-draw grades the CASET -> RASET -> RAMWR -> stream order', () => {
		const c = byId('m4-04-draw');
		expect(c.kind).toBe('order');
		if (c.kind !== 'order') return;
		const identity = c.items.map((_, i) => i);
		expect(grade(c, { order: identity })).toBe(true);
		// RAMWR before the address window is the classic mistake: wrong.
		expect(grade(c, { order: [2, 0, 1, 3] })).toBe(false);
	});
});
