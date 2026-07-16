//! An ILI9341-class panel model: builds framebuffer state by decoding the
//! command/data byte stream, exactly as the course teaches the protocol.

use crate::panel::Panel;
use crate::spi::{Dc, TraceEvent};
// The command byte values live in one table, owned by `trace`; the decoder
// and the trace formatter can never drift apart.
use crate::trace::{CASET, COLMOD, DISPOFF, DISPON, PASET, RAMWR, SLPOUT, SWRESET};

/// What the panel is currently collecting data bytes for.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Expecting {
    Nothing,
    WindowParams {
        cmd: u8,
        bytes: [u8; 4],
        count: usize,
    },
    PixelFormat,
    Pixels {
        high: Option<u8>,
    },
}

pub struct Ili9341 {
    fb: Panel,
    expecting: Expecting,
    col: (u16, u16),
    page: (u16, u16),
    cursor: (u16, u16),
    pixel_format: u8,
    awake: bool,
    on: bool,
}

impl Ili9341 {
    pub fn new(w: usize, h: usize) -> Self {
        assert!(w > 0 && h > 0, "panel dimensions must be nonzero");
        let mut p = Self {
            fb: Panel::new(w, h),
            expecting: Expecting::Nothing,
            col: (0, 0),
            page: (0, 0),
            cursor: (0, 0),
            pixel_format: 0x55,
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
        self.pixel_format = 0x55;
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
    /// The COLMOD format byte last written (0x55 = 16 bpp, the reset default).
    pub fn pixel_format(&self) -> u8 {
        self.pixel_format
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
                self.expecting = Expecting::WindowParams {
                    cmd: c,
                    bytes: [0; 4],
                    count: 0,
                }
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
            Expecting::Nothing => {
                // Stray data with no command is discarded, as real silicon does.
            }
            Expecting::PixelFormat => {
                // COLMOD's parameter: remember the format byte (0x55 = 16 bpp
                // is the only mode the pixel path models, but we store any).
                self.pixel_format = b;
                self.expecting = Expecting::Nothing;
            }
            Expecting::WindowParams {
                cmd,
                mut bytes,
                count,
            } => {
                bytes[count] = b;
                if count == 3 {
                    let start = u16::from_be_bytes([bytes[0], bytes[1]]);
                    let end = u16::from_be_bytes([bytes[2], bytes[3]]);
                    if cmd == CASET {
                        self.col = (start, end);
                    } else {
                        self.page = (start, end);
                    }
                    self.cursor = (self.col.0, self.page.0);
                    self.expecting = Expecting::Nothing;
                } else {
                    self.expecting = Expecting::WindowParams {
                        cmd,
                        bytes,
                        count: count + 1,
                    };
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
    fn a_dangling_high_byte_is_discarded_by_the_next_command() {
        let mut p = Ili9341::new(240, 320);
        cmd(&mut p, 0x2C); // RAMWR
        data(&mut p, &[0xF8]); // odd byte count: a pixel left half-arrived
        cmd(&mut p, 0x28); // DISPOFF: the dangling high byte dies here
        cmd(&mut p, 0x2C); // RAMWR again, cursor back to window start
        data(&mut p, &[0x07, 0xE0]);
        assert_eq!(p.framebuffer().get_pixel(0, 0), 0x07E0);
        assert_eq!(p.framebuffer().get_pixel(1, 0), 0x0000); // nothing else written
    }

    #[test]
    fn window_params_interrupted_mid_collection_are_discarded() {
        let mut p = Ili9341::new(240, 320);
        cmd(&mut p, 0x2A); // CASET
        data(&mut p, &[0x00, 0x0A]); // only half the parameters arrive
        cmd(&mut p, 0x2B); // PASET interrupts the collection
        data(&mut p, &[0x00, 0x02, 0x00, 0x04]);
        // column window unchanged from reset; page window set
        assert_eq!(p.window(), ((0, 2), (239, 4)));
    }

    #[test]
    fn colmod_value_is_stored() {
        let mut p = Ili9341::new(240, 320);
        assert_eq!(p.pixel_format(), 0x55); // reset default: 16 bpp
        cmd(&mut p, 0x3A); // COLMOD
        data(&mut p, &[0x66]); // 18 bpp
        assert_eq!(p.pixel_format(), 0x66);
    }

    #[test]
    fn ramwr_with_no_explicit_window_writes_from_the_top_left() {
        // A fresh panel's reset window is the whole panel, so RAMWR before any
        // CASET/PASET streams from (0,0) row-major - the real chip's behavior.
        let mut p = Ili9341::new(4, 4);
        assert_eq!(p.window(), ((0, 0), (3, 3)));
        cmd(&mut p, 0x2C); // RAMWR straight away
        data(&mut p, &[0xF8, 0x00, 0x07, 0xE0]); // two pixels
        assert_eq!(p.framebuffer().get_pixel(0, 0), 0xF800);
        assert_eq!(p.framebuffer().get_pixel(1, 0), 0x07E0);
    }

    #[test]
    fn a_window_whose_end_exceeds_the_panel_never_panics() {
        // CASET/PASET can name coordinates past the panel edge; write_pixel's
        // set_pixel is bounds-checked, so out-of-range pixels are dropped, not
        // a panic. (A real panel with a smaller GRAM does the same.)
        let mut p = Ili9341::new(4, 4);
        cmd(&mut p, 0x2A);
        data(&mut p, &[0x00, 0x00, 0xFF, 0xFF]); // columns 0..=65535
        cmd(&mut p, 0x2B);
        data(&mut p, &[0x00, 0x00, 0xFF, 0xFF]); // pages 0..=65535
        cmd(&mut p, 0x2C);
        // Stream more pixels than the panel row holds; the huge column window
        // means the cursor marches along row 0 (0,1,2,3, then off-panel) and
        // never wraps within these 40 pixels. In-bounds cells land; the rest
        // are dropped by the bounds check. The point is: no panic.
        let mut blob = Vec::new();
        for _ in 0..40 {
            blob.push(0xFF);
            blob.push(0xFF);
        }
        data(&mut p, &blob);
        assert_eq!(p.framebuffer().get_pixel(0, 0), 0xFFFF);
        assert_eq!(p.framebuffer().get_pixel(3, 0), 0xFFFF);
        assert_eq!(p.framebuffer().get_pixel(0, 1), 0x0000); // cursor never wrapped
    }

    #[test]
    fn a_reversed_window_start_after_end_does_not_panic() {
        // A start > end window is malformed; the cursor logic must still be
        // panic-free (it writes the one start cell, then wraps to start).
        let mut p = Ili9341::new(8, 8);
        cmd(&mut p, 0x2A);
        data(&mut p, &[0x00, 0x05, 0x00, 0x02]); // columns 5..=2 (reversed)
        cmd(&mut p, 0x2B);
        data(&mut p, &[0x00, 0x05, 0x00, 0x02]); // pages 5..=2 (reversed)
        cmd(&mut p, 0x2C);
        data(&mut p, &[0x07, 0xE0, 0x00, 0x1F]); // no panic
        assert_eq!(p.framebuffer().get_pixel(5, 5), 0x001F); // last write wins at start
    }

    #[test]
    fn replaying_a_truncated_pixel_stream_leaves_the_panel_consistent() {
        // A trace cut off mid-pixel (odd number of data bytes after RAMWR):
        // the dangling high byte is simply never completed. No panic.
        use crate::spi::{SimSpi, SpiBus};
        let mut bus = SimSpi::new();
        bus.select();
        bus.set_dc(Dc::Command);
        bus.write(&[0x2C]);
        bus.set_dc(Dc::Data);
        bus.write(&[0xF8, 0x00, 0x07]); // one full pixel + a dangling high byte
                                        // note: no deselect - the trace is truncated mid-transaction
        let mut p = Ili9341::new(4, 4);
        p.replay(bus.trace());
        assert_eq!(p.framebuffer().get_pixel(0, 0), 0xF800);
        assert_eq!(p.framebuffer().get_pixel(1, 0), 0x0000); // half-pixel dropped
    }

    #[test]
    fn colmod_18bpp_is_stored_and_the_pixel_path_still_decodes_16bpp() {
        // The decoder stores any COLMOD byte but only models the 16bpp pixel
        // path; an 18bpp declaration does not corrupt subsequent RAMWR decode.
        let mut p = Ili9341::new(4, 4);
        cmd(&mut p, 0x3A);
        data(&mut p, &[0x66]); // 18 bpp declared
        assert_eq!(p.pixel_format(), 0x66);
        cmd(&mut p, 0x2C);
        data(&mut p, &[0xF8, 0x00]);
        assert_eq!(p.framebuffer().get_pixel(0, 0), 0xF800);
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
}
