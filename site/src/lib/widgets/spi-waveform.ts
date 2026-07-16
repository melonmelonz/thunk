// The SPI waveform, as pure data - the exact signal the bench speaks, derived
// here so the SPI Scope widget can draw it in SVG without loading the wasm bench.
//
// Parity with the Rust `thunk_sim::trace::waveform`: MSB first, one clock pulse
// per bit, and the data line (MOSI) settled across the whole bit cell so it is
// stable before each rising edge (SPI mode 0, where the receiver samples on the
// low-to-high transition). Reading MOSI at every rising edge, most significant
// bit first, rebuilds the input byte - the same invariant the Rust test
// `waveform_data_row_encodes_the_byte_msb_first` pins.

/** Bits in a byte. */
export const BITS = 8;

/**
 * Samples per clock cell in the drawn square wave: LOW then HIGH. The rising
 * edge - where the bit latches - sits between them, at sample index 1 of the
 * pair. MOSI is already settled across both samples.
 */
export const CELL = 2;

export interface Waveform {
	/** The 8 data bits, most significant first (index 0 is bit 7). */
	bits: number[];
	/** MOSI level sampled CELL times per bit; held (settled) across each cell. */
	mosi: number[];
	/** CLK level sampled CELL times per bit: 0 (low) then 1 (high) - one pulse. */
	clk: number[];
}

/** Normalize any input to a byte 0..255 (wraps, like the hardware register). */
export function toByte(n: number): number {
	return (((Math.trunc(n) % 256) + 256) % 256) & 0xff;
}

/**
 * The waveform for a byte: its 8 bits MSB-first, plus the CLK and MOSI lines
 * sampled at CELL resolution. Pure and total - every u8 yields three arrays of
 * length 8 (bits) and 8*CELL (clk, mosi).
 */
export function spiWaveform(byte: number): Waveform {
	const b = toByte(byte);
	const bits: number[] = [];
	for (let i = BITS - 1; i >= 0; i--) bits.push((b >> i) & 1);

	const clk: number[] = [];
	const mosi: number[] = [];
	for (const bit of bits) {
		for (let s = 0; s < CELL; s++) {
			clk.push(s === 0 ? 0 : 1); // low, then high: the rising edge is at s=1
			mosi.push(bit); // data settled across the whole cell
		}
	}
	return { bits, mosi, clk };
}

/**
 * The value latched after `steps` rising edges (0..8), built most significant
 * bit first - exactly how the running total fills as you step the clock.
 */
export function latchedValue(bits: number[], steps: number): number {
	const n = Math.max(0, Math.min(BITS, steps));
	let v = 0;
	for (let i = 0; i < n; i++) v = (v << 1) | (bits[i] & 1);
	return v;
}
