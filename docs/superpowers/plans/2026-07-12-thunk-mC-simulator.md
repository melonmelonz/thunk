# thunk M-C: Full Simulator (Protocol Model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow `thunk-sim` from "record bytes, set pixels directly" into a real protocol model: a
richer bus that records select edges and DC-tagged bytes, an `Ili9341` panel model that builds its
framebuffer state purely by decoding the byte stream, and a learner-facing `Display` driver that
speaks the protocol (init, address windows, RAMWR) over the `SpiBus` seam. The boot splash then
renders end-to-end through the protocol, and the CLI/TUI consume it.

**Architecture:** Three cleanly separated roles, mirroring hardware. The **bus** (`SimSpi`) is a
pure recorder: it holds the DC and select line state the driver sets and emits `TraceEvent`s. The
**panel** (`Ili9341`) is a pure decoder: `receive(dc, byte)` advances a small state machine
(command routing, CASET/PASET parameter collection, RAMWR pixel writes with window wrap), and
`replay(&[TraceEvent])` rebuilds state from a recorded trace. The **driver** (`Display<B: SpiBus>`)
is what a learner reads: init sequence, `set_window`, `blit`. Everything deterministic, no I/O,
no new dependencies. `Panel` (the raw framebuffer) survives as the `Ili9341`'s storage and keeps
`to_ascii` for rendering. This matches exactly what M3/M4 content teaches (select framing, DC,
0x2A/0x2B windows with inclusive ends, 0x2C RAMWR, two bytes per pixel high byte first).

**Tech Stack:** Rust 1.88, zero new dependencies (offline cargo constraint). Commands modeled:
SWRESET 0x01, SLPOUT 0x11, DISPOFF 0x28, DISPON 0x29, CASET 0x2A, PASET 0x2B, RAMWR 0x2C,
COLMOD 0x3A (data 0x55 = 16 bpp).

---

## File Structure

```
thunk-sim/src/
  lib.rs        # re-exports: Dc, TraceEvent, SpiBus, SimSpi, Ili9341, Display, Panel, boot
  spi.rs        # MODIFY: Dc, TraceEvent {SelectLow, SelectHigh, Byte{value,dc}}, SpiBus trait
                #         (select/deselect/set_dc/write), SimSpi recorder
  ili9341.rs    # NEW: the decoding panel model (state machine over the byte stream)
  display.rs    # NEW: learner-facing Display driver speaking the protocol
  panel.rs      # UNCHANGED: raw framebuffer + to_ascii (used by Ili9341 as storage)
  boot.rs       # MODIFY: splash via Display (protocol path); keep bar_color/boot_splash
thunk-cli/src/main.rs   # MODIFY: `thunk sim` drives the protocol path, prints trace summary
thunk-tui/src/app.rs    # MODIFY (minimal): panel scene renders the protocol-driven framebuffer
```

Existing callers to migrate: `boot_splash_over_bus` (removed; replaced by the Display path),
`TraceEvent::Byte(u8)` pattern uses in thunk-sim tests.

---

### Task 1: Bus vocabulary - Dc, select edges, DC-tagged trace

**Files:**
- Modify: `thunk-sim/src/spi.rs`
- Modify: `thunk-sim/src/lib.rs` (exports)
- Modify: `thunk-sim/src/boot.rs` (compile fix only, see Step 4)

- [ ] **Step 1: Write the failing test** (replace `sim_spi_records_a_trace` in `spi.rs`):

```rust
#[test]
fn sim_spi_records_select_dc_and_bytes() {
    let mut bus = SimSpi::new();
    bus.select();
    bus.set_dc(Dc::Command);
    bus.write(&[0x2C]);
    bus.set_dc(Dc::Data);
    bus.write(&[0xF8, 0x00]);
    bus.deselect();
    assert_eq!(
        bus.trace(),
        &[
            TraceEvent::SelectLow,
            TraceEvent::Byte { value: 0x2C, dc: Dc::Command },
            TraceEvent::Byte { value: 0xF8, dc: Dc::Data },
            TraceEvent::Byte { value: 0x00, dc: Dc::Data },
            TraceEvent::SelectHigh,
        ]
    );
}

#[test]
fn writes_while_deselected_are_not_recorded() {
    let mut bus = SimSpi::new();
    bus.set_dc(Dc::Data);
    bus.write(&[0xAA]); // nothing selected; a real peripheral would not hear this
    assert!(bus.trace().is_empty());
}
```

- [ ] **Step 2:** `CARGO_NET_OFFLINE=true cargo test -p thunk-sim` - COMPILE FAIL (`Dc`, new
methods undefined). Observe it.
- [ ] **Step 3: Implement** in `spi.rs`:

```rust
//! The SPI bus: how a peripheral is spoken to, one byte at a time.

/// The data/command line: tells the panel what kind of byte is arriving.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dc {
    Command,
    Data,
}

/// One thing that happened on the wires. The trace view is built from these.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TraceEvent {
    /// Chip select pulled low: a transaction begins.
    SelectLow,
    /// Chip select raised: the transaction is over.
    SelectHigh,
    /// One byte crossed the data line, with the DC level it carried.
    Byte { value: u8, dc: Dc },
}

/// The interface a display driver talks through. Implemented by `SimSpi`
/// (inside build) and, later, by a real bus + GPIO pair (open build).
pub trait SpiBus {
    /// Pull chip select low: start speaking to the panel.
    fn select(&mut self);
    /// Raise chip select: done.
    fn deselect(&mut self);
    /// Set the DC line for the bytes that follow.
    fn set_dc(&mut self, dc: Dc);
    /// Clock bytes out on the data line.
    fn write(&mut self, bytes: &[u8]);
}

/// A simulated bus that remembers everything that happened on the wires.
pub struct SimSpi {
    trace: Vec<TraceEvent>,
    dc: Dc,
    selected: bool,
}

impl Default for SimSpi {
    fn default() -> Self {
        Self { trace: Vec::new(), dc: Dc::Command, selected: false }
    }
}

impl SimSpi {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn trace(&self) -> &[TraceEvent] {
        &self.trace
    }
}

impl SpiBus for SimSpi {
    fn select(&mut self) {
        if !self.selected {
            self.selected = true;
            self.trace.push(TraceEvent::SelectLow);
        }
    }
    fn deselect(&mut self) {
        if self.selected {
            self.selected = false;
            self.trace.push(TraceEvent::SelectHigh);
        }
    }
    fn set_dc(&mut self, dc: Dc) {
        self.dc = dc;
    }
    fn write(&mut self, bytes: &[u8]) {
        if !self.selected {
            return;
        }
        for &value in bytes {
            self.trace.push(TraceEvent::Byte { value, dc: self.dc });
        }
    }
}
```

- [ ] **Step 4:** `boot.rs::boot_splash_over_bus` no longer compiles against the new trait.
Delete the function and its test `over_bus_leaves_a_trace` (Task 4 replaces both with the real
protocol path). Keep `bar_color`, `BARS`, `boot_splash`, and `boot_splash_draws_color_bars`.
Update `lib.rs` exports: `pub use spi::{Dc, SimSpi, SpiBus, TraceEvent};` and drop the
`boot_splash` re-export only if it breaks callers - it should stay.
- [ ] **Step 5:** `CARGO_NET_OFFLINE=true cargo test -p thunk-sim` PASS. Then
`CARGO_NET_OFFLINE=true cargo test --workspace` - expect thunk-cli/tui still green (they used
`boot_splash`, not the deleted function; fix any straggler compile errors minimally).
- [ ] **Step 6: Commit:** `feat(sim): bus models select edges and the DC line in the trace`

---

### Task 2: Ili9341 decoder - command routing and address windows

**Files:**
- Create: `thunk-sim/src/ili9341.rs`
- Modify: `thunk-sim/src/lib.rs`

- [ ] **Step 1: Write the failing tests** in `ili9341.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::spi::Dc;

    fn cmd(p: &mut Ili9341, c: u8) {
        p.receive(Dc::Command, c);
    }
    fn data(p: &mut Ili9341, bytes: &[u8]) {
        for &b in bytes {
            p.receive(Dc::Data, b);
        }
    }

    #[test]
    fn caset_and_paset_set_the_window() {
        let mut p = Ili9341::new(240, 320);
        cmd(&mut p, 0x2A); // CASET
        data(&mut p, &[0x00, 0x0A, 0x00, 0x14]); // columns 10..=20
        cmd(&mut p, 0x2B); // PASET
        data(&mut p, &[0x00, 0x02, 0x00, 0x04]); // pages 2..=4
        assert_eq!(p.window(), ((10, 2), (20, 4)));
    }

    #[test]
    fn init_sequence_wakes_and_turns_on() {
        let mut p = Ili9341::new(240, 320);
        assert!(!p.is_on());
        cmd(&mut p, 0x01); // SWRESET
        cmd(&mut p, 0x11); // SLPOUT
        cmd(&mut p, 0x3A); // COLMOD
        data(&mut p, &[0x55]); // 16 bits per pixel
        cmd(&mut p, 0x29); // DISPON
        assert!(p.is_awake());
        assert!(p.is_on());
        cmd(&mut p, 0x28); // DISPOFF
        assert!(!p.is_on());
    }

    #[test]
    fn swreset_restores_the_full_window() {
        let mut p = Ili9341::new(240, 320);
        cmd(&mut p, 0x2A);
        data(&mut p, &[0x00, 0x0A, 0x00, 0x14]);
        cmd(&mut p, 0x01); // SWRESET
        assert_eq!(p.window(), ((0, 0), (239, 319)));
        assert!(!p.is_on());
    }

    #[test]
    fn unknown_commands_are_ignored() {
        let mut p = Ili9341::new(240, 320);
        cmd(&mut p, 0xD9); // not modeled
        data(&mut p, &[0x01, 0x02]);
        cmd(&mut p, 0x2A);
        data(&mut p, &[0x00, 0x00, 0x00, 0x01]);
        assert_eq!(p.window(), ((0, 0), (1, 319))); // decoder state undamaged
    }
}
```

- [ ] **Step 2:** Run - COMPILE FAIL. Observe.
- [ ] **Step 3: Implement** the state machine:

```rust
//! An ILI9341-class panel model: builds framebuffer state by decoding the
//! command/data byte stream, exactly as the course teaches the protocol.

use crate::panel::Panel;
use crate::spi::{Dc, TraceEvent};

const SWRESET: u8 = 0x01;
const SLPOUT: u8 = 0x11;
const DISPOFF: u8 = 0x28;
const DISPON: u8 = 0x29;
const CASET: u8 = 0x2A;
const PASET: u8 = 0x2B;
const RAMWR: u8 = 0x2C;
const COLMOD: u8 = 0x3A;

/// What the panel is currently collecting data bytes for.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Expecting {
    Nothing,
    WindowParams { cmd: u8, got: [u8; 4], n: usize },
    PixelFormat,
    Pixels { high: Option<u8> },
}

pub struct Ili9341 {
    fb: Panel,
    expecting: Expecting,
    col: (u16, u16),
    page: (u16, u16),
    cursor: (u16, u16),
    awake: bool,
    on: bool,
}

impl Ili9341 {
    pub fn new(w: usize, h: usize) -> Self {
        let mut p = Self {
            fb: Panel::new(w, h),
            expecting: Expecting::Nothing,
            col: (0, 0),
            page: (0, 0),
            cursor: (0, 0),
            awake: false,
            on: false,
        };
        p.reset();
        p
    }

    fn reset(&mut self) {
        self.expecting = Expecting::Nothing;
        self.col = (0, self.fb.w as u16 - 1);
        self.page = (0, self.fb.h as u16 - 1);
        self.cursor = (self.col.0, self.page.0);
        self.awake = false;
        self.on = false;
    }

    pub fn framebuffer(&self) -> &Panel {
        &self.fb
    }
    pub fn window(&self) -> ((u16, u16), (u16, u16)) {
        ((self.col.0, self.page.0), (self.col.1, self.page.1))
    }
    pub fn is_awake(&self) -> bool {
        self.awake
    }
    pub fn is_on(&self) -> bool {
        self.on
    }

    /// One byte arrives off the bus, with the DC level it carried.
    pub fn receive(&mut self, dc: Dc, byte: u8) {
        match dc {
            Dc::Command => self.command(byte),
            Dc::Data => self.data(byte),
        }
    }

    /// Rebuild state from a recorded trace: the panel decodes the bus.
    pub fn replay(&mut self, trace: &[TraceEvent]) {
        for e in trace {
            if let TraceEvent::Byte { value, dc } = e {
                self.receive(*dc, *value);
            }
        }
    }

    fn command(&mut self, c: u8) {
        self.expecting = Expecting::Nothing;
        match c {
            SWRESET => self.reset(),
            SLPOUT => self.awake = true,
            DISPON => self.on = true,
            DISPOFF => self.on = false,
            COLMOD => self.expecting = Expecting::PixelFormat,
            CASET | PASET => {
                self.expecting = Expecting::WindowParams { cmd: c, got: [0; 4], n: 0 }
            }
            RAMWR => {
                self.cursor = (self.col.0, self.page.0);
                self.expecting = Expecting::Pixels { high: None };
            }
            _ => {} // unmodeled commands: ignored, parameters discarded
        }
    }

    fn data(&mut self, b: u8) {
        match self.expecting {
            Expecting::Nothing | Expecting::PixelFormat => {
                // COLMOD data is accepted (0x55 = 16bpp, the only mode modeled);
                // stray data with no command is discarded, as real silicon does.
                self.expecting = Expecting::Nothing;
            }
            Expecting::WindowParams { cmd, mut got, n } => {
                got[n] = b;
                if n == 3 {
                    let start = u16::from_be_bytes([got[0], got[1]]);
                    let end = u16::from_be_bytes([got[2], got[3]]);
                    if cmd == CASET {
                        self.col = (start, end);
                    } else {
                        self.page = (start, end);
                    }
                    self.cursor = (self.col.0, self.page.0);
                    self.expecting = Expecting::Nothing;
                } else {
                    self.expecting = Expecting::WindowParams { cmd, got, n: n + 1 };
                }
            }
            Expecting::Pixels { high } => match high {
                None => self.expecting = Expecting::Pixels { high: Some(b) },
                Some(hi) => {
                    let color = u16::from_be_bytes([hi, b]);
                    self.write_pixel(color);
                    self.expecting = Expecting::Pixels { high: None };
                }
            },
        }
    }

    fn write_pixel(&mut self, color: u16) {
        let (x, y) = self.cursor;
        self.fb.set_pixel(x as usize, y as usize, color);
        // Advance within the window; wrap columns, then pages; wrap the whole
        // window when it is full, as the real controller does.
        if x < self.col.1 {
            self.cursor = (x + 1, y);
        } else if y < self.page.1 {
            self.cursor = (self.col.0, y + 1);
        } else {
            self.cursor = (self.col.0, self.page.0);
        }
    }
}
```

- [ ] **Step 4:** Add `pub mod ili9341;` + `pub use ili9341::Ili9341;` to `lib.rs`.
- [ ] **Step 5:** `CARGO_NET_OFFLINE=true cargo test -p thunk-sim` PASS.
- [ ] **Step 6: Commit:** `feat(sim): ILI9341 decoder - command routing + address windows`

---

### Task 3: Ili9341 decoder - RAMWR pixel writes with window wrap

**Files:**
- Modify: `thunk-sim/src/ili9341.rs` (tests only if Task 2's impl already passes them; TDD still
  applies - write these tests, watch the run, fix anything that fails)

- [ ] **Step 1: Write the failing/probing tests** (append to the tests module):

```rust
#[test]
fn ramwr_writes_pixels_into_the_window() {
    let mut p = Ili9341::new(240, 320);
    cmd(&mut p, 0x2A);
    data(&mut p, &[0x00, 0x02, 0x00, 0x03]); // columns 2..=3
    cmd(&mut p, 0x2B);
    data(&mut p, &[0x00, 0x05, 0x00, 0x06]); // pages 5..=6
    cmd(&mut p, 0x2C); // RAMWR
    // four pixels, high byte first: red, green, blue, white
    data(&mut p, &[0xF8, 0x00, 0x07, 0xE0, 0x00, 0x1F, 0xFF, 0xFF]);
    let fb = p.framebuffer();
    assert_eq!(fb.get_pixel(2, 5), 0xF800);
    assert_eq!(fb.get_pixel(3, 5), 0x07E0); // wrapped column
    assert_eq!(fb.get_pixel(2, 6), 0x001F); // wrapped to next page
    assert_eq!(fb.get_pixel(3, 6), 0xFFFF);
    assert_eq!(fb.get_pixel(0, 0), 0x0000); // outside window untouched
}

#[test]
fn overflowing_the_window_wraps_to_its_start() {
    let mut p = Ili9341::new(240, 320);
    cmd(&mut p, 0x2A);
    data(&mut p, &[0x00, 0x00, 0x00, 0x00]); // single column 0
    cmd(&mut p, 0x2B);
    data(&mut p, &[0x00, 0x00, 0x00, 0x00]); // single page 0
    cmd(&mut p, 0x2C);
    data(&mut p, &[0xF8, 0x00, 0x07, 0xE0]); // two pixels into a one-pixel window
    assert_eq!(p.framebuffer().get_pixel(0, 0), 0x07E0); // second overwrote first
}

#[test]
fn a_new_command_ends_the_pixel_stream() {
    let mut p = Ili9341::new(240, 320);
    cmd(&mut p, 0x2C);
    data(&mut p, &[0xF8, 0x00]);
    cmd(&mut p, 0x28); // DISPOFF interrupts
    data(&mut p, &[0x07, 0xE0]); // stray data, no active command: discarded
    assert_eq!(p.framebuffer().get_pixel(0, 0), 0xF800);
    assert_eq!(p.framebuffer().get_pixel(1, 0), 0x0000);
}

#[test]
fn replay_rebuilds_state_from_a_trace() {
    use crate::spi::{SimSpi, SpiBus};
    let mut bus = SimSpi::new();
    bus.select();
    bus.set_dc(Dc::Command);
    bus.write(&[0x2C]);
    bus.set_dc(Dc::Data);
    bus.write(&[0xF8, 0x00]);
    bus.deselect();
    let mut p = Ili9341::new(240, 320);
    p.replay(bus.trace());
    assert_eq!(p.framebuffer().get_pixel(0, 0), 0xF800);
}
```

- [ ] **Step 2:** Run `CARGO_NET_OFFLINE=true cargo test -p thunk-sim`. Some may already pass
against Task 2's implementation; any failure is a bug in the state machine - fix the
implementation, never weaken a test. All four must end green.
- [ ] **Step 3:** `CARGO_NET_OFFLINE=true cargo test --workspace` green;
`cargo clippy -p thunk-sim --all-targets -- -D warnings` clean.
- [ ] **Step 4: Commit:** `feat(sim): RAMWR pixel stream - wrap, interrupt, replay`

---

### Task 4: The Display driver (the learner-facing seam)

**Files:**
- Create: `thunk-sim/src/display.rs`
- Modify: `thunk-sim/src/lib.rs`, `thunk-sim/src/boot.rs`

- [ ] **Step 1: Write the failing tests** in `display.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::ili9341::Ili9341;
    use crate::spi::{Dc, SimSpi, TraceEvent};

    #[test]
    fn init_speaks_the_documented_sequence() {
        let mut bus = SimSpi::new();
        let mut d = Display::new(&mut bus, 240, 320);
        d.init();
        let t = bus.trace();
        assert_eq!(t.first(), Some(&TraceEvent::SelectLow));
        assert_eq!(t.last(), Some(&TraceEvent::SelectHigh));
        let bytes: Vec<(u8, Dc)> = t
            .iter()
            .filter_map(|e| match e {
                TraceEvent::Byte { value, dc } => Some((*value, *dc)),
                _ => None,
            })
            .collect();
        assert_eq!(
            bytes,
            vec![
                (0x01, Dc::Command), // SWRESET
                (0x11, Dc::Command), // SLPOUT
                (0x3A, Dc::Command), // COLMOD
                (0x55, Dc::Data),    // 16 bits per pixel
                (0x29, Dc::Command), // DISPON
            ]
        );
    }

    #[test]
    fn blit_draws_a_frame_through_the_protocol() {
        let mut bus = SimSpi::new();
        let mut d = Display::new(&mut bus, 240, 320);
        d.init();
        // a 2x2 frame in the top-left corner
        d.blit_rect(0, 0, 2, 2, &[0xF800, 0x07E0, 0x001F, 0xFFFF]);
        let mut panel = Ili9341::new(240, 320);
        panel.replay(bus.trace());
        assert!(panel.is_on());
        assert_eq!(panel.framebuffer().get_pixel(0, 0), 0xF800);
        assert_eq!(panel.framebuffer().get_pixel(1, 0), 0x07E0);
        assert_eq!(panel.framebuffer().get_pixel(0, 1), 0x001F);
        assert_eq!(panel.framebuffer().get_pixel(1, 1), 0xFFFF);
    }

    #[test]
    fn fill_covers_the_whole_panel() {
        let mut bus = SimSpi::new();
        let mut d = Display::new(&mut bus, 4, 4);
        d.init();
        d.fill(0xF800);
        let mut panel = Ili9341::new(4, 4);
        panel.replay(bus.trace());
        assert_eq!(panel.framebuffer().get_pixel(0, 0), 0xF800);
        assert_eq!(panel.framebuffer().get_pixel(3, 3), 0xF800);
    }
}
```

- [ ] **Step 2:** Run - COMPILE FAIL. Observe.
- [ ] **Step 3: Implement:**

```rust
//! The display driver a learner studies: it does nothing but speak the
//! protocol M4 teaches - init, set a window, stream pixels.

use crate::spi::{Dc, SpiBus};

const SWRESET: u8 = 0x01;
const SLPOUT: u8 = 0x11;
const DISPON: u8 = 0x29;
const CASET: u8 = 0x2A;
const PASET: u8 = 0x2B;
const RAMWR: u8 = 0x2C;
const COLMOD: u8 = 0x3A;
const COLMOD_16BPP: u8 = 0x55;

/// Drives an ILI9341-class panel over any `SpiBus`. On the inside build the
/// bus is simulated; on the open build the same code drives real wires.
pub struct Display<'b, B: SpiBus> {
    bus: &'b mut B,
    pub w: u16,
    pub h: u16,
}

impl<'b, B: SpiBus> Display<'b, B> {
    pub fn new(bus: &'b mut B, w: u16, h: u16) -> Self {
        Self { bus, w, h }
    }

    fn command(&mut self, c: u8) {
        self.bus.set_dc(Dc::Command);
        self.bus.write(&[c]);
    }
    fn data(&mut self, bytes: &[u8]) {
        self.bus.set_dc(Dc::Data);
        self.bus.write(bytes);
    }

    /// Wake the panel and set 16-bit color: the sequence M4 describes.
    pub fn init(&mut self) {
        self.bus.select();
        self.command(SWRESET);
        self.command(SLPOUT);
        self.command(COLMOD);
        self.data(&[COLMOD_16BPP]);
        self.command(DISPON);
        self.bus.deselect();
    }

    /// Aim: first and last column, first and last row, inclusive.
    fn set_window(&mut self, x0: u16, y0: u16, x1: u16, y1: u16) {
        self.command(CASET);
        self.data(&[(x0 >> 8) as u8, x0 as u8, (x1 >> 8) as u8, x1 as u8]);
        self.command(PASET);
        self.data(&[(y0 >> 8) as u8, y0 as u8, (y1 >> 8) as u8, y1 as u8]);
    }

    /// Write: RAMWR, then two bytes per pixel, high byte first.
    pub fn blit_rect(&mut self, x: u16, y: u16, w: u16, h: u16, pixels: &[u16]) {
        debug_assert_eq!(pixels.len(), w as usize * h as usize);
        self.bus.select();
        self.set_window(x, y, x + w - 1, y + h - 1);
        self.command(RAMWR);
        self.bus.set_dc(Dc::Data);
        for &px in pixels {
            self.bus.write(&[(px >> 8) as u8, px as u8]);
        }
        self.bus.deselect();
    }

    /// One color, edge to edge.
    pub fn fill(&mut self, color: u16) {
        let n = self.w as usize * self.h as usize;
        let frame = vec![color; n];
        self.blit_rect(0, 0, self.w, self.h, &frame);
    }
}
```

- [ ] **Step 4:** In `boot.rs`, add the protocol-path splash (keep `boot_splash` for direct
framebuffer use):

```rust
use crate::display::Display;

/// The splash drawn the honest way: init + one full-frame blit over the bus.
pub fn boot_splash_via_display(bus: &mut impl SpiBus, w: u16, h: u16) {
    let mut d = Display::new(bus, w, h);
    d.init();
    let frame: Vec<u16> = (0..h as usize)
        .flat_map(|_| (0..w as usize).map(|x| bar_color(x, w as usize)))
        .collect();
    d.blit_rect(0, 0, w, h, &frame);
}
```

with test:

```rust
#[test]
fn splash_via_display_reaches_the_panel_through_the_protocol() {
    let mut bus = SimSpi::new();
    boot_splash_via_display(&mut bus, 240, 320);
    let mut panel = Ili9341::new(240, 320);
    panel.replay(bus.trace());
    assert!(panel.is_on());
    assert_eq!(panel.framebuffer().get_pixel(0, 160), 0xF800);
    assert_ne!(
        panel.framebuffer().get_pixel(0, 160),
        panel.framebuffer().get_pixel(239, 160)
    );
    // the trace opens with a real init: select, then SWRESET as a command
    assert_eq!(bus.trace()[0], TraceEvent::SelectLow);
    assert_eq!(bus.trace()[1], TraceEvent::Byte { value: 0x01, dc: Dc::Command });
}
```

- [ ] **Step 5:** Exports in `lib.rs`: `pub mod display;` `pub use display::Display;`
`pub use boot::{boot_splash, boot_splash_via_display};`
- [ ] **Step 6:** `CARGO_NET_OFFLINE=true cargo test -p thunk-sim` PASS (all new + old);
workspace green; clippy clean.
- [ ] **Step 7: Commit:** `feat(sim): Display driver speaks init/window/RAMWR over the seam`

---

### Task 5: Consumers - CLI and TUI ride the protocol

**Files:**
- Modify: `thunk-cli/src/main.rs` (`sim` command)
- Modify: `thunk-tui/src/app.rs` and/or `thunk-tui/src/ui.rs` (panel scene source)

- [ ] **Step 1: Write the failing test** (thunk-cli):

```rust
#[test]
fn sim_output_mentions_the_protocol_traffic() {
    let s = sim();
    assert!(s.lines().count() > 20, "still renders the panel");
    assert!(s.contains("bus events"), "reports the trace size:\n{s}");
    assert!(s.contains("RAMWR"), "names the write command:\n{s}");
}
```

- [ ] **Step 2:** Run - FAIL (current `sim()` uses direct `boot_splash`).
- [ ] **Step 3: Implement** - `sim()` drives the protocol and reports it:

```rust
fn sim() -> String {
    let mut bus = SimSpi::new();
    boot_splash_via_display(&mut bus, 240, 320);
    let mut panel = Ili9341::new(240, 320);
    panel.replay(bus.trace());
    let events = bus.trace().len();
    format!(
        "simulated panel - boot splash drawn over the bus\n\
         {events} bus events: init (SWRESET, SLPOUT, COLMOD, DISPON), \
         window (CASET, PASET), then RAMWR + pixel data\n\n{}",
        panel.framebuffer().to_ascii(60, 24)
    )
}
```

(adjust imports: `use thunk_sim::{boot::boot_splash_via_display, Ili9341, SimSpi};` - drop unused
`boot_splash`/`Panel` imports if nothing else uses them.)

- [ ] **Step 4:** TUI panel scene: find where `boot_splash` fills the panel (thunk-tui/src/app.rs)
and switch it to the same drive-then-replay shape, storing the `Ili9341` (or its framebuffer) in
app state. Keep the scene's rendering untouched - it reads pixels the same way. Keep the change
minimal; the TUI's trace *view* is milestone M-E, not this task.
- [ ] **Step 5:** `CARGO_NET_OFFLINE=true cargo test --workspace` green;
`cargo run -q -p thunk-cli -- sim` eyeball: color bars + the trace summary line. Include the output
in your report.
- [ ] **Step 6: Commit:** `feat(cli,tui): sim path drives the panel through the real protocol`

---

### Task 6: Sweep + roadmap annotation

- [ ] **Step 1:** `cargo fmt --all`; `CARGO_NET_OFFLINE=true cargo clippy --workspace
--all-targets -- -D warnings`; `CARGO_NET_OFFLINE=true cargo test --workspace`;
`./scripts/vocab-lint.sh`. All green/clean.
- [ ] **Step 2:** Annotate M-C in `docs/superpowers/plans/2026-07-10-thunk-buildout.md` as
**Status: DONE 2026-07-12** with one line of substance (decoder commands modeled, driver, consumers).
- [ ] **Step 3: Commit:** `chore(mC): verification sweep - protocol simulator complete`

---

## Self-Review notes

- **Spec coverage vs the M-C milestone:** ILI9341 command set over SPI with DC (Tasks 1-2), init
  sequence + windows + RAMWR + RGB565 writes (Tasks 2-3), panel decodes the byte stream rather
  than exposing a direct pixel API (Task 2's `receive`/`replay`; `Panel::set_pixel` survives only
  as the decoder's internal storage primitive), learner-facing `Display` performing init + drawing
  a framebuffer by speaking the protocol (Task 4), deterministic byte-stream-in/state-out tests
  throughout, trace records the real protocol traffic (Task 1 + Task 4's trace assertions,
  consumed by the CLI in Task 5). No randomness anywhere, so no seed machinery needed.
- **Type consistency:** `Dc`/`TraceEvent` defined once in Task 1 and consumed by Tasks 2-5 with
  the same shapes; `Ili9341::replay(&[TraceEvent])` (Task 2) is the bridge used by Tasks 4-5;
  `Display::new(&mut bus, w, h)` signature consistent across Tasks 4-5.
- **Content consistency:** window params big-endian first/last inclusive, RAMWR resets the cursor,
  two bytes per pixel high byte first, DISPON/DISPOFF - all match what M3/M4 lessons teach,
  including the 0x2A/0x2B encoding M4 added in review.
- **No placeholders:** every task carries complete code and exact commands.
