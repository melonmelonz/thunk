# Reading a Diff

When you offer commits to a project, its people do not reread the whole codebase to see what you
did. They read a **diff**: a listing of exactly what your change adds and removes, and nothing
else. The rules for reading one fit in three lines.

- A line starting with `-` was removed.
- A line starting with `+` was added.
- A line starting with a space is unchanged, shown so you can see where you are.

Changes are grouped into **hunks**. A hunk is one block of changed lines with a few unchanged
**context lines** around it, so the change is readable without opening the file. A small change
is one hunk; a bigger one is several, each marked with a `@@` header saying where in the file it
lands.

## One real diff

Here is a diff the world of this course could produce. Imagine the framebuffer arithmetic from
M4 written as a `set_pixel` function. Someone has noticed that nothing stops a caller from
writing a pixel outside the frame. Their fix:

```diff
--- a/src/framebuffer.rs
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
 }
```

Walk it. The two `---`/`+++` lines name the file, before and after: same file, `framebuffer.rs`.
The `@@` header opens the only hunk and says where it lands: the hunk spans six lines of the old
file and ten of the new, starting at line 12. The doc comment at the top is context,
unchanged. The `-` line removes the old signature; the `+` line directly under it puts the
signature back with one difference, a `-> bool` return type, so the function can now report
whether it wrote anything. The next three `+` lines are the actual fix: if `x` or `y` is off the
frame, return `false` instead of writing. Then two context lines, the index arithmetic you know
from M4 and the write itself, untouched. One more `+` line makes the function end in `true`, the
value it returns when the write happens. The closing braces are context. Read this way, the diff
answers the reviewer's question precisely: out-of-range writes are refused, in-range behavior is
unchanged, and callers can now tell which happened.

## The unit of conversation

The diff is the unit of conversation in open source. Proposals arrive as diffs. **Review** happens
on the diff: people read it, comment on its lines, ask for changes to it. Disagreements are argued
over specific `+` and `-` lines, and approval means this diff, exactly, enters the history.
Learning to read a diff is learning to be read, because when you send a change, the diff is what
the project sees of you. Who reads it, and how they decide, is the last lesson.

## Key terms

- **diff** — a listing of exactly what a change removes (`-` lines) and adds (`+` lines).
- **hunk** — one block of changed lines in a diff, marked with a `@@` header.
- **context lines** — the unchanged lines shown around a hunk so it reads without opening the file.
- **review** — the reading of a diff by the project's people before it is accepted.
