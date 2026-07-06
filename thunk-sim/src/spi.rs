//! The SPI bus: how a peripheral is spoken to, one byte at a time.

/// One thing that happened on the wire. The trace view is built from these.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TraceEvent {
    Byte(u8),
}

/// The interface a driver talks through. Implemented by `SimSpi` (inside build)
/// and, later, by a real hardware bus (open build). Same driver code either way.
pub trait SpiBus {
    fn write(&mut self, bytes: &[u8]);
}

/// A simulated SPI bus that remembers everything written to it.
#[derive(Default)]
pub struct SimSpi {
    trace: Vec<TraceEvent>,
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
    fn write(&mut self, bytes: &[u8]) {
        for &b in bytes {
            self.trace.push(TraceEvent::Byte(b));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sim_spi_records_a_trace() {
        let mut bus = SimSpi::new();
        bus.write(&[0x2C, 0xF8, 0x00]);
        let t = bus.trace();
        assert_eq!(t.len(), 3);
        assert_eq!(t[0], TraceEvent::Byte(0x2C));
        assert_eq!(t[1], TraceEvent::Byte(0xF8));
    }
}
