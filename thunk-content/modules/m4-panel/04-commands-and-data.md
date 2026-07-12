# Commands and Data

The bytes are ready and the wires exist. What remains is the far side: the chip that receives
the bytes and turns them into lit pixels. On this course's panel that is an ILI9341-class
**controller chip**, mounted on the back of the glass. It holds the framebuffer from last
lesson, it refreshes the glass on its own, and it speaks SPI. Your program never touches a
pixel directly. It talks the controller into doing it.

Talking takes more than bytes. SPI, as M3 left it, delivers bytes in order and says nothing
about what they mean. The controller needs to receive two different kinds of byte:
instructions, like "get ready for pixels," and the values those instructions work on. The
first kind is a **command**; the second kind is **data**.

## The DC wire

How does the controller tell them apart? Not by the byte's value: `0x2C` could be an
instruction or could be half a pixel. The panel adds one extra wire beside the SPI lines,
called **DC**, short for data/command. While a byte is clocking in, the level of DC labels it.
DC low means this byte is a command. DC high means this byte is data belonging to the last
command. One wire with one job, in the same spirit as M3's chip select.

## Drawing a region

The controller understands many commands, but drawing needs only three: two to aim, one to
write. To paint a rectangular region:

1. Send the column address command, byte `0x2A`, with four data bytes: the first and last
   column, each as two bytes, high byte first.
2. Send the page address command, byte `0x2B`, with four data bytes in the same shape: the
   first and last row. "Page" is the datasheet's word for a row of pixels.
3. Those two together define the **address window**: the rectangle you are about to fill.
4. Send the memory-write command, **RAMWR**, byte `0x2C`. Then hold DC high and stream pixel
   data: two bytes per pixel, high byte first, a second ordering rule, this one the
   controller's, sitting on top of M3's MSB-first bit order.

The part that makes this fast is what you do not send. There are no coordinates in the pixel
stream. The controller steps through the window on its own: each arriving pixel lands one step
right of the last, wrapping to the next row at the window's edge. You aim once; after that,
pixels land in order. Filling the whole screen is a window covering everything, one RAMWR, and
153,600 bytes of color.

## The trace, solved

Now read M3's mystery transaction one last time: `0x2C`, then `0xF8`. The first byte, sent
with DC low, a fourth wire that trace never showed, was RAMWR: start writing pixels into the
window. The second, with DC high, was
the high byte of `0xF800`. That trace caught a program in the act of painting a red pixel,
and you decoded it before you knew what it meant.

This sequence is the whole job. Set the window, send RAMWR, stream colors. The display driver
you will study in thunk's simulator does exactly this and nothing more, and you can now read
every byte of it.

## Key terms

- **controller chip** — the ILI9341-class chip on the panel that owns the framebuffer and speaks SPI.
- **command** — a byte, sent with DC low, telling the controller to do something.
- **data** — bytes, sent with DC high, that the last command works on: parameters or pixel colors.
- **DC** — the extra wire that labels each byte as command (low) or data (high).
- **address window** — the rectangle, set by the column and page address commands, that pixels fill.
- **RAMWR** — the memory-write command, byte 0x2C; the bytes streamed after it are pixel colors.
