# Bits in Types

M0 said the machine holds nothing but bytes, and that what a byte means depends on the agreement
used to read it. A **type** is how Rust writes that agreement down. A type names a byte pattern:
how many bytes, and how to read them. Once you see types that way, the low-level code ahead stops
looking like magic and starts looking like labeled bytes.

## The unsigned integers

The types you will meet most are the unsigned integers, and their names tell you their size:

- **`u8`** is one byte. It holds 0 through 255. This is exactly M0's byte, given a name.
- **`u16`** is two bytes. It holds 0 through 65535.
- **`u32`** is four bytes. It holds 0 through a little over four billion.

The `u` means unsigned, no negative values, and the number is the count of bits. Eight bits, one
byte; sixteen bits, two bytes; thirty-two bits, four.

Compound types are the same idea, continued. A **struct** is several named values laid out as bytes
side by side. A struct holding a `u16` and two `u8`s is, in memory, just those four bytes in a row.
The type is the map that says which bytes are which.

## One type you should meet early

Displays like the one this course drives use a 16-bit color format called **RGB565**: red, green,
and blue packed into sixteen bits, so one whole color fits in a single `u16`. M4 takes it apart
properly. For now, hold onto the size: one color, one `u16`, two bytes.

## Splitting a u16

Here is the problem those two bytes create. M1 said the display is reached over SPI, and that wire
carries one byte at a time. A `u16` color is two bytes. To travel the wire, it must split into two
`u8`s:

```rust
let c: u16 = 0x2A5B;         // two bytes: 0x2A high, 0x5B low
let high = (c >> 8) as u8;   // 0x2A
let low  = (c & 0xFF) as u8; // 0x5B
```

Two new tools here, both worth knowing cold.

`c >> 8` is a **shift**. It slides every bit of `c` eight places to the right. The low byte falls
off the end and is gone; the high byte slides down into the low position. What remains is the high
byte, sitting where a single byte lives.

`c & 0xFF` is a **mask**. The `&` compares `c` bit by bit against `0xFF`, which is eight 1s in the
low byte and 0s above, and keeps only the bits where both have a 1. Everything above the low byte
is zeroed. What remains is the low byte, untouched.

In both lines, `as u8` then converts the `u16` down to a `u8`, keeping the low byte, which is
exactly the byte each expression arranged to put there.

That is the bridge to the next module. Buses carry bytes, one after another, and types tell you
which bytes: how many, in what order, meaning what. M3 puts the bytes on the wire.

## Key terms

- **type** — Rust's name for a byte pattern: how many bytes, and how to read them.
- **`u8` / `u16` / `u32`** — unsigned integers of one, two, and four bytes; a `u8` holds 0 through 255.
- **struct** — named values laid out in memory as bytes side by side.
- **RGB565** — a 16-bit color format; one color fits in a single `u16`.
- **shift (`>>`)** — slides bits toward the low end; `c >> 8` brings the high byte down.
- **mask (`&`)** — keeps only chosen bits; `c & 0xFF` keeps the low byte.
