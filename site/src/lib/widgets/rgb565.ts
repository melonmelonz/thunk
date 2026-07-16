// RGB565 packing for the Pixel Forge widget (M4). Three channels - 5 bits red,
// 6 bits green, 5 bits blue - packed into one u16, exactly the format the panel
// stores and the RAMWR command streams two bytes at a time. Pure and DOM-free so
// the packing is unit-testable against the three colours the M4 lesson names.
//
// Parity with the lesson: pure red 0xF800, pure green 0x07E0, pure blue 0x001F,
// white 0xFFFF, black 0x0000. The high byte is the first byte over the bus.

export const R_MAX = 31; // 5 bits
export const G_MAX = 63; // 6 bits
export const B_MAX = 31; // 5 bits

/** Clamp to 0..max and truncate to an integer field value. */
function field(v: number, max: number): number {
	const n = Math.trunc(v);
	return n < 0 ? 0 : n > max ? max : n;
}

/**
 * Pack a 5/6/5 colour into its 16-bit word: red in the top five bits, green in
 * the middle six, blue in the bottom five. `RRRRRGGG GGGBBBBB`.
 */
export function packRgb565(r5: number, g6: number, b5: number): number {
	const r = field(r5, R_MAX);
	const g = field(g6, G_MAX);
	const b = field(b5, B_MAX);
	return ((r << 11) | (g << 5) | b) & 0xffff;
}

/** The high byte of the word - the FIRST byte RAMWR streams for the pixel. */
export function hiByte(word: number): number {
	return (word >> 8) & 0xff;
}

/** The low byte of the word - the SECOND byte streamed. */
export function loByte(word: number): number {
	return word & 0xff;
}

/**
 * Expand a 5/6/5 field to a full 8-bit channel by bit replication (the standard
 * scaling: copy the high bits down into the low ones so 0 maps to 0 and the
 * field maximum maps to 255). This is how the packed word becomes a screen
 * colour, so the swatch matches what the panel would light.
 */
export function expand5(v: number): number {
	const f = field(v, R_MAX);
	return (f << 3) | (f >> 2);
}
export function expand6(v: number): number {
	const f = field(v, G_MAX);
	return (f << 2) | (f >> 4);
}

export interface Rgb888 {
	r: number;
	g: number;
	b: number;
}

/** The word's screen colour as 8-bit channels, ready for a CSS `rgb(...)`. */
export function toRgb888(word: number): Rgb888 {
	const w = word & 0xffff;
	return {
		r: expand5((w >> 11) & R_MAX),
		g: expand6((w >> 5) & G_MAX),
		b: expand5(w & B_MAX)
	};
}

/** A CSS colour string for the swatch. */
export function toCss(word: number): string {
	const { r, g, b } = toRgb888(word);
	return `rgb(${r} ${g} ${b})`;
}

/** Two uppercase hex digits, for a byte readout. */
export function hex2(byte: number): string {
	return (byte & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

/** Four uppercase hex digits with the `0x` prefix, for the word readout. */
export function hex4(word: number): string {
	return '0x' + (word & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/** The 16 bits most significant first, as a 0/1 array (index 0 is bit 15). */
export function wordBits(word: number): number[] {
	const bits: number[] = [];
	for (let i = 15; i >= 0; i--) bits.push((word >> i) & 1);
	return bits;
}
