import { describe, it, expect } from 'vitest';
import { parseDiff, parseHunkHeader, diffStat, SAMPLE_DIFF } from './diff';

describe('parseHunkHeader', () => {
	it('reads the old and new start lines from a @@ header', () => {
		expect(parseHunkHeader('@@ -12,6 +12,10 @@ impl Framebuffer {')).toEqual({
			oldStart: 12,
			newStart: 12
		});
		expect(parseHunkHeader('@@ -1 +1,3 @@')).toEqual({ oldStart: 1, newStart: 1 });
	});

	it('returns null for a line that is not a hunk header', () => {
		expect(parseHunkHeader('     context')).toBeNull();
		expect(parseHunkHeader('@@ malformed')).toBeNull();
	});
});

describe('parseDiff on the lesson patch', () => {
	const lines = parseDiff(SAMPLE_DIFF);

	it('classifies the file headers and the single hunk', () => {
		expect(lines[0]).toMatchObject({ kind: 'file-old', text: '--- a/src/framebuffer.rs' });
		expect(lines[1]).toMatchObject({ kind: 'file-new', text: '+++ b/src/framebuffer.rs' });
		expect(lines[2].kind).toBe('hunk');
		expect(lines.filter((l) => l.kind === 'hunk')).toHaveLength(1);
	});

	it('marks the signature swap as one removal and its replacement addition', () => {
		const del = lines.find((l) => l.kind === 'del');
		const firstAdd = lines.find((l) => l.kind === 'add');
		expect(del?.text).toContain('color: u16) {');
		expect(firstAdd?.text).toContain('-> bool');
	});

	it('counts the change: five additions, one removal', () => {
		expect(diffStat(lines)).toEqual({ added: 5, removed: 1 });
	});

	it('numbers context lines on both sides, starting from the hunk header', () => {
		// The doc comment is the first body line: old 12, new 12.
		const comment = lines.find((l) => l.text.includes('Write one pixel'));
		expect(comment).toMatchObject({ kind: 'context', oldNo: 12, newNo: 12 });
	});

	it('numbers a removal on the old side only and an addition on the new side only', () => {
		const del = lines.find((l) => l.kind === 'del');
		expect(del?.oldNo).toBe(13);
		expect(del?.newNo).toBeNull();
		const add = lines.find((l) => l.kind === 'add');
		expect(add?.newNo).toBe(13);
		expect(add?.oldNo).toBeNull();
	});

	it('keeps the two sides consistent through the whole hunk', () => {
		// The `let i = ...` context line sits at old 14 / new 17: one removal and
		// four additions precede it, so the new side has run three lines ahead.
		const idx = lines.find((l) => l.text.includes('let i ='));
		expect(idx).toMatchObject({ kind: 'context', oldNo: 14, newNo: 17 });
	});
});

describe('parseDiff robustness', () => {
	it('is total: an unrecognized line falls back to context, nothing dropped', () => {
		const lines = parseDiff('a line with no marker\nanother');
		expect(lines).toHaveLength(2);
		expect(lines[0].kind).toBe('context');
	});

	it('handles a trailing newline without emitting an empty line', () => {
		expect(parseDiff('@@ -1,1 +1,1 @@\n context\n')).toHaveLength(2);
	});
});
