// Parsing a unified diff for the Diff Reader widget (M6). The lesson teaches the
// three rules for reading a patch (`-` removed, `+` added, space unchanged) and
// walks one real hunk; this parses that same diff into structured lines the
// widget can colour and number. Pure and DOM-free so the parse is unit-testable.
//
// The grammar is the unified-diff subset the course uses: `---`/`+++` file
// headers, `@@ -old,len +new,len @@` hunk headers, and body lines prefixed with
// a space (context), `+` (added), or `-` (removed). Line numbers are computed
// the way a reviewer reads them: a context line advances both sides, a removal
// advances only the old side, an addition only the new side.

export type DiffKind = 'file-old' | 'file-new' | 'hunk' | 'context' | 'add' | 'del';

export interface DiffLine {
	kind: DiffKind;
	/** The line text without its leading marker (marker kept for headers). */
	text: string;
	/** 1-based line number in the old file, or null (added / header lines). */
	oldNo: number | null;
	/** 1-based line number in the new file, or null (removed / header lines). */
	newNo: number | null;
}

/** Parse a `@@ -a,b +c,d @@ trailing` header into its start line numbers. */
export function parseHunkHeader(line: string): { oldStart: number; newStart: number } | null {
	const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
	if (!m) return null;
	return { oldStart: Number(m[1]), newStart: Number(m[2]) };
}

/**
 * Parse a unified diff into structured lines with old/new line numbers. Total
 * over any input: a line that fits no rule is treated as context so nothing is
 * dropped. Line numbering resets at each hunk header from its `@@` start values.
 */
export function parseDiff(diff: string): DiffLine[] {
	const out: DiffLine[] = [];
	let oldNo = 0;
	let newNo = 0;
	for (const raw of diff.replace(/\n$/, '').split('\n')) {
		if (raw.startsWith('--- ')) {
			out.push({ kind: 'file-old', text: raw, oldNo: null, newNo: null });
		} else if (raw.startsWith('+++ ')) {
			out.push({ kind: 'file-new', text: raw, oldNo: null, newNo: null });
		} else if (raw.startsWith('@@')) {
			const h = parseHunkHeader(raw);
			if (h) {
				oldNo = h.oldStart;
				newNo = h.newStart;
			}
			out.push({ kind: 'hunk', text: raw, oldNo: null, newNo: null });
		} else if (raw.startsWith('+')) {
			out.push({ kind: 'add', text: raw.slice(1), oldNo: null, newNo: newNo });
			newNo += 1;
		} else if (raw.startsWith('-')) {
			out.push({ kind: 'del', text: raw.slice(1), oldNo: oldNo, newNo: null });
			oldNo += 1;
		} else {
			const text = raw.startsWith(' ') ? raw.slice(1) : raw;
			out.push({ kind: 'context', text, oldNo: oldNo, newNo: newNo });
			oldNo += 1;
			newNo += 1;
		}
	}
	return out;
}

/**
 * The exact patch the M6 "Reading a Diff" lesson walks: a `set_pixel` gaining a
 * bounds check and a `-> bool` return. Kept here as the single source both the
 * widget and its test read, so the interactive reader shows the same diff the
 * prose narrates.
 */
export const SAMPLE_DIFF = `--- a/src/framebuffer.rs
+++ b/src/framebuffer.rs
@@ -12,6 +12,10 @@ impl Framebuffer {
     /// Write one pixel into the frame.
-    pub fn set_pixel(&mut self, x: usize, y: usize, color: u16) {
+    pub fn set_pixel(&mut self, x: usize, y: usize, color: u16) -> bool {
+        if x >= WIDTH || y >= HEIGHT {
+            return false;
+        }
         let i = y * WIDTH + x;
         self.pixels[i] = color;
+        true
     }
 }`;

/** A count of added and removed lines, for a one-line summary. */
export function diffStat(lines: DiffLine[]): { added: number; removed: number } {
	let added = 0;
	let removed = 0;
	for (const l of lines) {
		if (l.kind === 'add') added += 1;
		else if (l.kind === 'del') removed += 1;
	}
	return { added, removed };
}
