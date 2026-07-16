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
        if w == 0 || h == 0 {
            return; // an empty rectangle puts nothing on the wires
        }
        assert_eq!(
            pixels.len(),
            w as usize * h as usize,
            "blit_rect: pixel count must match the rectangle exactly"
        );
        self.bus.select();
        self.set_window(x, y, x + w - 1, y + h - 1);
        self.command(RAMWR);
        self.bus.set_dc(Dc::Data);
        // One batched write, as a real spidev driver must do: the panel sees
        // the same byte stream either way, but the wires like big transfers.
        let mut buf = Vec::with_capacity(pixels.len() * 2);
        for &px in pixels {
            buf.push((px >> 8) as u8);
            buf.push(px as u8);
        }
        self.bus.write(&buf);
        self.bus.deselect();
    }

    /// One color, edge to edge.
    pub fn fill(&mut self, color: u16) {
        let n = self.w as usize * self.h as usize;
        let frame = vec![color; n];
        self.blit_rect(0, 0, self.w, self.h, &frame);
    }
}

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
    fn blit_rect_with_empty_dimensions_is_a_no_op() {
        let mut bus = SimSpi::new();
        {
            let mut d = Display::new(&mut bus, 240, 320);
            d.init();
        }
        let after_init = bus.trace().len();
        assert!(after_init > 0); // init really spoke
        let mut d = Display::new(&mut bus, 240, 320);
        d.blit_rect(0, 0, 0, 0, &[]); // nothing to draw, nothing on the wires
        assert_eq!(bus.trace().len(), after_init);
    }

    #[test]
    fn a_single_pixel_blit_lands_exactly_where_aimed() {
        let mut bus = SimSpi::new();
        let mut d = Display::new(&mut bus, 8, 8);
        d.init();
        d.blit_rect(3, 5, 1, 1, &[0x07E0]); // one green pixel at (3,5)
        let mut panel = Ili9341::new(8, 8);
        panel.replay(bus.trace());
        assert_eq!(panel.framebuffer().get_pixel(3, 5), 0x07E0);
        assert_eq!(panel.framebuffer().get_pixel(2, 5), 0x0000);
        assert_eq!(panel.framebuffer().get_pixel(3, 4), 0x0000);
    }

    #[test]
    fn a_blit_flush_against_the_bottom_right_corner_fills_to_the_edge() {
        // A 2x2 rectangle whose far corner is the panel's last pixel: the
        // window math (x + w - 1) must land exactly on the edge, no overflow.
        let mut bus = SimSpi::new();
        let mut d = Display::new(&mut bus, 4, 4);
        d.init();
        d.blit_rect(2, 2, 2, 2, &[0xF800, 0x07E0, 0x001F, 0xFFFF]);
        let mut panel = Ili9341::new(4, 4);
        panel.replay(bus.trace());
        assert_eq!(panel.framebuffer().get_pixel(2, 2), 0xF800);
        assert_eq!(panel.framebuffer().get_pixel(3, 2), 0x07E0);
        assert_eq!(panel.framebuffer().get_pixel(2, 3), 0x001F);
        assert_eq!(panel.framebuffer().get_pixel(3, 3), 0xFFFF); // the corner
    }

    #[test]
    #[should_panic(expected = "pixel count must match")]
    fn a_blit_with_a_mismatched_pixel_count_is_a_programming_error() {
        // The pixel slice must match w*h exactly; a mismatch is a caller bug
        // caught loudly, not silent corruption. (Callers in this crate always
        // pass exact frames; this pins the contract.)
        let mut bus = SimSpi::new();
        let mut d = Display::new(&mut bus, 8, 8);
        d.blit_rect(0, 0, 2, 2, &[0xF800]); // says 2x2, gives 1 pixel
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
