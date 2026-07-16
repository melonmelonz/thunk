# Borrowing

Ownership as the last lesson told it has a problem. If assignment moves a value, how do you ever
hand one to a function without losing it? You do not want a function that prints a buffer to eat
the buffer.

The answer is that you can lend a value without giving it away. The loan is called a **borrow**,
and the thing you hand over is a **reference**: not the value itself, just permission to reach it.
The owner stays the owner. When the borrow ends, the owner carries on as before.

Here is that printing function, done right:

```rust
fn show(s: &String) { println!("{s}"); }   // borrows the text, reads it, hands it back
```

Calling `show(&text)` lends the value for the length of the call; when `show` returns, the borrow
is over and the caller still owns `text`.

## Two kinds of loan

Rust has two kinds of reference, and the difference is what the holder may do:

- `&value` is a **shared reference**. The holder can read the value but not change it.
- `&mut value` is a **mutable reference**. The holder can change the value.

```rust
fn main() {
    let mut count = 10;
    let r = &count;         // a shared reference: borrow count to read it
    println!("{r}");        // prints 10; the read borrow ends here
    let w = &mut count;     // a mutable reference: borrow count to write it
    *w += 1;                // count is now 11
}
```

This compiles, because the read borrow is finished before the write borrow starts. The `*w` on the
last line means "the value the reference points at", so `*w += 1` adds one to `count` itself.

## The rule

Here is the law that governs every borrow. At any moment, a value may have any number of readers,
or exactly one writer. Never both at once, and never two writers.

If someone is writing while others read, the readers can see the value half-changed.
If two are writing, they trample each other. Rust does not ask you to be careful about this. It
makes the overlap a compile error. Take a shared reference to a value and then try to change that
value while the reference is still in use, and the program does not build.

The part of the compiler that enforces the rule is called the **borrow checker**. It traces every
reference in the program, works out where each borrow starts and ends, and rejects any overlap of
readers and a writer.

## What this buys you

Look back at lesson 01's three mistakes. Using memory after giving it back: that is a reference
outliving the owner it borrowed from, and the borrow checker rejects it, since a borrow may not
outlive its owner. Two threads writing the same bytes at once: that is two writers on one value,
and the rule forbids it. The bugs that older languages discover at runtime, sometimes years later,
fail to compile here. That is the proof lesson 01 promised, made of two parts: ownership says who
holds each value, borrowing says who may touch it, and the compiler checks both before the program
exists.

Here is the borrow checker as something you can push on. Two bindings, one owned `String`, and
every rule from these two lessons live at once: move the value and the old name goes dead, take as
many shared borrows as you like, take a mutable one and it insists on being alone. Every time you
try to break a rule, the panel refuses with the exact error `rustc` would print, code and all. It
is a checker you cannot fool, which is the point of having one.

:::widget ownership-move
:::

## Key terms

- **borrow** — lending access to a value without giving up ownership.
- **reference** — the handle a borrower holds; permission to reach a value, not the value itself.
- **shared reference (`&`)** — a borrow that allows reading only; any number may exist at once.
- **mutable reference (`&mut`)** — a borrow that allows writing; only one may exist at a time.
- **borrow checker** — the part of the compiler that enforces the readers-or-one-writer rule.
