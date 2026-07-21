import { describe, it, expect } from 'vitest';
import { CheatBuffer, CHEATS } from './cheats';

// Type a whole string one character at a time; return the last match (or null).
function type(b: CheatBuffer, s: string) {
	let hit = null as ReturnType<CheatBuffer['push']>;
	for (const ch of s) hit = b.push(ch);
	return hit;
}

describe('CheatBuffer (DOOM codes)', () => {
	it('reports the authentic message on the completing keystroke', () => {
		const b = new CheatBuffer();
		expect(type(b, 'iddq')).toBeNull();
		expect(b.push('d')).toEqual({ code: 'iddqd', message: 'DEGREELESSNESS MODE ON' });
	});

	it('matches every canonical cheat', () => {
		for (const cheat of CHEATS) {
			expect(type(new CheatBuffer(), cheat.code)).toEqual(cheat);
		}
	});

	it('is case-insensitive', () => {
		expect(type(new CheatBuffer(), 'IDKFA')?.code).toBe('idkfa');
	});

	it('matches even when the code trails other typing (rolling window)', () => {
		const b = new CheatBuffer();
		expect(type(b, 'wasdwasd')).toBeNull(); // wandering the level first
		expect(type(b, 'iddqd')?.code).toBe('iddqd');
	});

	it('consumes a match so a held final key does not re-fire it', () => {
		const b = new CheatBuffer();
		type(b, 'iddqd');
		expect(b.push('d')).toBeNull();
		expect(b.push('d')).toBeNull();
	});

	it('ignores non-letter keys without disturbing the buffer', () => {
		const b = new CheatBuffer();
		type(b, 'iddq');
		expect(b.push('ArrowUp')).toBeNull();
		expect(b.push('1')).toBeNull();
		expect(b.push(' ')).toBeNull();
		expect(b.push('d')).toEqual({ code: 'iddqd', message: 'DEGREELESSNESS MODE ON' });
	});

	it('handles the long overlapping-prefix code (idspispopd)', () => {
		expect(type(new CheatBuffer(), 'idspispopd')?.code).toBe('idspispopd');
	});
});
