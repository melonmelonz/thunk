//! thunk-wasm: the live bench for the public course site.
//!
//! A thin wasm-bindgen wrapper over `thunk-sim`. It owns the simulated SPI bus,
//! the ILI9341 panel model, a frame counter, and one fixed RGBA buffer. Each
//! `boot()`/`tick()` drives the real driver, replays the resulting bus trace
//! into the panel, and converts the RGB565 framebuffer into the RGBA buffer the
//! browser blits with `putImageData`. The trace crosses the JS boundary as flat
//! typed arrays plus one newline-joined string - never per-event serde.
//!
//! The pure parts (RGB565 -> RGBA conversion, trace-row encoding) are ordinary
//! functions, unit-tested natively: `cargo test` here needs no wasm toolchain
//! because this crate is excluded from the workspace and carries only
//! wasm-bindgen, which compiles on the host target.

use thunk_sim::trace::{annotate, waveform};
use thunk_sim::{boot_finale, finale_tick, Ili9341, SimSpi, TraceEvent};
use wasm_bindgen::prelude::*;

/// The animation rate the JS rAF loop targets. The sim is 60fps-capable; 30
/// reads more like a CRT and halves the per-frame sim/convert cost. Exported as
/// a function (wasm-bindgen cannot export bare consts) so the page and the
/// crate agree on one number.
pub const TARGET_FPS: u32 = 30;

#[wasm_bindgen]
pub fn target_fps() -> u32 {
    TARGET_FPS
}

/// Row-kind codes in the flat trace encoding (`kinds` array). Documented here
/// and mirrored by the JS decoder: 0 command, 1 data run, 2 select edge.
const KIND_CMD: u8 = 0;
const KIND_DATA: u8 = 1;
const KIND_SELECT: u8 = 2;

/// Classify an annotated row by its leading token. `annotate()` emits exactly
/// three shapes: "select ...", "cmd  XX ...", "data XX ...".
fn row_kind(row: &str) -> u8 {
    if row.starts_with("select") {
        KIND_SELECT
    } else if row.starts_with("cmd") {
        KIND_CMD
    } else {
        KIND_DATA
    }
}

/// The first hex byte an annotated row carries, or `None` for select edges.
/// `cmd` and `data` rows both spell their first byte as a two-hex-digit token;
/// this parses it so a clicked row can be handed to `waveform()`. Using the
/// rendered text (annotate's own output) keeps this from drifting from the
/// formatter. Returns -1 for "no byte" in the flat `bytes` array.
fn row_first_byte(row: &str) -> i16 {
    // Skip the leading label word and its spaces, take the next token.
    let token = row
        .split_whitespace()
        .nth(1)
        .filter(|_| !row.starts_with("select"));
    match token.and_then(|t| u8::from_str_radix(t, 16).ok()) {
        Some(b) => b as i16,
        None => -1,
    }
}

/// Convert an RGB565 framebuffer (row-major `w*h` pixels) into RGBA8888 in
/// `out` (which must be `w*h*4` bytes). Channels are bit-replicated so full
/// 5/6/5 maps to full 0xFF, not 0xF8/0xFC. Alpha is opaque. Pure and hot: one
/// tight loop, done in Rust per the research note rather than in JS.
fn rgb565_to_rgba(src: &[u16], out: &mut [u8]) {
    debug_assert_eq!(out.len(), src.len() * 4);
    for (px, chunk) in src.iter().zip(out.chunks_exact_mut(4)) {
        let c = *px;
        let r5 = ((c >> 11) & 0x1f) as u8;
        let g6 = ((c >> 5) & 0x3f) as u8;
        let b5 = (c & 0x1f) as u8;
        chunk[0] = (r5 << 3) | (r5 >> 2);
        chunk[1] = (g6 << 2) | (g6 >> 4);
        chunk[2] = (b5 << 3) | (b5 >> 2);
        chunk[3] = 0xff;
    }
}

/// The annotated trace of one boot or tick, encoded flat for JS: parallel
/// `kinds`/`bytes` arrays plus every row's text newline-joined into one string.
/// JS splits `text` on '\n' and reads `kinds[i]`/`bytes[i]` per row. `bytes[i]`
/// is -1 when the row has no backing byte (a select edge).
#[wasm_bindgen]
pub struct TraceRows {
    kinds: Vec<u8>,
    bytes: Vec<i16>,
    text: String,
}

/// Build a `TraceRows` from a recorded bus trace via `annotate()`.
fn encode_rows(events: &[TraceEvent]) -> TraceRows {
    let rows = annotate(events);
    let mut kinds = Vec::with_capacity(rows.len());
    let mut bytes = Vec::with_capacity(rows.len());
    for row in &rows {
        kinds.push(row_kind(row));
        bytes.push(row_first_byte(row));
    }
    TraceRows {
        kinds,
        bytes,
        text: rows.join("\n"),
    }
}

#[wasm_bindgen]
impl TraceRows {
    /// One byte per row: 0 command, 1 data run, 2 select edge.
    #[wasm_bindgen(getter)]
    pub fn kinds(&self) -> Vec<u8> {
        self.kinds.clone()
    }
    /// One entry per row: the row's first byte, or -1 for a select edge.
    #[wasm_bindgen(getter)]
    pub fn bytes(&self) -> Vec<i16> {
        self.bytes.clone()
    }
    /// Every row's text, newline-joined. Split on '\n' in JS.
    #[wasm_bindgen(getter)]
    pub fn text(&self) -> String {
        self.text.clone()
    }
    /// Row count (== lines in `text`, == `kinds.len()`).
    #[wasm_bindgen(getter)]
    pub fn len(&self) -> usize {
        self.kinds.len()
    }
    #[wasm_bindgen(getter)]
    pub fn is_empty(&self) -> bool {
        self.kinds.is_empty()
    }
}

/// The live bench: a simulated bus, a panel, a frame counter, and one RGBA
/// buffer. Owned by JS for the lifetime of the `/bench` page.
#[wasm_bindgen]
pub struct Bench {
    spi: SimSpi,
    panel: Ili9341,
    w: u16,
    h: u16,
    frame: u32,
    booted: bool,
    boot_events: u32,
    rgba: Vec<u8>,
}

#[wasm_bindgen]
impl Bench {
    /// A panel of `w x h` pixels (240x320 for the finale). Allocates the RGBA
    /// buffer once, up front, so wasm memory never grows mid-run and the JS
    /// view over it stays valid.
    #[wasm_bindgen(constructor)]
    pub fn new(w: u16, h: u16) -> Bench {
        let (wu, hu) = (w as usize, h as usize);
        Bench {
            spi: SimSpi::new(),
            panel: Ili9341::new(wu, hu),
            w,
            h,
            frame: 0,
            booted: false,
            boot_events: 0,
            rgba: vec![0u8; wu * hu * 4],
        }
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u16 {
        self.w
    }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u16 {
        self.h
    }
    /// The current frame index (0 after boot, then 1, 2, ...).
    #[wasm_bindgen(getter)]
    pub fn frame(&self) -> u32 {
        self.frame
    }
    /// The raw bus-event count of the last boot (select edges + every byte,
    /// before annotation folds the pixel run). The real number the finale's
    /// bring-up puts on the wires - the bench's headline stat.
    #[wasm_bindgen(getter)]
    pub fn boot_events(&self) -> u32 {
        self.boot_events
    }

    /// Power on: run the finale's boot + frame zero, replay the bus into the
    /// panel, paint the RGBA buffer. Returns the boot trace as `TraceRows` -
    /// the same encoding `tick()`'s rows use. Idempotent-ish: calling it again
    /// re-boots from a fresh bus and panel.
    pub fn boot(&mut self) -> TraceRows {
        self.spi = SimSpi::new();
        self.panel = Ili9341::new(self.w as usize, self.h as usize);
        self.frame = 0;
        boot_finale(&mut self.spi, self.w, self.h);
        let trace = self.spi.take_trace();
        self.boot_events = trace.len() as u32;
        self.panel.replay(&trace);
        self.paint();
        self.booted = true;
        encode_rows(&trace)
    }

    /// One animation step: draw the next frame, replay just its drained trace
    /// into the panel, repaint. Returns the tick's `TraceRows` so the log can
    /// append them. A no-op returning empty rows if `boot()` has not run.
    pub fn tick(&mut self) -> TraceRows {
        if !self.booted {
            return TraceRows {
                kinds: Vec::new(),
                bytes: Vec::new(),
                text: String::new(),
            };
        }
        self.frame = self.frame.wrapping_add(1);
        finale_tick(&mut self.spi, self.w, self.h, self.frame);
        let trace = self.spi.take_trace();
        self.panel.replay(&trace);
        self.paint();
        encode_rows(&trace)
    }

    /// Convert the panel framebuffer into the RGBA buffer.
    fn paint(&mut self) {
        let fb = self.panel.framebuffer();
        // Pull the framebuffer row-major into a scratch vec of RGB565, then
        // convert in one pass. `get_pixel` is the only accessor Panel exposes.
        let (w, h) = (self.w as usize, self.h as usize);
        let mut src = Vec::with_capacity(w * h);
        for y in 0..h {
            for x in 0..w {
                src.push(fb.get_pixel(x, y));
            }
        }
        rgb565_to_rgba(&src, &mut self.rgba);
    }

    /// Pointer to the RGBA buffer inside wasm memory. JS builds a
    /// `Uint8ClampedArray(memory.buffer, frame_ptr(), frame_len())` view and a
    /// reused `ImageData`. The buffer is allocated once in `new()` and never
    /// resized, so the pointer is stable; rebuild the view from `memory.buffer`
    /// each frame anyway, since any wasm memory growth detaches old views.
    #[wasm_bindgen]
    pub fn frame_ptr(&self) -> *const u8 {
        self.rgba.as_ptr()
    }
    /// Length of the RGBA buffer in bytes (`w * h * 4`).
    #[wasm_bindgen]
    pub fn frame_len(&self) -> usize {
        self.rgba.len()
    }

    /// The three-line M3 waveform diagram for a byte (bit / clk / data),
    /// newline-joined. JS splits on '\n' for the detail well.
    #[wasm_bindgen]
    pub fn waveform(&self, byte: u8) -> String {
        waveform(byte).join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use thunk_sim::spi::{Dc, SpiBus};

    #[test]
    fn rgb565_primaries_bit_replicate_to_full_range() {
        // Full red, green, blue, white, black.
        let src = [0xF800u16, 0x07E0, 0x001F, 0xFFFF, 0x0000];
        let mut out = vec![0u8; src.len() * 4];
        rgb565_to_rgba(&src, &mut out);
        assert_eq!(&out[0..4], &[0xFF, 0x00, 0x00, 0xFF]); // red
        assert_eq!(&out[4..8], &[0x00, 0xFF, 0x00, 0xFF]); // green
        assert_eq!(&out[8..12], &[0x00, 0x00, 0xFF, 0xFF]); // blue
        assert_eq!(&out[12..16], &[0xFF, 0xFF, 0xFF, 0xFF]); // white
        assert_eq!(&out[16..20], &[0x00, 0x00, 0x00, 0xFF]); // black, opaque
    }

    #[test]
    fn rgb565_mid_values_replicate_low_bits() {
        // A mid grey: r=0x10 (10000), g=0x20 (100000), b=0x10.
        let c = (0x10u16 << 11) | (0x20u16 << 5) | 0x10u16;
        let mut out = [0u8; 4];
        rgb565_to_rgba(&[c], &mut out);
        // r5=0x10 -> (0x10<<3)|(0x10>>2) = 0x80|0x04 = 0x84
        assert_eq!(out[0], 0x84);
        // g6=0x20 -> (0x20<<2)|(0x20>>4) = 0x80|0x02 = 0x82
        assert_eq!(out[1], 0x82);
        assert_eq!(out[2], 0x84);
        assert_eq!(out[3], 0xFF);
    }

    #[test]
    fn boot_paints_a_non_black_panel() {
        let mut b = Bench::new(240, 320);
        let rows = b.boot();
        assert!(rows.len() > 0);
        assert_eq!(b.frame(), 0);
        // The finale's frame zero is not all black.
        assert!(b.rgba.chunks_exact(4).any(|p| p[0] | p[1] | p[2] != 0));
    }

    #[test]
    fn boot_events_counts_the_real_bringup_traffic() {
        let mut b = Bench::new(240, 320);
        b.boot();
        // init (7 events) + one full-frame blit (SelectLow, CASET+4, PASET+4,
        // RAMWR + 240*320 pixels * 2 bytes, SelectHigh) = 153,620.
        assert_eq!(b.boot_events(), 153_620);
    }

    #[test]
    fn tick_advances_the_frame_counter() {
        let mut b = Bench::new(240, 320);
        b.boot();
        b.tick();
        assert_eq!(b.frame(), 1);
        b.tick();
        assert_eq!(b.frame(), 2);
    }

    #[test]
    fn tick_before_boot_is_empty_and_inert() {
        let mut b = Bench::new(240, 320);
        let rows = b.tick();
        assert!(rows.is_empty());
        assert_eq!(b.frame(), 0);
    }

    #[test]
    fn boot_rows_classify_and_carry_bytes() {
        let mut b = Bench::new(240, 320);
        let rows = b.boot();
        let text = rows.text();
        let lines: Vec<&str> = text.split('\n').collect();
        assert_eq!(lines.len(), rows.len());
        // First row is the opening select edge: kind 2, no byte.
        assert_eq!(rows.kinds[0], KIND_SELECT);
        assert_eq!(rows.bytes[0], -1);
        // A CASET command row must appear with its byte 0x2A decoded.
        let caset = lines
            .iter()
            .position(|l| l.contains("CASET"))
            .expect("boot trace names CASET");
        assert_eq!(rows.kinds[caset], KIND_CMD);
        assert_eq!(rows.bytes[caset], 0x2A);
    }

    #[test]
    fn encode_roundtrips_a_known_trace() {
        let mut bus = SimSpi::new();
        bus.select();
        bus.set_dc(Dc::Command);
        bus.write(&[0x2C]); // RAMWR
        bus.set_dc(Dc::Data);
        bus.write(&[0xF8, 0x00, 0x07, 0xE0]);
        bus.deselect();
        let rows = encode_rows(bus.trace());
        let lines: Vec<&str> = rows.text.split('\n').collect();
        assert_eq!(lines, ["select v  (transaction begins)", "cmd  2C  RAMWR  (pixel stream follows)", "data F8 00 07 E0", "select ^  (transaction ends)"]);
        assert_eq!(rows.kinds, [KIND_SELECT, KIND_CMD, KIND_DATA, KIND_SELECT]);
        assert_eq!(rows.bytes, [-1, 0x2C, 0xF8, -1]);
    }

    #[test]
    fn waveform_is_three_newline_joined_rows() {
        let b = Bench::new(240, 320);
        let w = b.waveform(0x2C);
        assert_eq!(w.split('\n').count(), 3);
        assert!(w.starts_with("bit"));
    }

    #[test]
    fn frame_buffer_is_sized_and_stable() {
        let b = Bench::new(240, 320);
        assert_eq!(b.frame_len(), 240 * 320 * 4);
        let p1 = b.frame_ptr();
        let p2 = b.frame_ptr();
        assert_eq!(p1, p2, "pointer is stable across calls");
    }
}
