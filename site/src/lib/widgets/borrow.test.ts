import { describe, it, expect } from 'vitest';
import { initial, moveTo, borrow, dropBorrow, use_, usable, other } from './borrow';

describe('ownership: moves', () => {
	it('starts with a owning the value and b uninitialized', () => {
		const s = initial();
		expect(s.owner).toBe('a');
		expect(usable(s, 'a')).toBe(true);
		expect(usable(s, 'b')).toBe(false); // b is not yet initialized
		expect(use_(s, 'b').error?.code).toBe('E0381');
	});

	it('moves the value a -> b, killing a', () => {
		const { state, error } = moveTo(initial(), 'b');
		expect(error).toBeNull();
		expect(state.owner).toBe('b');
		expect(usable(state, 'b')).toBe(true);
		expect(usable(state, 'a')).toBe(false);
	});

	it('using a moved-out binding is E0382 (the real message)', () => {
		const moved = moveTo(initial(), 'b').state;
		const { error } = use_(moved, 'a');
		expect(error).toEqual({ code: 'E0382', message: 'use of moved value: `a`' });
	});

	it('borrowing a moved-out binding is E0382', () => {
		const moved = moveTo(initial(), 'b').state;
		expect(borrow(moved, 'shared', 'a').error).toEqual({
			code: 'E0382',
			message: 'borrow of moved value: `a`'
		});
	});

	it('can move back b -> a, reviving a and killing b', () => {
		let s = moveTo(initial(), 'b').state;
		s = moveTo(s, 'a').state;
		expect(s.owner).toBe('a');
		expect(usable(s, 'a')).toBe(true);
		expect(usable(s, 'b')).toBe(false);
	});
});

describe('borrowing: shared XOR mutable', () => {
	it('allows any number of shared borrows at once', () => {
		let s = initial();
		s = borrow(s, 'shared').state;
		const second = borrow(s, 'shared');
		expect(second.error).toBeNull();
		expect(second.state.borrows).toHaveLength(2);
	});

	it('blocks a mutable borrow while shared borrows exist (E0502)', () => {
		const shared = borrow(initial(), 'shared').state;
		expect(borrow(shared, 'mut').error).toEqual({
			code: 'E0502',
			message: 'cannot borrow `a` as mutable because it is also borrowed as immutable'
		});
	});

	it('blocks a shared borrow while a mutable borrow exists (E0502)', () => {
		const mut = borrow(initial(), 'mut').state;
		expect(borrow(mut, 'shared').error).toEqual({
			code: 'E0502',
			message: 'cannot borrow `a` as immutable because it is also borrowed as mutable'
		});
	});

	it('blocks a second mutable borrow (E0499)', () => {
		const mut = borrow(initial(), 'mut').state;
		expect(borrow(mut, 'mut').error).toEqual({
			code: 'E0499',
			message: 'cannot borrow `a` as mutable more than once at a time'
		});
	});

	it('lets the borrow succeed once the conflicting one is dropped', () => {
		let s = borrow(initial(), 'shared').state;
		const shId = s.borrows[0].id;
		expect(borrow(s, 'mut').error).not.toBeNull(); // blocked while shared held
		s = dropBorrow(s, shId).state; // reference goes out of scope
		expect(borrow(s, 'mut').error).toBeNull(); // now exclusive access is free
	});

	it('reading through a live &mut is E0503', () => {
		const mut = borrow(initial(), 'mut').state;
		expect(use_(mut, 'a').error).toEqual({
			code: 'E0503',
			message: 'cannot use `a` because it was mutably borrowed'
		});
	});
});

describe('the interaction of moves and borrows', () => {
	it('refuses to move a value that is borrowed (E0505)', () => {
		const shared = borrow(initial(), 'shared').state;
		expect(moveTo(shared, 'b').error).toEqual({
			code: 'E0505',
			message: 'cannot move out of `a` because it is borrowed'
		});
	});

	it('leaves state unchanged on every refusal (nothing compiled, nothing ran)', () => {
		const shared = borrow(initial(), 'shared').state;
		expect(moveTo(shared, 'b').state).toBe(shared);
		expect(borrow(shared, 'mut').state).toBe(shared);
	});

	it('other() flips the binding', () => {
		expect(other('a')).toBe('b');
		expect(other('b')).toBe('a');
	});
});
