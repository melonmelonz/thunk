# Ownership

The last lesson said Rust proves, at compile time, who owns each piece of memory. This lesson is
that proof's first rule. It is called **ownership**, and it is short enough to state in one line:
every value has exactly one owner.

A **value** is a piece of data living somewhere in memory: a number, a piece of text, a buffer of
pixels. The **owner** is the variable responsible for it. One value, one owner, always. Two
variables never own the same value at the same time, and a value is never left with no owner while
it is still alive.

## Moves

What happens when you assign one variable to another? For a value of any real size, Rust does not
copy it. Ownership **moves**. The new variable becomes the owner, and the old name is dead. Here it
is with `String`, Rust's owned text type:

```rust
fn main() {
    let a = String::from("thunk");
    let b = a;              // ownership of the text moves from a to b
    println!("{b}");        // fine: b is the owner now
    println!("{a}");        // error: a no longer owns anything
}
```

This does not compile. The compiler stops on the last line and says the value was moved out of `a`,
points at the line where the move happened, and refuses to build the program. That refusal is the
whole point. In an older language, two names for one piece of memory is exactly how you give memory
back twice, or use it after it is gone. Rust makes the situation unrepresentable: after a move, the
old name cannot be used at all.

One footnote so the rule does not surprise you: small fixed-size values, like plain numbers, are
copied on assignment instead of moved, because copying a few bytes is free and harmless. The move
rule is for everything bigger.

## Drop

The rule has a second half. When the owner goes out of **scope**, when execution leaves the block
of code where the variable lives, the value is **dropped**: it is dismantled and its memory is
returned, right there, at the closing brace.

```rust
fn main() {
    {
        let frame = String::from("a full frame of pixels");
        // frame is usable here
    }   // frame's owner is gone: the value is dropped, its memory returned
}
```

Now put the two halves together and you can see the trick behind lesson 01's claim. Exactly one
owner, and a drop the moment that owner leaves scope, means the compiler can point at the line
where every value's memory comes back. It is proved once, while compiling. Nothing has to watch
memory at runtime, nothing has to guess, and that is how Rust manages memory with no garbage
collector at all.

## Key terms

- **ownership** — Rust's rule that every value has exactly one owner.
- **value** — a piece of data living in memory.
- **move** — assignment that transfers ownership; the old name is dead afterward.
- **scope** — the block of code a variable lives in.
- **drop** — what happens when the owner leaves scope: the value is dismantled and its memory returned.
