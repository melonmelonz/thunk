# What a Program Is

You know the processor follows instructions. So where do the instructions come from, and what do
they look like?

A **program** is a list of instructions. That is all it is. Not a mind, not a set of rules the
machine reasons about, just a list, written down in order, meant to be followed from the top.

And a program is stored as bytes, like everything else. The last lesson said nothing in the
machine is anything but numbers, and that includes instructions. Each instruction the processor
understands has a number assigned to it, by agreement, the same way the letter A has the number
65. A program sitting in memory is just a long run of bytes that the processor reads as
instructions.

## One step at a time

The processor works like this. It picks up one instruction, does what that instruction says, and
moves to the next one. Then it does that again. And again. It never does two instructions at once,
it never skips ahead because it is bored, and it never gets tired. It steps through the list,
billions of times every second.

## Each step is tiny

Here is the surprising part: each instruction does almost nothing. A single instruction is
something like:

- add two numbers together,
- copy a byte from one place in memory to another,
- compare two numbers,
- jump to a different place in the list and continue from there.

That is the scale of one step. There is no instruction for "show a photo" or "play a song." Those
things happen because millions of tiny instructions run one after another, each doing one small
piece. The magic of a computer is not intelligence. It is speed and stacking, billions of trivial
steps per second, piled up until the result looks smart.

The jump instruction deserves a second look. Because the processor can jump backward in the list,
a program can repeat a stretch of instructions over and over. Because it can jump only when a
comparison comes out a certain way, a program can make decisions. Repeating and deciding, built
from jumps, are where all the apparent cleverness comes from.

## Instructions and data, side by side

One more fact, easy to state and deep in its consequences: instructions and data live in the same
memory. The bytes of a program and the bytes it is working on, the numbers, the text, the picture,
sit in one shared space. Memory does not have a special section that only holds instructions. A
byte holding the number 65 could be the letter A, or part of a picture, or an instruction, and
nothing about the byte itself says which. Later modules will show how much care the machine takes
to keep those roles straight.

## Key terms

- **program** — a list of instructions, stored as bytes like everything else.
- **instruction** — one tiny step the processor can do, like adding two numbers or copying a byte.
- **jump** — an instruction that moves the processor to a different place in the list.
- **data** — the bytes a program works on; it lives in the same memory as the program itself.
