// The check grader. Framework-free, pure, offline; nothing leaves this machine.
//
// EXACT parity with thunk_core::Check::grade (thunk-core/src/check.rs), by way of
// thunk-web/assets/check.js which already mirrors it:
//   Choice: the picked option's index must equal the answer index (i === answer).
//   Short:  trim + lowercase both sides; accept if the response matches ANY entry
//           of the accepted list - the same normalization as Rust's
//           `t.trim().to_lowercase() == x.trim().to_lowercase()`.
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

/** A check's live response: the picked option index, or the typed text. */
export type Response = { picked: number } | { text: string };

/** Grade a check against a response. true = pass, false = wrong, null = empty. */
export function grade(check: Check, response: Response): boolean | null {
	if (check.kind === 'choice') {
		return gradeChoice('picked' in response ? response.picked : -1, check.answer);
	}
	return gradeShort('text' in response ? response.text : '', check.answers);
}
