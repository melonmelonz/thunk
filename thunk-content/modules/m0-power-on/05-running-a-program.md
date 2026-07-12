# Running a Program

You have the pieces now. A program is a list of instructions stored as bytes. Storage remembers,
memory is fast, and the processor steps through instructions in memory. Put them together and you
can say exactly what "running a program" means.

When a program runs, the machine copies its instructions from storage into memory, and the
processor starts stepping through them. That is the whole event. The program was sitting on the
shelf as a **file**, a named bundle of bytes kept in storage, doing nothing. Now its instructions
are on the desk, in memory, and the processor is walking the list, one instruction at a time,
billions of times a second.

## The terminal

How do you ask for that to happen? In this course, through the **terminal**. The terminal is a
program that takes typed commands. It shows you a mostly empty screen with a short prompt, a few
characters marking where your typing goes, and it waits. You type a line, press enter, and the
terminal acts on what you typed.

A **command** is the name of a program, plus whatever you want from it. The first word on the line
says which program to run. The words after it say what you want that program to do. When you press
enter, the terminal finds that program in storage, has it loaded into memory, and the processor
starts stepping through it.

Then the program does its work. Usually it prints its answer, right there in the terminal, as
lines of text. And when it is done, it **exits**. Exiting means the program is finished: the
processor stops stepping through its instructions, its space in memory is given back, and the
terminal shows its prompt again, waiting for your next command. Most of the programs you will run
in this course live for less than a second. Run, print, exit.

## You have already done this

None of this is hypothetical. You are reading these words inside a program called `thunk`. It sits
in storage as a file of bytes. At some point you typed its name into a terminal and pressed enter.
The machine copied its instructions into memory, the processor started stepping through them, and
one of the things those instructions do is put this lesson on your screen. When you quit, it will
exit, and the prompt will come back. You ran a program before you finished the first module about
them.

## Opening the machine

That closes the loop this module opened. A machine of switches, switches as bits, bits as bytes,
bytes as instructions, instructions as programs, and programs run by a typed command. Nothing in
that chain is magic, and you have now walked all of it once, at a distance.

The rest of the course opens the machine up, layer by layer. Next comes the kernel, the program
that referees all the others, then Rust, then the wires that carry bytes to real devices, until
you are the one putting dots on a screen. Same machine, closer up.

## Key terms

- **file** — a named bundle of bytes kept in storage.
- **run** — to copy a program's instructions from storage into memory and have the processor step through them.
- **terminal** — a program that takes typed commands and shows their output as text.
- **command** — a typed line naming a program to run, plus what you want from it.
- **exit** — how a program finishes: it stops running and the terminal waits for the next command.
