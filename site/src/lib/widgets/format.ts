// Byte formatting for the interactive widgets: one byte, read out four ways.
// Pure and DOM-free so both the Bit Lab and the SPI Scope share it and it is
// unit-testable. Every function clamps to a byte first, so no caller can leak a
// value outside 0..255 into a readout.

/** Normalize to a byte 0..255. */
export function toByte(n: number): number {
	return (((Math.trunc(n) % 256) + 256) % 256) & 0xff;
}

/** Eight binary digits, most significant first: 65 -> "01000001". */
export function toBin(n: number): string {
	return toByte(n).toString(2).padStart(8, '0');
}

/** Binary grouped into two nibbles for reading: "01000001" -> "0100 0001". */
export function groupBin(bin: string): string {
	return `${bin.slice(0, 4)} ${bin.slice(4)}`;
}

/** Uppercase hex with the `0x` prefix, two digits: 44 -> "0x2C". */
export function toHex(n: number): string {
	return '0x' + toByte(n).toString(16).toUpperCase().padStart(2, '0');
}

export interface AsciiInfo {
	/** Whether the byte maps to a printable ASCII glyph. */
	printable: boolean;
	/** What to show: the glyph, a named control ("␣ space"), or "(non-printing)". */
	label: string;
}

/**
 * The ASCII reading of a byte. Printable glyphs 0x21..0x7E render as themselves;
 * the space (0x20) is named so it is visible in a readout; everything else is
 * non-printing (control codes and the high half with no ASCII meaning).
 */
export function asciiInfo(n: number): AsciiInfo {
	const b = toByte(n);
	if (b === 0x20) return { printable: true, label: '␣ space' };
	if (b > 0x20 && b < 0x7f) return { printable: true, label: String.fromCharCode(b) };
	return { printable: false, label: '(non-printing)' };
}
