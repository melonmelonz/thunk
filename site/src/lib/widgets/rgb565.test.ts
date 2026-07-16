import { describe, it, expect } from 'vitest';
import {
	packRgb565,
	hiByte,
	loByte,
	expand5,
	expand6,
	toRgb888,
	toCss,
	hex2,
	hex4,
	wordBits,
	R_MAX,
	G_MAX,
	B_MAX
} from './rgb565';

describe('packRgb565', () => {
	it('packs the three colours the M4 lesson names', () => {
		expect(packRgb565(31, 0, 0)).toBe(0xf800); // pure red
		expect(packRgb565(0, 63, 0)).toBe(0x07e0); // pure green
		expect(packRgb565(0, 0, 31)).toBe(0x001f); // pure blue
	});

	it('packs black and white at the field extremes', () => {
		expect(packRgb565(0, 0, 0)).toBe(0x0000);
		expect(packRgb565(R_MAX, G_MAX, B_MAX)).toBe(0xffff);
	});

	it('lays fields out RRRRR GGGGGG BBBBB (red top, blue bottom)', () => {
		// One bit set in each field lands in the documented position.
		expect(packRgb565(1, 0, 0)).toBe(1 << 11);
		expect(packRgb565(0, 1, 0)).toBe(1 << 5);
		expect(packRgb565(0, 0, 1)).toBe(1);
	});

	it('clamps out-of-range channel values to their field', () => {
		expect(packRgb565(99, 99, 99)).toBe(0xffff);
		expect(packRgb565(-5, -5, -5)).toBe(0x0000);
	});
});

describe('byte split', () => {
	it('splits a word into the two bytes RAMWR streams, high first', () => {
		expect(hiByte(0xf800)).toBe(0xf8); // the M4 lesson's "high byte is 0xF8"
		expect(loByte(0xf800)).toBe(0x00);
		expect(hiByte(0x07e0)).toBe(0x07);
		expect(loByte(0x07e0)).toBe(0xe0);
	});
});

describe('channel expansion', () => {
	it('maps field 0 to 0 and field max to 255 by bit replication', () => {
		expect(expand5(0)).toBe(0);
		expect(expand5(31)).toBe(255);
		expect(expand6(0)).toBe(0);
		expect(expand6(63)).toBe(255);
	});

	it('turns a word into 8-bit channels and a CSS colour', () => {
		expect(toRgb888(0xf800)).toEqual({ r: 255, g: 0, b: 0 });
		expect(toRgb888(0xffff)).toEqual({ r: 255, g: 255, b: 255 });
		expect(toCss(0x001f)).toBe('rgb(0 0 255)');
	});
});

describe('formatting', () => {
	it('renders bytes and words as padded uppercase hex', () => {
		expect(hex2(0x07)).toBe('07');
		expect(hex2(0xe0)).toBe('E0');
		expect(hex4(0xf800)).toBe('0xF800');
		expect(hex4(0x1f)).toBe('0x001F');
	});

	it('lists the 16 bits most significant first', () => {
		expect(wordBits(0xf800)).toEqual([1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(wordBits(0x0001)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
	});
});
