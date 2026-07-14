# thunk

*A systems course. Offline, from the ground up.*

thunk is a reentry utility that teaches programming at a fundamental level; from 1s and 0s up
through Rust, we help onboard justice-impacted individuals to the world of open source as a
career-building initiative.

The course takes a learner from true zero (what a computer is, what a bit is) up through the
kernel, Rust, and a real wire protocol, and ends with a moving scene booting on a display panel
the learner's own driver code drove over a simulated SPI bus. Seven modules, 31 lessons, mastery
gates with a placement diagnostic, and three front-ends over one content source: a CLI, a
terminal classroom, and a static offline web site. Everything runs on a locked-down machine with
no network and no hardware.

A *thunk* is a piece of code that gets set aside and run later, not thrown away.

## Build and run

The binary embeds the whole course; nothing is fetched at runtime.

```sh
cargo build --release                 # offline-friendly: CARGO_NET_OFFLINE=true works
cargo run -p thunk-cli                # course overview
cargo run -p thunk-cli -- tui         # the terminal classroom (reader, checks, panel, trace)
cargo run -p thunk-cli -- read        # print a lesson
cargo run -p thunk-cli -- check       # list every check, by module
cargo run -p thunk-cli -- progress    # the gated module ladder (--export for CSV)
cargo run -p thunk-cli -- sim         # boot the finale on the simulated panel (--trace for the bus)
cargo run -p thunk-cli -- web         # write the course as a static offline site
cargo run -p thunk-cli -- serve       # serve that site on 127.0.0.1 (also works from disk)
cargo run -p thunk-cli -- kit         # facilitator kit: pacing guide + answer key
```

## The two build profiles

- **Inside** (the default build): for air-gapped machines. The hardware crate is absent from the
  dependency graph entirely, not feature-disabled; `scripts/profile-audit.sh` and CI prove it on
  every change. The only socket surface in the binary is `serve`, which binds 127.0.0.1 explicitly.
- **Open** (`--features open`): adds `thunk hw`, which drives the same finale on a real panel over
  `/dev/spidev` and GPIO with the same driver code the simulator runs, and adds module M7, First
  Patch, which walks a learner into a first real open-source contribution.

## No hardware required

The course runs at four rungs, from an in-process simulator up to a real panel, and the first
three need no hardware at all. The third boots a real Linux kernel in QEMU where the static
`thunk` binary is the only userspace on board (`./scripts/qemu-smoke.sh`, verified in CI).
See [`docs/PATHS.md`](docs/PATHS.md) for all four, each with its exact command.

## Workspace

- `thunk-core` — domain logic: content model, check grading, progress, gates, placement.
- `thunk-content` — the curriculum (M0 Power On through M6 Intro to Open Source; M7 on the open
  build), embedded at compile time and validated by its test suite.
- `thunk-sim` — the deterministic SPI bus, ILI9341-style panel protocol, trace annotation, and
  the finale frame source; the sim-or-real seam (`SpiBus`).
- `thunk-hw` — the open build's real bus: spidev + GPIO character-device backend for the seam.
- `thunk-web` — the static site generator: semantic HTML, no framework, no external assets.
- `thunk-tui` — the terminal classroom (ratatui).
- `thunk-cli` — the `thunk` binary that fronts all of it.

## Verification

Every gate is a command a contributor can run; CI only repeats them.

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets   # warnings are errors in CI
cargo test --workspace                   # 131 tests
./scripts/vocab-lint.sh                  # course-appropriate language gate
./scripts/profile-audit.sh               # inside/open graph separation
```

## Docs

Full index: [`docs/README.md`](docs/README.md) — requirements, design spec, pitch, proposal,
risk register, and print-ready PDFs.

## Status

Built and tested: the full ladder, the protocol simulator and trace view, both build profiles,
the web site, and the facilitator kit. The inside build's finale is a deterministic corridor
scene rendered through the learner-facing display driver; playable DOOM is planned for the open
build. Local repository; not yet published.

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.
