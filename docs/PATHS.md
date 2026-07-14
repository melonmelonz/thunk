# Running thunk: the four rungs

The course has to work on whatever machine a learner actually has, which usually means no
hardware, and sometimes no permission to install anything. So there are four ways to run it,
in increasing order of how much machine you have. Every rung runs the same course from the
same binary; nothing is a demo build.

## 1. The simulator, in-process

The default. The SPI bus, the panel, and the boot sequence are all simulated inside the
`thunk` process, deterministically. This is where the course lives day to day: the terminal
classroom, the checks, the annotated bus trace.

```sh
cargo run -p thunk-cli -- tui          # the terminal classroom
cargo run -p thunk-cli -- sim --trace  # the bus trace, annotated byte by byte
```

## 2. The offline web build

The whole course as a static site: plain HTML, no framework, no external URLs (CI proves
zero, every commit). Works opened straight from disk on a machine where nothing can be
installed and nothing may phone out.

```sh
cargo run -p thunk-cli -- web --out site   # then open site/index.html
```

## 3. QEMU: same binary, real kernel, no hardware

Boot a real Linux kernel in an emulated machine where the static `thunk` binary is the only
userspace on board. PID 1 is a five-line init script; the only other program is a static
busybox to interpret it. The course runs, prints its bus trace over the serial console, and
powers the machine off. No KVM required, so it works anywhere QEMU installs, including CI.

```sh
./scripts/qemu-smoke.sh                # finds a kernel in /boot or /usr/lib/modules
THUNK_QEMU_KERNEL=/tmp/vmlinuz ./scripts/qemu-smoke.sh   # or point it at one
```

This rung exists for two reasons. It proves deployment: the exact artifact a facility would
receive boots on a bare kernel with no distribution underneath it. And it is a course
artifact in its own right: by module M4 a learner has read about kernels for weeks, and
"boot Linux; the only program is the course you are taking" is the cheapest real kernel
they can hold in one hand.

## 4. A real panel, on the open build

The open profile (`--features open`) adds `thunk hw`, which drives the same finale on a
physical ILI9341-class panel over `/dev/spidev` and GPIO, with the same driver code the
simulator runs. This is the rung for the outside: a BeaglePlay or similar board and about
eight wires.

```sh
cargo run -p thunk-cli --features open -- hw \
    --spidev /dev/spidev0.0 --dc-chip /dev/gpiochip2 --dc-line 10
```

The seam between rungs 1-3 and rung 4 is one trait (`SpiBus`); the inside build carries no
hardware code at all, which `scripts/profile-audit.sh` proves on every change.
