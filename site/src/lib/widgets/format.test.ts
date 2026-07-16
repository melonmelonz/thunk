import { describe, it, expect } from 'vitest';
import { toByte, toBin, groupBin, toHex, asciiInfo } from './format';

describe('byte formatting', () => {
	it('reads a byte four ways, using 65 = A from the lesson', () => {
		expect(toBin(65)).toBe('01000001');
		expect(groupBin(toBin(65))).toBe('0100 0001');
		expect(toHex(65)).toBe('0x41');
		expect(asciiInfo(65)).toEqual({ printable: true, label: 'A' });
	});

	it('formats the course signature byte 0x2C', () => {
		expect(toHex(0x2c)).toBe('0x2C');
		expect(toBin(0x2c)).toBe('00101100');
		expect(asciiInfo(0x2c)).toEqual({ printable: true, label: ',' });
	});

	it('pads to eight binary digits and two hex digits', () => {
		expect(toBin(0)).toBe('00000000');
		expect(toHex(0)).toBe('0x00');
		expect(toBin(255)).toBe('11111111');
		expect(toHex(255)).toBe('0xFF');
	});

	it('names the space and flags non-printing bytes', () => {
		expect(asciiInfo(0x20)).toEqual({ printable: true, label: '␣ space' });
		expect(asciiInfo(0x00).printable).toBe(false);
		expect(asciiInfo(0x1f).printable).toBe(false); // control
		expect(asciiInfo(0x7f).printable).toBe(false); // DEL
		expect(asciiInfo(0x80).printable).toBe(false); // high half
		expect(asciiInfo(0xff)).toEqual({ printable: false, label: '(non-printing)' });
	});

	it('clamps out-of-range input to a byte', () => {
		expect(toByte(256)).toBe(0);
		expect(toByte(-1)).toBe(255);
		expect(toHex(300)).toBe('0x2C');
	});
});
