# The Framebuffer

Seventy-six thousand eight hundred pixels, two bytes each. Before any of that reaches a wire,
the picture has to exist somewhere, and in a computer "somewhere" always means memory. The
block of memory that holds a whole picture, one color value per pixel, is called a
**framebuffer**. One complete picture is a **frame**; the framebuffer is where the current
frame lives.

For this panel, a framebuffer is an array of `u16` values, one RGB565 color for every pixel.
No compression, no cleverness. Pixel colors, in a row, in order.

## Rows end to end

Memory has no columns and rows; it is one long line. So the grid has to be flattened, and the
rule is **row-major** order: store all of row 0 first, left to right, then all of row 1, then
row 2, down to the bottom of the screen. Here is a three-wide, two-tall screen and its memory:

```
screen:            memory:
row 0: A B C       [ A  B  C  D  E  F ]
row 1: D E F         0  1  2  3  4  5
```

The whole of row 0 sits before any of row 1. That one rule gives you a formula. To find pixel
(x, y), skip over y complete rows, each `width` pixels long, then step x pixels into the row:

    index = y * width + x

That number is the pixel's **index** in the array. Try it on E above: E is at (1, 1) on a
screen 3 wide, so its index is 1 * 3 + 1 = 4. Count the memory boxes: A is 0, E is 4. It holds.

Now the real panel, 240 wide. Pixel (10, 2) is index 2 * 240 + 10 = 490. Watch the order in
the formula: it is y times the width, not x times the height. Rows are what get skipped, and a
row is `width` pixels long. Mix that up and the picture comes out scrambled, and no error
message will tell you why.

## What drawing is

With the framebuffer in hand, drawing loses its mystery. To set pixel (x, y) to a color,
compute the index and write the `u16` there. That is drawing: writing memory. Animation is
nothing new either: rewrite the framebuffer, show it, rewrite it again, many times a second,
until the changes read as motion.

Count the cost. One frame is 240 x 320 = 76,800 pixels at 2 bytes each: 153,600 bytes, every
time you want the whole screen different.

One more fact, and it matters for the next lesson. The panel's controller chip holds its own
framebuffer, in its own memory on the far side of the bus. Once your pixels arrive there, the
panel keeps showing them by itself. Your program can move on to other work, or stop entirely,
and the picture stays put. You are not feeding the screen; you are updating the panel's copy of
the frame. How you update it, over the SPI wires from M3, is the last lesson of this module.

## Key terms

- **framebuffer** — the block of memory holding one color value per pixel: the whole picture.
- **frame** — one complete picture; on this panel, 153,600 bytes.
- **row-major** — the flattening rule: row 0 first, then row 1, each row left to right.
- **index** — a pixel's position in the framebuffer array: y * width + x.
