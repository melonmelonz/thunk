//! The first thing the panel shows: color bars, drawn over the SPI bus.

use crate::display::Display;
use crate::panel::Panel;
use crate::spi::SpiBus;

/// Classic vertical color bars: red, green, blue, yellow, white.
const BARS: [u16; 5] = [0xF800, 0x07E0, 0x001F, 0xFFE0, 0xFFFF];

fn bar_color(x: usize, w: usize) -> u16 {
    BARS[(x * BARS.len() / w).min(BARS.len() - 1)]
}

/// Draw the splash straight into a panel framebuffer.
pub fn boot_splash(p: &mut Panel) {
    for x in 0..p.w {
        let color = bar_color(x, p.w);
        for y in 0..p.h {
            p.set_pixel(x, y, color);
        }
    }
}

/// The splash drawn the honest way: init + one full-frame blit over the bus.
pub fn boot_splash_via_display(bus: &mut impl SpiBus, w: u16, h: u16) {
    let mut d = Display::new(bus, w, h);
    d.init();
    let frame: Vec<u16> = (0..h as usize)
        .flat_map(|_| (0..w as usize).map(|x| bar_color(x, w as usize)))
        .collect();
    d.blit_rect(0, 0, w, h, &frame);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ili9341::Ili9341;
    use crate::spi::{Dc, SimSpi, TraceEvent};

    #[test]
    fn boot_splash_draws_color_bars() {
        let mut p = Panel::new(240, 320);
        boot_splash(&mut p);
        let left = p.get_pixel(0, 160);
        let right = p.get_pixel(239, 160);
        assert_ne!(left, right);
        assert_eq!(left, 0xF800); // first bar is red
    }

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
        assert_eq!(
            bus.trace()[1],
            TraceEvent::Byte {
                value: 0x01,
                dc: Dc::Command
            }
        );
    }
}
