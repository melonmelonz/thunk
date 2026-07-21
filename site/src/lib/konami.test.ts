import { describe, it, expect } from 'vitest';
import { SequenceMatcher, KONAMI } from './konami';

// Feed a whole sequence of keys; return the result of the last push().
function feed(m: SequenceMatcher, keys: readonly string[]): boolean {
	let hit = false;
	for (const k of keys) hit = m.push(k);
	return hit;
}

describe('SequenceMatcher (Konami)', () => {
	it('fires exactly on the keystroke that completes the code', () => {
		const m = new SequenceMatcher();
		// Every key but the last returns false; the final A returns true.
		for (let i = 0; i < KONAMI.length - 1; i++) {
			expect(m.push(KONAMI[i])).toBe(false);
		}
		expect(m.push(KONAMI[KONAMI.length - 1])).toBe(true);
	});

	it('matches the B and A letters case-insensitively', () => {
		const m = new SequenceMatcher();
		const shouty = KONAMI.map((k) => (k.length === 1 ? k.toUpperCase() : k));
		expect(feed(m, shouty)).toBe(true);
	});

	it('resets on a wrong key and needs the full run again', () => {
		const m = new SequenceMatcher();
		m.push('ArrowUp');
		m.push('ArrowUp');
		m.push('x'); // wrong - back to the start
		expect(feed(m, KONAMI.slice(0, -1))).toBe(false);
		expect(m.push('a')).toBe(true);
	});

	it('treats a stray first-step key as a fresh start, not a dead reset', () => {
		const m = new SequenceMatcher();
		m.push('ArrowDown'); // wrong first key, but it IS the... no - resets to 0
		// A real fresh start: the very next full sequence still completes.
		expect(feed(m, KONAMI)).toBe(true);
	});

	it('re-arms after a completed run so it can fire twice', () => {
		const m = new SequenceMatcher();
		expect(feed(m, KONAMI)).toBe(true);
		expect(feed(m, KONAMI)).toBe(true);
	});

	it('works against any custom sequence', () => {
		const m = new SequenceMatcher(['a', 'b', 'c']);
		expect(m.push('a')).toBe(false);
		expect(m.push('b')).toBe(false);
		expect(m.push('c')).toBe(true);
	});
});
