// The panel WINDOW register readout: a pure parser over the bus-trace rows the
// bench already streams. It reads the addressable window the driver last set -
// CASET (column range) + PASET (page range) - and the pixel format from COLMOD,
// straight off the same annotated rows the M3/M4 lessons taught. During DOOM it
// exposes the letterbox center window on the wire; teaching is the point.
//
// The rows look like (see thunk-sim/src/trace.rs):
//   cmd  2A  CASET  (column window)
//   data 00 00 00 EF          <- xs_hi xs_lo xe_hi xe_lo  => 0..239
//   cmd  2B  PASET  (page window)
//   data 00 55 00 EA          <- ys_hi ys_lo ye_hi ye_lo  => 85..234
//   cmd  3A  COLMOD  (16-bit color)
//   data 55                   <- 0x55 = 16 bpp
// A command's parameters are the first `data` run that follows it, before the
// next command. We keep the LAST window seen, so the readout tracks the most
// recent frame.

export interface WindowState {
	/** [x_start, x_end] from CASET, inclusive. */
	caset?: [number, number];
	/** [y_start, y_end] from PASET, inclusive. */
	paset?: [number, number];
	/** COLMOD pixel-format byte (0x55 = 16 bpp). */
	colmod?: number;
}

/** The `data` run immediately following command row `i`, before the next cmd. */
function dataAfter(lines: string[], i: number): string | null {
	for (let j = i + 1; j < lines.length; j++) {
		const l = lines[j];
		if (l.startsWith('data')) return l;
		if (l.startsWith('cmd')) return null;
	}
	return null;
}

/** The leading two-hex-digit tokens of a `data ...` row. */
function hexBytes(dataLine: string): number[] {
	const toks = dataLine.replace(/^data\s+/, '').split(/\s+/);
	const out: number[] = [];
	for (const t of toks) {
		if (/^[0-9A-Fa-f]{2}$/.test(t)) out.push(parseInt(t, 16));
		else break; // stop at "..." in a summarized run
	}
	return out;
}

const be16 = (hi: number, lo: number): number => ((hi << 8) | lo) & 0xffff;

/** Parse the last-set window + pixel format from the trace rows' text. */
export function parseWindow(lines: string[]): WindowState {
	const w: WindowState = {};
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i];
		if (!l.startsWith('cmd')) continue;
		if (l.includes('CASET')) {
			const b = hexBytes(dataAfter(lines, i) ?? '');
			if (b.length >= 4) w.caset = [be16(b[0], b[1]), be16(b[2], b[3])];
		} else if (l.includes('PASET')) {
			const b = hexBytes(dataAfter(lines, i) ?? '');
			if (b.length >= 4) w.paset = [be16(b[0], b[1]), be16(b[2], b[3])];
		} else if (l.includes('COLMOD')) {
			const b = hexBytes(dataAfter(lines, i) ?? '');
			if (b.length >= 1) w.colmod = b[0];
		}
	}
	return w;
}

/** The datasheet name for a COLMOD pixel-format byte. */
export function colmodName(byte: number): string {
	switch (byte) {
		case 0x55:
			return '16BPP';
		case 0x66:
			return '18BPP';
		case 0x33:
			return '12BPP';
		default:
			return '0x' + byte.toString(16).toUpperCase().padStart(2, '0');
	}
}

/**
 * The one-line register readout, e.g. `WINDOW 0-239 x 85-234 · COLMOD 16BPP`,
 * or null when the trace has not set a window yet (nothing to show).
 */
export function formatWindowLine(w: WindowState): string | null {
	const parts: string[] = [];
	if (w.caset && w.paset) {
		parts.push(`WINDOW ${w.caset[0]}-${w.caset[1]} x ${w.paset[0]}-${w.paset[1]}`);
	} else if (w.caset) {
		parts.push(`WINDOW ${w.caset[0]}-${w.caset[1]} x -`);
	} else if (w.paset) {
		parts.push(`WINDOW - x ${w.paset[0]}-${w.paset[1]}`);
	}
	if (w.colmod !== undefined) parts.push(`COLMOD ${colmodName(w.colmod)}`);
	return parts.length ? parts.join(' · ') : null;
}
