# thunk — Proposal

*A systems course for people coming home. Offline, from the ground up.*

**Penn Porterfield — 2026-07-06. Working title.**
**For my Next Chapter mentors.**

---

thunk is a small, self-contained course that teaches the low level of a computer, from true zero, on
a machine that is not allowed to touch the internet. It is one offline Rust program. It teaches how a
computer actually works, at your own pace, and it ends with DOOM booting on a screen the learner
drove from the metal up. Below is the problem it answers, why I am the one to build it, and how it
connects to reentry.

## The problem

Every coding program for justice-impacted people teaches web development. The Last Mile teaches
JavaScript and React. Persevere teaches full-stack. Justice Through Code teaches Python. These are
good programs doing real good, and I respect them. But web development is the most crowded corner of
the industry, the place everyone who did a bootcamp already stands, so it does little to set anyone
apart. And teaching it inside a facility is a bit of a simulacrum. You cannot use the live internet,
so the program mirrors a fake one in for you to practice against. You come out one step removed from
the real thing.

Meanwhile I could not find one prison or reentry program that teaches systems, embedded, or kernel
work. Not one. That is a real white space, and there is a plain reason it stayed empty: low-level
work usually needs hardware, and hardware does not clear facility review. So the most durable, least
crowded part of the field is the one part nobody is teaching to the people who could most use a way
to stand out.

## Why I should build this

Because I have lived exactly this, and I am already doing the hard part.

I taught myself on a graphing calculator in the honor block of a maximum security prison, then worked
through the "You Don't Know JavaScript" series on a locked-down library browser because it was the
only machine I could reach. I know what it is to want this and have to assemble it out of scraps. I
spent time as the assistant for the math GED, too, and I know what it is to watch someone finally get
it.

I am not proposing this from the sidelines. Right now I am building the capstone it teaches toward,
myself: an out-of-tree Rust driver for an SPI display with DOOM running on it, on a BeaglePlay,
traced on a Saleae logic analyzer. So I know the material is real and current. Rust just became a
first-class part of the Linux kernel, and there is still no Rust SPI abstraction in mainline, so this
sits on a live frontier, not a history lesson.

And it is buildable. The whole low-level stack is simulated in software, so it clears the wall the
incumbents could not: one static binary, no network, no installer, and a check in the build that
keeps the language engineering and not hacking. It is cheap, it is self-contained, and Phase 1 is
already built and passing tests. I can open the classroom and show it running today.

## How it connects to reentry

Reentry is the stretch right before you get out and the first months after, when you have the least
footing and the most to prove. The whole course is built around that window. You learn the
fundamentals inside, on a machine with no internet. The week you get home, you turn that into
something real.

The point of reentry is walking out with something you can show, and this is where thunk is different
from a web-dev course. It ends in tangible artifacts a person can put on a resume:

- a device driver they wrote, and DOOM running on a panel because of it;
- and, once they are out, their first real contribution to open source: a documentation fix, a bug in
  a tool they use, and for the ones who go far, a Linux kernel patch, which is the path I am walking
  myself.

That last one matters more for people coming home than for almost anyone else. A merged contribution
is public and permanent. It is your name on real work that shipped, in a place that does not ask
about your record. When a background check might quietly close a door, a history of open-source
contributions is a door that is already open, and nobody can take it back. It is also how you meet
people in the field; the work introduces you. That part needs the internet, so it lives on the
outside, which is exactly right. You learn inside, and you make your first real contribution the week
you come home.

So the arc matches the moment. Inside, you build the skill. At release, you build the record. Both
are things you can point to when someone asks what you can do.

## What I am asking for

A yes, and the room to build this as my justice-impacted work. Your feedback where I am wrong; I ship
better code when someone tells me it is not up to snuff, and I have learned to take that well. And an
introduction where you have one, to Next Chapter leadership, to The Last Mile, to Saleae.

---

### Sources (verified 2026-07-06; date-stamp before reuse)

- Rust concluded its kernel "experiment" and became core in Linux 7.0; 7.1 stable Jun 2026; no
  in-tree Rust SPI abstraction as of 7.2-rc2. (Phoronix; kernel.org Rust docs; rust.docs.kernel.org)
- Prison/reentry programs teach web/Python, not systems: The Last Mile (JS/React), Persevere
  (full-stack), Justice Through Code (Python/Django). (thelastmile.org; perseverenow.org;
  centerforjustice.columbia.edu)
- Web-dev entry tier oversupplied; embedded/systems roles short-staffed, ~$137k–$169k; Rust
  most-admired (not highest-paid). (BLS OOH Web Developers; Glassdoor/Salary.com; Stack Overflow 2025.)
- Saleae: no nonprofit/donation program; ~50% student discount (Logic 8 ≈ $249 vs $499); $200
  project-writeup bounty. (saleae.com/discounts; saleae.com/support writing-for-saleae)
