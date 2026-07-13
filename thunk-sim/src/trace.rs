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
    fn unknown_commands_are_still_shown() {
        let rows = annotate(&[byte(0xD9, Dc::Command)]);
        assert_eq!(rows, vec!["cmd  D9  (unknown)".to_string()]);
    }
}
