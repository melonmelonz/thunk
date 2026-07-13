//! The open build's real bus: the same `SpiBus` the simulator implements,
//! pointed at /dev/spidev and a GPIO line. Never compiled into the inside build.

// mod bus;
// mod gpio;
// The bus and gpio modules are this crate's only consumers of the ioctl math;
// until they land, the request functions are exercised solely by their tests.
#[allow(dead_code)]
mod ioctl;

// pub use bus::{DcPin, SpidevBus};
// pub use gpio::GpioLine;
