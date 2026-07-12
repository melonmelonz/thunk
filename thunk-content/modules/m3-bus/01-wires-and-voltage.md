# Wires and Voltage

M2 ended with a `u16` color split into two bytes, ready to travel. This module is about the
travel itself: how a byte physically leaves one chip and arrives at another. The answer starts
with a single wire.

## A bit in flight

A wire between two chips is either carrying **voltage** or it is not. The sender connects the
wire to power, or it connects it to ground. The receiver measures which. That is the entire
signal: two states, nothing in between that anyone agrees to care about.

By convention, a **high** voltage on the wire is read as a 1, and a **low** voltage is read as
a 0. You have seen this before. M0 said a bit is a switch that is on or off. A wire under
voltage is the same bit, made physical, and moving. The bit in a register sits still; the bit
on a wire is in flight from one chip to another.

Both chips measure voltage against a shared reference, which is why every cable between two
devices carries a **ground** wire alongside the signal wires. High and low only mean something
when both sides agree on where zero is.

## Eight wires or one

One wire moves one bit. A byte is eight bits, so you have two options.

- **Parallel**: run eight wires side by side and put one bit on each. The whole byte arrives
  at once.
- **Serial**: run one data wire and send the eight bits through it one after another, in a
  row.

Parallel sounds faster, and inside a processor it is how memory moves. But between separate
chips, every wire costs a pin on each chip, a trace on the board, and a conductor in the
cable. Eight data wires means big connectors, more board space, and more ways for the wires to
disagree with each other. For a small peripheral like a display or a sensor, serial wins on
cost, size, and simplicity. One data wire, used eight times per byte, is cheap and it is
enough.

## SPI

The serial bus this course uses is **SPI**, the serial peripheral interface. It reaches a
device over a small handful of wires: classically four signals, plus ground as the shared
reference. One wire carries data out to the device. One carries data back. The other two
answer the two questions serial raises, and the next two lessons take them one at a time:
when exactly should the receiver look at the data wire, and which device on the bus is being
spoken to?

M1 told you this course's display hangs off an SPI bus. By the end of this module you will be
able to watch a byte cross that bus and read it off the wires yourself.

## Key terms

- **voltage** — the electrical level on a wire; present or absent, high or low.
- **high / low** — the two wire states; high is read as a 1, low as a 0, by convention.
- **ground** — the shared zero reference both chips measure voltage against.
- **parallel** — moving a byte on eight wires at once, one bit per wire.
- **serial** — moving a byte on one wire, one bit at a time, eight in a row.
- **SPI** — the serial peripheral interface; a small handful of wires, classically four signals plus ground.
