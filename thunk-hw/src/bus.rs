//! `SpiBus` over /dev/spidevX.Y. Config is three ioctls at open; data is
//! chunked write(2), which spidev performs as half-duplex TX transfers with
//! the controller driving chip select. `SpiBus` is infallible by design (the
//! M-C seam decision), so the first io error is latched and the bus goes
//! quiet; callers check `take_error()` after driving.
//!
//! The 4096-byte write chunking is only exercisable on real hardware: a unit
//! test writing through a plain `File` cannot observe chunk boundaries.

use crate::ioctl;
use std::fs::{File, OpenOptions};
use std::io::{self, Write};
use std::os::fd::AsRawFd;
use std::path::Path;
use thunk_sim::{Dc, SpiBus};

/// The panel's data/command line, however it is wired.
pub trait DcPin {
    fn set(&mut self, dc: Dc) -> io::Result<()>;
}

/// ILI9341 wiring: DC low = command, high = data.
impl DcPin for crate::GpioLine {
    fn set(&mut self, dc: Dc) -> io::Result<()> {
        // The inherent method, named in full: inherent methods win resolution
        // today, but a future rename of the inherent `set` would silently turn
        // a bare `self.set(...)` into trait-method recursion.
        crate::GpioLine::set(self, dc == Dc::Data)
    }
}

/// spidev's default buffer size; larger writes fail with EMSGSIZE.
const SPIDEV_BUFSIZ: usize = 4096;

pub struct SpidevBus<P: DcPin> {
    spi: File,
    dc: P,
    error: Option<io::Error>,
}

impl<P: DcPin> SpidevBus<P> {
    /// Open and configure: mode 0, 8 bits per word, `speed_hz`.
    pub fn open(path: &Path, speed_hz: u32, dc: P) -> io::Result<Self> {
        let spi = OpenOptions::new().read(true).write(true).open(path)?;
        let fd = spi.as_raw_fd();
        let mode: u8 = 0;
        let bits: u8 = 8;
        // SAFETY: fd is open; each request/argument pair matches the spidev
        // ABI (requests pinned by the ioctl tests).
        unsafe {
            if libc::ioctl(fd, ioctl::spi_wr_mode() as libc::c_ulong, &mode) < 0
                || libc::ioctl(fd, ioctl::spi_wr_bits_per_word() as libc::c_ulong, &bits) < 0
                || libc::ioctl(fd, ioctl::spi_wr_max_speed_hz() as libc::c_ulong, &speed_hz) < 0
            {
                return Err(io::Error::last_os_error());
            }
        }
        Ok(Self {
            spi,
            dc,
            error: None,
        })
    }

    #[cfg(test)]
    fn from_parts(spi: File, dc: P) -> Self {
        Self {
            spi,
            dc,
            error: None,
        }
    }

    /// The first error since the last drain, if any. Draining.
    pub fn take_error(&mut self) -> Option<io::Error> {
        self.error.take()
    }

    fn latch(&mut self, r: io::Result<()>) {
        if let Err(e) = r {
            if self.error.is_none() {
                self.error = Some(e);
            }
        }
    }
}

impl<P: DcPin> SpiBus for SpidevBus<P> {
    /// The controller asserts CS around each transfer; nothing to do here.
    fn select(&mut self) {}
    fn deselect(&mut self) {}

    fn set_dc(&mut self, dc: Dc) {
        if self.error.is_some() {
            return;
        }
        let r = self.dc.set(dc);
        self.latch(r);
    }

    fn write(&mut self, bytes: &[u8]) {
        if self.error.is_some() {
            return;
        }
        // Panel timing is a wire property: SWRESET and SLPOUT need settle
        // time before the next command reaches the panel. A command write is
        // a single byte with DC=command; the two that need it are recognized
        // here so `Display::init` stays timeless on every bus. The match keys
        // on the byte pattern alone, not DC state: a 1-byte data write of
        // 0x01 or 0x11 would also settle. Deliberate - a spurious sleep is
        // harmless; a missing one bricks the init.
        let settle_ms = match bytes {
            [0x01] => 6,   // SWRESET: 5ms per datasheet, rounded up
            [0x11] => 120, // SLPOUT
            _ => 0,
        };
        for chunk in bytes.chunks(SPIDEV_BUFSIZ) {
            let r = self.spi.write_all(chunk);
            self.latch(r);
            if self.error.is_some() {
                return;
            }
        }
        if settle_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(settle_ms));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;
    use thunk_sim::{Dc, SpiBus};

    struct FakeDc {
        log: Rc<RefCell<Vec<Dc>>>,
        calls: Rc<RefCell<u32>>,
        fail: bool,
    }
    impl DcPin for FakeDc {
        fn set(&mut self, dc: Dc) -> std::io::Result<()> {
            *self.calls.borrow_mut() += 1;
            if self.fail {
                return Err(std::io::Error::other("dc pin unavailable"));
            }
            self.log.borrow_mut().push(dc);
            Ok(())
        }
    }

    fn null_bus(dc: FakeDc) -> SpidevBus<FakeDc> {
        // /dev/null accepts writes; good enough to exercise the trait plumbing.
        SpidevBus::from_parts(std::fs::File::create("/dev/null").unwrap(), dc)
    }

    #[test]
    fn opening_a_non_spidev_path_is_an_error() {
        let dc = FakeDc {
            log: Rc::default(),
            calls: Rc::default(),
            fail: false,
        };
        assert!(SpidevBus::open(std::path::Path::new("/dev/null"), 8_000_000, dc).is_err());
    }

    #[test]
    fn set_dc_reaches_the_pin() {
        let log = Rc::new(RefCell::new(Vec::new()));
        let mut bus = null_bus(FakeDc {
            log: Rc::clone(&log),
            calls: Rc::default(),
            fail: false,
        });
        bus.set_dc(Dc::Command);
        bus.set_dc(Dc::Data);
        assert_eq!(*log.borrow(), vec![Dc::Command, Dc::Data]);
        assert!(bus.take_error().is_none());
    }

    #[test]
    fn the_first_error_is_latched_and_the_bus_goes_quiet() {
        let calls = Rc::new(RefCell::new(0));
        let mut bus = null_bus(FakeDc {
            log: Rc::default(),
            calls: Rc::clone(&calls),
            fail: true,
        });
        bus.set_dc(Dc::Data);
        assert_eq!(*calls.borrow(), 1, "the failing call reached the pin");
        bus.write(&[0xAA]); // after the latch: a no-op, not a second error
        bus.set_dc(Dc::Command); // quiet means this never reaches the pin
        assert_eq!(*calls.borrow(), 1, "the latched bus stops driving the pin");
        let e = bus.take_error().expect("the dc failure was latched");
        assert_eq!(e.to_string(), "dc pin unavailable");
        assert!(bus.take_error().is_none(), "take_error drains");
    }
}
