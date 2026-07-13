//! Trace formatting: pure functions that turn a recorded bus trace into the
//! logic-analyzer-style rows the M3/M4 lessons taught the learner to read.
//!
//! This module owns the ILI9341 command byte constants; the decoder in
//! `ili9341.rs` imports them from here, so the hex values live in one table.

use crate::spi::{Dc, TraceEvent};

pub const SWRESET: u8 = 0x01;
pub const SLPOUT: u8 = 0x11;
pub const DISPOFF: u8 = 0x28;
pub const DISPON: u8 = 0x29;
pub const CASET: u8 = 0x2A;
pub const PASET: u8 = 0x2B;
pub const RAMWR: u8 = 0x2C;
pub const COLMOD: u8 = 0x3A;

/// The datasheet name of a command byte, for the commands the course models.
pub fn command_name(c: u8) -> Option<&'static str> {
    Some(match c {
        SWRESET => "SWRESET",
        SLPOUT => "SLPOUT",
        DISPOFF => "DISPOFF",
        DISPON => "DISPON",
        CASET => "CASET",
        PASET => "PASET",
        RAMWR => "RAMWR",
        COLMOD => "COLMOD",
        _ => return None,
    })
}

/// A short plain-words gloss for a command byte; empty when unknown.
fn command_gloss(c: u8) -> &'static str {
    match c {
        SWRESET => "reset",
        SLPOUT => "wake",
        DISPOFF => "display off",
        DISPON => "display on",
        CASET => "column window",
        PASET => "page window",
        RAMWR => "pixel stream follows",
        COLMOD => "16-bit color",
        _ => "",
    }
}

/// How many bytes of a data run are shown before the row summarizes.
const DATA_RUN_SHOWN: usize = 8;

/// Annotated protocol rows for a recorded trace: select edges, named
/// commands, and consecutive data bytes folded into one row per run.
pub fn annotate(events: &[TraceEvent]) -> Vec<String> {
    rows(events).into_iter().map(|(text, _)| text).collect()
}

/// The first byte value backing row `row` of `annotate(events)`, if that row
/// was built from bytes (select edges have no byte). Lets a viewer show the
/// waveform of whichever row is selected.
pub fn row_byte(events: &[TraceEvent], row: usize) -> Option<u8> {
    rows(events).get(row).and_then(|(_, byte)| *byte)
}

/// Each rendered row paired with the first byte that produced it.
fn rows(events: &[TraceEvent]) -> Vec<(String, Option<u8>)> {
    let mut out: Vec<(String, Option<u8>)> = Vec::new();
    let mut run: Vec<u8> = Vec::new();
    for e in events {
        match e {
            TraceEvent::Byte {
                value,
                dc: Dc::Data,
            } => run.push(*value),
            other => {
                flush_data_run(&mut out, &mut run);
                match other {
                    TraceEvent::SelectLow => {
                        out.push(("select v  (transaction begins)".to_string(), None))
                    }
                    TraceEvent::SelectHigh => {
                        out.push(("select ^  (transaction ends)".to_string(), None))
                    }
                    TraceEvent::Byte { value, .. } => out.push((command_row(*value), Some(*value))),
                }
            }
        }
    }
    flush_data_run(&mut out, &mut run);
    out
}

fn command_row(c: u8) -> String {
    match command_name(c) {
        Some(name) => format!("cmd  {c:02X}  {name}  ({})", command_gloss(c)),
        None => format!("cmd  {c:02X}  (unknown)"),
    }
}

/// One byte as the M3 lesson diagram: three aligned rows (bit values, one
/// clock pulse per tick, and the data line's level), MSB first, one 4-char
/// cell per tick. The data line idles low and transitions at cell starts, so
/// it is settled before each clock's rising edge - just as the lesson drew it.
pub fn waveform(byte: u8) -> [String; 3] {
    let mut bits = String::from("bit  ");
    let mut clk = String::from("clk  ");
    let mut data = String::from("data ");
    let mut level = false; // the line idles low before the first bit
    for i in (0..8).rev() {
        let bit = (byte >> i) & 1 == 1;
        bits.push_str(if bit { "  1 " } else { "  0 " });
        clk.push_str("_/\\_");
        let fill = if bit { '~' } else { '_' };
        data.push(match (level, bit) {
            (false, true) => '/',
            (true, false) => '\\',
            _ => fill,
        });
        data.push_str(&fill.to_string().repeat(3));
        level = bit;
    }
    [bits, clk, data]
}

fn flush_data_run(out: &mut Vec<(String, Option<u8>)>, run: &mut Vec<u8>) {
    if run.is_empty() {
        return;
    }
    let shown: Vec<String> = run
        .iter()
        .take(DATA_RUN_SHOWN)
        .map(|b| format!("{b:02X}"))
        .collect();
    let text = if run.len() > DATA_RUN_SHOWN {
        format!("data {} ... ({} bytes)", shown.join(" "), run.len())
    } else {
        format!("data {}", shown.join(" "))
    };
    out.push((text, run.first().copied()));
    run.clear();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::spi::{Dc, TraceEvent};

    fn byte(value: u8, dc: Dc) -> TraceEvent {
        TraceEvent::Byte { value, dc }
    }

    #[test]
    fn annotate_names_commands_and_groups_data() {
        let events = vec![
            TraceEvent::SelectLow,
            byte(0x2A, Dc::Command),
            byte(0x00, Dc::Data),
            byte(0x0A, Dc::Data),
            byte(0x00, Dc::Data),
            byte(0x14, Dc::Data),
            byte(0x2C, Dc::Command),
            byte(0xF8, Dc::Data),
            byte(0x00, Dc::Data),
            byte(0x07, Dc::Data),
            byte(0xE0, Dc::Data),
            TraceEvent::SelectHigh,
        ];
        assert_eq!(
            annotate(&events),
            vec![
                "select v  (transaction begins)".to_string(),
                "cmd  2A  CASET  (column window)".to_string(),
                "data 00 0A 00 14".to_string(),
                "cmd  2C  RAMWR  (pixel stream follows)".to_string(),
                "data F8 00 07 E0".to_string(),
                "select ^  (transaction ends)".to_string(),
            ]
        );
    }

    #[test]
    fn long_data_runs_are_summarized() {
        let mut events = vec![TraceEvent::SelectLow, byte(0x2C, Dc::Command)];
        events.extend((0..64).map(|i| byte(i as u8, Dc::Data)));
        events.push(TraceEvent::SelectHigh);
        let rows = annotate(&events);
        assert_eq!(rows.len(), 4);
        assert_eq!(rows[2], "data 00 01 02 03 04 05 06 07 ... (64 bytes)");
    }

    #[test]
    fn waveform_draws_the_m3_lesson_diagram() {
        // Hand-derived: 0x2C = 00101100, MSB first, one 4-char cell per tick,
        // 5-char row prefix, data idles low and transitions at cell starts.
        // The bit row carries a trailing space so all rows are 37 columns.
        let w = waveform(0x2C);
        assert_eq!(
            w,
            [
                "bit    0   0   1   0   1   1   0   0 ".to_string(),
                "clk  _/\\__/\\__/\\__/\\__/\\__/\\__/\\__/\\_".to_string(),
                "data ________/~~~\\___/~~~~~~~\\_______".to_string(),
            ]
        );
    }

    #[test]
    fn unknown_commands_are_still_shown() {
        let rows = annotate(&[byte(0xD9, Dc::Command)]);
        assert_eq!(rows, vec!["cmd  D9  (unknown)".to_string()]);
    }

    #[test]
    fn waveform_rows_have_equal_width_for_every_byte() {
        for b in 0..=255u8 {
            let [bits, clk, data] = waveform(b);
            assert_eq!(bits.chars().count(), clk.chars().count(), "byte {b:#04X}");
            assert_eq!(clk.chars().count(), data.chars().count(), "byte {b:#04X}");
        }
    }

    #[test]
    fn waveform_data_row_encodes_the_byte_msb_first() {
        // The machine check for the hand derivation: reading the settled
        // level at the end of each 4-char cell rebuilds the input byte.
        for b in 0..=255u8 {
            let data = &waveform(b)[2];
            let cells: Vec<char> = data.chars().skip(5).collect();
            let mut rebuilt = 0u8;
            for tick in 0..8 {
                let level = cells[tick * 4 + 3];
                rebuilt = (rebuilt << 1) | u8::from(level == '~');
            }
            assert_eq!(rebuilt, b, "data row does not spell {b:#04X}: {data}");
        }
    }
}
