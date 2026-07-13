# Picking a Project

M6 ended with what remains: take a real project, make a real change, and send it. This module is
that, in three steps. Pick the project, make the change, see it through review. You are on the
open build now, with the internet in reach, and everything from here on is real: a real
repository, a real maintainer, a real merge.

## Start with what you run

The best first project is software you already use. You have been using open source for the whole
course: Linux, git, the Rust toolchain, thunk itself. All of them take contributions. Using the
software matters more than it sounds, because it gives you three things a stranger to the project
does not have: you know what the software is supposed to do, you can test your change by actually
using it, and you will still care about the project after the change merges.

The instinct to resist is picking a project for its name. A famous project does not make a better
first contribution; it makes a longer review queue and a higher bar, for a change that carries
your name no sooner. Small and real beats impressive. The first goal is one merged change, of any
size, and where it lands matters much less than that it lands.

## Reading a repository from the outside

You can size up any public repository before touching it, and most of what you need is in three
places. The README says what the project is and how to build and run it; if you cannot get it
running from the README alone, you may have already found your first contribution. The
**CONTRIBUTING file** says how the project wants changes prepared and sent: what format, what
tests to run, where to send the result. Read it before you write a line, because every project's
answer is different, and following it is the first thing a reviewer checks. The **issue tracker**
is the project's public list of known problems and wanted work; reading it tells you what the
project considers broken and how its people talk to each other.

Many trackers carry a **good first issue** label: maintainers marking, ahead of time, the tasks
they judge suitable for someone new to the code. That label is an invitation. It means a
maintainer has already decided the task is worth a newcomer's time and their own review.

## On-ramps that already exist

Some doors are built for first-time contributors; call them on-ramps. kernelnewbies.org is
documentation plus a community: it spells out how to prepare and send a first Linux kernel patch,
down to the email formatting, and its people answer first-timers' questions. Two of the on-ramps
are **mentorship programs**, where someone has agreed in advance to teach you: the Linux Kernel
Mentorship Program pairs newcomers with experienced kernel developers for a structured first
contribution, and Outreachy runs paid open source internships, explicit about taking people whose
path here was not the usual one. You do not need an on-ramp to contribute, but if the cold start
feels steep, they exist to remove it.

## The scarce resource

One fact organizes everything else in this module: the maintainer's time is the scarce resource.
Most maintainers review contributions on top of their own work, often unpaid. Every choice that
follows, in this lesson and the next two, comes down to spending as little of that time as
possible: a small change, prepared the way the project asked, described so it can be checked
quickly. Do that and you are ahead of most first-time contributors before anyone reads your diff.

## Key terms

- **CONTRIBUTING file** — a project's own instructions for preparing and sending changes; read it first.
- **issue tracker** — a project's public list of known problems and wanted work.
- **good first issue** — a label maintainers put on tasks they judge suitable for newcomers.
- **mentorship program** — a structured entrance to a project, built to take in and teach first-time contributors.
