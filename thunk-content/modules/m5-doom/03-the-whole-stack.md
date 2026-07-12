# The Whole Stack

Follow one frame from the moment it is computed to the moment it is light on glass, and you cross
everything this course taught. Walk it slowly, once.

A frame is numbers in memory. Two bytes per pixel, rows laid end to end, every one of them made
of the bits and bytes M0 started with. Those numbers are computed and owned by a program, written
in a language like the Rust you read in M2, and ownership decides exactly who holds that buffer
at every moment. The program cannot touch the hardware itself, so it hands the frame to a driver
the kernel runs, stepping through the syscall doorway M1 built. The driver pushes the frame out
over clocked wires, one bit per tick, on the select, clock, and data lines M3 traced. And the
bytes land in the panel controller's own memory, through the DC wire and the address window and
RAMWR from M4, where the controller paints them onto the glass.

The word for this arrangement is the **stack**: hardware and software in layers, each one resting
on the one below it and serving the one above. A **layer** does one job and offers it upward.
Memory offers bytes. The language offers a safe way to compute with them. The kernel offers the
doorway. The bus offers delivery. The panel offers light. No layer needs to understand the whole;
each one only needs to keep its own promise. Stand at the top and the frame simply appears. Walk
down, as you just did, and there is a reason at every step.

## Simulated and real

On this build, the finale renders on the **simulated panel**: thunk draws the panel as a picture
on your screen, and the display driver you studied writes to it byte for byte as it would write
to hardware. The same window commands, the same RAMWR, the same two bytes per pixel, high byte
first.

The driver cannot tell the difference, because the simulated panel and the real one sit behind
the same **interface**: the agreed set of operations one layer offers the layer above. The driver
asks for a window and streams bytes; whatever answers those requests, chip or simulation, is its
panel. On the open build, the same program, through that same interface, drives a real controller
over a real SPI bus. Nothing about the code changes. That is what an interface buys: the layers
above it do not have to care what stands below.

## Nothing hidden

Here is what this module was for. A frame of DOOM crossing this stack is not magic at any layer.
It is numbers, a program, a doorway, a clock, and a chip that keeps its promise. You have now
looked inside every one of those. When a screen does something that seems impossible, you know it
is this same ladder underneath, and you know how to climb down it.

One thread is still loose. Lesson one said the porting never stopped because id Software shared
the engine's source code, and people who had never met built on it together. Code like the driver
you can now read is written that way too, in the open, by many hands. How that world works, and
how you can work in it, is M6.

## Key terms

- **stack** — hardware and software in layers, each resting on the one below and serving the one above.
- **layer** — one level of the stack, doing one job and offering it upward.
- **simulated panel** — thunk's software panel, which answers the driver exactly as the hardware would.
- **interface** — the agreed set of operations one layer offers the layer above, the same for simulated and real hardware.
