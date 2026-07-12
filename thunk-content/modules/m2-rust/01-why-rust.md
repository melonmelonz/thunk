# Why Rust, Down Here

M1 ended at the bottom of the software stack: drivers, kernel code, bytes moving over an SPI wire
toward a display. Before you can read the code that lives down there, you need the language it is
written in. In this course that language is **Rust**. This module teaches just enough of it to read
the low-level code coming in the next three modules.

Start with why the language matters at all. Low-level code manages memory by hand. It asks for
bytes, uses them, and gives them back. Three mistakes show up over and over in that kind of code:

- using a piece of memory after giving it back, so you read whatever landed there next,
- reading past the end of a buffer, into bytes that belong to something else,
- two threads writing the same bytes at once, each trampling the other's work.

In older systems languages, nothing stops you from writing any of these. The program compiles
cleanly, ships, and runs. The mistake surfaces later, at runtime, as a crash or as quietly
corrupted data. Sometimes it surfaces years later, on a machine you will never see, in a way you
cannot reproduce. Whole careers have been spent chasing bugs of exactly this shape.

## Rust's bet

Rust makes a different bet: catch these mistakes at **compile time**, before the program even
exists. The compiler is given enough information about who owns each piece of memory and who is
allowed to touch it that it can prove the three mistakes above are absent, or refuse to build the
program. A Rust program that compiles has already passed that proof. The bug never gets the chance
to run.

The next two lessons cover the two ideas that make the proof possible: ownership and borrowing.
They are rules you write your code within, and the compiler holds you to them.

## No garbage collector

Many languages avoid manual memory mistakes a different way: a **garbage collector**, a runtime
helper that watches memory while the program runs and reclaims pieces once nothing uses them
anymore. It works, but it costs. The collector needs processor time, and it pauses the program at
moments of its own choosing to do its sweep.

Rust has no garbage collector. Because the compiler already proved who owns what, memory comes back
the instant its owner is done with it. Not eventually, not when a collector gets around to it. The
same instant, every run, predictably.

## Why it fits down here

That predictability is why Rust fits kernels and small machines. A kernel cannot stop for a garbage
collection pause while an interrupt is waiting. A small machine driving a display may not have the
memory or the processor time a collector demands. Rust gives the control of the old systems
languages, with the three classic mistakes moved from runtime to compile time.

This is not a fringe position. The Linux kernel, the same kernel M1 was about, now accepts driver
code written in Rust alongside its C.

## Key terms

- **Rust** — a systems language that catches memory mistakes at compile time.
- **compile time** — while the compiler builds the program, before it ever runs.
- **runtime** — while the program is actually running.
- **garbage collector** — a runtime helper that reclaims unused memory, at the cost of pauses; Rust does not have one.
- **buffer** — a run of bytes set aside for data; reading past its end is a classic memory mistake.
