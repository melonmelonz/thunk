# Syscalls

In the last lesson we said a program steps through the one doorway whenever it needs the kernel. A
**syscall** is that doorway. This lesson is about what actually happens when you step through it.

A syscall is not a normal function call. A normal call jumps to another address in your own program,
still in user mode. A syscall hands control to the kernel and asks the processor to switch into
kernel mode on the way in. You do not get to pick which kernel code runs; you name the request by
number, and the kernel decides.

## The mechanics

Every syscall has a number. `read` is 0 on x86-64 Linux, `write` is 1, and so on. To make the call,
a program:

1. puts the syscall number in a specific register,
2. puts the arguments in a few more registers,
3. runs a single special instruction that traps into the kernel.

On x86-64 the number goes in `rax` and the arguments in `rdi, rsi, rdx, r10, r8, r9`, and the
instruction is `syscall`. On 64-bit ARM (AArch64) the number goes in `x8`, the arguments in
`x0`–`x5`, and the instruction is `svc #0`. Different registers, exact same idea.

The processor switches to kernel mode, the kernel runs the handler for that number, and then control
returns to your program with a result back in a register (`rax` on x86-64).

## The calls you meet first

A short list covers most of what a program does:

- `read`, `write` — move bytes to and from an open file or device.
- `open`, `close` — start and stop using a file.
- `mmap` — ask for memory (next lesson).
- `execve` — replace the current program with a new one.
- `exit` — stop.

Almost everything else is built on top of these.

## Results and errors

The return value is a single number. If it is zero or positive, it usually means success (bytes
read, a file number, an address). If it is negative, it is an error code; the C library flips the
sign and stores it in `errno` for you. A failed `open` comes back as a negative number, and the
reason (no such file, permission denied) is in that number.

You can watch all of this happen. The tool `strace` prints every syscall a program makes, with its
arguments and result. Running a normal program under `strace` for the first time is a good way to
see how much quiet conversation with the kernel is going on under an ordinary task.

## Key terms

- **syscall number** — the integer that names the request.
- **trap** — the controlled switch from user mode into the kernel.
- **errno** — where the C library records why a syscall failed.
- **strace** — a tool that prints the syscalls a program makes.
