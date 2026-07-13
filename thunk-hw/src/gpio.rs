//! The GPIO v2 character-device uAPI (linux/gpio.h), by hand: request one
//! output line from a gpiochip, then set it high or low. This is how DC and
//! RST are driven on the open build.

use crate::ioctl;
use std::io;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::path::Path;

pub const GPIO_V2_LINE_FLAG_OUTPUT: u64 = 1 << 3;

#[repr(C)]
pub struct GpioV2LineAttribute {
    pub id: u32,
    pub padding: u32,
    pub value: u64, // union: flags / values / debounce_period_us
}

#[repr(C)]
pub struct GpioV2LineConfigAttribute {
    pub attr: GpioV2LineAttribute,
    pub mask: u64,
}

#[repr(C)]
pub struct GpioV2LineConfig {
    pub flags: u64,
    pub num_attrs: u32,
    pub padding: [u32; 5],
    pub attrs: [GpioV2LineConfigAttribute; 10],
}

#[repr(C)]
pub struct GpioV2LineRequest {
    pub offsets: [u32; 64],
    pub consumer: [u8; 32],
    pub config: GpioV2LineConfig,
    pub num_lines: u32,
    pub event_buffer_size: u32,
    pub padding: [u32; 5],
    pub fd: i32,
}

#[repr(C)]
pub struct GpioV2LineValues {
    pub bits: u64,
    pub mask: u64,
}

/// One requested output line, held for the life of the value.
pub struct GpioLine {
    line_fd: OwnedFd,
}

impl GpioLine {
    /// Request `line` on `chip` (e.g. /dev/gpiochip0) as an output.
    pub fn open(chip: &Path, line: u32, consumer: &str) -> io::Result<Self> {
        let chip_file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(chip)?;
        // SAFETY: zeroed is a valid all-defaults request for this uAPI struct.
        let mut req: GpioV2LineRequest = unsafe { std::mem::zeroed() };
        req.offsets[0] = line;
        req.num_lines = 1;
        req.config.flags = GPIO_V2_LINE_FLAG_OUTPUT;
        let name = consumer.as_bytes();
        let n = name.len().min(req.consumer.len() - 1);
        req.consumer[..n].copy_from_slice(&name[..n]);
        // SAFETY: fd is open; the request struct matches the kernel layout
        // (pinned by the layout tests) and lives across the call.
        let rc = unsafe {
            libc::ioctl(
                chip_file.as_raw_fd(),
                ioctl::gpio_v2_get_line() as libc::c_ulong,
                &mut req,
            )
        };
        if rc < 0 {
            return Err(io::Error::last_os_error());
        }
        if req.fd < 0 {
            // The ioctl succeeded but handed back no usable fd; errno is not
            // set on this path, so name the failure ourselves.
            return Err(io::Error::other("kernel returned an invalid line fd"));
        }
        // The chip fd may be dropped after the line is requested; the line fd
        // keeps the line.
        // SAFETY: the kernel just handed us this fd; we own it from here.
        Ok(Self {
            line_fd: unsafe { OwnedFd::from_raw_fd(req.fd) },
        })
    }

    /// Drive the line high or low.
    pub fn set(&mut self, high: bool) -> io::Result<()> {
        let mut values = GpioV2LineValues {
            bits: high as u64,
            mask: 1,
        };
        // SAFETY: line_fd is a valid line handle; the struct layout is pinned.
        let rc = unsafe {
            libc::ioctl(
                self.line_fd.as_raw_fd(),
                ioctl::gpio_v2_line_set_values() as libc::c_ulong,
                &mut values,
            )
        };
        if rc < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::mem::size_of;

    #[test]
    fn uapi_struct_layouts_match_the_kernel() {
        assert_eq!(size_of::<GpioV2LineAttribute>(), 16);
        assert_eq!(size_of::<GpioV2LineConfigAttribute>(), 24);
        assert_eq!(size_of::<GpioV2LineConfig>(), 272);
        assert_eq!(size_of::<GpioV2LineRequest>(), 592);
        assert_eq!(size_of::<GpioV2LineValues>(), 16);
    }

    #[test]
    fn uapi_field_offsets_match_the_kernel() {
        use std::mem::offset_of;
        // gpio_v2_line_config: flags u64 (0), num_attrs u32 (8),
        // padding [u32; 5] (12..32), attrs (32).
        assert_eq!(offset_of!(GpioV2LineConfig, attrs), 32);
        // gpio_v2_line_request: offsets [u32; 64] (0..256), consumer
        // [u8; 32] (256..288), config 272 bytes (288..560), num_lines (560),
        // event_buffer_size (564), padding [u32; 5] (568..588), fd (588).
        assert_eq!(offset_of!(GpioV2LineRequest, config), 288);
        assert_eq!(offset_of!(GpioV2LineRequest, num_lines), 560);
        assert_eq!(offset_of!(GpioV2LineRequest, fd), 588);
    }

    #[test]
    fn opening_a_non_gpio_path_is_an_error_not_a_panic() {
        assert!(GpioLine::open(std::path::Path::new("/dev/null"), 0, "thunk-test").is_err());
    }
}
