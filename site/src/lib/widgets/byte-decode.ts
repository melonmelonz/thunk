// Parsing a byte from any base, for the Byte Decoder widget (M0). The Bit Lab is
// switch-first: you build a byte and read it out. This is entry-first: you type a
// value in binary, decimal, or hex and watch it land in all four readings plus
// the character. Pure and DOM-free so it is unit-testable and shares `format.ts`
// for the four readings. The one job here is honest parsing: which strings are a
// valid byte in a base, and what byte they name.

/** The bases a value can be entered in. */
export type Base = 2 | 10 | 16;

/** The allowed digits for a base, as a validation regex source (no 0x/0b prefix). */
const DIGITS: Record<Base, RegExp> = {
	2: /^[01]+$/,
	10: /^[0-9]+$/,
	16: /^[0-9a-fA-F]+$/
};

export interface ParseResult {
	/** The parsed byte 0..255, or null when the text is not a valid byte in the base. */
	value: number | null;
	/** Why a non-null result was rejected, for a quiet inline note. */
	reason: 'empty' | 'digit' | 'range' | null;
}

/**
 * Parse `text` as a value in `base`, accepting an optional matching prefix
 * (`0b`/`0x`) and surrounding space. Returns the byte when the text is well
 * formed and in 0..255; otherwise a null value with the reason it failed:
 * `empty` (nothing typed), `digit` (a character illegal in the base), or
 * `range` (a valid number the byte cannot hold).
 */
export function parseInBase(text: string, base: Base): ParseResult {
	let s = text.trim();
	if (base === 16) s = s.replace(/^0x/i, '');
	if (base === 2) s = s.replace(/^0b/i, '');
	if (s === '') return { value: null, reason: 'empty' };
	if (!DIGITS[base].test(s)) return { value: null, reason: 'digit' };
	const n = parseInt(s, base);
	if (Number.isNaN(n) || n < 0 || n > 255) return { value: null, reason: 'range' };
	return { value: n, reason: null };
}

/** The value rendered in a base, no prefix, uppercase hex (for the entry fields). */
export function inBase(value: number, base: Base): string {
	const b = (((Math.trunc(value) % 256) + 256) % 256) & 0xff;
	const s = b.toString(base);
	if (base === 2) return s.padStart(8, '0');
	if (base === 16) return s.toUpperCase().padStart(2, '0');
	return s;
}

/** The human name of a base, for labels. */
export function baseName(base: Base): string {
	return base === 2 ? 'binary' : base === 16 ? 'hex' : 'decimal';
}
