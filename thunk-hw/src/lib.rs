//! The open build's real bus: the same `SpiBus` the simulator implements,
//! pointed at /dev/spidev and a GPIO line. Never compiled into the inside build.

mod bus;
mod gpio;
mod ioctl;

pub use bus::{DcPin, SpidevBus};
pub use gpio::GpioLine;
