//! ioctl request numbers, derived the way the kernel derives them and pinned
//! to the well-known ABI literals by tests. No bindgen, no new dependencies.

const IOC_WRITE: u64 = 1;
const IOC_READ: u64 = 2;

/// The kernel's _IOC macro: dir(2 bits) | size(14 bits) | type(8 bits) | nr(8 bits).
const fn ioc(dir: u64, ty: u8, nr: u8, size: usize) -> u64 {
    (dir << 30) | ((size as u64) << 16) | ((ty as u64) << 8) | nr as u64
}

// The spi requests are consumed by the bus module; until it lands they are
// exercised solely by the pinned-literal tests below.
#[allow(dead_code)]
const SPI_MAGIC: u8 = b'k';
const GPIO_MAGIC: u8 = 0xB4;

#[allow(dead_code)]
pub const fn spi_wr_mode() -> u64 {
    ioc(IOC_WRITE, SPI_MAGIC, 1, 1)
}
#[allow(dead_code)]
pub const fn spi_wr_bits_per_word() -> u64 {
    ioc(IOC_WRITE, SPI_MAGIC, 3, 1)
}
#[allow(dead_code)]
pub const fn spi_wr_max_speed_hz() -> u64 {
    ioc(IOC_WRITE, SPI_MAGIC, 4, 4)
}
pub const fn gpio_v2_get_line() -> u64 {
    ioc(
        IOC_READ | IOC_WRITE,
        GPIO_MAGIC,
        0x07,
        std::mem::size_of::<crate::gpio::GpioV2LineRequest>(),
    )
}
pub const fn gpio_v2_line_set_values() -> u64 {
    ioc(
        IOC_READ | IOC_WRITE,
        GPIO_MAGIC,
        0x0F,
        std::mem::size_of::<crate::gpio::GpioV2LineValues>(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spi_requests_match_the_kernel_abi() {
        assert_eq!(spi_wr_mode(), 0x4001_6b01);
        assert_eq!(spi_wr_bits_per_word(), 0x4001_6b03);
        assert_eq!(spi_wr_max_speed_hz(), 0x4004_6b04);
    }

    #[test]
    fn gpio_v2_requests_match_the_kernel_abi() {
        assert_eq!(gpio_v2_get_line(), 0xC250_B407);
        assert_eq!(gpio_v2_line_set_values(), 0xC010_B40F);
    }
}
