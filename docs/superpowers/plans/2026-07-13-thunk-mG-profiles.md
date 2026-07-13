# thunk M-G: Inside/Open Build Profiles Implementation Plan

> **Status: DONE 2026-07-13.** Commits `f665fdb`..`9092161` + sweep; every task per-task
> spec-reviewed and quality-reviewed (subagent-driven). Two deviations from the text below,
> both recorded in commit bodies: the rust-embed `exclude` route was offline-impossible
> (globset not cached), replaced by a second embed root `modules-open/` + `OpenAssets`
> fall-through; and the quiet-latch test was hardened with a call counter after review.
> Playable DOOM on the open build stays a named follow-up (needs network).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two build profiles from one workspace: the **inside** profile (the default build, no
feature flags) contains no hardware code at all, and the **open** profile (`--features open`)
adds a real `/dev/spidev` + GPIO backend behind the same `SpiBus` seam plus the M7 First Patch
module, with a script + CI job proving the separation.

**Architecture:** "Inside" is the *absence* of the `open` feature, which is the strongest form of
the requirement: the hardware code is not disabled, it is not compiled into the dependency graph
at all. A new crate `thunk-hw` implements `thunk_sim::SpiBus` over the Linux spidev character
device (config via hand-derived ioctls on `libc`, data via chunked `write(2)`) and drives the DC
line through the GPIO v2 character-device uAPI. `thunk-cli` gains `open = ["dep:thunk-hw",
"thunk-content/open"]` and a feature-gated `thunk hw` subcommand that boots the existing finale
through the existing `Display` driver on real wires. `thunk-content` gains an `open` feature that
adds `m7-first-patch` to the ladder. `scripts/profile-audit.sh` asserts via `cargo tree` that the
inside graph excludes `thunk-hw` and the open graph includes it; a CI `profiles` job runs it and
builds/tests the open profile.

**Tech Stack:** Rust 1.88, offline (`CARGO_NET_OFFLINE=true`). ONE new dependency: `libc` 0.2
(present in the offline cache; verified). The `spidev` crate is NOT in the cache — the ioctl
constants are hand-derived and machine-checked against the known kernel ABI values, the same
literals-pinned-by-tests discipline M-E used for waveforms.

**Explicitly out of scope, on the record:** playable DOOM on the open build (Penn's M-D decision
routes it here) requires doomgeneric sources and a WAD that cannot be fetched in this offline
sandbox. It stays a named follow-up for a session with network access; the open `hw` command
drives the corridor finale, which already proves the seam end to end.

**Seam policy (locks the M-C design note):** `SpiBus` stays infallible and timeless. The real
implementation latches the first `io::Error` internally (`take_error()` after driving) and honors
the two datasheet settle times (SWRESET, SLPOUT) inside the bus, because panel timing is a
wire-level property; long delays like hardware reset live in the caller.

---

## File Structure

```
thunk-hw/                    # NEW crate, workspace member; compiled always, linked only by open
  Cargo.toml                 # deps: thunk-sim (path), libc (workspace)
  src/lib.rs                 # exports SpidevBus, GpioLine, DcPin
  src/ioctl.rs               # _IOC math + SPI/GPIO request numbers, machine-checked
  src/gpio.rs                # GPIO v2 uAPI structs + GpioLine (output line handle)
  src/bus.rs                 # SpidevBus: SpiBus over /dev/spidevX.Y + a DcPin
Cargo.toml                   # members += thunk-hw; workspace.dependencies += libc
thunk-content/Cargo.toml     # [features] open = []
thunk-content/src/lib.rs     # cfg'd LADDER (+m7), PLACEMENT_LADDER, cfg_attr embed exclude
thunk-content/modules/m7-first-patch/   # module.ron + 3 lessons + checks.ron (open build)
thunk-cli/Cargo.toml         # [features] open = ["dep:thunk-hw", "thunk-content/open"]
thunk-cli/src/main.rs        # feature-gated Hw subcommand
scripts/profile-audit.sh     # cargo tree separation assertions
.github/workflows/ci.yml     # + profiles job
```

---

### Task 1: thunk-hw crate + the ioctl request math

**Files:**
- Modify: `Cargo.toml` (workspace members + `libc = "0.2"` under `[workspace.dependencies]`)
- Create: `thunk-hw/Cargo.toml`, `thunk-hw/src/lib.rs`, `thunk-hw/src/ioctl.rs`

`thunk-hw/Cargo.toml`:

```toml
[package]
name = "thunk-hw"
version.workspace = true
edition.workspace = true
license.workspace = true
description = "thunk open-build hardware backend: SpiBus over Linux spidev + GPIO."

[dependencies]
thunk-sim = { path = "../thunk-sim" }
libc = { workspace = true }
```

`thunk-hw/src/lib.rs` starts as:

```rust
//! The open build's real bus: the same `SpiBus` the simulator implements,
//! pointed at /dev/spidev and a GPIO line. Never compiled into the inside build.

mod bus;
mod gpio;
mod ioctl;

pub use bus::{DcPin, SpidevBus};
pub use gpio::GpioLine;
```

(For this task only, comment out the `bus`/`gpio` lines; they land in Tasks 2-3.)

- [x] **Step 1: Write the failing tests** in `thunk-hw/src/ioctl.rs`. The expected literals are
the kernel's own values (spidev: `linux/spi/spidev.h`, magic `'k'`; GPIO v2: `linux/gpio.h`,
magic `0xB4`) — the same numbers `strace` shows on a real system:

```rust
//! ioctl request numbers, derived the way the kernel derives them and pinned
//! to the well-known ABI literals by tests. No bindgen, no new dependencies.

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
```

- [x] **Step 2:** Run `CARGO_NET_OFFLINE=true cargo test -p thunk-hw` — expected: COMPILE FAIL
(functions not defined). Observe it fail.
- [x] **Step 3: Implement** in `ioctl.rs` (sizes for the GPIO requests come from Task 2's structs;
for this task use the literal sizes with a comment, then Task 2 replaces them with
`mem::size_of`):

```rust
const IOC_WRITE: u64 = 1;
const IOC_READ: u64 = 2;

/// The kernel's _IOC macro: dir(2 bits) | size(14 bits) | type(8 bits) | nr(8 bits).
const fn ioc(dir: u64, ty: u8, nr: u8, size: usize) -> u64 {
    (dir << 30) | ((size as u64) << 16) | ((ty as u64) << 8) | nr as u64
}

const SPI_MAGIC: u8 = b'k';
const GPIO_MAGIC: u8 = 0xB4;

pub const fn spi_wr_mode() -> u64 {
    ioc(IOC_WRITE, SPI_MAGIC, 1, 1)
}
pub const fn spi_wr_bits_per_word() -> u64 {
    ioc(IOC_WRITE, SPI_MAGIC, 3, 1)
}
pub const fn spi_wr_max_speed_hz() -> u64 {
    ioc(IOC_WRITE, SPI_MAGIC, 4, 4)
}
pub const fn gpio_v2_get_line() -> u64 {
    // sizeof(struct gpio_v2_line_request) == 592; Task 2 swaps in size_of.
    ioc(IOC_READ | IOC_WRITE, GPIO_MAGIC, 0x07, 592)
}
pub const fn gpio_v2_line_set_values() -> u64 {
    // sizeof(struct gpio_v2_line_values) == 16; Task 2 swaps in size_of.
    ioc(IOC_READ | IOC_WRITE, GPIO_MAGIC, 0x0F, 16)
}
```

If `/usr/include/linux/gpio.h` exists on the build box, eyeball the constants against it once
(`grep -A2 GPIO_V2_GET_LINE_IOCTL /usr/include/linux/gpio.h`) and note the result in the commit
message body.

- [x] **Step 4:** Run `CARGO_NET_OFFLINE=true cargo test -p thunk-hw` — expected: PASS. Then
`cargo fmt` and `CARGO_NET_OFFLINE=true cargo clippy -p thunk-hw --all-targets` — clean.
- [x] **Step 5: Commit:** `feat(hw): thunk-hw crate - ioctl request math, pinned to the kernel ABI`

---

### Task 2: GPIO v2 line handle

**Files:**
- Create: `thunk-hw/src/gpio.rs`
- Modify: `thunk-hw/src/lib.rs` (enable `mod gpio; pub use gpio::GpioLine;`),
  `thunk-hw/src/ioctl.rs` (sizes via `size_of`)

- [x] **Step 1: Write the failing tests** in `gpio.rs`. Layout is the contract with the kernel;
pin every size:

```rust
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
    fn opening_a_non_gpio_path_is_an_error_not_a_panic() {
        assert!(GpioLine::open(std::path::Path::new("/dev/null"), 0, "thunk-test").is_err());
    }
}
```

- [x] **Step 2:** Run `CARGO_NET_OFFLINE=true cargo test -p thunk-hw` — expected: COMPILE FAIL.
- [x] **Step 3: Implement:**

```rust
//! The GPIO v2 character-device uAPI (linux/gpio.h), by hand: request one
//! output line from a gpiochip, then set it high or low. This is how DC and
//! RST are driven on the open build.

use crate::ioctl;
use std::fs::{File, OpenOptions};
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
        let chip_file = OpenOptions::new().read(true).write(true).open(chip)?;
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
        if rc < 0 || req.fd < 0 {
            return Err(io::Error::last_os_error());
        }
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
```

Also in `ioctl.rs`, replace the literal sizes with the real ones (keep the pinned-literal tests
untouched — they now prove the struct sizes too):

```rust
pub const fn gpio_v2_get_line() -> u64 {
    ioc(IOC_READ | IOC_WRITE, GPIO_MAGIC, 0x07, std::mem::size_of::<crate::gpio::GpioV2LineRequest>())
}
pub const fn gpio_v2_line_set_values() -> u64 {
    ioc(IOC_READ | IOC_WRITE, GPIO_MAGIC, 0x0F, std::mem::size_of::<crate::gpio::GpioV2LineValues>())
}
```

Note `File` import: `open` returns `File` from `OpenOptions`; the chip fd may be dropped after the
line is requested (the line fd keeps the line). If clippy flags the unused `File` binding pattern,
keep the explicit binding with a comment — dropping the chip early is intended.

- [x] **Step 4:** Run `CARGO_NET_OFFLINE=true cargo test -p thunk-hw` — expected: PASS (layout
sizes, /dev/null error path, and the Task 1 literals all green). fmt + clippy clean.
- [x] **Step 5: Commit:** `feat(hw): GPIO v2 output line handle over the char-device uAPI`

---

### Task 3: SpidevBus - the real SpiBus

**Files:**
- Create: `thunk-hw/src/bus.rs`
- Modify: `thunk-hw/src/lib.rs` (enable `mod bus; pub use bus::{DcPin, SpidevBus};`)

- [x] **Step 1: Write the failing tests** in `bus.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;
    use thunk_sim::{Dc, SpiBus};

    struct FakeDc {
        log: Rc<RefCell<Vec<Dc>>>,
        fail: bool,
    }
    impl DcPin for FakeDc {
        fn set(&mut self, dc: Dc) -> std::io::Result<()> {
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
        let dc = FakeDc { log: Rc::default(), fail: false };
        assert!(SpidevBus::open(std::path::Path::new("/dev/null"), 8_000_000, dc).is_err());
    }

    #[test]
    fn set_dc_reaches_the_pin() {
        let log = Rc::new(RefCell::new(Vec::new()));
        let mut bus = null_bus(FakeDc { log: Rc::clone(&log), fail: false });
        bus.set_dc(Dc::Command);
        bus.set_dc(Dc::Data);
        assert_eq!(*log.borrow(), vec![Dc::Command, Dc::Data]);
        assert!(bus.take_error().is_none());
    }

    #[test]
    fn the_first_error_is_latched_and_the_bus_goes_quiet() {
        let mut bus = null_bus(FakeDc { log: Rc::default(), fail: true });
        bus.set_dc(Dc::Data);
        bus.write(&[0xAA]); // after the latch: a no-op, not a second error
        let e = bus.take_error().expect("the dc failure was latched");
        assert_eq!(e.to_string(), "dc pin unavailable");
        assert!(bus.take_error().is_none(), "take_error drains");
    }
}
```

- [x] **Step 2:** Run `CARGO_NET_OFFLINE=true cargo test -p thunk-hw` — expected: COMPILE FAIL.
- [x] **Step 3: Implement:**

```rust
//! `SpiBus` over /dev/spidevX.Y. Config is three ioctls at open; data is
//! chunked write(2), which spidev performs as half-duplex TX transfers with
//! the controller driving chip select. `SpiBus` is infallible by design (the
//! M-C seam decision), so the first io error is latched and the bus goes
//! quiet; callers check `take_error()` after driving.

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
        self.set(dc == Dc::Data)
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
        Ok(Self { spi, dc, error: None })
    }

    #[cfg(test)]
    fn from_parts(spi: File, dc: P) -> Self {
        Self { spi, dc, error: None }
    }

    /// The first error since the last call, if any. Draining.
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
        // here so `Display::init` stays timeless on every bus.
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
```

Note: the settle match keys on the byte pattern alone, not DC state; a 1-byte data write of 0x01
or 0x11 would also settle. That is a deliberate simplification (a spurious sleep is harmless; a
missing one bricks the init) — keep the comment honest about it if clippy or review asks.

Check what `thunk_sim` re-exports: the CLI uses `thunk_sim::...` paths today. If `Dc`, `SpiBus`
are not at the crate root (`thunk-sim/src/lib.rs`), import from `thunk_sim::spi::{Dc, SpiBus}`
and mirror whichever path the workspace already uses.

- [x] **Step 4:** Run `CARGO_NET_OFFLINE=true cargo test -p thunk-hw` — expected: PASS. fmt +
clippy clean. Also run `CARGO_NET_OFFLINE=true cargo test --workspace` — expected: 118 + new
tests, no regressions.
- [x] **Step 5: Commit:** `feat(hw): SpidevBus - the real SpiBus over spidev, error-latched`

---

### Task 4: thunk-content `open` feature + the M7 scaffold

**Files:**
- Modify: `thunk-content/Cargo.toml`, `thunk-content/src/lib.rs`
- Create: `thunk-content/modules/m7-first-patch/module.ron`,
  `01-picking-a-project.md`, `02-a-docs-fix.md`, `03-review-and-merge.md`, `checks.ron`

`thunk-content/Cargo.toml` gains:

```toml
[features]
# The open build adds M7 First Patch: the internet-facing module, done on the
# outside. The inside build never embeds it.
open = []
```

- [x] **Step 1: Write the failing tests.** In `thunk-content/src/lib.rs`, replace
`the_ladder_is_complete_m0_through_m6` with a cfg'd pair, and add the embed assertions:

```rust
#[cfg(not(feature = "open"))]
#[test]
fn the_inside_ladder_is_complete_m0_through_m6() {
    assert_eq!(
        LADDER,
        &["m0-power-on", "m1-kernel", "m2-rust", "m3-bus", "m4-panel", "m5-doom", "m6-open-source"]
    );
    assert!(Assets::get("m7-first-patch/module.ron").is_none(), "m7 must not be embedded inside");
}

#[cfg(feature = "open")]
#[test]
fn the_open_ladder_adds_m7_last() {
    assert_eq!(LADDER.len(), 8);
    assert_eq!(LADDER[..7], PLACEMENT_LADDER[..]);
    assert_eq!(LADDER[7], "m7-first-patch");
    assert!(Assets::get("m7-first-patch/module.ron").is_some());
}

#[test]
fn placement_never_covers_m7() {
    assert_eq!(PLACEMENT_LADDER.last(), Some(&"m6-open-source"));
}
```

Also update `placement_covers_every_module_with_three_existing_checks` to iterate
`PLACEMENT_LADDER` instead of `LADDER` (both loops and the final
`assert_eq!(items.len(), PLACEMENT_LADDER.len() * 3)`), so it stays true on the open build.

- [x] **Step 2:** Run both, observe failures (compile fail on `PLACEMENT_LADDER`, then missing
m7 assets under the feature):

```sh
CARGO_NET_OFFLINE=true cargo test -p thunk-content
CARGO_NET_OFFLINE=true cargo test -p thunk-content --features open
```

- [x] **Step 3: Implement the gating** in `thunk-content/src/lib.rs`:

```rust
#[derive(RustEmbed)]
#[folder = "modules/"]
#[cfg_attr(not(feature = "open"), exclude = "m7-first-patch/*")]
struct Assets;

/// The course ladder, in order. The inside build ends at M6; the open build
/// adds M7 First Patch, the internet-facing module.
#[cfg(not(feature = "open"))]
pub const LADDER: &[&str] = &[
    "m0-power-on", "m1-kernel", "m2-rust", "m3-bus", "m4-panel", "m5-doom", "m6-open-source",
];
#[cfg(feature = "open")]
pub const LADDER: &[&str] = &[
    "m0-power-on", "m1-kernel", "m2-rust", "m3-bus", "m4-panel", "m5-doom", "m6-open-source",
    "m7-first-patch",
];

/// The placement diagnostic covers M0-M6 on every build: knowledge modules
/// you can test out of. Nobody tests out of doing the first contribution.
pub const PLACEMENT_LADDER: &[&str] = &[
    "m0-power-on", "m1-kernel", "m2-rust", "m3-bus", "m4-panel", "m5-doom", "m6-open-source",
];
```

(If `cfg_attr` + the `exclude` helper attribute fails to expand under the derive, fall back to two
`cfg`'d `Assets` definitions, each with its own full attribute set, and say so in the commit body.)

- [x] **Step 4: Author the M7 scaffold.** `module.ron`:

```ron
(
    id: "m7-first-patch",
    title: "First Patch",
    lessons: [
        "01-picking-a-project",
        "02-a-docs-fix",
        "03-review-and-merge",
    ],
)
```

Three lessons, engineering voice, same shape the validation suite enforces (first line `# Title`,
20+ lines, a `## Key terms` footer, no exploitation vocabulary — run `./scripts/vocab-lint.sh`):

- `01-picking-a-project.md` — `# Picking a Project`. Beats: you have used open source for the
  whole course, so start with software you already run; how to read a repository from the outside
  (README, CONTRIBUTING, the issue tracker, "good first issue" labels); on-ramps that already
  exist (kernelnewbies.org, the Linux Kernel Mentorship Program, Outreachy); pick something small
  and real over something impressive; the maintainer's time is the scarce resource.
- `02-a-docs-fix.md` — `# A Docs Fix`. Beats: why the first contribution should be documentation
  (you exercise the whole workflow with near-zero risk); finding a real defect (a stale command, a
  broken link, a wrong default) while reading docs as a newcomer, which is a superpower maintainers
  lack; fork/branch/commit recap tying back to M6's version-control lesson; writing the change
  description: what was wrong, what is right now, how you verified it.
- `03-review-and-merge.md` — `# Review and Merge`. Beats: what happens after you send it (CI,
  review comments, requests for changes); review judges the patch, not the person — respond to
  every comment, fix or discuss, never take it personally; the culture is exacting and blunt and
  blind to your past (ties to M6 lesson 05); a merged change is public and permanent with your
  name on it; the ladder from here: doc fixes, then small bugs, then, for the ambitious, drivers
  and the kernel path.

`checks.ron`: at least 3 checks per lesson, ids `m7-01-*`, `m7-02-*`, `m7-03-*`, same RON shapes
as m6 (`Choice(id, prompt, options, answer)` with the correct option at a varied index, and
`Short(id, prompt, answers)` with generous answer lists). Every canonical answer must self-grade
`Correct` — the existing suite enforces it under `--features open`. Example of the register,
lesson 01:

```ron
Choice(
    id: CheckId("m7-01-first"),
    prompt: "What is the best first project to contribute to?",
    options: [
        "software you already use, where the contribution can be small and real",
        "the most famous project you can find, for the visibility",
        "a brand-new project nobody uses yet, to avoid review",
    ],
    answer: 0,
),
```

- [x] **Step 5:** Run the full matrix — expected: ALL PASS:

```sh
CARGO_NET_OFFLINE=true cargo test -p thunk-content
CARGO_NET_OFFLINE=true cargo test -p thunk-content --features open
CARGO_NET_OFFLINE=true cargo test --workspace
./scripts/vocab-lint.sh
```

The open run proves m7 meets every content bar (self-validating checks, 3+ per lesson, key terms,
no orphans, satisfiable gate); the default run proves the inside build never sees it.

- [x] **Step 6: Commit:** `feat(content): open feature - M7 First Patch rides the open build only`

---

### Task 5: thunk-cli `open` feature + the `hw` subcommand

**Files:**
- Modify: `thunk-cli/Cargo.toml`, `thunk-cli/src/main.rs`

`thunk-cli/Cargo.toml` gains:

```toml
thunk-hw = { path = "../thunk-hw", optional = true }

[features]
# The open build: the real spidev/GPIO backend + the M7 module. The inside
# build is the default build; this feature is never on inside a facility.
open = ["dep:thunk-hw", "thunk-content/open"]
```

- [x] **Step 1: Write the failing test** (in `thunk-cli/src/main.rs`'s test module, feature-gated):

```rust
#[cfg(feature = "open")]
#[test]
fn the_open_build_offers_the_hw_command_and_the_full_ladder() {
    use clap::CommandFactory;
    let cmd = Cli::command();
    assert!(cmd.get_subcommands().any(|s| s.get_name() == "hw"));
    assert_eq!(thunk_content::LADDER.last(), Some(&"m7-first-patch"));
}
```

(Adjust `Cli` to the actual clap parser type name in main.rs; the test belongs next to the
existing CLI tests and follows their style.)

- [x] **Step 2:** Run `CARGO_NET_OFFLINE=true cargo test -p thunk-cli --features open` — expected:
FAIL (no `hw` subcommand). Also confirm the default build is untouched:
`CARGO_NET_OFFLINE=true cargo test -p thunk-cli` — PASS, unchanged.
- [x] **Step 3: Implement.** Add to the subcommand enum:

```rust
/// Drive a real panel over /dev/spidev: the same driver, real wires. (open build)
#[cfg(feature = "open")]
Hw {
    /// The spidev node wired to the panel, e.g. /dev/spidev0.0
    #[arg(long)]
    spidev: std::path::PathBuf,
    /// The gpiochip carrying the DC (and optional RST) line
    #[arg(long)]
    dc_chip: std::path::PathBuf,
    /// DC line offset on that chip
    #[arg(long)]
    dc_line: u32,
    /// RST line offset, if the panel's reset is wired
    #[arg(long)]
    rst_line: Option<u32>,
    /// SPI clock in Hz
    #[arg(long, default_value_t = 8_000_000)]
    speed_hz: u32,
    /// Frames of the finale to run
    #[arg(long, default_value_t = 120)]
    frames: u32,
},
```

and the runner (match the existing error-handling style in main.rs — if other commands return
`Result` and print via a common path, do the same):

```rust
#[cfg(feature = "open")]
#[allow(clippy::too_many_arguments)]
fn run_hw(
    spidev: &std::path::Path,
    dc_chip: &std::path::Path,
    dc_line: u32,
    rst_line: Option<u32>,
    speed_hz: u32,
    frames: u32,
) -> Result<(), String> {
    use std::{thread, time::Duration};
    use thunk_hw::{GpioLine, SpidevBus};

    if let Some(line) = rst_line {
        // Hardware reset: long, one-time delays live here, outside the bus.
        let mut rst =
            GpioLine::open(dc_chip, line, "thunk-rst").map_err(|e| format!("rst: {e}"))?;
        rst.set(true).map_err(|e| format!("rst: {e}"))?;
        thread::sleep(Duration::from_millis(5));
        rst.set(false).map_err(|e| format!("rst: {e}"))?;
        thread::sleep(Duration::from_millis(20));
        rst.set(true).map_err(|e| format!("rst: {e}"))?;
        thread::sleep(Duration::from_millis(150));
    }
    let dc = GpioLine::open(dc_chip, dc_line, "thunk-dc").map_err(|e| format!("dc: {e}"))?;
    let mut bus =
        SpidevBus::open(spidev, speed_hz, dc).map_err(|e| format!("spidev: {e}"))?;
    thunk_sim::boot_finale(&mut bus, 240, 320);
    for t in 1..frames {
        thunk_sim::finale_tick(&mut bus, 240, 320, t);
        thread::sleep(Duration::from_millis(30));
    }
    if let Some(e) = bus.take_error() {
        return Err(format!("bus: {e}"));
    }
    println!("drove {frames} frames over {}", spidev.display());
    Ok(())
}
```

(Mirror the exact `boot_finale`/`finale_tick` import paths the `sim` command already uses.)

- [x] **Step 4:** Run — expected: PASS on all four:

```sh
CARGO_NET_OFFLINE=true cargo test -p thunk-cli --features open
CARGO_NET_OFFLINE=true cargo test --workspace
CARGO_NET_OFFLINE=true cargo clippy --workspace --all-targets
CARGO_NET_OFFLINE=true cargo clippy -p thunk-cli --features open --all-targets
```

The real-hardware run cannot happen in this sandbox; the BeaglePlay bench is the manual test.
Note that in the commit body.

- [x] **Step 5: Commit:** `feat(cli): open profile - thunk hw drives the finale on real wires`

---

### Task 6: profile-audit script + CI profiles job

**Files:**
- Create: `scripts/profile-audit.sh` (chmod +x)
- Modify: `.github/workflows/ci.yml`

- [x] **Step 1: Write the script** (the "test" here is the script itself; it must fail loudly on
either violation):

```sh
#!/usr/bin/env bash
# The M-G separation gate: the inside (default) build graph must not contain
# the hardware crate at all; the open graph must.
set -euo pipefail
cd "$(dirname "$0")/.."

if CARGO_NET_OFFLINE=true cargo tree -p thunk-cli --edges normal | grep -q "thunk-hw"; then
    echo "profile-audit: FAIL - the inside graph contains thunk-hw" >&2
    exit 1
fi
if ! CARGO_NET_OFFLINE=true cargo tree -p thunk-cli --features open --edges normal | grep -q "thunk-hw"; then
    echo "profile-audit: FAIL - the open graph is missing thunk-hw" >&2
    exit 1
fi
echo "profile-audit: clean"
```

- [x] **Step 2:** Run `./scripts/profile-audit.sh` — expected: `profile-audit: clean`. Sanity-check
it can fail: run the first `cargo tree` by hand with `--features open` and confirm the grep hits.
- [x] **Step 3: Add the CI job** to `.github/workflows/ci.yml`, mirroring the existing jobs' style
exactly (same checkout/toolchain steps, `timeout-minutes`, workflow-level permissions):

```yaml
  profiles:
    name: inside/open profiles
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      # same checkout + pinned-toolchain steps as the check job
      - run: ./scripts/profile-audit.sh
      - run: cargo build -p thunk-cli --features open
      - run: cargo test -p thunk-content --features open
      - run: cargo test -p thunk-cli --features open
```

- [x] **Step 4:** Validate the workflow parses: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`.
- [x] **Step 5: Commit:** `feat(ci): profile-audit gate - inside graph clean, open graph complete`

---

### Task 7: Sweep + roadmap

- [x] Full gate, both profiles:

```sh
CARGO_NET_OFFLINE=true cargo fmt --all -- --check
CARGO_NET_OFFLINE=true cargo clippy --workspace --all-targets
CARGO_NET_OFFLINE=true cargo test --workspace
CARGO_NET_OFFLINE=true cargo test -p thunk-content -p thunk-cli --features open  # or two runs
./scripts/vocab-lint.sh
./scripts/profile-audit.sh
```

- [x] Annotate M-G **Status: DONE** in `docs/superpowers/plans/2026-07-10-thunk-buildout.md` with:
the inside profile is the default build (hardware code absent from the graph, not disabled),
`open` adds thunk-hw (hand-rolled spidev + GPIO v2 over libc; the spidev crate was not in the
offline cache) and M7 First Patch; playable DOOM on the open build remains the named follow-up
(needs network for doomgeneric + WAD); real-hardware smoke test deferred to Penn's BeaglePlay
bench. Annotate this plan's header the same way.
- [x] Commit: `chore(mG): verification sweep - two profiles, one workspace`

---

## Self-Review notes

- **Spec coverage vs M-G:** cargo features inside/open (Tasks 4-5; inside = default = absence,
  recorded as the deliberate reading of the milestone), real-hardware SpiBus over spidev (Tasks
  1-3), M6-M7 open-source track scaffolded (M6 shipped in M-A; M7 in Task 4, open-gated), the
  build/test asserting the inside profile has no hardware code present (Task 6, `cargo tree` +
  CI; stronger than a symbol grep because the crate is absent from the graph), both profiles
  build (Task 6 CI).
- **Placeholder scan:** the M7 lesson prose is specified by beats + the machine-enforced shape
  (the validation suite is the spec), not full text - deliberate: prose is authored, not coded.
  All code steps carry complete code.
- **Type consistency:** `GpioLine::open(&Path, u32, &str)` / `set(bool)` used identically in
  Tasks 2 and 5; `SpidevBus::open(&Path, u32, P) -> io::Result<Self>` / `take_error()` in Tasks
  3 and 5; `DcPin::set(Dc) -> io::Result<()>` in Tasks 3 and 5; `PLACEMENT_LADDER` in Task 4's
  tests and impl. `Dc::Data` = DC high per ILI9341, stated once in Task 3 and relied on in Task 5.
- **Known risks, on the record:** GPIO v2 struct sizes are hand-derived (pinned by tests; verify
  against /usr/include/linux/gpio.h if present); `cfg_attr` + rust-embed `exclude` has a stated
  fallback; the settle-time byte-pattern match is deliberately DC-blind.
