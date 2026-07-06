# Drivers

We have built up the whole picture from the program's side: user mode and kernel mode, the syscall
doorway, files and devices, and memory. This last lesson turns around and looks at the piece on the
kernel's side that actually knows how to talk to a specific chip. That piece is a **driver**.

## What a driver is

A driver is kernel code that translates between the general interface the rest of the system uses and
the specific, fussy details of one device. When a program writes bytes to `/dev/ttyUSB0`, it has no
idea how that particular serial chip works, and it should not have to. The driver does. It takes the
generic "write these bytes" and turns it into the exact register pokes that make this chip send them.

The rest of the kernel talks to every driver through the same shape, roughly the same `open`, `read`,
`write`, `close` you already know, plus `ioctl` for the odd controls. That uniform shape is why a
program can treat a keyboard, a disk, and a display the same way. Each has a different driver
underneath, presenting the same face.

## How a driver reaches hardware

Hardware exposes itself as **registers**: small numbered slots you read and write to control the
device. Often these registers are mapped into memory, so the driver reads and writes them like any
other memory address. This is called **memory-mapped I/O**, or MMIO. Writing a particular value to a
particular address might turn on a light, start a transfer, or arm an interrupt.

When a device needs the kernel's attention, say a byte has arrived, it raises an **interrupt**. The
processor stops what it is doing and jumps to the driver's interrupt handler, which deals with the
event and returns. Interrupts are how hardware talks back without the kernel having to sit and poll
in a loop.

## Where this course is going

A display panel is a device like any other, and it needs a driver. In our case the panel is reached
over a simple wire protocol called **SPI**, which is the subject of the next module. The driver's job
will be to take a picture and turn it into the exact sequence of bytes the panel expects, sent over
that bus, one after another.

That is the whole arc. A program asks for something; the syscall carries the request into the kernel;
a driver turns it into register writes and bus traffic; the hardware does the thing. By the end of
this course you will have written the small driver at the bottom of that chain, and watched a game
boot on a screen because of it.

## Key terms

- **driver** — kernel code that speaks one device's specific language.
- **register** — a numbered control slot on a device.
- **memory-mapped I/O (MMIO)** — reaching device registers by reading and writing memory addresses.
- **interrupt** — a device signaling the processor that it needs attention.
