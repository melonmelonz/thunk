// DOOM cheat codes, detected as typed sequences on the bench panel. Pure homage:
// the wink is a HUD flash carrying the authentic 1993 idlib status-bar string;
// the simulator and the engine are untouched - the keystrokes still flow to DOOM
// exactly as before, so typing a cheat also strafes the player, just as it did on
// a 386. A rolling buffer holds the last few letters typed and reports a match.

export interface Cheat {
	/** The letters typed, lowercase. */
	code: string;
	/** The real status-bar message DOOM printed for this code, in HUD caps. */
	message: string;
}

// The canonical id* cheats and their genuine STSTR_* strings from the id source.
export const CHEATS: readonly Cheat[] = [
	{ code: 'iddqd', message: 'DEGREELESSNESS MODE ON' },
	{ code: 'idkfa', message: 'VERY HAPPY AMMO ADDED' },
	{ code: 'idspispopd', message: 'NO CLIPPING MODE ON' }
];

const MAX_LEN = Math.max(...CHEATS.map((c) => c.code.length));

/** A rolling buffer of recent letters that reports when a cheat code lands. */
export class CheatBuffer {
	private buf = '';
	constructor(private readonly cheats: readonly Cheat[] = CHEATS) {}

	/** Feed one typed character. Returns the matched cheat, or null. */
	push(key: string): Cheat | null {
		if (key.length !== 1) return null; // ignore Arrow/Enter/Ctrl/Space/etc.
		const c = key.toLowerCase();
		if (c < 'a' || c > 'z') return null; // letters only - digits never open a cheat
		this.buf = (this.buf + c).slice(-MAX_LEN);
		for (const cheat of this.cheats) {
			if (this.buf.endsWith(cheat.code)) {
				this.buf = ''; // consume, so holding the last key can't re-fire it
				return cheat;
			}
		}
		return null;
	}
}
