# Frames to the Panel

Nothing on a screen actually moves. A moving picture is still pictures shown fast, one after
another, each slightly different from the last. One of those still pictures is a **frame**. Show
enough frames each second and your eye stops seeing pictures and starts seeing motion.

So a program like DOOM is a loop. The engine computes a frame into the framebuffer. The driver
moves that frame over the bus. The panel shows it. Then the loop runs again, with the world one
small step further along. Every moving picture you have ever watched on a screen is some version
of this loop.

## The budget

Motion looks smooth at around thirty **frames per second**. That number hands each frame a
deadline: one thirtieth of a second to be computed, moved, and shown. Engineers call this the
**frame budget**. A frame that misses its deadline holds up every frame behind it, and the
motion stutters. So before building anything, an engineer asks whether the budget can be met at
all. You already know enough to answer that for this course's panel.

M4 measured the frame: 76,800 pixels at two bytes each, so one full frame is 153,600 bytes. At
thirty frames per second, that is 153,600 times 30, which comes to 4,608,000 bytes every second,
about 4.6 million. Each byte is eight bits, so the bus has to carry roughly 37 million bits per
second.

And M3 told you how the bus carries them: one bit per clock tick. To deliver 37 million bits in a
second, the clock has to tick about 37 million times in that second, and that is just for pixel
data, before a single command byte. The other stages have room to spare: a modern processor
finishes a frame's arithmetic in a small fraction of that thirtieth of a second, while the serial
wires can never move a byte faster than one bit per tick. That makes the bus the **bottleneck**:
the slowest stage in the loop, the one that sets the pace for all the others. The engine can
compute frames as fast as it likes; the panel shows them no faster than the wires deliver them.
It was not always so. On the machines of 1993, the engine's arithmetic was the slow stage; the
bottleneck moves with the hardware.

Here is that whole budget in Rust, nothing variable about it. The panel's frame is a fixed size,
and thirty frames a second is the target the motion sets:

```rust
const PIXELS: u32 = 320 * 240;                 // 76,800 on the panel
const FRAME_BYTES: u32 = PIXELS * 2;           // 153,600 - two bytes a pixel
const BITS_PER_FRAME: u32 = FRAME_BYTES * 8;   // 1,228,800
const BITS_PER_SECOND: u32 = BITS_PER_FRAME * 30; // ~36.9 million at 30 fps
```

Turn the clock yourself. The panel is fixed at 153,600 bytes a frame; find the tick rate where the
loop closes thirty times a second, and notice that thirty megahertz does not buy thirty frames.

:::widget frame-budget
:::

## Spending it well

A budget this tight is why the M4 window trick matters. Suppose the driver named a position for
every pixel it sent: coordinates, then color, 76,800 times per frame. The coordinates would cost
more bytes than the colors, and the budget would be blown before the picture was half drawn.

The address window removes that cost. Set the window once to cover the whole screen, send RAMWR,
and stream nothing but color bytes. The controller places each pixel on its own, one step after
the last. Aiming costs a few bytes per frame instead of a few bytes per pixel, and nearly every
tick of that 37-million-tick second carries picture.

This is real engineering: a budget, a bottleneck, and a design that fits inside it. The clock
rate decides how many bits can move, up to the ceiling the panel sets. The window trick decides
how few bits are wasted. Get both right and the loop closes thirty times a second. What remains
is to watch one frame make that trip, down through every layer you have learned.

## Key terms

- **frame** — one still picture in the moving sequence.
- **frames per second** — how many frames are shown each second; around thirty reads as smooth motion.
- **frame budget** — the time one frame is allowed to take; at thirty frames per second, one thirtieth of a second.
- **bottleneck** — the slowest stage in the loop, which sets the pace for all the others.
