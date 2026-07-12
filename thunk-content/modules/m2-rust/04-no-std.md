# no_std

Every Rust program you have seen so far leans on the **standard library**, written `std`. It is the
toolbox that ships with the language: `String` from lesson 02, files, threads, collections that
grow as you push into them. Lean on it freely, on a normal machine.

But look at what those tools are made of. Opening a file is the `open` syscall. Starting a thread
is a syscall. A collection that grows needs **heap allocation**, memory requested while the program
runs, and that memory ultimately comes from the kernel, the same way M1's `mmap` got it. Walk to
the bottom of almost anything in `std` and you find a syscall. The standard library quietly assumes
there is a kernel underneath to answer.

## Bare metal

Now remember where this course is going: a small machine driving a display over SPI. Code that runs
on a chip like that, or code that runs inside a kernel, has no kernel underneath it. There is
nothing to answer a syscall. Programmers call this **bare metal**: your code and the hardware, with
no operating system in between. On bare metal, `std`'s quiet assumption is simply false, and the
library cannot work.

## Dropping the assumption

Rust lets you say so, with one line at the top of the program:

```rust
#![no_std]
```

The attribute tells the compiler: build this program without the standard library, because there is
no operating system where it is going. Files, threads, and the growing collections are gone. You
cannot ask for what nothing can provide.

What remains is **core**: the part of the language's library that needs nothing beneath it. The
number types and their arithmetic. Slices, the fixed views into buffers. Options, results,
comparisons, iteration. Everything in `core` is self-contained computation, compiled instructions
working on memory the program already has, so it runs anywhere the processor runs.

## Who lives here

This is not an exotic corner. Embedded Rust, the code on small chips in instruments and machines,
is `no_std` code. The Rust that goes into the Linux kernel is built on the same discipline, since
kernel code has no kernel above itself to call. And thunk's own display simulator, the one you will
program in the coming modules, is written against this discipline too: if code only uses `core`, it
could run on the real panel's chip, not just in the simulator.

So the Rust you will read from here on is the small kind. No files, no threads, no growing
collections. Types, arithmetic, buffers, and a wire. The next lesson starts on the types.

## Key terms

- **standard library (`std`)** — Rust's full toolbox; it assumes an operating system underneath.
- **heap allocation** — memory requested while the program runs, which ultimately comes from the kernel.
- **bare metal** — running with no operating system between your code and the hardware.
- **`#![no_std]`** — the attribute that builds a program without the standard library.
- **core** — the library that remains: types, arithmetic, and traits that need nothing beneath them.
