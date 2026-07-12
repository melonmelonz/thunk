# Pixels and Grids

Get close to a screen, closer than you ever normally would, and the picture comes apart. There
is no picture. There is a **grid** of tiny colored dots, laid out in straight columns and rows,
each dot showing a single color. Step back and your eye blends them into faces and letters.
Every screen works this way, from a phone to a stadium scoreboard, and so does the small panel
this course drives.

Each dot is a **pixel**. A pixel is the smallest thing a screen can change. It cannot show a
shape or an edge; it shows exactly one color at a time, and that is all it does. Everything you
have ever seen on a screen was built from single-color dots, enough of them, small enough, that
your eye did the rest.

## Naming a pixel

To change a pixel's color, you first have to say which pixel you mean. The grid gives you the
way: count columns across and rows down. A pixel's **coordinates** are two numbers, written
(x, y): x is the column, y is the row. Both counts start at zero, and both are counted from the
top left. The top-left pixel is (0, 0), and it has a name of its own: the **origin**.

Watch the direction of y. On a graph in math class, y grows upward. On a screen, y grows
downward: row 0 is the top row, and a bigger y means lower on the screen. This trips up almost
everyone once. Count from the top left and you will be fine.

Here is a five-by-four grid with one pixel picked out:

```
     x=0  x=1  x=2  x=3  x=4
y=0 [ .. ][ .. ][ .. ][ .. ][ .. ]
y=1 [ .. ][ .. ][ .. ][ .. ][ .. ]
y=2 [ .. ][ .. ][ .. ][ ## ][ .. ]
y=3 [ .. ][ .. ][ .. ][ .. ][ .. ]
```

The marked pixel is in column 3, row 2, so its coordinates are (3, 2). Not (2, 3): x comes
first, and x is the column.

## This course's panel

The panel this course drives is 240 pixels wide and 320 pixels tall, taller than it is wide,
like a phone held upright. Its **resolution**, the pixel count written width by height, is 240
by 320. So x runs from 0 to 239, y runs from 0 to 319, and the whole grid holds 240 x 320 =
76,800 pixels.

That number is the honest size of the job. To draw anything, you choose a color for every pixel
you want changed. A single letter might be a few dozen pixels; filling the screen means setting
all 76,800. There is no "draw a circle" wire on the panel. There are only pixels, and code that
decides their colors.

Which raises the next question: what is a color, to a machine that only stores bits? That is
the next lesson.

## Key terms

- **pixel** — one dot on the screen; it shows exactly one color at a time.
- **grid** — the arrangement of pixels in columns and rows that makes up a screen.
- **coordinates** — the (x, y) pair naming one pixel: column first, then row, counted from zero.
- **origin** — pixel (0, 0), the top-left corner of the screen.
- **resolution** — a screen's size in pixels, width by height; this panel is 240 by 320.
