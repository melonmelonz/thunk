# Clock and Data

Put yourself on the receiving end. You are a display controller staring at one data wire. The
sender is going to put eight bits on it, one after another. The wire is high, then low, then
high again. But when does one bit end and the next begin? If the sender puts two 1s in a row
on the wire, the level never changes. Stare at the wire alone and you cannot tell one 1 from
two.

## The clock

The answer is a second wire: the **clock**. The sending side, the controller, ticks it: low,
high, low, high, in a steady rhythm. Each tick means one thing to the receiver: read the data
wire now. On SPI the data line is sampled on a clock edge, and in the most common mode, mode
0, that is the **rising edge**, the moment the clock goes from low to high.

So the two wires work as a pair. The controller sets the data wire to the next bit, then
ticks the clock. The receiver waits for the edge, reads the data wire, and stores the bit.
One bit per tick. Eight ticks, one byte.

Which bit goes first? On SPI the convention is **MSB first**: the most significant bit leads,
and the rest follow in order down to bit 0. That is a convention, not a law of nature; the
device's documentation states the order, and for the parts in this course it is MSB first.

## One byte on the wires

Here is the byte `0x2C`, which is `00101100` in binary, crossing the bus. The top row is the
clock; the bottom row is the data wire.

```
tick       1       2       3       4       5       6       7       8
           ___     ___     ___     ___     ___     ___     ___     ___
clock  ___|   |___|   |___|   |___|   |___|   |___|   |___|   |___|   |__
                         _______         _______________
data   ________________|       |_______|               |_________________
bit        0       0       1       0       1       1       0       0
```

Walk it tick by tick, reading the data row at each rising clock edge:

- Ticks 1 and 2: data is low. Two 0s. These are bits 7 and 6.
- Tick 3: data is high. A 1.
- Tick 4: data is low again. A 0.
- Ticks 5 and 6: data holds high across both ticks. Two 1s. This is the case that needed the
  clock: the level never moved, but two edges arrived, so the receiver counts two bits.
- Ticks 7 and 8: data is low. Two 0s.

Read off in order: `0 0 1 0 1 1 0 0`. That is `0x2C`. The byte your Rust code shifted and
masked in M2 crosses the bus as exactly this shape.

## How fast

The clock's tick rate is the bus **speed**. Tick a million times a second and you move a
million bits a second. The controller decides the rate, but the peripheral sets the ceiling:
its **datasheet**, the manufacturer's manual for the chip, states the fastest clock it can
follow. Drive the clock faster than that and the device starts misreading bits. Slower always
works; the receiver only acts on edges, so a lazy clock just means a slow byte.

## Key terms

- **clock** — the wire the controller ticks; each tick tells the receiver to read the data wire.
- **rising edge** — the low-to-high moment of a clock tick; where mode 0 samples the data line.
- **MSB first** — the usual SPI bit order; the most significant bit is sent first.
- **speed** — the clock's tick rate; one bit moves per tick.
- **datasheet** — the manufacturer's manual for a chip, including its maximum clock rate.
