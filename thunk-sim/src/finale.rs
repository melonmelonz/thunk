//! The finale's frame source: a one-point-perspective corridor, rendered in
//! pure integer math. Deterministic: the same (w, h, t) is the same frame.
//!
//! This is the inside build's finale: a scene the learner's own driver can
//! push down the bus, frame after frame. (The open build points the same
//! interface at heavier programs; see the roadmap.)

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
            // Brightness falls off as the inverse of depth (nearest depth is
            // 32, so the near edge is full bright); bands modulate it.
            let mut shade = (992 / depth.max(32)).min(31) as u16;
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
        assert!(
            luma(edge) > luma(center),
            "edge {edge:#06x} vs center {center:#06x}"
        );
    }

    fn luma(c: u16) -> u32 {
        let r = ((c >> 11) & 0x1f) as u32;
        let g = ((c >> 5) & 0x3f) as u32;
        let b = (c & 0x1f) as u32;
        r * 2 + g + b * 2 // channel-width-adjusted, good enough to compare
    }

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
        assert_eq!(
            panel.framebuffer().get_pixel(120, 160),
            expected[160 * 240 + 120]
        );
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
        assert_eq!(
            panel.framebuffer().get_pixel(4, 160),
            expected[160 * 240 + 4]
        );
        let _ = before; // frames 0 and 3 may or may not differ at one pixel; the
                        // equality against the frame source is the real assertion
    }
}
