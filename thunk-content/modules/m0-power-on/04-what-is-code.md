# What Code Is

The last lesson said a program is a list of instructions, stored as numbers. So does writing a
program mean typing out those numbers, one by one?

It used to. The first programmers wrote raw instruction numbers by hand, and it was as slow and
error-prone as it sounds. One wrong digit and the program did something else entirely, with no
hint about where the mistake was. Nobody works that way anymore.

## Source code

Instead, people write **source code**. Source code is text, written in a **programming language**,
and it is meant to be read by humans first. A programming language is a set of rules for writing
instructions in a form a person can follow: words instead of raw numbers, names for things instead
of memory locations, structure you can look at and understand. A line of source code might say,
more or less, "add the price and the tax, and call the result the total." You can read that. You
can spot a mistake in it. You can hand it to someone else and they can read it too.

But the processor cannot run text. The processor only runs its instruction numbers. Something has
to translate.

## The compiler

That something is the **compiler**. A compiler is a program whose job is to read your source code
and translate it into the processor's instructions. Text goes in, a runnable program comes out.
And notice what the compiler is: the tool that turns programs into programs is itself just a
program, a list of instructions like any other. There is no special machinery for it. It reads
bytes and writes bytes.

So the working loop of a programmer is: write source code, run it through the compiler, and get a
program the processor can step through.

## Many languages, one machine

There are many programming languages, the way there are many human languages. Each one makes
different trade-offs about what is easy to say and what mistakes it will catch for you. They all
end up in the same place, processor instructions, because that is the only thing the machine runs.

This course uses **Rust**. Rust is a language built for exactly the kind of work this course does:
programs that sit close to the machine, where you need to know what the processor and memory are
really doing, and where the language catches whole families of mistakes before your program ever
runs. You will start reading and writing it in the next module.

One last piece of naming, because you will hear these words constantly. "Code" is just source
code, the text. "Coding" is writing it. There is no more to the words than that.

## Key terms

- **source code** — the human-readable text of a program, written in a programming language.
- **programming language** — a set of rules for writing instructions in a form people can read.
- **compiler** — a program that translates source code into the processor's instructions.
- **Rust** — the programming language this course uses.
