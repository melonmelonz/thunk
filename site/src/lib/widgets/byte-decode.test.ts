import { describe, it, expect } from 'vitest';
import { parseInBase, inBase, baseName } from './byte-decode';

describe('parseInBase', () => {
	it('reads the lesson byte 65 = A in every base', () => {
		expect(parseInBase('01000001', 2).value).toBe(65);
		expect(parseInBase('65', 10).value).toBe(65);
		expect(parseInBase('41', 16).value).toBe(65);
		expect(parseInBase('A', 16).value).toBe(10); // 'A' is a hex digit, not the letter
	});

	it('accepts an optional matching prefix and surrounding space', () => {
		expect(parseInBase('  0x2C ', 16).value).toBe(0x2c);
		expect(parseInBase('0b101100', 2).value).toBe(0b101100);
		expect(parseInBase('0X2c', 16).value).toBe(0x2c);
	});

	it('rejects a digit illegal in the base', () => {
		expect(parseInBase('2', 2)).toEqual({ value: null, reason: 'digit' });
		expect(parseInBase('G', 16)).toEqual({ value: null, reason: 'digit' });
		expect(parseInBase('12a', 10)).toEqual({ value: null, reason: 'digit' });
	});

	it('rejects a valid number a byte cannot hold', () => {
		expect(parseInBase('256', 10)).toEqual({ value: null, reason: 'range' });
		expect(parseInBase('100000000', 2)).toEqual({ value: null, reason: 'range' }); // 256
		expect(parseInBase('FF', 16).value).toBe(255); // the boundary is in range
		expect(parseInBase('100', 16)).toEqual({ value: null, reason: 'range' }); // 256
	});

	it('flags an empty entry distinctly from a bad one', () => {
		expect(parseInBase('', 10)).toEqual({ value: null, reason: 'empty' });
		expect(parseInBase('   ', 16)).toEqual({ value: null, reason: 'empty' });
		expect(parseInBase('0x', 16)).toEqual({ value: null, reason: 'empty' });
	});
});

describe('inBase', () => {
	it('renders a byte per base, padded like a register', () => {
		expect(inBase(65, 2)).toBe('01000001');
		expect(inBase(65, 10)).toBe('65');
		expect(inBase(65, 16)).toBe('41');
		expect(inBase(0x2c, 16)).toBe('2C');
		expect(inBase(0, 2)).toBe('00000000');
		expect(inBase(255, 16)).toBe('FF');
	});

	it('wraps out-of-range input to a byte, matching the hardware register', () => {
		expect(inBase(256, 10)).toBe('0');
		expect(inBase(-1, 10)).toBe('255');
	});
});

describe('baseName', () => {
	it('names each base for labels', () => {
		expect(baseName(2)).toBe('binary');
		expect(baseName(10)).toBe('decimal');
		expect(baseName(16)).toBe('hex');
	});
});
