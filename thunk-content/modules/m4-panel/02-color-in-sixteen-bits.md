# Color in Sixteen Bits

A pixel shows one color. To a machine, then, a color has to be a number, because bits are all a
machine can store. This lesson is about the number.

Start with the light itself. A screen makes color by mixing three tiny lights inside each
pixel: one red, one green, one blue. Each of the three is a **channel**. Turn all three up full
and you get white. Turn them all off and you get black. Red at full with the others off is pure
red; red and green together make yellow. Every color the panel can show is a recipe: how bright
is red, how bright is green, how bright is blue.

So a color is three brightness numbers, and the question is how many bits to spend on them.
Spend too many and every picture gets heavy; spend too few and smooth color turns blotchy. This
panel's answer, a very common one for small displays, is sixteen bits for the whole color, one
`u16` per pixel. M2 promised you a 16-bit color format called **RGB565**. This is it.

## Five, six, five

RGB565 spends its sixteen bits like this: 5 for red, 6 for green, 5 for blue. 5 + 6 + 5 = 16.
Inside the `u16`, red takes the top five bits:

```
bit:  15 14 13 12 11 10  9  8  7  6  5  4  3  2  1  0
       R  R  R  R  R  G  G  G  G  G  G  B  B  B  B  B

      RRRRRGGG GGGBBBBB
```

Why does green get the extra bit? Because your eyes do. Human eyes are more sensitive to
differences in green than to differences in red or blue; two nearby shades of green look
distinct where the same-sized step in red would be invisible. The spare bit goes where you can
see it.

Each channel's value is an **intensity**: 0 means that light is off, and the biggest value the
field can hold (31 for red and blue, 63 for green) means fully on.

## Three colors worth memorizing

Set all five red bits and nothing else, and you get pure red. The same move on each field:

- pure red is `1111 1000 0000 0000`, which is `0xF800`
- pure green is `0000 0111 1110 0000`, which is `0x07E0`
- pure blue is `0000 0000 0001 1111`, which is `0x001F`

Sixteen bits give 2 to the 16th, 65,536 possible values, so RGB565 can name 65,536 different
colors, and a whole color travels in just two bytes.

Two bytes should sound familiar. In M3 you decoded a trace that carried `0x2C` and then `0xF8`.
Split `0xF800` into bytes the way M2 taught, shift and mask, and its **high byte** is `0xF8`.
The second byte of that mystery transaction was the first half of a pure red pixel, already in
flight toward the panel. What the `0x2C` in front of it was, lesson four will tell you.

Where do 76,800 of these `u16` values live while they are being the picture? That is the next
lesson.

## Key terms

- **channel** — one of a color's three lights: red, green, or blue.
- **RGB565** — the 16-bit color format: 5 bits red, 6 bits green, 5 bits blue, in one `u16`.
- **intensity** — a channel's brightness value, from 0 (off) to the top of its range (fully on).
- **high byte** — the top eight bits of a `u16`; for pure red `0xF800` it is `0xF8`.
