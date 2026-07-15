import { describe, it, expect } from 'vitest';
import { parseWindow, formatWindowLine, colmodName } from './window';

// A full-frame finale window: columns 0..239, pages 0..319, 16 bpp.
const fullFrame = [
	'select v  (transaction begins)',
	'cmd  2A  CASET  (column window)',
	'data 00 00 00 EF',
	'cmd  2B  PASET  (page window)',
	'data 00 00 01 3F',
	'cmd  3A  COLMOD  (16-bit color)',
	'data 55',
	'cmd  2C  RAMWR  (pixel stream follows)',
	'data F8 00 07 E0 ... (76800 bytes)',
	'select ^  (transaction ends)'
];

// The DOOM letterbox: 240 wide, 150 tall centered in 320 -> pages 85..234.
const letterbox = [
	'cmd  2A  CASET  (column window)',
	'data 00 00 00 EF',
	'cmd  2B  PASET  (page window)',
	'data 00 55 00 EA',
	'cmd  2C  RAMWR  (pixel stream follows)',
	'data 00 00 ... (72000 bytes)'
];

describe('parseWindow', () => {
	it('reads CASET/PASET ranges and COLMOD from a full frame', () => {
		const w = parseWindow(fullFrame);
		expect(w.caset).toEqual([0, 239]);
		expect(w.paset).toEqual([0, 319]);
		expect(w.colmod).toBe(0x55);
	});

	it('reads the DOOM letterbox page window (85..234)', () => {
		const w = parseWindow(letterbox);
		expect(w.caset).toEqual([0, 239]);
		expect(w.paset).toEqual([85, 234]);
	});

	it('keeps the most recent window when the trace sets it twice', () => {
		const w = parseWindow([...fullFrame, ...letterbox]);
		expect(w.paset).toEqual([85, 234]);
	});

	it('does not mistake a following RAMWR data run for CASET params', () => {
		const w = parseWindow(['cmd  2A  CASET  (column window)', 'cmd  2C  RAMWR  (pixel stream follows)']);
		expect(w.caset).toBeUndefined();
	});
});

describe('formatWindowLine', () => {
	it('formats the register line', () => {
		expect(formatWindowLine(parseWindow(letterbox.concat('cmd  3A  COLMOD  (16-bit color)', 'data 55')))).toBe(
			'WINDOW 0-239 x 85-234 · COLMOD 16BPP'
		);
	});
	it('is null before any window is set', () => {
		expect(formatWindowLine(parseWindow(['select v  (transaction begins)']))).toBeNull();
	});
});

describe('colmodName', () => {
	it('names known formats and falls back to hex', () => {
		expect(colmodName(0x55)).toBe('16BPP');
		expect(colmodName(0x66)).toBe('18BPP');
		expect(colmodName(0xab)).toBe('0xAB');
	});
});
