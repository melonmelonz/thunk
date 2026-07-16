# Bits and Bytes

The last lesson said the machine is built from switches, and that engineers write those two states
as digits. A switch that is off is a **0**. A switch that is on is a **1**. One of these digits,
a single 0 or 1, is called a **bit**. A bit is the smallest piece of information the machine can
hold.

Two digits does not sound like much. You count with ten digits, 0 through 9. The machine only has
two. But you can count just as far with two digits as with ten. You just run out of digits sooner
and have to carry.

## Counting with two digits

Think about how an odometer works. The rightmost wheel turns 0, 1, 2, and so on up to 9. When it
would pass 9, it rolls back to 0 and the wheel to its left ticks up by one. Counting with bits
works the same way, except each wheel only has two positions, 0 and 1. When a wheel would pass 1,
it rolls back to 0 and carries to the left.

Here is every number you can make with three bits:

- 000 is zero
- 001 is one
- 010 is two (the right bit rolled over and carried)
- 011 is three
- 100 is four (both right bits rolled over and carried)
- 101 is five
- 110 is six
- 111 is seven

Three bits, eight different patterns, the numbers 0 through 7. Add another bit and you double the
range. This is all the machine ever does with its switches: hold patterns of bits, and treat those
patterns as numbers.

## Bytes

Working with single bits is clumsy, so bits are handled in groups of eight. Eight bits together
are called a **byte**. A byte can hold any pattern from 00000000 to 11111111, which as numbers is
0 through 255. The byte is the basic unit of the machine. Memory is measured in bytes, storage is
measured in bytes, and everything the machine holds is some number of bytes.

## Everything is numbers

Here is the part worth sitting with. Text, pictures, and sound are all stored as numbers, because
numbers are the only thing the machine has. What makes a number mean something is agreement.
People agreed, decades ago, that the number 65 stands for the capital letter A, 66 for B, and so
on. A picture is a long run of numbers describing the color of each dot. Sound is a long run of
numbers describing air pressure over time.

The machine never knows the difference. It holds bytes. Whether those bytes are a letter, a color,
or a note depends entirely on the agreed-upon numbering being used to read them. Nothing in the
machine is anything but numbers.

Here is a byte you can hold in your hands. Flip the eight switches and watch the same pattern read
out four ways: binary, decimal, hex, and the letter it stands for. Try to build the number 65, and
watch the letter A appear.

:::widget bit-lab
:::

## Key terms

- **bit** — a single 0 or 1, the smallest piece of information the machine holds.
- **byte** — a group of eight bits; it can hold the numbers 0 through 255.
- **carry** — what happens when a digit rolls over and bumps the digit to its left.
- **encoding** — an agreed-upon numbering that gives meaning to bytes, like 65 standing for A.
