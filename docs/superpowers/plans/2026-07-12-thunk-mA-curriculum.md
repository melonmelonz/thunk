# thunk M-A: Full Curriculum (M0-M6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the six remaining curriculum modules (M0, M2-M6) as `thunk-content` assets in the
exact shape of Module 1, with a validation suite that proves every module loads, every check
self-grades, every lesson is covered by checks, and every module gate is satisfiable; the `thunk`
CLI lists the whole M0-M6 ladder.

**Status: executed 2026-07-12; all 9 tasks done.**

**Architecture:** Pure content build on the existing pipeline. `thunk-content` gains a `LADDER`
const (course order) and `Curriculum::all()`; a data-driven validation suite runs over the ladder so
each newly authored module is guarded automatically the moment its directory is added. No new
crates, no new dependencies. `thunk-core` is untouched (the roadmap's "retune AdvanceGate" note
refers to gating machinery that does not exist yet; real per-module check counts come from
`load_checks(dir).len()` and gating itself is milestone M-B).

**Tech Stack:** Rust 1.88, rust-embed (already wired), RON checks, markdown lessons. Zero new deps
(offline cargo constraint).

---

## File Structure

```
thunk-content/
  src/lib.rs                          # + LADDER, Curriculum::all(), validation tests
  modules/
    m0-power-on/                      # NEW - true zero
      module.ron
      01-the-machine.md
      02-bits-and-bytes.md
      03-what-is-a-program.md
      04-what-is-code.md
      05-running-a-program.md
      checks.ron                      # 15 checks (3/lesson)
    m1-kernel/                        # EXISTS - untouched
    m2-rust/                          # NEW
      module.ron
      01-why-rust.md
      02-ownership.md
      03-borrowing.md
      04-no-std.md
      05-bits-in-types.md
      checks.ron                      # 15 checks
    m3-bus/                           # NEW
      module.ron
      01-wires-and-voltage.md
      02-clock-and-data.md
      03-chip-select.md
      04-reading-a-trace.md
      checks.ron                      # 12 checks
    m4-panel/                         # NEW
      module.ron
      01-pixels-and-grids.md
      02-color-in-sixteen-bits.md
      03-the-framebuffer.md
      04-commands-and-data.md
      checks.ron                      # 12 checks
    m5-doom/                          # NEW
      module.ron
      01-why-doom.md
      02-frames-to-the-panel.md
      03-the-whole-stack.md
      checks.ron                      # 9 checks
    m6-open-source/                   # NEW
      module.ron
      01-what-open-source-is.md
      02-licenses-in-plain-terms.md
      03-version-control-in-the-open.md
      04-reading-a-diff.md
      05-the-culture-of-merit.md
      checks.ron                      # 15 checks
thunk-cli/src/main.rs                 # overview lists the ladder; read searches all modules
```

Course totals after M-A: 7 modules, 31 lessons, 93 checks.

---

## Content authoring standards (every module task references this)

**Voice.** Match `thunk-content/modules/m1-kernel/01-programs-and-os.md` exactly in register: plain,
concrete, second person, engineering-not-hacking. Short declarative sentences. Start from the thing
in front of the learner. No em dashes. No manufactured aphorisms, no corny closings, no "journey"
language, no exclamation marks. Bold key nouns on first introduction. Every lesson ends with a
`## Key terms` footer (4-6 terms, one line each). Banned tics (each caught in review once already):
the "sit with it / worth sitting with / worth pausing on" family, and reusing another module's
opening sentence verbatim. One rhetorical gesture per module, maximum.

**Length.** 40-70 lines of markdown per lesson. M0 lessons sit at the gentle end (shorter
paragraphs, zero assumed knowledge; do not assume the learner knows what a file is until taught).

**Review-safety.** The vocab-lint denylist is
`exploit|malware|keylogger|backdoor|rootkit|botnet|ransomware|ddos`. Never use these words or their
inflections ("exploited", "exploitation") in content or source. DOOM content is framed strictly as
an engineering artifact: rendering, frames, the port as a systems problem. No weapon or violence
vocabulary. M6 prose says "take advantage of" or "put to work" where "exploit" would tempt.

**Checks.** RON `Vec<Check>` identical in shape to `m1-kernel/checks.ron`. Check ids follow
`{module_prefix}-{lesson_number}-{slug}` (e.g. `m0-02-byte`) - the validation suite parses this
prefix to prove per-lesson coverage. `Short` answers list every reasonable phrasing (the grader is
case- and whitespace-insensitive but not fuzzy). Every check must be answerable from its lesson's
prose alone.

**Verification per module task.**

```sh
CARGO_NET_OFFLINE=true cargo test -p thunk-content
./scripts/vocab-lint.sh
```

---

### Task 1: Ladder + `Curriculum::all()` + validation suite

**Files:**
- Modify: `thunk-content/src/lib.rs`

- [ ] **Step 1: Write the failing tests.** Append to the `tests` module in
`thunk-content/src/lib.rs` (keep the two existing tests):

```rust
#[test]
fn ladder_modules_load_in_order() {
    let mods = Curriculum::all();
    assert_eq!(mods.len(), LADDER.len());
    for (m, dir) in mods.iter().zip(LADDER) {
        assert_eq!(&m.id.0, dir, "module id must equal its directory name");
        assert!(!m.lessons.is_empty(), "module {dir} has no lessons");
        for l in &m.lessons {
            assert!(!l.title.trim().is_empty(), "untitled lesson in {dir}");
            assert!(l.body.lines().count() >= 20, "lesson {} in {dir} is a stub", l.id.0);
            assert!(l.body.contains("## Key terms"), "lesson {} in {dir} lacks key terms", l.id.0);
        }
    }
}

#[test]
fn every_check_in_every_module_self_validates() {
    for dir in LADDER {
        let checks = Curriculum::load_checks(dir);
        assert!(!checks.is_empty(), "module {dir} has no checks");
        for c in &checks {
            assert_eq!(c.grade(&c.canonical_answer()), Verdict::Correct, "check {:?} in {dir}", c.id());
        }
    }
}

#[test]
fn every_lesson_has_at_least_three_checks() {
    for dir in LADDER {
        let m = Curriculum::load_module(dir);
        let checks = Curriculum::load_checks(dir);
        let prefix = dir.split('-').next().expect("module dir starts with mN-");
        for l in &m.lessons {
            let n = l.id.0.split('-').next().expect("lesson file starts with NN-");
            let want = format!("{prefix}-{n}-");
            let count = checks.iter().filter(|c| c.id().0.starts_with(&want)).count();
            assert!(count >= 3, "lesson {} in {dir} has {count} checks, needs 3+", l.id.0);
        }
    }
}

#[test]
fn check_ids_are_unique_across_the_course() {
    let mut seen = std::collections::BTreeSet::new();
    for dir in LADDER {
        for c in Curriculum::load_checks(dir) {
            assert!(seen.insert(c.id().clone()), "duplicate check id {:?}", c.id());
        }
    }
}

#[test]
fn every_module_gate_is_satisfiable() {
    use thunk_core::Progress;
    for dir in LADDER {
        let checks = Curriculum::load_checks(dir);
        let mut p = Progress::default();
        for c in &checks {
            p.record(c.id(), c.grade(&c.canonical_answer()));
        }
        let ids: Vec<_> = checks.iter().map(|c| c.id().clone()).collect();
        assert!(p.module_mastered(&ids), "module {dir} can never be mastered");
    }
}
```

- [ ] **Step 2: Run to verify failure.** Run: `CARGO_NET_OFFLINE=true cargo test -p thunk-content`.
Expected: COMPILE FAIL (`LADDER` and `Curriculum::all` undefined).

- [ ] **Step 3: Implement.** In `thunk-content/src/lib.rs`, above `pub struct Curriculum`:

```rust
/// The course ladder, in order. Grows as modules are authored (M-A);
/// completeness is pinned by `the_ladder_is_complete` once M0-M6 land.
pub const LADDER: &[&str] = &["m1-kernel"];
```

and inside `impl Curriculum`:

```rust
/// Every module on the ladder, in course order.
pub fn all() -> Vec<Module> {
    LADDER.iter().map(|dir| Self::load_module(dir)).collect()
}
```

- [ ] **Step 4: Run to verify pass.** Run: `CARGO_NET_OFFLINE=true cargo test -p thunk-content`.
Expected: PASS (existing 2 + new 5).

- [ ] **Step 5: Commit.**

```bash
git add thunk-content/src/lib.rs
git commit -m "feat(content): course ladder + data-driven validation suite"
```

---

### Task 2: Author M0 - Power On (true zero)

**Files:**
- Create: `thunk-content/modules/m0-power-on/module.ron`
- Create: `thunk-content/modules/m0-power-on/{01-the-machine,02-bits-and-bytes,03-what-is-a-program,04-what-is-code,05-running-a-program}.md`
- Create: `thunk-content/modules/m0-power-on/checks.ron`
- Modify: `thunk-content/src/lib.rs` (LADDER)

- [ ] **Step 1: Make the suite demand M0.** Change LADDER to:

```rust
pub const LADDER: &[&str] = &["m0-power-on", "m1-kernel"];
```

- [ ] **Step 2: Run to verify failure.** Run: `CARGO_NET_OFFLINE=true cargo test -p thunk-content`.
Expected: FAIL/PANIC ("missing embedded asset: m0-power-on/module.ron").

- [ ] **Step 3: Author `module.ron`:**

```ron
(
    id: "m0-power-on",
    title: "Power On",
    lessons: [
        "01-the-machine",
        "02-bits-and-bytes",
        "03-what-is-a-program",
        "04-what-is-code",
        "05-running-a-program",
    ],
)
```

- [ ] **Step 4: Author the five lessons** per the standards section. Assumed knowledge: none at all.
Arcs:

- **01-the-machine** (`# The Machine`) - a computer is a machine that follows instructions;
  it runs on electricity, and everything inside it comes down to switches that are on or off; the
  four parts that matter here: the **processor** (follows instructions), **memory** (fast workspace,
  forgets at power off), **storage** (slow shelf, remembers), and **input/output** (keyboard in,
  screen out). Close on: every layer of this course is one of these parts, seen closer up.
- **02-bits-and-bytes** (`# Bits and Bytes`) - a switch that is off is a 0, on is a 1; one such
  digit is a **bit**; counting with only two digits (walk 0..7 in three bits, the odometer
  analogy); eight bits make a **byte**, which can hold 0 through 255; text, pictures, sound are all
  just agreed-upon numberings (letter A is 65 by agreement); nothing in the machine is anything but
  numbers.
- **03-what-is-a-program** (`# What a Program Is`) - a **program** is a list of instructions, stored
  as bytes like everything else; the processor picks up one instruction, does it, moves to the next,
  billions of times a second; each instruction is tiny (add two numbers, copy a byte, jump); the
  magic is speed and stacking, not intelligence; instructions and data live in the same memory.
- **04-what-is-code** (`# What Code Is`) - nobody writes raw instruction numbers by hand anymore;
  people write **source code**, text in a programming language a human can read; a **compiler** is a
  program that translates source code into the processor's instructions; there are many languages;
  this course uses **Rust**; "code" is just that text, and "coding" is writing it.
- **05-running-a-program** (`# Running a Program`) - what "run" means: the machine copies the
  program's instructions from storage into memory and the processor starts stepping through them;
  the **terminal** is a program that takes typed commands; a **command** is the name of a program
  plus what you want it to do; you type it, press enter, the program runs, prints its answer, and
  **exits**; the learner has already done this: `thunk` itself is a program they ran. Close by
  pointing down: the rest of the course opens the machine up, layer by layer.

- [ ] **Step 5: Author `checks.ron`** - 15 checks, 3 per lesson, ids and facts:

| id | type | tests |
|---|---|---|
| `m0-01-processor` | Choice | the part that steps through instructions is the processor |
| `m0-01-memory` | Choice | memory is the fast workspace that forgets at power off |
| `m0-01-switch` | Short | a switch that is on stores the digit: `1`, `one` |
| `m0-02-bit` | Short | a single 0-or-1 is called a: `bit` |
| `m0-02-byte` | Choice | bits in a byte: 8 |
| `m0-02-range` | Choice | largest number one byte holds: 255 |
| `m0-03-program` | Choice | a program is a list of instructions stored as bytes |
| `m0-03-step` | Choice | the processor does instructions one at a time, very fast |
| `m0-03-same` | Choice | instructions and data live in the same memory |
| `m0-04-source` | Short | the human-readable text of a program: `source code`, `code`, `source` |
| `m0-04-compiler` | Short | the program that translates source into instructions: `compiler`, `a compiler` |
| `m0-04-language` | Choice | the language this course uses: Rust |
| `m0-05-terminal` | Short | where you type commands: `terminal`, `the terminal`, `command line`, `shell`, `console` |
| `m0-05-run` | Choice | running = copied into memory, processor steps through it |
| `m0-05-exit` | Choice | a finished program exits |

- [ ] **Step 6: Run to verify pass.** `CARGO_NET_OFFLINE=true cargo test -p thunk-content` PASS;
`./scripts/vocab-lint.sh` clean.

- [ ] **Step 7: Commit.**

```bash
git add thunk-content
git commit -m "content(m0): Power On - true-zero on-ramp (5 lessons, 15 checks)"
```

---

### Task 3: Author M2 - Rust for the Metal

**Files:**
- Create: `thunk-content/modules/m2-rust/module.ron`
- Create: `thunk-content/modules/m2-rust/{01-why-rust,02-ownership,03-borrowing,04-no-std,05-bits-in-types}.md`
- Create: `thunk-content/modules/m2-rust/checks.ron`
- Modify: `thunk-content/src/lib.rs` (LADDER)

- [ ] **Step 1:** LADDER becomes `&["m0-power-on", "m1-kernel", "m2-rust"]`.
- [ ] **Step 2:** Run suite, expect FAIL (missing `m2-rust/module.ron`).
- [ ] **Step 3: Author `module.ron`:**

```ron
(
    id: "m2-rust",
    title: "Rust for the Metal",
    lessons: [
        "01-why-rust",
        "02-ownership",
        "03-borrowing",
        "04-no-std",
        "05-bits-in-types",
    ],
)
```

- [ ] **Step 4: Author the five lessons.** The learner has finished M1 (knows kernel/user mode,
syscalls, drivers). Small Rust snippets in fenced code blocks are welcome from here on. Arcs:

- **01-why-rust** (`# Why Rust, Down Here`) - what goes wrong in low-level code: using memory after
  giving it back, reading past the end of a buffer, two threads writing the same bytes; in C these
  become crashes discovered at runtime, sometimes years later; Rust's bet: catch use-after-free and
  data races at compile time, before the program exists, and stop out-of-bounds access at runtime
  with a bounds check the moment it happens (**erratum 2026-07-12:** an earlier draft of this arc
  said "catch them at compile time" for all three; bounds checks are runtime - do not re-import
  that claim); no garbage collector, so memory comes back the instant it is done, predictably,
  which is why Rust fits kernels and small machines; the kernel itself now accepts Rust (state it
  plainly).
- **02-ownership** (`# Ownership`) - every value has exactly one owner; assignment of non-trivial
  values moves ownership, the old name is dead (show a 6-line snippet with the compile error in
  prose); when the owner goes out of scope the value is dropped and its memory returned; this is the
  no-garbage-collector trick: the compiler proves when memory is done.
- **03-borrowing** (`# Borrowing`) - you can lend a value without giving it away: a reference;
  the rule: any number of readers, or exactly one writer, never both; the **borrow checker** is the
  part of the compiler enforcing it; this rule is what makes the memory bugs from lesson 01
  impossible to compile; show `&` and `&mut` in a short snippet.
- **04-no-std** (`# no_std`) - Rust's standard library quietly assumes a kernel underneath (files,
  threads, heap allocation all end in syscalls, which M1 taught); on bare metal there is no kernel
  to call; `#![no_std]` drops that assumption, leaving **core**: the types, arithmetic, and traits
  that need nothing beneath them; embedded and kernel Rust live here; thunk's simulator is written
  against this discipline.
- **05-bits-in-types** (`# Bits in Types`) - types are how Rust names byte patterns: `u8` is one
  byte (0-255, exactly M0's byte), `u16` two bytes, `u32` four; a struct is bytes laid side by side;
  a `u16` color splits into two `u8`s to travel a wire that carries one byte at a time (show
  `(c >> 8) as u8` and `(c & 0xFF) as u8`); this is the bridge to M3: buses carry bytes, types tell
  you which bytes.

- [ ] **Step 5: Author `checks.ron`** - 15 checks:

| id | type | tests |
|---|---|---|
| `m2-01-catch` | Choice | Rust catches memory mistakes at compile time |
| `m2-01-gc` | Choice | no garbage collector: memory returns the moment its owner is done |
| `m2-01-fit` | Choice | why Rust fits kernels: predictable, no runtime pauses |
| `m2-02-owner` | Choice | a value has exactly one owner |
| `m2-02-move` | Choice | after a move the old name can no longer be used |
| `m2-02-drop` | Short | when the owner leaves scope the value is: `dropped`, `freed`, `returned` |
| `m2-03-rule` | Choice | many readers or one writer, never both |
| `m2-03-borrow` | Short | lending access without giving ownership: `borrow`, `borrowing`, `a borrow`, `reference`, `a reference` |
| `m2-03-checker` | Short | the compiler part that enforces the rule: `borrow checker`, `the borrow checker` |
| `m2-04-std` | Choice | std assumes an operating system underneath |
| `m2-04-attr` | Short | the attribute that drops that assumption: `no_std`, `#![no_std]` |
| `m2-04-core` | Short | what remains without std: `core` |
| `m2-05-u8` | Choice | u8 holds 0 through 255 |
| `m2-05-u16` | Choice | u16 is two bytes |
| `m2-05-color` | Choice | an RGB565 color fits in a u16 |

- [ ] **Step 6:** Suite PASS + vocab-lint clean.
- [ ] **Step 7: Commit:** `content(m2): Rust for the Metal (5 lessons, 15 checks)`

---

### Task 4: Author M3 - The Bus

**Files:**
- Create: `thunk-content/modules/m3-bus/module.ron`
- Create: `thunk-content/modules/m3-bus/{01-wires-and-voltage,02-clock-and-data,03-chip-select,04-reading-a-trace}.md`
- Create: `thunk-content/modules/m3-bus/checks.ron`
- Modify: `thunk-content/src/lib.rs` (LADDER)

- [ ] **Step 1:** LADDER appends `"m3-bus"`. **Step 2:** suite FAIL (missing asset).
- [ ] **Step 3: Author `module.ron`:**

```ron
(
    id: "m3-bus",
    title: "The Bus",
    lessons: [
        "01-wires-and-voltage",
        "02-clock-and-data",
        "03-chip-select",
        "04-reading-a-trace",
    ],
)
```

- [ ] **Step 4: Author the four lessons.** ASCII timing diagrams in fenced blocks are encouraged.
Arcs:

- **01-wires-and-voltage** (`# Wires and Voltage`) - a wire either carries voltage or it does not;
  high is a 1, low is a 0; this is M0's bit, physically; to move a byte you can use eight wires at
  once (parallel) or one wire eight times (serial); serial wins on cost and simplicity, and **SPI**
  is a serial bus: four wires to speak to a device.
- **02-clock-and-data** (`# Clock and Data`) - the receiver's problem: when do I look at the data
  wire? the **clock** wire answers it: every tick means "read now"; one bit per tick, eight ticks
  per byte, most significant bit first; draw `0x2C` as an ASCII clock/data timing diagram and walk
  it bit by bit; speed is just the tick rate.
- **03-chip-select** (`# Chip Select`) - several devices can share clock and data; the **chip
  select** wire, one per device, says "you"; it idles high and is pulled low to speak (active low);
  the device driving the clock is the **controller**, the device addressed is the **peripheral**;
  the full shape of a transaction: select low, clock out bytes, select high.
- **04-reading-a-trace** (`# Reading a Trace`) - a **logic analyzer** records the wires and draws
  them over time; how to decode: at each clock tick read the data line, eight reads make a byte;
  decode a two-byte trace by hand in the lesson; thunk's simulator records exactly this trace, and
  the panel in M4 is driven through it; what you can debug when you can see the wire.

- [ ] **Step 5: Author `checks.ron`** - 12 checks:

| id | type | tests |
|---|---|---|
| `m3-01-high` | Choice | high voltage on a wire represents a 1 |
| `m3-01-serial` | Choice | serial = bits one at a time over one wire |
| `m3-01-spi` | Choice | SPI reaches a device over about four wires |
| `m3-02-clock` | Choice | the clock line says when to read the data line |
| `m3-02-perbyte` | Choice | eight ticks move one byte |
| `m3-02-msb` | Short | SPI usually sends this bit first: `most significant`, `most significant bit`, `msb`, `the most significant bit` |
| `m3-03-select` | Choice | chip select tells one device it is being addressed |
| `m3-03-controller` | Short | the device that drives the clock: `controller`, `the controller` |
| `m3-03-low` | Choice | select is active low: pulled low to speak |
| `m3-04-analyzer` | Short | the tool that records and draws the wires: `logic analyzer`, `a logic analyzer`, `analyzer` |
| `m3-04-decode` | Choice | to decode: read the data line at each clock tick |
| `m3-04-trace` | Choice | thunk's simulator records the bus traffic as a trace |

- [ ] **Step 6:** Suite PASS + vocab-lint clean.
- [ ] **Step 7: Commit:** `content(m3): The Bus - SPI from the wire up (4 lessons, 12 checks)`

---

### Task 5: Author M4 - The Panel

**Files:**
- Create: `thunk-content/modules/m4-panel/module.ron`
- Create: `thunk-content/modules/m4-panel/{01-pixels-and-grids,02-color-in-sixteen-bits,03-the-framebuffer,04-commands-and-data}.md`
- Create: `thunk-content/modules/m4-panel/checks.ron`
- Modify: `thunk-content/src/lib.rs` (LADDER)

- [ ] **Step 1:** LADDER appends `"m4-panel"`. **Step 2:** suite FAIL.
- [ ] **Step 3: Author `module.ron`:**

```ron
(
    id: "m4-panel",
    title: "The Panel",
    lessons: [
        "01-pixels-and-grids",
        "02-color-in-sixteen-bits",
        "03-the-framebuffer",
        "04-commands-and-data",
    ],
)
```

- [ ] **Step 4: Author the four lessons.** Arcs:

- **01-pixels-and-grids** (`# Pixels and Grids`) - a screen is a grid of dots; each dot is a
  **pixel**; a pixel is named by its column and row, (x, y), counted from the top left; the panel in
  this course is 240 wide by 320 tall, 76,800 pixels; "drawing" means deciding a color for each.
- **02-color-in-sixteen-bits** (`# Color in Sixteen Bits`) - a color is a mix of red, green, blue;
  **RGB565** packs a color into one u16: 5 bits red, 6 green, 5 blue; green gets the extra bit
  because eyes resolve green best; walk the layout (`RRRRRGGG GGGBBBBB`); pure red is `0xF800`, pure
  green `0x07E0`, pure blue `0x001F`; 65,536 colors in two bytes.
- **03-the-framebuffer** (`# The Framebuffer`) - the whole picture lives in memory: one u16 per
  pixel, rows laid end to end; pixel (x, y) sits at index `y * width + x` (walk one example);
  drawing is writing memory, animation is rewriting it fast; the panel keeps its own copy, which is
  why the picture persists while your program does other work; 240 x 320 x 2 bytes = 153,600 bytes
  per full frame.
- **04-commands-and-data** (`# Commands and Data`) - the panel has a controller chip that speaks
  SPI; one extra wire (**DC**) tells it whether a byte is a **command** (do something) or **data**
  (here are the bytes for it); to draw: set the column window, set the page window, then send the
  write command **RAMWR** (0x2C) followed by pixel data, two bytes per pixel, high byte first; the
  driver you will study in the simulator does exactly this and nothing else.

- [ ] **Step 5: Author `checks.ron`** - 12 checks:

| id | type | tests |
|---|---|---|
| `m4-01-pixel` | Short | one dot on the screen: `pixel`, `a pixel` |
| `m4-01-coords` | Choice | a pixel is named by x and y from the top left |
| `m4-01-size` | Choice | this course's panel is 240 by 320 |
| `m4-02-bits` | Choice | RGB565 uses 16 bits total |
| `m4-02-green` | Choice | green gets 6 bits |
| `m4-02-red` | Choice | 0xF800 is pure red |
| `m4-03-fb` | Short | the memory holding the whole picture: `framebuffer`, `the framebuffer`, `frame buffer` |
| `m4-03-index` | Choice | pixel (x, y) lives at index y * width + x |
| `m4-03-bytes` | Choice | one full frame is 153,600 bytes |
| `m4-04-dc` | Choice | the DC wire marks a byte as command or data |
| `m4-04-window` | Choice | before pixels you set the address window |
| `m4-04-ramwr` | Short | the command that starts pixel writes: `ramwr`, `0x2c`, `2c`, `ram write` |

- [ ] **Step 6:** Suite PASS + vocab-lint clean.
- [ ] **Step 7: Commit:** `content(m4): The Panel - pixels to protocol (4 lessons, 12 checks)`

---

### Task 6: Author M5 - DOOM (concept finale)

**Files:**
- Create: `thunk-content/modules/m5-doom/module.ron`
- Create: `thunk-content/modules/m5-doom/{01-why-doom,02-frames-to-the-panel,03-the-whole-stack}.md`
- Create: `thunk-content/modules/m5-doom/checks.ron`
- Modify: `thunk-content/src/lib.rs` (LADDER)

**Framing (decided with Penn 2026-07-12):** the inside build's finale is a review-safe rendered
scene; playable DOOM ships on the open build only. These lessons teach the finale as a systems
achievement. Engineering vocabulary only.

- [ ] **Step 1:** LADDER appends `"m5-doom"`. **Step 2:** suite FAIL.
- [ ] **Step 3: Author `module.ron`:**

```ron
(
    id: "m5-doom",
    title: "DOOM",
    lessons: [
        "01-why-doom",
        "02-frames-to-the-panel",
        "03-the-whole-stack",
    ],
)
```

- [ ] **Step 4: Author the three lessons.** Arcs:

- **01-why-doom** (`# Why DOOM`) - DOOM is a program from 1993 that drew a moving 3D world on
  machines thousands of times weaker than anything today; engineers port it to everything
  (printers, oscilloscopes, test equipment) because it is the classic proof that a whole stack
  works: if DOOM runs, your processor, memory, display path, and timing all work; id Software
  released its source code in 1997, which is why anyone can port it at all (a first taste of M6);
  "porting" means supplying the small set of things it needs: a framebuffer to draw into, a clock,
  input.
- **02-frames-to-the-panel** (`# Frames to the Panel`) - a moving picture is stills shown fast; each
  still is a **frame**; the program computes a frame into the framebuffer, the driver moves it over
  the bus, the panel shows it, repeat; do the budget math in the open: 153,600 bytes per frame, at
  30 frames per second that is about 4.6 MB every second through a four-wire bus, so the clock rate
  and the address-window trick from M4 start to matter; this is real engineering: a budget, a
  bottleneck, a design that fits.
- **03-the-whole-stack** (`# The Whole Stack`) - walk the ladder back down: a frame is numbers
  (M0), typed and owned by a program (M2), pushed through a syscall to a driver (M1), out over
  clocked wires (M3), into a panel's memory (M4); nothing in the stack is magic and you have now
  seen every layer; on this build the finale renders on the simulated panel; on the open build the
  same program, through the same interface, drives real hardware; where to go next: M6, where the
  code you just learned to read is something you can help build.

- [ ] **Step 5: Author `checks.ron`** - 9 checks:

| id | type | tests |
|---|---|---|
| `m5-01-proof` | Choice | running DOOM proves the whole stack works together |
| `m5-01-source` | Choice | porting is possible because the source was released |
| `m5-01-needs` | Choice | a port supplies a framebuffer, a clock, and input |
| `m5-02-frame` | Short | one still picture in the sequence: `frame`, `a frame` |
| `m5-02-budget` | Choice | one frame of this panel is 153,600 bytes |
| `m5-02-path` | Choice | frame path: framebuffer, then driver, then bus, then panel |
| `m5-03-layers` | Choice | the correct bottom-up order of the stack |
| `m5-03-same` | Choice | sim and real hardware sit behind the same interface |
| `m5-03-magic` | Choice | every layer is inspectable; none of it is magic |

- [ ] **Step 6:** Suite PASS + vocab-lint clean.
- [ ] **Step 7: Commit:** `content(m5): DOOM - the finale as systems engineering (3 lessons, 9 checks)`

---

### Task 7: Author M6 - Intro to Open Source, and pin the ladder

**Files:**
- Create: `thunk-content/modules/m6-open-source/module.ron`
- Create: `thunk-content/modules/m6-open-source/{01-what-open-source-is,02-licenses-in-plain-terms,03-version-control-in-the-open,04-reading-a-diff,05-the-culture-of-merit}.md`
- Create: `thunk-content/modules/m6-open-source/checks.ron`
- Modify: `thunk-content/src/lib.rs` (LADDER + completeness pin)

- [ ] **Step 1: Write the failing completeness test** (this is the acceptance pin for all of M-A):

```rust
#[test]
fn the_ladder_is_complete_m0_through_m6() {
    assert_eq!(
        LADDER,
        &[
            "m0-power-on",
            "m1-kernel",
            "m2-rust",
            "m3-bus",
            "m4-panel",
            "m5-doom",
            "m6-open-source",
        ]
    );
}
```

- [ ] **Step 2:** Run suite. Expected: FAIL (`m6-open-source` absent from LADDER).
- [ ] **Step 3:** Append `"m6-open-source"` to LADDER; run again; now FAIL on missing assets.
- [ ] **Step 4: Author `module.ron`:**

```ron
(
    id: "m6-open-source",
    title: "Intro to Open Source",
    lessons: [
        "01-what-open-source-is",
        "02-licenses-in-plain-terms",
        "03-version-control-in-the-open",
        "04-reading-a-diff",
        "05-the-culture-of-merit",
    ],
)
```

- [ ] **Step 5: Author the five lessons.** Reminder: never use the word "exploit" in any form.
Arcs:

- **01-what-open-source-is** (`# What Open Source Is`) - software whose source code is public and
  licensed so anyone may use, study, change, and share it; "free" means freedom, not price; the
  learner has used it all course: Linux is open source, Rust is, thunk itself is; open source is not
  charity or amateur hour, it runs most of the world's infrastructure and most of it is built by
  paid engineers in the open.
- **02-licenses-in-plain-terms** (`# Licenses in Plain Terms`) - a **license** is the short legal
  text that grants those freedoms; MIT in one sentence: do what you like, keep the notice; Apache
  adds patent protection; GPL adds: if you ship changes, share them under the same terms
  (copyleft); why authors choose each; thunk is dual MIT/Apache, the Rust convention; a license is a
  promise you can read in five minutes.
- **03-version-control-in-the-open** (`# Version Control in the Open`) - **git** records the history
  of a project as a chain of **commits**, each one a named, dated, explained change; history is the
  project's memory and its ledger of credit; a public repository means anyone can read it; a
  **fork** is your own copy to work in; you propose a change back as a request the maintainers can
  read; every commit carries its author's name, forever.
- **04-reading-a-diff** (`# Reading a Diff`) - a **diff** shows exactly what a change does: lines
  starting `-` removed, `+` added, grouped in **hunks** with a little context around each; walk a
  real 15-line diff in the lesson (a small Rust function change) hunk by hunk; the diff is the unit
  of conversation in open source: reviews, arguments, and approvals all happen on the diff; learning
  to read one is learning to be read.
- **05-the-culture-of-merit** (`# The Culture of Merit`) - how a project runs: **maintainers**
  decide what merges, reviewers read diffs and say what they see; review judges the change, not the
  person who sent it; nobody on a mailing list asks about your past, they ask whether the change is
  correct; the review culture is exacting and blunt about code and blind to everything else; a
  public contribution history is a work record anyone can verify, with your name on every merged
  change; M7, on the open build, is where you send your first one.

- [ ] **Step 6: Author `checks.ron`** - 15 checks:

| id | type | tests |
|---|---|---|
| `m6-01-means` | Choice | open source = public source, licensed to use/study/change/share |
| `m6-01-free` | Choice | "free" refers to freedom, not price |
| `m6-01-used` | Choice | Linux/Rust/thunk are all open source |
| `m6-02-license` | Short | the text granting the freedoms: `license`, `a license`, `the license` |
| `m6-02-mit` | Choice | MIT roughly: do what you like, keep the notice |
| `m6-02-gpl` | Choice | GPL adds: share changes under the same terms |
| `m6-03-git` | Short | the tool recording project history: `git` |
| `m6-03-commit` | Short | one recorded, explained change: `commit`, `a commit` |
| `m6-03-fork` | Choice | a fork is your own copy of a project to work in |
| `m6-04-plus` | Choice | a line starting with + was added |
| `m6-04-hunk` | Short | a block of changed lines with context: `hunk`, `a hunk` |
| `m6-04-unit` | Choice | the diff is the unit of review conversation |
| `m6-05-maintainer` | Short | the person who decides what merges: `maintainer`, `a maintainer`, `the maintainer` |
| `m6-05-review` | Choice | review judges the change, not the person |
| `m6-05-record` | Choice | contribution history is a verifiable public work record |

- [ ] **Step 7:** Full suite PASS (including the completeness pin) + vocab-lint clean.
- [ ] **Step 8: Commit:** `content(m6): Intro to Open Source (5 lessons, 15 checks); pin the M0-M6 ladder`

---

### Task 8: CLI lists the whole ladder

**Files:**
- Modify: `thunk-cli/src/main.rs`

- [ ] **Step 1: Write the failing tests.** Replace `overview_lists_module_one` and
`read_defaults_to_first_lesson` in `thunk-cli/src/main.rs` with:

```rust
#[test]
fn overview_lists_the_whole_ladder() {
    let s = overview();
    for needle in [
        "M0", "Power On",
        "M1", "The Kernel",
        "M2", "Rust for the Metal",
        "M3", "The Bus",
        "M4", "The Panel",
        "M5", "DOOM",
        "M6", "Intro to Open Source",
    ] {
        assert!(s.contains(needle), "overview missing {needle:?}:\n{s}");
    }
}

#[test]
fn read_defaults_to_the_first_lesson_of_the_course() {
    // The course now starts at true zero: M0, The Machine.
    assert!(read(None).to_lowercase().contains("machine"));
}

#[test]
fn read_finds_a_lesson_in_any_module() {
    assert!(read(Some("02-syscalls")).to_lowercase().contains("syscall"));
    assert!(read(Some("01-why-rust")).to_lowercase().contains("rust"));
}
```

- [ ] **Step 2:** Run `CARGO_NET_OFFLINE=true cargo test -p thunk-cli`. Expected: FAIL
(overview only knows Module 1; read(None) returns the kernel lesson).

- [ ] **Step 3: Implement.** In `thunk-cli/src/main.rs`, rewrite `overview`, `read`, `checks`, and
`progress` to walk the ladder:

```rust
fn ladder_tag(module_id: &str) -> String {
    module_id.split('-').next().unwrap_or(module_id).to_uppercase()
}

fn overview() -> String {
    let mut s = String::from("thunk - a systems course, from the ground up\n\n");
    for m in Curriculum::all() {
        s.push_str(&format!(
            "  {:3} {:24} {} lessons\n",
            ladder_tag(&m.id.0),
            m.title,
            m.lessons.len()
        ));
    }
    s.push_str("\nTry:  thunk tui   |   thunk read   |   thunk check   |   thunk sim\n");
    s
}

fn read(which: Option<&str>) -> String {
    let modules = Curriculum::all();
    let lesson = match which {
        Some(id) => modules
            .iter()
            .flat_map(|m| m.lessons.iter())
            .find(|l| l.id.0 == id),
        None => modules.first().and_then(|m| m.lessons.first()),
    };
    match lesson {
        Some(l) => format!("{}\n", l.body),
        None => "no such lesson\n".to_string(),
    }
}

fn checks() -> String {
    let mut s = String::from("Checks, by module:\n");
    for m in Curriculum::all() {
        let cs = Curriculum::load_checks(&m.id.0);
        s.push_str(&format!("\n{} - {} ({} checks)\n", ladder_tag(&m.id.0), m.title, cs.len()));
        for (i, c) in cs.iter().enumerate() {
            s.push_str(&format!("  {}. {}\n", i + 1, c.prompt()));
        }
    }
    s
}

fn progress() -> String {
    let total: usize = Curriculum::all()
        .iter()
        .map(|m| Curriculum::load_checks(&m.id.0).len())
        .sum();
    format!("Mastery = pass every check in a module to unlock the next. {total} checks across the course.\n")
}
```

(`read` keeps its existing signature and callers; `Curriculum::module_one` remains for the TUI,
which gets its multi-module treatment in M-B alongside locked/unlocked state.)

- [ ] **Step 4:** Run `CARGO_NET_OFFLINE=true cargo test -p thunk-cli`. Expected: PASS.
- [ ] **Step 5:** Eyeball it: `CARGO_NET_OFFLINE=true cargo run -q -p thunk-cli --` shows the M0-M6
ladder; `cargo run -q -p thunk-cli -- read` prints The Machine.
- [ ] **Step 6: Commit:** `feat(cli): overview/read/check/progress span the full M0-M6 ladder`

---

### Task 9: Full-workspace verification sweep

**Files:**
- Modify: `docs/superpowers/plans/2026-07-10-thunk-buildout.md` (mark M-A done)

- [ ] **Step 1:** `CARGO_NET_OFFLINE=true cargo fmt --all` then
`CARGO_NET_OFFLINE=true cargo clippy --workspace --all-targets -- -D warnings`. Fix anything it raises.
- [ ] **Step 2:** `CARGO_NET_OFFLINE=true cargo test --workspace`. Expected: all green, 40+ tests
(24 baseline + ladder suite + CLI).
- [ ] **Step 3:** `./scripts/vocab-lint.sh` - clean.
- [ ] **Step 4:** Read two lessons end-to-end as a human would (`thunk read 01-the-machine`,
`thunk read 05-the-culture-of-merit`) and check the voice against the standards section. Fix any
lesson that reads like filler.
- [ ] **Step 5:** In the buildout roadmap, annotate M-A as done with the date and final counts.
- [ ] **Step 6: Commit:** `chore(mA): verification sweep - M0-M6 authored, suite green`

---

## Self-Review notes

- **Spec coverage vs the M-A milestone:** all six missing modules authored (Tasks 2-7); the
  self-validating loader test extended to every module, module list/lesson order asserted, gate
  satisfiability asserted (Task 1's suite + Task 7's pin); `thunk` lists M0-M6 (Task 8); workspace
  green + vocab-lint clean (Task 9). The roadmap's "retune AdvanceGate" line maps to no existing
  code; per-module counts are already data-driven and gating lands in M-B - noted in the header.
- **Type consistency:** only existing types (`Module`, `Check`, `Progress`, `Verdict`,
  `canonical_answer`) are used; `LADDER`/`Curriculum::all()` defined in Task 1 and consumed in
  Tasks 2-8 with matching signatures.
- **No placeholders:** every check across all modules has an exact id, type, and target fact; every
  lesson has a slug, title, and a concrete arc. Lesson prose is authored at execution time under the
  standards section, guarded by the validation suite - the same discipline Phase 1 used (its Task 10).
