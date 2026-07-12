# thunk M-D: The Finale on the Simulated Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The inside-build finale: a deterministic, software-rendered, animated corridor scene that
reaches the simulated panel the honest way (through the `Display` driver over the bus), animating
in the TUI's panel scene and booting from `thunk sim`. Per Penn's decision (2026-07-12), this
review-safe rendered scene IS the inside build's finale; playable DOOM belongs to the open build
(milestone M-G territory).

**Architecture:** A pure frame source (`finale::frame(w, h, t) -> Vec<u16>`: one-point-perspective
corridor, integer math only, no randomness) is composed with the M-C protocol stack: init once,
then one `blit_rect` per frame. Two pieces of bus plumbing inherited from the M-C review make
animation viable: `SimSpi::take_trace()` (drain, so per-frame traces don't accumulate) and a
blanket `impl SpiBus for &mut B` (so `Display` can be constructed per frame over a borrowed bus
without lifetime fights). The TUI gains one action (`Tick`) and animates only while the panel
scene is showing. Review-safety: the scene is described everywhere as a rendered corridor,
perspective and shading; no game vocabulary.

**Tech Stack:** Rust 1.88, zero new dependencies. All integer math; deterministic per (w, h, t).

---

## File Structure

```
thunk-sim/src/
  spi.rs        # MODIFY: take_trace(); blanket impl SpiBus for &mut B
  finale.rs     # NEW: frame() renderer + boot_finale()/finale_tick() over the bus
  lib.rs        # exports
thunk-cli/src/main.rs   # MODIFY: `thunk sim` boots the finale; `--splash` keeps the bars
thunk-tui/src/app.rs    # MODIFY: Action::Tick, bus+frame state, incremental replay
thunk-tui/src/lib.rs    # MODIFY: poll timeout -> Tick while panel scene is active
```

---

### Task 1: Bus plumbing - take_trace() and the &mut blanket impl

**Files:**
- Modify: `thunk-sim/src/spi.rs`

- [ ] **Step 1: Write the failing tests** (append to spi.rs tests):

```rust
#[test]
fn take_trace_drains_the_recorder() {
    let mut bus = SimSpi::new();
    bus.select();
    bus.set_dc(Dc::Data);
    bus.write(&[0x01]);
    let first = bus.take_trace();
    assert_eq!(first.len(), 2); // SelectLow + one byte
    assert!(bus.trace().is_empty(), "drained");
    bus.write(&[0x02]);
    assert_eq!(bus.take_trace().len(), 1, "select state survives the drain");
}

#[test]
fn a_mutable_reference_is_also_a_bus() {
    fn drive(bus: impl SpiBus) {
        let mut bus = bus;
        bus.select();
        bus.set_dc(Dc::Command);
        bus.write(&[0x2C]);
        bus.deselect();
    }
    let mut bus = SimSpi::new();
    drive(&mut bus); // compiles only with the blanket impl
    assert_eq!(bus.trace().len(), 3);
}
```

- [ ] **Step 2:** `CARGO_NET_OFFLINE=true cargo test -p thunk-sim` - COMPILE FAIL. Observe.
- [ ] **Step 3: Implement** in spi.rs:

```rust
impl SimSpi {
    /// Take everything recorded so far, leaving the recorder empty but the
    /// line state (select, DC) intact. Animation drains per frame.
    pub fn take_trace(&mut self) -> Vec<TraceEvent> {
        std::mem::take(&mut self.trace)
    }
}

/// A `&mut B` speaks the bus protocol too, so a `Display` can be built over a
/// borrowed bus for one frame and dropped without taking the bus with it.
impl<B: SpiBus + ?Sized> SpiBus for &mut B {
    fn select(&mut self) {
        (**self).select()
    }
    fn deselect(&mut self) {
        (**self).deselect()
    }
    fn set_dc(&mut self, dc: Dc) {
        (**self).set_dc(dc)
    }
    fn write(&mut self, bytes: &[u8]) {
        (**self).write(bytes)
    }
}
```

- [ ] **Step 4:** Tests PASS; workspace green. **Step 5: Commit:**
`feat(sim): take_trace drain + &mut blanket impl for animation`

---

### Task 2: The frame source - a corridor in integer math

**Files:**
- Create: `thunk-sim/src/finale.rs`
- Modify: `thunk-sim/src/lib.rs` (`pub mod finale;`)

- [ ] **Step 1: Write the failing tests** in finale.rs:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_are_deterministic() {
        assert_eq!(frame(240, 320, 7), frame(240, 320, 7));
    }

    #[test]
    fn frames_change_over_time() {
        assert_ne!(frame(240, 320, 0), frame(240, 320, 1));
    }

    #[test]
    fn frame_has_one_pixel_per_cell() {
        assert_eq!(frame(240, 320, 0).len(), 240 * 320);
    }

    #[test]
    fn the_corridor_recedes_toward_the_center() {
        // perspective: the vanishing point is darker than the near edge
        let f = frame(240, 320, 0);
        let center = f[160 * 240 + 120];
        let edge = f[160 * 240 + 2];
        assert!(luma(edge) > luma(center), "edge {edge:#06x} vs center {center:#06x}");
    }

    fn luma(c: u16) -> u32 {
        let r = ((c >> 11) & 0x1f) as u32;
        let g = ((c >> 5) & 0x3f) as u32;
        let b = (c & 0x1f) as u32;
        r * 2 + g + b * 2 // channel-width-adjusted, good enough to compare
    }
}
```

- [ ] **Step 2:** COMPILE FAIL. Observe.
- [ ] **Step 3: Implement:**

```rust
//! The finale's frame source: a one-point-perspective corridor, rendered in
//! pure integer math. Deterministic: the same (w, h, t) is the same frame.
//!
//! This is the inside build's finale: a scene the learner's own driver can
//! push down the bus, frame after frame. (The open build points the same
//! interface at heavier programs; see the roadmap.)

/// Render frame `t` of the corridor as RGB565, row-major, `w * h` pixels.
pub fn frame(w: u16, h: u16, t: u32) -> Vec<u16> {
    let (w, h) = (w as i32, h as i32);
    let (cx, cy) = (w / 2, h / 2);
    let mut out = Vec::with_capacity((w * h) as usize);
    for y in 0..h {
        for x in 0..w {
            let dx = (x - cx).abs().max(1);
            let dy = (y - cy).abs().max(1);
            // How far out toward the frame edge this ray exits, 1..=256.
            let nx = dx * 256 / cx.max(1);
            let ny = dy * 256 / cy.max(1);
            let m = nx.max(ny).clamp(1, 256);
            // Perspective depth: far (center) is large, near (edge) is small.
            let depth = (256 * 32 / m).clamp(1, 4096);
            // Bands travel toward the viewer as t grows.
            let band = ((depth as u32 + t * 4) / 32) % 2;
            // Brightness falls off with depth; bands modulate it.
            let mut shade = (31 - (depth / 140).min(28)) as u16;
            if band == 0 {
                shade = shade.saturating_sub(6);
            }
            // Walls read warm, floor and ceiling read cool: which boundary
            // does the ray hit first?
            let color = if nx >= ny {
                // wall: amber - red full, green scaled, little blue
                (shade << 11) | ((shade * 3 / 2).min(63) << 5) | (shade >> 3)
            } else {
                // floor/ceiling: gray-blue
                ((shade * 3 / 4) << 11) | ((shade * 3 / 2).min(63) << 5) | shade
            };
            out.push(color);
        }
    }
    out
}
```

- [ ] **Step 4:** Tests PASS. If `the_corridor_recedes_toward_the_center` fails, fix the shading
math (depth falloff), not the test. Eyeball it before committing:
add nothing to the CLI yet, but run a scratch check via a unit test or
`cargo test -p thunk-sim -- --nocapture` printing `Panel`-rendered ASCII if you need to look.
The scene must read as a corridor (bright near edges, dark center, visible bands).
- [ ] **Step 5: Commit:** `feat(sim): finale frame source - integer-math corridor`

---

### Task 3: The finale reaches the panel over the bus

**Files:**
- Modify: `thunk-sim/src/finale.rs`, `thunk-sim/src/lib.rs`

- [ ] **Step 1: Write the failing tests:**

```rust
#[test]
fn boot_finale_initializes_and_draws_frame_zero() {
    use crate::ili9341::Ili9341;
    use crate::spi::SimSpi;
    let mut bus = SimSpi::new();
    boot_finale(&mut bus, 240, 320);
    let mut panel = Ili9341::new(240, 320);
    panel.replay(bus.trace());
    assert!(panel.is_on());
    let expected = frame(240, 320, 0);
    assert_eq!(panel.framebuffer().get_pixel(0, 160), expected[160 * 240]);
    assert_eq!(panel.framebuffer().get_pixel(120, 160), expected[160 * 240 + 120]);
}

#[test]
fn ticks_animate_the_panel_incrementally() {
    use crate::ili9341::Ili9341;
    use crate::spi::SimSpi;
    let mut bus = SimSpi::new();
    let mut panel = Ili9341::new(240, 320);
    boot_finale(&mut bus, 240, 320);
    panel.replay(&bus.take_trace());
    let before = panel.framebuffer().get_pixel(4, 160);
    finale_tick(&mut bus, 240, 320, 3);
    panel.replay(&bus.take_trace()); // only the new frame's events
    let expected = frame(240, 320, 3);
    assert_eq!(panel.framebuffer().get_pixel(4, 160), expected[160 * 240 + 4]);
    let _ = before; // frames 0 and 3 may or may not differ at one pixel; the
                    // equality against the frame source is the real assertion
}
```

- [ ] **Step 2:** COMPILE FAIL. Observe.
- [ ] **Step 3: Implement** (in finale.rs):

```rust
use crate::display::Display;
use crate::spi::SpiBus;

/// Init the panel and draw frame zero: the finale boots.
pub fn boot_finale(bus: &mut impl SpiBus, w: u16, h: u16) {
    let mut d = Display::new(bus, w, h);
    d.init();
    d.blit_rect(0, 0, w, h, &frame(w, h, 0));
}

/// Draw frame `t`. The panel is already initialized; this is one animation step.
pub fn finale_tick(bus: &mut impl SpiBus, w: u16, h: u16, t: u32) {
    let mut d = Display::new(bus, w, h);
    d.blit_rect(0, 0, w, h, &frame(w, h, t));
}
```

(The blanket `&mut B` impl from Task 1 is what lets `Display::new(bus, ...)` take the borrow.)

- [ ] **Step 4:** Tests PASS; export `pub use finale::{boot_finale, finale_tick};` alongside
`pub mod finale;`. Workspace green; clippy clean.
- [ ] **Step 5: Commit:** `feat(sim): finale boots and ticks through the protocol`

---

### Task 4: `thunk sim` boots the finale

**Files:**
- Modify: `thunk-cli/src/main.rs`

- [ ] **Step 1: Write the failing tests** (replace `sim_output_mentions_the_protocol_traffic`):

```rust
#[test]
fn sim_boots_the_finale_by_default() {
    let s = sim(false);
    assert!(s.lines().count() > 20);
    assert!(s.contains("finale"), "names the scene:\n{s}");
    assert!(s.contains("bus events"), "reports the traffic:\n{s}");
}

#[test]
fn sim_splash_flag_keeps_the_color_bars() {
    let s = sim(true);
    assert!(s.contains("color bars"), "splash still available:\n{s}");
}
```

- [ ] **Step 2:** FAIL (sim takes no argument). Observe.
- [ ] **Step 3: Implement:** subcommand becomes `Sim { /// Show the boot splash (color bars) instead of the finale. #[arg(long)] splash: bool }`;
`sim(splash: bool)` drives `boot_splash_via_display` or `boot_finale` accordingly, replays into an
`Ili9341`, and formats:

```rust
fn sim(splash: bool) -> String {
    let mut bus = SimSpi::new();
    let what = if splash {
        boot_splash_via_display(&mut bus, 240, 320);
        "boot splash (color bars)"
    } else {
        boot_finale(&mut bus, 240, 320);
        "the finale: a rendered corridor, drawn by the display driver"
    };
    let mut panel = Ili9341::new(240, 320);
    panel.replay(bus.trace());
    let events = bus.trace().len();
    format!(
        "simulated panel - {what}\n\
         {events} bus events: init (SWRESET, SLPOUT, COLMOD, DISPON), \
         window (CASET, PASET), then RAMWR + pixel data\n\n{}",
        panel.framebuffer().to_ascii(60, 24)
    )
}
```

- [ ] **Step 4:** `CARGO_NET_OFFLINE=true cargo test -p thunk-cli` PASS; workspace green. Eyeball
both: `cargo run -q -p thunk-cli -- sim` (corridor: bright edges, dark vanishing point, bands) and
`cargo run -q -p thunk-cli -- sim --splash` (bars). Include both outputs in the report.
- [ ] **Step 5: Commit:** `feat(cli): thunk sim boots the finale; --splash keeps the bars`

---

### Task 5: The TUI panel scene animates

**Files:**
- Modify: `thunk-tui/src/app.rs`, `thunk-tui/src/lib.rs`

- [ ] **Step 1: Write the failing tests** (app.rs):

```rust
#[test]
fn ticks_animate_the_panel_scene() {
    let mut app = App::new();
    app.update(Action::OpenPanel);
    let before: Vec<u16> = (0..240).map(|x| app.panel.framebuffer().get_pixel(x, 160)).collect();
    for _ in 0..8 {
        app.update(Action::Tick);
    }
    let after: Vec<u16> = (0..240).map(|x| app.panel.framebuffer().get_pixel(x, 160)).collect();
    assert_ne!(before, after, "the corridor bands moved");
}

#[test]
fn ticks_outside_the_panel_scene_do_nothing() {
    let mut app = App::new();
    let frame_before = app.frame_t;
    app.update(Action::Tick); // Reader scene
    assert_eq!(app.frame_t, frame_before);
}
```

- [ ] **Step 2:** COMPILE FAIL (`Action::Tick`, `frame_t`). Observe.
- [ ] **Step 3: Implement:**
  - `App` gains `pub bus: SimSpi` and `pub frame_t: u32`. `App::new()` boots the finale instead of
    the splash: `boot_finale(&mut bus, 240, 320)`, replay via `panel.replay(&bus.take_trace())`,
    store the bus.
  - `Action::Tick` handler: only when `self.scene == Scene::Panel`: `self.frame_t += 1;
    finale_tick(&mut self.bus, 240, 320, self.frame_t); self.panel.replay(&self.bus.take_trace());`
  - Fix `panel_is_decoded_from_the_bus_trace`: the splash's red-bar assertion no longer holds;
    assert instead that the panel `is_on()` and that its framebuffer equals the finale's frame 0 at
    two sample pixels (import `thunk_sim::finale::frame`).
  - `thunk-tui/src/lib.rs` event loop: switch `event::read()` to `event::poll(Duration::from_millis(60))?`
    + read when true; when poll times out, send `Action::Tick`. Read the existing loop first and
    keep the change minimal (the key mapping stays as is).
- [ ] **Step 4:** `CARGO_NET_OFFLINE=true cargo test --workspace` green; clippy clean. Manual
sanity if a TTY is available: `cargo run -q -p thunk-cli -- tui`, press `s` for the panel; the
corridor should visibly animate; `q` quits. If no TTY, note it and rely on the state tests.
- [ ] **Step 5: Commit:** `feat(tui): the panel scene animates the finale`

---

### Task 6: Sweep + roadmap annotation

- [ ] **Step 1:** `cargo fmt --all`; clippy `-D warnings`; full workspace tests; vocab-lint. Green.
- [ ] **Step 2:** Annotate M-D in `docs/superpowers/plans/2026-07-10-thunk-buildout.md`:
**Status: DONE 2026-07-12** + one substantive line (corridor finale, animation plumbing, CLI/TUI).
Note explicitly: open-build DOOM remains with M-G as decided.
- [ ] **Step 3: Commit:** `chore(mD): verification sweep - the finale boots on the sim panel`

---

## Self-Review notes

- **Spec coverage vs M-D:** deterministic frame source (Task 2: pure, integer, tested for
  determinism/variation/perspective), frames reach the panel over the bus (Task 3: replay
  equality against the frame source), `thunk sim` boots the finale (Task 4), inside build ships
  the non-game version (the corridor IS the finale; DOOM stays on the open build - stated in the
  plan header and the roadmap annotation). Animation plumbing (Task 1) implements both design
  notes inherited from the M-C review.
- **Type consistency:** `frame(w: u16, h: u16, t: u32) -> Vec<u16>` used identically in Tasks 2-5;
  `boot_finale`/`finale_tick(bus: &mut impl SpiBus, w, h, t)` consistent; `App.frame_t: u32`
  matches `t`.
- **Review-safety:** "corridor", "scene", "finale" throughout; no game/violence vocabulary
  anywhere including code comments; vocab-lint gates it as always.
- **No placeholders:** complete code in every step.
