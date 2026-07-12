# Version Control in the Open

A project with many hands has a bookkeeping problem. Hundreds of people change the same code, and
the project has to know what changed, when, by whom, and why. The tool that solves this is called
version control, and the one nearly every open source project uses is **git**.

## A chain of commits

git records a project's history as a chain of **commits**. A commit is one recorded change: it
names its author, carries a date, holds the exact edits made to the files, and includes a message
in which the author explains the change in their own words. A project's history is thousands of
these, each one building on the one before, going back to the first line ever written.

This history is the project's memory. Ask git about any line in Linux and it will tell you who
wrote it, when, and what the commit message said. When code misbehaves, you can walk the chain
backward and find the exact commit where the behavior changed. None of this depends on anyone's
memory; it is all recorded.

It is also a ledger of credit. Because every commit carries its author's name, the history records
not just what the code is but who built it, change by change, with dates.

## In the open

The place a project's code and history live is its **repository**. thunk's repository holds every
lesson you have read plus every commit that built them. An open source project makes its
repository public, and that is a stronger statement than publishing the code alone. Anyone can
read not just the current source but the entire history: every change, every author, every
explanation, for the life of the project.

You do not need permission to start working on a public project. You take a **fork**: your own
complete copy of the repository, history included, that you can change freely. Your fork is yours.
Experiment in it, break things in it, rewrite whatever you like; the original project does not
feel any of it.

When something in your fork is worth keeping, you offer it back. You propose your commits to the
original project, and the project's people read exactly what you changed before deciding whether
to take it. The next lesson is about the form your proposed change takes when they read it.

If they take it, your commits join the chain, name and date intact. **Merged** work, work accepted
into the project's history, stays credited to its author permanently, in a public record anyone
can inspect. Every line you get into an open source project is signed work.

## Key terms

- **git** — the version control tool that records a project's history; nearly universal in open source.
- **commit** — one recorded change: author, date, the edits, and a message explaining them.
- **repository** — where a project's code and full history live; public, in open source.
- **fork** — your own complete copy of a project, to work in freely.
- **merged** — accepted into the project's history, credited to its author permanently.
