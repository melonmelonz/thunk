# Memory and mmap

Every program you run believes it has the machine's memory to itself, starting from a clean, huge
address space. That belief is a useful lie the kernel tells each program, and this lesson is about
how it keeps the lie consistent.

## Virtual memory

The addresses your program uses are **virtual addresses**. They are not where the data really sits in
the physical memory chips. Between the two is a translation, maintained by the kernel and enforced by
the processor, called the **page tables**. Every time your program touches an address, the hardware
walks the page tables to find the real location.

Because each program has its own page tables, two programs can both use address `0x1000` and never
collide; the kernel points each one at different physical memory. This is the mechanism behind the
isolation we talked about in the first lesson. One program cannot read another's memory because its
page tables simply do not map there.

## Pages and faults

Memory is managed in fixed-size chunks called **pages**, usually 4096 bytes. When your program
touches a page that is not currently mapped to physical memory, the processor raises a **page
fault**. That sounds like an error, and sometimes it is, but usually it is routine: the kernel
catches the fault, finds or allocates the physical page, updates the page tables, and lets your
program continue as if nothing happened. Faulting is how memory gets filled in on demand instead of
all at once.

## Asking for memory

When a program needs more memory, it asks the kernel with `mmap`. A single call sets up a fresh
region of the address space and points the page tables at it. There are a few flavors:

- **anonymous** — plain scratch memory, backed by nothing on disk. This is where a large allocation
  or a language runtime's heap usually comes from.
- **file-backed** — the contents of a file mapped straight into memory, so reading the memory reads
  the file, with no separate `read` call.
- **shared** — a region two programs can both map, so a write by one is seen by the other. This is
  one of the fastest ways for programs to talk.

The matching call `munmap` tears a region back down. Touch it afterward and you get the fault that
really is an error: a segmentation fault.

There is one more piece worth knowing, because we will need it. `mmap` can map a **device's** memory,
not just ordinary RAM. That is how a program reaches a display's framebuffer: it maps the panel's
memory into its own address space, and then drawing a pixel is just writing to memory. We build
exactly that at the end of the course.

## Key terms

- **virtual address** — the address a program uses, translated by the page tables.
- **page** — the 4096-byte unit memory is managed in.
- **page fault** — the processor asking the kernel to deal with an unmapped access.
- **mmap** — the syscall that maps memory (anonymous, file-backed, shared, or a device).
