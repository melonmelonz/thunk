//! The sim page: the finale frame as run-length SVG + the annotated bus trace.
//!
//! Everything here replays the same recorded bus the terminal `thunk sim`
//! shows: `boot_finale` drives `SimSpi`, `Ili9341` decodes the trace back
//! into a framebuffer, and `trace::annotate` names every protocol row. The
//! web layer only renders; the protocol logic stays in thunk-sim.

use crate::page::{esc, shell};
use thunk_sim::trace::{annotate, waveform, RAMWR};
use thunk_sim::{boot_finale, Ili9341, SimSpi};

/// An RGB565 value as the `#rrggbb` hex SVG wants (5/6/5 bits upscaled to
/// 8/8/8 the standard way: r5*255/31, g6*255/63, b5*255/31).
fn rgb565_to_hex(color: u16) -> String {
    let r = ((color >> 11) & 0x1f) as u32 * 255 / 31;
    let g = ((color >> 5) & 0x3f) as u32 * 255 / 63;
    let b = (color & 0x1f) as u32 * 255 / 31;
    format!("#{r:02x}{g:02x}{b:02x}")
}

/// The finale frame, drawn by the display driver, as an SVG. Per row,
/// consecutive same-color pixels fold into one 1px-tall `<rect>`, so the
/// markup stays a fraction of the naive w*h rect count.
pub fn panel_svg(w: usize, h: usize) -> String {
    let mut bus = SimSpi::new();
    boot_finale(&mut bus, w as u16, h as u16);
    let mut panel = Ili9341::new(w, h);
    panel.replay(bus.trace());
    let fb = panel.framebuffer();

    let mut svg = format!(
        "<svg viewBox=\"0 0 {w} {h}\" width=\"{w}\" height=\"{h}\" role=\"img\" class=\"panel\">\n\
         <title>the finale frame, drawn by the display driver</title>\n"
    );
    for y in 0..h {
        let mut x = 0;
        while x < w {
            let color = fb.get_pixel(x, y);
            let mut run = 1;
            while x + run < w && fb.get_pixel(x + run, y) == color {
                run += 1;
            }
            svg.push_str(&format!(
                "<rect x=\"{x}\" y=\"{y}\" width=\"{run}\" height=\"1\" fill=\"{}\"/>\n",
                rgb565_to_hex(color)
            ));
            x += run;
        }
    }
    svg.push_str("</svg>\n");
    svg
}

/// The word an annotated row starts with (select/cmd/data) and the rest of
/// the row, split for the two-column trace table.
fn split_row(row: &str) -> (&str, &str) {
    match row.split_once(char::is_whitespace) {
        Some((kind, rest)) => (kind, rest.trim_start()),
        None => (row, ""),
    }
}

/// The whole sim page: prose tying back to M3/M4, the panel SVG, the
/// annotated trace as a semantic table, and one byte's waveform.
pub fn sim_page() -> String {
    let mut bus = SimSpi::new();
    boot_finale(&mut bus, 240, 320);
    let rows = annotate(bus.trace());
    let events = bus.trace().len();

    let mut main = format!(
        "<p class=\"crumbs\"><a href=\"../index.html\">thunk</a> / The Bench</p>\n\
         <h1>The Bench</h1>\n\
         <p>This is the traffic your driver put on the bus. The same init sequence \
         M3 and M4 taught - reset, wake, color mode, window, then the pixel stream - \
         drove a simulated ILI9341, and the panel below is what its framebuffer holds. \
         Nothing here is a picture of a screen; it is the decoded result of {events} bus events.</p>\n\
         <figure class=\"panel-frame\">\n{}\
         <figcaption>240 x 320, decoded from the recorded trace by the panel model.</figcaption>\n\
         </figure>\n\
         <h2>The bus trace, annotated</h2>\n\
         <table class=\"trace\">\n\
         <caption>Every event on the wire, as a logic analyzer would group it: \
         select edges, named commands, and data runs folded to one row each.</caption>\n\
         <thead><tr><th scope=\"col\">kind</th><th scope=\"col\">row</th></tr></thead>\n\
         <tbody>\n",
        panel_svg(240, 320)
    );
    for row in &rows {
        let (kind, rest) = split_row(row);
        main.push_str(&format!(
            "<tr><td class=\"kind\">{}</td><td>{}</td></tr>\n",
            esc(kind),
            esc(rest)
        ));
    }
    main.push_str("</tbody>\n</table>\n");

    let [bits, clk, data] = waveform(RAMWR);
    main.push_str(&format!(
        "<h2>One byte on the wire</h2>\n\
         <p>RAMWR (0x2C), the command that opens the pixel stream, exactly as the \
         M3 lesson drew it - MSB first, data settled before each rising clock edge:</p>\n\
         <pre aria-label=\"one byte on the wire\"><code>{}\n{}\n{}</code></pre>\n",
        esc(&bits),
        esc(&clk),
        esc(&data)
    ));

    shell("The Bench", "thunk", &main, 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_panel_svg_is_runlength_compressed_and_correct() {
        let svg = panel_svg(240, 320);
        assert!(svg.starts_with("<svg"));
        assert!(svg.contains("viewBox=\"0 0 240 320\""));
        let rects = svg.matches("<rect").count();
        assert!(rects > 100, "not empty: {rects}");
        assert!(rects < 40_000, "run-length compression working: {rects}");
        assert!(svg.contains("role=\"img\""));
        assert!(svg.contains("<title>"));
    }

    #[test]
    fn the_sim_page_shows_the_trace_the_lessons_taught() {
        let html = sim_page();
        for needle in ["SWRESET", "CASET", "RAMWR", "bytes)", "<table", "<caption>"] {
            assert!(html.contains(needle), "missing {needle}");
        }
    }

    #[test]
    fn the_svg_colors_are_true_565_upscales() {
        // The three primaries and both extremes, hand-derived.
        assert_eq!(rgb565_to_hex(0xF800), "#ff0000");
        assert_eq!(rgb565_to_hex(0x07E0), "#00ff00");
        assert_eq!(rgb565_to_hex(0x001F), "#0000ff");
        assert_eq!(rgb565_to_hex(0x0000), "#000000");
        assert_eq!(rgb565_to_hex(0xFFFF), "#ffffff");
    }

    #[test]
    fn the_sim_page_is_hermetic() {
        let html = sim_page();
        assert!(!html.contains("http://") && !html.contains("https://"));
    }
}
