//! A deterministic, pure-Rust model of an SPI bus and a small display panel.
//!
//! No hardware, no network. This is the "inside build" experience; the same
//! `SpiBus` trait is later implemented by a real Saleae + panel on the open build.

pub mod boot;
pub mod panel;
pub mod spi;

pub use boot::boot_splash;
pub use panel::Panel;
pub use spi::{SimSpi, SpiBus, TraceEvent};
