// The Konami code, detected keystroke by keystroke. A tiny rolling matcher: feed
// it KeyboardEvent.key values and it reports true on the frame the full sequence
// lands. Pure and framework-free so it unit-tests and reuses cleanly; what the
// match *does* (a CRT degauss) lives in the root layout and Degauss.svelte.

// Up Up Down Down Left Right Left Right B A - Konami's 1986 Contra sequence, by
// KeyboardEvent.key names. Single-character keys are matched case-insensitively.
export const KONAMI: readonly string[] = [
	'ArrowUp',
	'ArrowUp',
	'ArrowDown',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'ArrowLeft',
	'ArrowRight',
	'b',
	'a'
];

/** A rolling matcher over one target sequence. One instance, fed keys over time. */
export class SequenceMatcher {
	private pos = 0;
	constructor(private readonly seq: readonly string[] = KONAMI) {}

	/** Feed one key. Returns true exactly on the keystroke that completes the run. */
	push(key: string): boolean {
		const k = key.length === 1 ? key.toLowerCase() : key;
		if (k === this.seq[this.pos]) {
			this.pos++;
			if (this.pos === this.seq.length) {
				this.pos = 0;
				return true;
			}
			return false;
		}
		// A wrong key resets - but if it happens to be the first step, count it, so a
		// stray ArrowUp mid-run doesn't force the whole sequence to be re-keyed.
		this.pos = k === this.seq[0] ? 1 : 0;
		return false;
	}
}
