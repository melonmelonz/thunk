import { describe, it, expect } from 'vitest';
import {
	initial,
	setPower,
	writeCell,
	loadFromStorage,
	memoryFull,
	blank
} from './volatile';

const STORAGE = [0x48, 0x49, 0x21]; // "HI!"

describe('volatile memory model', () => {
	it('boots powered with storage kept and memory blank', () => {
		const s = initial(STORAGE);
		expect(s.power).toBe(true);
		expect(s.storage).toEqual(STORAGE);
		expect(s.memory).toEqual([null, null, null]);
		expect(memoryFull(s)).toBe(false);
	});

	it('writes bytes into memory only while powered', () => {
		let s = initial(STORAGE);
		s = writeCell(s, 0, 0x41);
		expect(s.memory[0]).toBe(0x41);
		s = loadFromStorage(s);
		expect(s.memory).toEqual(STORAGE);
		expect(memoryFull(s)).toBe(true);
	});

	it('clears memory but keeps storage when power is cut', () => {
		let s = loadFromStorage(initial(STORAGE));
		expect(s.memory).toEqual(STORAGE);
		s = setPower(s, false);
		expect(s.memory).toEqual([null, null, null]); // the desk forgot
		expect(s.storage).toEqual(STORAGE); // the shelf remembers
	});

	it('does NOT refill memory when power is restored', () => {
		let s = setPower(loadFromStorage(initial(STORAGE)), false);
		s = setPower(s, true);
		expect(s.power).toBe(true);
		expect(s.memory).toEqual([null, null, null]); // still empty until rewritten
	});

	it('ignores writes and loads while unpowered', () => {
		let s = setPower(initial(STORAGE), false);
		s = writeCell(s, 0, 0x41);
		expect(s.memory[0]).toBeNull();
		s = loadFromStorage(s);
		expect(s.memory).toEqual([null, null, null]);
	});

	it('restores writability after power returns', () => {
		let s = setPower(initial(STORAGE), false);
		s = setPower(s, true);
		s = writeCell(s, 1, 0x7a);
		expect(s.memory[1]).toBe(0x7a);
	});

	it('wraps a written byte and ignores out-of-range indices', () => {
		let s = initial(STORAGE);
		s = writeCell(s, 0, 256);
		expect(s.memory[0]).toBe(0);
		const before = s;
		expect(writeCell(s, 9, 1)).toBe(before);
	});

	it('blank() gives an all-null row', () => {
		expect(blank(3)).toEqual([null, null, null]);
	});
});
