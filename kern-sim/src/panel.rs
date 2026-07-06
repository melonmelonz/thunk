//! A small RGB565 display panel, addressed like an ILI9341.

/// A framebuffer of `w * h` RGB565 pixels.
pub struct Panel {
    pub w: usize,
    pub h: usize,
    buf: Vec<u16>,
}

impl Panel {
    pub fn new(w: usize, h: usize) -> Self {
        Self { w, h, buf: vec![0; w * h] }
    }
    pub fn fill(&mut self, color: u16) {
        for p in &mut self.buf {
            *p = color;
        }
    }
    pub fn set_pixel(&mut self, x: usize, y: usize, color: u16) {
        if x < self.w && y < self.h {
            self.buf[y * self.w + x] = color;
        }
    }
    pub fn get_pixel(&self, x: usize, y: usize) -> u16 {
        self.buf[y * self.w + x]
    }

    /// Perceived brightness (0..=255) of an RGB565 value.
    fn luma(color: u16) -> u32 {
        let r = ((color >> 11) & 0x1f) as u32 * 255 / 31;
        let g = ((color >> 5) & 0x3f) as u32 * 255 / 63;
        let b = (color & 0x1f) as u32 * 255 / 31;
        (r * 30 + g * 59 + b * 11) / 100
    }

    /// Downsample the framebuffer into an ASCII picture for the terminal.
    pub fn to_ascii(&self, cols: usize, rows: usize) -> String {
        const RAMP: &[u8] = b" .:-=+*#%@";
        let cols = cols.max(1);
        let rows = rows.max(1);
        let mut out = String::with_capacity((cols + 1) * rows);
        for ry in 0..rows {
            for rx in 0..cols {
                let x = rx * self.w / cols;
                let y = ry * self.h / rows;
                let l = Self::luma(self.get_pixel(x, y)) as usize;
                let idx = l * (RAMP.len() - 1) / 255;
                out.push(RAMP[idx] as char);
            }
            out.push('\n');
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn panel_fills_and_addresses() {
        let mut p = Panel::new(240, 320);
        p.fill(0xF800); // red
        assert_eq!(p.get_pixel(0, 0), 0xF800);
        p.set_pixel(10, 20, 0x07E0); // green
        assert_eq!(p.get_pixel(10, 20), 0x07E0);
        assert_eq!(p.get_pixel(0, 0), 0xF800);
    }

    #[test]
    fn set_pixel_out_of_bounds_is_ignored() {
        let mut p = Panel::new(8, 8);
        p.set_pixel(100, 100, 0xFFFF); // no panic
        assert_eq!(p.get_pixel(0, 0), 0);
    }

    #[test]
    fn ascii_has_expected_shape() {
        let p = Panel::new(240, 320);
        let art = p.to_ascii(40, 20);
        assert_eq!(art.lines().count(), 20);
        assert!(art.lines().all(|l| l.chars().count() == 40));
    }
}
