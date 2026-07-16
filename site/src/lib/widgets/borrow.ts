// A small, HONEST model of Rust's ownership and borrow rules, behind the
// Ownership / Borrow widget (M2). Two bindings, `a` and `b`, and one owned value
// (a `String`). You can MOVE the value between the bindings, take shared (`&`)
// and mutable (`&mut`) borrows of whoever owns it, and try to break the rules -
// and the model refuses exactly where `rustc` refuses, with the real diagnostic.
//
// Honesty is the whole point, so the rules here are Rust's, not a caricature:
//   - one owner at a time; a move leaves the source moved-out and unusable;
//   - any number of shared borrows, XOR exactly one mutable borrow;
//   - you cannot move out of a value while it is borrowed;
//   - you cannot use (or borrow) a value that has been moved out.
// Borrows are modelled as NAMED references held until you drop them - i.e. the
// `let r = &x;` form whose lifetime is lexical - which is the version of the
// rules a learner can see and hold. The error strings are the ones rustc prints
// (E0382 / E0499 / E0502 / E0503 / E0505), so what the toy says is what the
// compiler says.

export type Binding = 'a' | 'b';
export type BorrowKind = 'shared' | 'mut';

export interface Borrow {
	id: number;
	kind: BorrowKind;
	/** The binding this reference borrows from (always the current owner). */
	from: Binding;
}

export interface BorrowState {
	/** Which binding owns the value, or null if it has been dropped. */
	owner: Binding | null;
	/** A binding that has been moved out of - dead, using it is a compile error. */
	moved: Record<Binding, boolean>;
	/** A binding that has never been initialized (b, before anything moves to it). */
	init: Record<Binding, boolean>;
	/** The outstanding references. */
	borrows: Borrow[];
	nextId: number;
	/** The owned text, for display. */
	value: string;
}

export interface RustError {
	/** The rustc error code, e.g. "E0502". */
	code: string;
	/** The message rustc prints, verbatim. */
	message: string;
}

export interface Outcome {
	/** The state after the action - UNCHANGED when there is an error (it did not compile). */
	state: BorrowState;
	/** The compiler's refusal, or null when the action is legal. */
	error: RustError | null;
}

/** The other of the two bindings. */
export function other(b: Binding): Binding {
	return b === 'a' ? 'b' : 'a';
}

/** A fresh program: `let mut a = String::from(value); let mut b;` - a owns, b uninit. */
export function initial(value = 'thunk'): BorrowState {
	return {
		owner: 'a',
		moved: { a: false, b: false },
		init: { a: true, b: false },
		borrows: [],
		nextId: 1,
		value
	};
}

function ok(state: BorrowState): Outcome {
	return { state, error: null };
}
function err(state: BorrowState, code: string, message: string): Outcome {
	return { state, error: { code, message } };
}

function hasMut(s: BorrowState): boolean {
	return s.borrows.some((b) => b.kind === 'mut');
}
function hasShared(s: BorrowState): boolean {
	return s.borrows.some((b) => b.kind === 'shared');
}

/**
 * Move the value out of its current owner into `to` (`let to = from;`). Refused
 * if the source is borrowed (E0505) or has already been moved out (E0382). On
 * success the source binding is dead and `to` becomes the sole owner.
 */
export function moveTo(s: BorrowState, to: Binding): Outcome {
	const from = s.owner;
	if (from === null) return err(s, 'E0382', `use of moved value: \`${to}\``);
	if (to === from) return ok(s); // `let a = a;` - nothing to do
	if (s.borrows.length > 0) {
		return err(s, 'E0505', `cannot move out of \`${from}\` because it is borrowed`);
	}
	return ok({
		...s,
		owner: to,
		moved: { ...s.moved, [from]: true, [to]: false },
		init: { ...s.init, [to]: true }
	});
}

/**
 * Borrow `from` (default: the current owner). Shared borrows coexist with other
 * shared borrows; a mutable borrow demands exclusive access. Refusals carry the
 * exact rustc message for the rule that was broken.
 */
export function borrow(s: BorrowState, kind: BorrowKind, from: Binding = s.owner ?? 'a'): Outcome {
	if (s.moved[from]) {
		return err(s, 'E0382', `borrow of moved value: \`${from}\``);
	}
	if (!s.init[from]) {
		return err(s, 'E0381', `borrow of possibly-uninitialized variable: \`${from}\``);
	}
	if (kind === 'shared') {
		if (hasMut(s)) {
			return err(
				s,
				'E0502',
				`cannot borrow \`${from}\` as immutable because it is also borrowed as mutable`
			);
		}
	} else {
		if (hasMut(s)) {
			return err(s, 'E0499', `cannot borrow \`${from}\` as mutable more than once at a time`);
		}
		if (hasShared(s)) {
			return err(
				s,
				'E0502',
				`cannot borrow \`${from}\` as mutable because it is also borrowed as immutable`
			);
		}
	}
	const b: Borrow = { id: s.nextId, kind, from };
	return ok({ ...s, borrows: [...s.borrows, b], nextId: s.nextId + 1 });
}

/** Drop a reference (its lexical scope ends). Always legal. */
export function dropBorrow(s: BorrowState, id: number): Outcome {
	return ok({ ...s, borrows: s.borrows.filter((b) => b.id !== id) });
}

/**
 * Use (read) a binding - `println!("{binding}")`. Refused if it was moved out
 * (E0382) or is being mutated through an outstanding `&mut` (E0503).
 */
export function use_(s: BorrowState, binding: Binding): Outcome {
	if (s.moved[binding]) {
		return err(s, 'E0382', `use of moved value: \`${binding}\``);
	}
	if (!s.init[binding]) {
		return err(s, 'E0381', `used binding \`${binding}\` is possibly-uninitialized`);
	}
	if (s.borrows.some((b) => b.kind === 'mut' && b.from === binding)) {
		return err(s, 'E0503', `cannot use \`${binding}\` because it was mutably borrowed`);
	}
	return ok(s);
}

/** Whether a binding is usable right now (owns or holds a live, unborrowed value). */
export function usable(s: BorrowState, binding: Binding): boolean {
	return use_(s, binding).error === null;
}
