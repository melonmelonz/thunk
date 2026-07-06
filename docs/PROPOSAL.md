# kern — Proposal

*A systems course for justice-impacted learners. Offline, from the ground up.*

**Working title. — Penn Porterfield, 2026-07-06**
**For: my Next Chapter mentors and teachers.**

---

## What I want to build

A small, self-contained course that teaches the low level of a computer to people like me, from true
zero, on a machine that is not allowed to touch the internet. It is one offline Rust program. It
teaches how a computer actually works, at your own pace, and it ends with DOOM booting on a screen
the learner drove from the metal up. I am calling it **kern** for now, short for kernel. The name
will probably change; the idea will not.

## Where this comes from

On my birthdays in a maximum security prison my mom sent in a TI-84 Plus and a TI-89 Titanium. I
used the TI-BASIC and Lua on them to write small games and practice theory. I built a hex mapper to
handle the pixels for a 1-bit RPG world builder, all in TI-BASIC. To get closer to a real computer I
volunteered as a math tutor so I could use the library machines; they were locked down, but the
browsers had JavaScript, so I worked through the entire "You Don't Know JavaScript" series and saved
my work to local storage.

Nobody handed me any of that. I assembled it out of what I was allowed to have. Later I became the
assistant for the math GED, and the thing I wrote about it in my application still holds: it is
something to behold when someone finally gets it. Not everyone learns at the same pace. And that is
OK. kern is the course I did not have in that honor block.

## The problem I keep seeing

Every coding program for justice-impacted people teaches web development. The Last Mile teaches
HTML, CSS, JavaScript, React, Node. Persevere teaches full-stack. Justice Through Code teaches Python
and Django. These are real programs doing real good and I respect them.

But two things are true. Entry-level web development is the most saturated corner of the industry; it
is where everyone who did a bootcamp already stands. And teaching web dev inside a facility is a bit
of a simulacrum, because you cannot use the live internet, so the program mirrors a fake one in for
you to practice against. It works, but you are always one step removed from the real thing.

I went looking, and I could not find one prison or reentry program that teaches systems, embedded, or
kernel work. That is a real white space, and there is a plain reason it stayed empty: low-level work
usually needs hardware, and hardware does not clear facility review.

## The idea, and why it clears the wall

kern is simulator-first. The SPI bus, the display panel, and the DOOM framebuffer are all modeled in
software, baked into the binary. A learner reaches the finale with no hardware at all. Because there
is no hardware and no network, the exact thing that kept everyone else out is designed away. It is
one static binary or one static web page on one locked-down PC. No installer, no admin rights, no
sockets, nothing to fetch. There is a lint in the build that rejects any hacking or exploitation
vocabulary, because this is engineering, not hacking, and it needs to read that way to a reviewer.

For people on the outside who can get a cheap single-board computer, an SPI display, and a logic
analyzer, the same course drives the real hardware instead of the simulation. Simulated on the
inside, real on the outside, one program either way. That one seam is what lets kern serve people
still inside and people coming home with the same curriculum.

It runs three ways from one source: a plain command line, a full terminal classroom, and a local web
view where you can watch the simulated logic-analyzer trace, see the panel light up, and play DOOM.
It is self-paced and mastery-based, the way my WGU degree is, so nobody is rushed and nobody is held
back. It works with no teacher in the room, and ships an optional facilitator kit for cohorts that
want one.

## The ladder

Power On (what a computer even is, from nothing) → The Kernel (programs, syscalls, files and
devices, mmap, drivers) → Rust for the Metal → The Bus (SPI) → The Panel (driving a display) → DOOM
(it boots on the panel over the bus you built, then it decodes a real Rust driver).

## Why now, and why me

Rust just stopped being an experiment in the Linux kernel and became a supported, first-class part of
it, as of the 7.0 release late last year. As of the current 7.2 development kernel, there is still no
Rust SPI abstraction in mainline. This is current, not a history lesson. Embedded and systems roles
go unfilled and pay well (roughly $137k to $169k in recent listings) while junior web dev is badly
oversupplied. Rust is the most admired language among developers. I am pointing people at a door that
is open.

I am not proposing this from the sidelines. I am building the kernel capstone it teaches toward, right
now, myself: an out-of-tree Rust driver for an SPI display with DOOM running on it, on a BeaglePlay,
traced on a Saleae Logic 8. kern is the on-ramp to the exact work I am already doing.

## Cost, and honesty about partners

kern is free and open-source. I am not claiming money I do not have. Saleae, who makes the logic
analyzers, does not run a nonprofit or donation program that I can find; what they do offer is a
student discount (a Logic 8 is about $249 instead of $499) and a flat $200 for a solid project
writeup. That bounty is something I can actually collect and put toward hardware, and a larger
partnership is a conversation I intend to start, not one I have finished. Next Chapter is the natural
home and first cohort, and this is the justice-impacted work my capstone already requires.

## What this is not

It is not a game with a lesson attached. It is not vaporware; I can show you a working slice. It is
not a rewrite of anything; it is new. And it is not a claim that web development is bad. It is a claim
that people coming out deserve a shot at the part of the field that is wide open instead of the part
that is wall to wall.

## Phasing

- **Phase 1** — the skeleton and the spine: one content pipeline into the command line and the
  terminal classroom, the Kernel module authored end to end, and a first slice of the simulator that
  boots something on a simulated panel. Demoable at the August Next Chapter demo.
- **Phase 2** — the full simulator, the trace view, the simulated-or-real seam, the web view, and the
  whole ladder from Power On to DOOM.
- **Phase 3** — the facilitator kit, hardened inside and open builds, real outreach to Saleae and
  others, a first outside cohort, and a first conversation with a facility.

## What I am asking for

A yes, and the room to build it as my justice-impacted work. Your feedback where I am wrong; I ship
better code when someone tells me it is not up to snuff, and I have learned to take that well. And an
introduction where you have one, to Next Chapter leadership, to The Last Mile, to Saleae.

---

### Sources (verified 2026-07-06; date-stamp before reuse)

- Rust concluded its kernel "experiment" and became core in Linux 7.0; 7.1 stable Jun 2026; no
  in-tree Rust SPI abstraction as of 7.2-rc2. (Phoronix; kernel.org Rust docs; rust.docs.kernel.org)
- Prison/reentry programs teach web/Python, not systems: The Last Mile (JS/React), Persevere
  (full-stack), Justice Through Code (Python/Django). (thelastmile.org; perseverenow.org;
  centerforjustice.columbia.edu)
- Web-dev entry tier oversupplied; embedded roles short-staffed, ~$137k–$169k; Rust most-admired
  (not highest-paid). (BLS OOH Web Developers; Glassdoor/Salary.com embedded; Stack Overflow 2025.)
- Saleae: no nonprofit/donation program; ~50% student discount (Logic 8 ≈ $249 vs $499); $200
  project-writeup bounty. (saleae.com/discounts; saleae.com/support writing-for-saleae)
