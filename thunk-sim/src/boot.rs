//! The first thing the panel shows: color bars, drawn over the SPI bus.

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

/// Draw the same splash by *speaking to the bus*, so the trace shows the writes.
/// Each column's high and low color bytes are pushed like a real panel write.
pub fn boot_splash_over_bus(p: &mut Panel, bus: &mut impl SpiBus) {
    for x in 0..p.w {
        let color = bar_color(x, p.w);
        bus.write(&[(color >> 8) as u8, (color & 0xff) as u8]);
        for y in 0..p.h {
            p.set_pixel(x, y, color);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::spi::SimSpi;

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
    fn over_bus_leaves_a_trace() {
        let mut p = Panel::new(240, 320);
        let mut bus = SimSpi::new();
        boot_splash_over_bus(&mut p, &mut bus);
        assert_eq!(bus.trace().len(), 240 * 2); // two bytes per column
    }
}
