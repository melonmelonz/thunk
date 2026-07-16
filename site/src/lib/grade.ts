// The check grader. Framework-free, pure, offline; nothing leaves this machine.
//
// EXACT parity with thunk_core::Check::grade (thunk-core/src/check.rs), by way of
// thunk-web/assets/check.js which already mirrors it:
//   Choice:  the picked option's index must equal the answer index (i === answer).
//   Short:   trim + lowercase both sides; accept if the response matches ANY entry
//            of the accepted list - the same normalization as Rust's
//            `t.trim().to_lowercase() == x.trim().to_lowercase()`.
//   Order:   the submitted permutation of item indices must equal the identity
//            order (0,1,2,...) - the authored order reproduced exactly.
//   Predict: identical to Short (shared normalization); a distinct check kind
//            only so lessons can frame it and the UI can differ.
//
// `grade()` returns a tri-state so the UI can tell "wrong" from "nothing to grade
// yet" (mirrors check.js returning true / false / null).

import type { Check } from './content';

/** The one normalization, shared by short-answer accept and response. */
export function normalize(s: string): string {
	return s.trim().toLowerCase();
}

/** Choice parity: index equality. `picked < 0` means nothing chosen. */
export function gradeChoice(picked: number, answer: number): boolean | null {
	if (picked < 0) return null;
	return picked === answer;
}

/** Short parity: trim+lowercase exact match against the accepted list. */
export function gradeShort(response: string, answers: string[]): boolean | null {
	const got = normalize(response);
	if (got === '') return null;
	return answers.some((a) => normalize(a) === got);
}

/**
 * Order parity: the submitted permutation must equal the identity order over
 * `n` items - `is_identity_order` in Rust. `null` only when the submission is
 * not a full-length ordering (nothing to grade yet); a full ordering always
 * grades true/false.
 */
export function gradeOrder(order: number[], n: number): boolean | null {
	if (order.length !== n) return null;
	return order.every((v, i) => v === i);
}

/** A check's live response: a picked index, typed text, or a submitted order. */
export type Response = { picked: number } | { text: string } | { order: number[] };

/** Grade a check against a response. true = pass, false = wrong, null = empty. */
export function grade(check: Check, response: Response): boolean | null {
	if (check.kind === 'choice') {
		return gradeChoice('picked' in response ? response.picked : -1, check.answer);
	}
	if (check.kind === 'order') {
		return gradeOrder('order' in response ? response.order : [], check.items.length);
	}
	// Short and Predict share the exact same normalization + accept-list rule.
	return gradeShort('text' in response ? response.text : '', check.answers);
}
