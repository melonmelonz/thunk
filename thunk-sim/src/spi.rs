//! The SPI bus: how a peripheral is spoken to, one byte at a time.

/// The data/command line: tells the panel what kind of byte is arriving.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dc {
    Command,
    Data,
}

/// One thing that happened on the wires. The trace view is built from these.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TraceEvent {
    /// Chip select pulled low: a transaction begins.
    SelectLow,
    /// Chip select raised: the transaction is over.
    SelectHigh,
    /// One byte crossed the data line, with the DC level it carried.
    Byte { value: u8, dc: Dc },
}

/// The interface a display driver talks through. Implemented by `SimSpi`
/// (inside build) and, later, by a real bus + GPIO pair (open build).
pub trait SpiBus {
    /// Pull chip select low: start speaking to the panel.
    fn select(&mut self);
    /// Raise chip select: done.
    fn deselect(&mut self);
    /// Set the DC line for the bytes that follow.
    fn set_dc(&mut self, dc: Dc);
    /// Clock bytes out on the data line.
    fn write(&mut self, bytes: &[u8]);
}

/// A simulated bus that remembers everything that happened on the wires.
pub struct SimSpi {
    trace: Vec<TraceEvent>,
    dc: Dc,
    selected: bool,
}

impl Default for SimSpi {
    fn default() -> Self {
        Self {
            trace: Vec::new(),
            dc: Dc::Command,
            selected: false,
        }
    }
}

impl SimSpi {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn trace(&self) -> &[TraceEvent] {
        &self.trace
    }
}

impl SpiBus for SimSpi {
    fn select(&mut self) {
        if !self.selected {
            self.selected = true;
            self.trace.push(TraceEvent::SelectLow);
        }
    }
    fn deselect(&mut self) {
        if self.selected {
            self.selected = false;
            self.trace.push(TraceEvent::SelectHigh);
        }
    }
    fn set_dc(&mut self, dc: Dc) {
        self.dc = dc;
    }
    fn write(&mut self, bytes: &[u8]) {
        if !self.selected {
            return;
        }
        for &value in bytes {
            self.trace.push(TraceEvent::Byte { value, dc: self.dc });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sim_spi_records_select_dc_and_bytes() {
        let mut bus = SimSpi::new();
        bus.select();
        bus.set_dc(Dc::Command);
        bus.write(&[0x2C]);
        bus.set_dc(Dc::Data);
        bus.write(&[0xF8, 0x00]);
        bus.deselect();
        assert_eq!(
            bus.trace(),
            &[
                TraceEvent::SelectLow,
                TraceEvent::Byte {
                    value: 0x2C,
                    dc: Dc::Command
                },
                TraceEvent::Byte {
                    value: 0xF8,
                    dc: Dc::Data
                },
                TraceEvent::Byte {
                    value: 0x00,
                    dc: Dc::Data
                },
                TraceEvent::SelectHigh,
            ]
        );
    }

    #[test]
    fn writes_while_deselected_are_not_recorded() {
        let mut bus = SimSpi::new();
        bus.set_dc(Dc::Data);
        bus.write(&[0xAA]); // nothing selected; a real peripheral would not hear this
        assert!(bus.trace().is_empty());
    }
}
