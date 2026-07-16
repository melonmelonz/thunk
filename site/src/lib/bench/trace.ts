// SAVE TRACE serializer: turn the live trace rows (exactly what the log shows)
// into a plain-text file. Pure and DOM-free so it is unit-testable; the bench
// wraps a Blob download around it. One line per row - the row's kind then its
// annotated text - under a short header comment naming the frame, the event
// count, and the fixed panel format. ASCII only, so the file opens cleanly
// anywhere and diffs deterministically.

import type { Row } from './sim';

/** Short, fixed-width kind tag mirroring the Rust KIND_* codes (0 cmd, 1 data, 2 select). */
export function traceKindLabel(kind: number): string {
	if (kind === 0) return 'CMD';
	if (kind === 2) return 'SEL';
	return 'DATA';
}

export interface TraceMeta {
	/** The current frame counter, stamped in the header. */
	frame: number;
}

/**
 * Serialize `rows` to the downloadable trace text. Deterministic: the same rows
 * and frame always produce the same bytes. Trailing newline included.
 */
export function serializeTrace(rows: Row[], meta: TraceMeta): string {
	const frame = String(meta.frame).padStart(5, '0');
	const lines = [
		'# thunk bus trace',
		`# frame ${frame}  ${rows.length} events  240x320 RGB565`,
		...rows.map((r) => `${traceKindLabel(r.kind).padEnd(4)} ${r.text}`)
	];
	return lines.join('\n') + '\n';
}
