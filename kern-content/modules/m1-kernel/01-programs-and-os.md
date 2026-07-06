# Programs and the Operating System

Start with the thing in front of you. A program is just a file full of instructions. When you run
it, the machine copies those instructions into memory and starts stepping through them, one at a
time, very fast. That is the whole trick. Everything else is bookkeeping around that idea.

But a program almost never runs alone. Dozens of them run at once, and they all want the same
things: time on the processor, space in memory, a way to read a file or draw to the screen. If every
program could reach out and grab the hardware whenever it wanted, the machine would fall over in a
second. Two programs would write to the same memory. One would hog the processor forever. A crash in
one would take down all the rest.

So there is a referee. We call it the operating system, and the part of it with real authority is
the **kernel**. The kernel is a program too, but a privileged one. It starts first, it never exits
while the machine is on, and the processor gives it powers that ordinary programs do not get.

## Two modes

A modern processor runs in one of (at least) two modes.

- **User mode** is where your programs live. In user mode you can do arithmetic, move data around,
  and call into the kernel, but you cannot touch the hardware directly. Try to, and the processor
  stops you.
- **Kernel mode** is where the kernel runs. In kernel mode you can change the page tables that decide
  which memory a program can see, program the timer that interrupts a running program, and talk to
  devices.

This split is the foundation everything else rests on. It is why one badly behaved program cannot
scribble over another, and why a normal application cannot quietly take over the machine.

## What the kernel owns

The kernel keeps the ledgers that user programs are not allowed to keep for themselves:

- the **scheduler**, which decides who gets the processor next,
- the **page tables**, which give each program its own private view of memory,
- the **file descriptor table**, which tracks the files and devices a program has open,
- the **interrupt handlers**, which are how the hardware gets the kernel's attention.

You do not call these directly. You ask for them.

## The one doorway

When your program needs something only the kernel can do, read a file, get more memory, start
another program, it makes a **system call**, usually shortened to **syscall**. A syscall is a
controlled doorway from user mode into kernel mode. Your program puts a number and some arguments in
the right place and signals the processor; the processor switches to kernel mode, runs the kernel's
code for that request, and switches back with a result.

That is the shape of the whole system. Programs do ordinary work in user mode, and step through the
one doorway whenever they need the referee. The rest of this module walks through what is on the
other side of that doorway: syscalls in detail, how files and devices look the same from a program's
point of view, and how a program asks for memory.

## Key terms

- **program** — a file of instructions the machine steps through.
- **kernel** — the privileged core of the operating system.
- **user mode / kernel mode** — the unprivileged and privileged processor modes.
- **syscall** — the controlled request a program makes to the kernel.
- **page tables** — the kernel's map of what memory each program can see.
