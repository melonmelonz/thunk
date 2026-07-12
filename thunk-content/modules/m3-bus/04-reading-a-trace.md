# Reading a Trace

You cannot see voltage. When a bus misbehaves, you need an instrument that can. A **logic
analyzer** watches a set of wires, records each one's level over time, and draws the result
as rows on a screen: one row per wire, time running left to right. The drawing is called a
**trace**. Engineers read traces the way you are learning to read code, and the skill is the
same one you built in the last two lessons, applied to a picture.

## How to decode

The method never changes:

1. Find where select drops low. The transaction starts there.
2. At each clock tick, read the data row: high is 1, low is 0.
3. Eight reads make a byte, most significant bit first.
4. Repeat until select rises. The transaction is over.

## Two bytes on the bus

Here is a trace of one transaction carrying two bytes. Three wires this time: select, clock,
data.

```
        __                                                                     _
select    |___________________________________________________________________|
              _   _   _   _   _   _   _   _   _   _   _   _   _   _   _   _
clock   _____| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |____
                     ___     _______         ___________________
data    ____________|   |___|       |_______|                   |_______________
bit          0   0   1   0   1   1   0   0   1   1   1   1   1   0   0   0
```

Select drops before the first tick and rises after the last, so all sixteen ticks belong to
one transaction. Sixteen ticks is two bytes. Decode the first one bit by bit, reading the
data row at each rising clock edge:

- Tick 1: data low. Bit 7 is 0.
- Tick 2: low. Bit 6 is 0.
- Tick 3: high. Bit 5 is 1.
- Tick 4: low. Bit 4 is 0.
- Tick 5: high. Bit 3 is 1.
- Tick 6: high. Bit 2 is 1.
- Tick 7: low. Bit 1 is 0.
- Tick 8: low. Bit 0 is 0.

`00101100`, which is `0x2C`, the byte from last lesson. Now the second byte, faster: ticks 9
through 13 are high and ticks 14 through 16 are low, so the bits are `11111000`, which is
`0xF8`. The transaction sent `0x2C` then `0xF8`. With practice you stop counting single ticks
and start seeing runs: five highs, three lows, done.

## The simulator's trace

thunk ships a simulator, and this is exactly what it records. Every transaction your code
makes on the simulated bus is captured as a trace: select edges, every clocked byte, in
order. When you drive the display panel in M4, its trace view is where you will check your
work.

That matters because of what a trace settles. When the picture on the panel comes out wrong,
there are two suspects: your code sent the wrong bytes, or it sent the right bytes and the
drawing logic is wrong. Read the trace. If the bytes on the bus are wrong, the bug is on the
sending side, in your code. If the bytes are right and the picture is still wrong, the bug is
in what you chose to send. The trace is the **ground truth** between the two.

## Key terms

- **logic analyzer** — the instrument that records wires over time and draws them as rows.
- **trace** — the recorded drawing of bus activity; thunk's simulator produces one for every run.
- **decode** — reading a byte out of a trace: at each clock tick read the data line, eight bits, MSB first.
- **transaction (in a trace)** — everything between select falling and select rising.
- **ground truth** — what actually crossed the bus, as opposed to what your code meant to send.
