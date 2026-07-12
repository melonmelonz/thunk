# Why DOOM

In December 1993, a small company called id Software released a program named **DOOM**. It drew
a moving first-person view of a 3D world: hallways, stairs, rooms with light and shadow, all
redrawn many times a second as you moved through them. And it did this on the ordinary office
computers of its day. A 386 PC, the kind of machine that sat on a desk running spreadsheets, was
enough. Those machines were thousands of times weaker than anything you will touch.

The core of the program, the part that computes the world and draws the picture, is called the
**engine**. Around the engine sits a thin layer of machine-specific code: how to put a picture on
this screen, how to read this keyboard, how to keep time on this clock. That split turned out to
matter more than anyone guessed.

## Ported to nearly everything

In the years since, engineers have made DOOM run on machines it was never meant for. It has run
on printers. On oscilloscopes. On cash machines, on test equipment, on the little computers
inside appliances. The question "will it run DOOM" started as a joke among engineers and settled
into something more useful: a standing proof that a machine's whole stack works.

Consider what has to be true for DOOM to run. The processor has to execute the engine's code fast
enough. The memory has to hold the world and the frame being drawn. The display path has to carry
every finished frame to a screen. The timing has to hold steady, frame after frame, without
drifting. If DOOM runs, all of those layers are working together, under real pressure.

## Why anyone can port it

None of this would be possible if DOOM were a sealed box. In 1997, id Software released the
engine's **source code**: the human-readable text the program was built from. Anyone could read
how the engine worked, and anyone could rewrite the machine-specific layer to fit a new machine.
That one decision is why the porting never stopped. M6 comes back to what happens when code is
shared this way, because it shaped far more than one program.

## What a port supplies

Carrying a program to a machine it was not written for is called **porting**. The machine-specific
layer is small on purpose, so a port only has to supply the engine with three things from its
**host**, the machine it now lives on:

- somewhere to draw: a framebuffer, memory the engine fills with the pixels of each frame,
- a way to keep time, so the world moves at a steady rate no matter how fast the host is,
- input, so the person at the machine can steer through the world.

Everything else, the world, the drawing, the rules of the place, the engine carries with it. That
is why the list of hosts is so long and so strange. A printer and an oscilloscope have nothing in
common except that both can offer those three things.

Now look at what M4 left you holding. A panel with a framebuffer, a bus to fill it, and a driver
you can read byte by byte. The pieces a port needs are already on the table. The next lesson does
the arithmetic: whether frames can reach the panel fast enough to look like motion.

## Key terms

- **DOOM** — a 1993 program that draws a moving first-person view of a 3D world.
- **engine** — the core of the program: the part that computes the world and draws each frame.
- **source code** — the human-readable text a program is built from; id Software released DOOM's in 1997.
- **porting** — carrying a program to a machine it was not written for.
- **host** — the machine a ported program runs on, which supplies drawing, timing, and input.
