// The volatile-vs-persistent memory model behind the Volatile Memory widget
// (M1). Two rows of cells: MEMORY (RAM - the desk) forgets the moment power is
// cut; STORAGE (the disk - the shelf) keeps its bytes through a power cycle.
// Pure and DOM-free so the one lesson - what survives a power loss - is a
// unit-testable state machine, not something buried in a component.

/** A memory cell holds a byte, or null when it holds nothing (blank/cleared). */
export type Cell = number | null;

export interface VState {
	/** Whether the machine is powered. */
	power: boolean;
	/** Volatile row: cleared to all-null the instant power drops. */
	memory: Cell[];
	/** Persistent row: unaffected by power. */
	storage: number[];
}

/** A fresh powered-on machine: storage holds its bytes, memory starts blank. */
export function initial(storage: number[]): VState {
	return { power: true, memory: storage.map(() => null), storage: [...storage] };
}

/** Every memory cell blank. */
export function blank(len: number): Cell[] {
	return Array.from({ length: len }, () => null);
}

/**
 * Flip power. Cutting it clears every volatile memory cell to null and leaves
 * storage untouched; restoring it does NOT refill memory - the desk stays empty
 * until something writes to it again. This asymmetry is the whole lesson.
 */
export function setPower(state: VState, on: boolean): VState {
	if (on === state.power) return state;
	if (!on) {
		// Power lost: memory forgets, storage remembers.
		return { ...state, power: false, memory: blank(state.memory.length) };
	}
	// Power restored: memory is still blank (it was cleared on the way down).
	return { ...state, power: true };
}

/** Write a byte into a memory cell. A no-op with no power (nothing latches). */
export function writeCell(state: VState, i: number, byte: number): VState {
	if (!state.power) return state;
	if (i < 0 || i >= state.memory.length) return state;
	const memory = state.memory.slice();
	memory[i] = (((Math.trunc(byte) % 256) + 256) % 256) & 0xff;
	return { ...state, memory };
}

/**
 * Load the whole row from storage into memory (the "read it back off the
 * shelf" move a program makes after a restart). A no-op with no power.
 */
export function loadFromStorage(state: VState): VState {
	if (!state.power) return state;
	return { ...state, memory: state.storage.map((b) => b & 0xff) };
}

/** True once every memory cell holds a byte (the row is fully written). */
export function memoryFull(state: VState): boolean {
	return state.memory.every((c) => c !== null);
}
