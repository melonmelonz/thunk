# Chip Select

A bus is rarely a private line. The same clock and data wires can run past several
peripherals at once: a display, a temperature sensor, a memory chip, all wired to the same
pair. Every one of them sees every tick and every bit. If they all acted on what they saw,
one transmission would land on three devices and the bus would be useless.

## One wire per device

So each peripheral gets one more wire, its own, called **chip select**. The rule is simple: a
device only listens to the clock and data wires while its select wire is held active. The
rest of the time it ignores the bus completely, no matter what crosses it. The shared wires
carry the words; the select wire says who is being spoken to.

To talk to the display, you assert the display's select wire and every byte you clock out
lands there. The sensor's select wire stays idle, so the sensor hears nothing. Three
peripherals means three select wires, and never more than one asserted at a time.

## Active low

Select is usually **active low**: the wire idles high, and the controller pulls it low to
speak to the device. That sounds backwards until you ask what happens when things fail. An
undriven select line does not sit at some random level; a small resistor, called a
**pull-up**, holds it high whenever nothing is driving it. So designers made high mean "not
selected". A broken or unconnected select wire then reads as not-selected, and the device
stays silent instead of listening to traffic meant for someone else. The failure lands on
the safe side.

## Controller and peripheral

The last lesson used the names for the two bus roles in passing; now pin them down. The
device that drives the clock, and the select
wires with it, is the **controller**. In this course that is the computer running your code.
The device being spoken to is the **peripheral**: the display, the sensor, the memory chip.
The controller starts every conversation; a peripheral never ticks the clock and never speaks
unasked.

## The shape of a transaction

Put the three lessons so far together and you have the full shape of one SPI
**transaction**:

1. The controller pulls the peripheral's select wire low.
2. It ticks out the bytes, eight clock edges per byte, MSB first, as many bytes as it has.
3. It raises the select wire back high.

From the peripheral's side, the select edges are the frame around the conversation. The
falling edge says "the next bytes are for you, start counting bits from zero." The rising
edge says "done." Everything between the two edges is one transaction, and everything outside
them is someone else's traffic.

The next lesson records those wires over time and teaches you to read the picture.

## Key terms

- **chip select** — the per-device wire that tells one peripheral it is being addressed.
- **active low** — asserted by pulling the wire low; idle is high, so a dead wire means "not selected".
- **pull-up** — a small resistor that holds a line high whenever nothing is driving it.
- **controller** — the device that drives the clock and the select wires, and starts every transaction.
- **peripheral** — the device spoken to; it never drives the clock.
- **transaction** — select pulled low, bytes clocked out, select raised high.
