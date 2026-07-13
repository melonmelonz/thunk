//! `thunk` command-line front-end. Renders the one content source to the terminal.

mod kit;

use clap::{Parser, Subcommand};
use thunk_content::Curriculum;
use thunk_core::{ladder_state, progress_from_ron, state_path, ModuleStatus, Progress};
use thunk_sim::{boot::boot_splash_via_display, boot_finale, Ili9341, SimSpi};

#[derive(Parser)]
#[command(
    name = "thunk",
    version,
    about = "A systems course. Offline, from the ground up."
)]
struct Cli {
    #[command(subcommand)]
    cmd: Option<Cmd>,
}

#[derive(Subcommand)]
enum Cmd {
    /// Launch the terminal classroom (reader + checks + panel).
    Tui,
    /// Print a lesson (defaults to the first lesson of the course).
    Read { lesson: Option<String> },
    /// List every check, by module.
    Check,
    /// Show what mastery requires.
    Progress {
        /// Print per-module mastery as CSV instead of the ladder view.
        #[arg(long)]
        export: bool,
    },
    /// Boot the simulated panel and print it as ASCII.
    Sim {
        /// Show the boot splash (color bars) instead of the finale.
        #[arg(long)]
        splash: bool,
        /// Print the annotated bus trace instead of the panel.
        #[arg(long)]
        trace: bool,
    },
    /// Write the whole course as an offline static site.
    Web {
        /// Directory to write the site into (created if missing).
        #[arg(long, default_value = "thunk-site")]
        out: std::path::PathBuf,
    },
    /// Write the facilitator kit: pacing guide + answer key, generated
    /// from the curriculum in this binary.
    Kit {
        /// Directory to write the kit into (created if missing).
        #[arg(long, default_value = "thunk-kit")]
        out: std::path::PathBuf,
    },
    /// Serve the site on 127.0.0.1 - a convenience; the written site also
    /// works opened straight from disk.
    Serve {
        /// Port on the loopback interface.
        #[arg(long, default_value_t = 7878)]
        port: u16,
    },
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
}

fn main() {
    match Cli::parse().cmd {
        None => print!("{}", overview()),
        Some(Cmd::Tui) => {
            if let Err(e) = thunk_tui::run() {
                eprintln!("thunk: could not start the classroom: {e}");
                std::process::exit(1);
            }
        }
        Some(Cmd::Read { lesson }) => print!("{}", read(lesson.as_deref())),
        Some(Cmd::Check) => print!("{}", checks()),
        Some(Cmd::Progress { export }) => {
            if export {
                print!("{}", kit::export_csv(&saved_progress().1));
            } else {
                print!("{}", progress());
            }
        }
        Some(Cmd::Sim { splash, trace }) => print!("{}", sim(splash, trace)),
        Some(Cmd::Web { out }) => match write_site(&out) {
            Ok(n) => println!(
                "wrote {n} files to {}; open {}/index.html",
                out.display(),
                out.display()
            ),
            Err(e) => {
                eprintln!("thunk: could not write the site: {e}");
                std::process::exit(1);
            }
        },
        Some(Cmd::Kit { out }) => match write_kit(&out) {
            Ok(()) => println!(
                "wrote pacing.md and answer-key.md to {} - the answer key is for facilitators",
                out.display()
            ),
            Err(e) => {
                eprintln!("thunk: could not write the kit: {e}");
                std::process::exit(1);
            }
        },
        Some(Cmd::Serve { port }) => {
            if let Err(e) = serve(port) {
                eprintln!("thunk: could not serve the site: {e}");
                std::process::exit(1);
            }
        }
        #[cfg(feature = "open")]
        Some(Cmd::Hw {
            spidev,
            dc_chip,
            dc_line,
            rst_line,
            speed_hz,
            frames,
        }) => {
            if let Err(e) = run_hw(&spidev, &dc_chip, dc_line, rst_line, speed_hz, frames) {
                eprintln!("thunk: could not drive the panel: {e}");
                std::process::exit(1);
            }
        }
    }
}

/// Boot the finale on real wires: hardware reset (if wired) out here, then
/// the same `boot_finale`/`finale_tick` the simulator runs, over spidev.
#[cfg(feature = "open")]
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
    use thunk_sim::finale_tick;

    // Hold the RST line handle for the whole run: releasing it back to the
    // kernel mid-run would let a pull-down re-assert reset on some boards.
    let mut rst_hold = None;
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
        rst_hold = Some(rst);
    }
    let dc = GpioLine::open(dc_chip, dc_line, "thunk-dc").map_err(|e| format!("dc: {e}"))?;
    let mut bus = SpidevBus::open(spidev, speed_hz, dc).map_err(|e| format!("spidev: {e}"))?;
    boot_finale(&mut bus, 240, 320);
    // Fail fast: a wiring error surfaces on the very first transfer; do not
    // sleep through a hundred frames of a dead bus to report it.
    if let Some(e) = bus.take_error() {
        return Err(format!("bus: {e}"));
    }
    for t in 1..frames {
        finale_tick(&mut bus, 240, 320, t);
        thread::sleep(Duration::from_millis(30));
    }
    if let Some(e) = bus.take_error() {
        return Err(format!("bus: {e}"));
    }
    drop(rst_hold);
    println!("drove {frames} frames over {}", spidev.display());
    Ok(())
}

/// Write the generated site under `dir`, creating directories as needed.
/// Returns how many files landed.
fn write_site(dir: &std::path::Path) -> std::io::Result<usize> {
    let files = thunk_web::Site::generate();
    for (rel, body) in &files {
        let path = dir.join(rel);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, body)?;
    }
    Ok(files.len())
}

/// Write the facilitator kit under `dir`, creating it as needed - the same
/// shape as `write_site`, two fixed files instead of a tree.
fn write_kit(dir: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    std::fs::write(dir.join("pacing.md"), kit::pacing_md())?;
    std::fs::write(dir.join("answer-key.md"), kit::answer_key_md())?;
    Ok(())
}

/// The generated site keyed by request path, so `serve` answers entirely
/// from memory - nothing is read from disk, nothing leaves the machine.
fn site_map() -> std::collections::HashMap<String, String> {
    thunk_web::Site::generate()
        .into_iter()
        .map(|(p, body)| (format!("/{}", p.display()), body))
        .collect()
}

/// Content-Type for a request path, by extension. The site only contains
/// html, css, and js (the panel SVG is inline in its page).
fn content_type(path: &str) -> &'static str {
    if path.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if path.ends_with(".js") {
        "text/javascript; charset=utf-8"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else {
        "text/html; charset=utf-8"
    }
}

/// Bind the loopback interface EXPLICITLY - the classroom never listens
/// beyond this machine. `serve` and its test share this one bind.
fn bind_loopback(port: u16) -> std::io::Result<std::net::TcpListener> {
    std::net::TcpListener::bind(("127.0.0.1", port))
}

/// Answer one HTTP request from the in-memory site: `/` and `<dir>/` map to
/// their index.html; anything unknown is a plain 404.
fn handle(
    mut stream: std::net::TcpStream,
    site: &std::collections::HashMap<String, String>,
) -> std::io::Result<()> {
    use std::io::{BufRead, BufReader, Write};
    let mut request_line = String::new();
    BufReader::new(stream.try_clone()?).read_line(&mut request_line)?;
    let mut path = request_line
        .split_whitespace()
        .nth(1)
        .unwrap_or("/")
        .to_string();
    if path.ends_with('/') {
        path.push_str("index.html");
    }
    let response = match site.get(&path) {
        Some(body) => format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            content_type(&path),
            body.len(),
        ),
        None => {
            let body = "not found";
            format!(
                "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len(),
            )
        }
    };
    stream.write_all(response.as_bytes())
}

/// Serve the site from memory, one request at a time - plenty for one
/// learner on loopback, and small enough to audit in a minute.
fn serve(port: u16) -> std::io::Result<()> {
    let listener = bind_loopback(port)?;
    let site = site_map();
    println!(
        "thunk site on 127.0.0.1:{} - loopback only; Ctrl-C stops it",
        listener.local_addr()?.port()
    );
    // Failed connections and hung-up clients are skipped or ignored; neither
    // may kill the server.
    for stream in listener.incoming().flatten() {
        let _ = handle(stream, &site);
    }
    Ok(())
}

fn ladder_tag(module_id: &str) -> String {
    module_id
        .split('-')
        .next()
        .unwrap_or(module_id)
        .to_uppercase()
}

fn overview() -> String {
    let mut s = String::from("thunk - a systems course, from the ground up\n\n");
    for m in Curriculum::all() {
        s.push_str(&format!(
            "  {:3} {:24} {} lessons\n",
            ladder_tag(&m.id.0),
            m.title,
            m.lessons.len()
        ));
    }
    s.push_str("\nTry:  thunk tui   |   thunk read   |   thunk check   |   thunk sim\n");
    s
}

fn read(which: Option<&str>) -> String {
    let modules = Curriculum::all();
    let lesson = match which {
        Some(id) => modules
            .iter()
            .flat_map(|m| m.lessons.iter())
            .find(|l| l.id.0 == id),
        None => modules.first().and_then(|m| m.lessons.first()),
    };
    match lesson {
        Some(l) => format!("{}\n", l.body),
        None => "no such lesson\n".to_string(),
    }
}

fn checks() -> String {
    let mut s = String::from("Checks, by module:\n");
    for m in Curriculum::all() {
        let cs = Curriculum::load_checks(&m.id.0);
        s.push_str(&format!(
            "\n{} - {} ({} checks)\n",
            ladder_tag(&m.id.0),
            m.title,
            cs.len()
        ));
        for (i, c) in cs.iter().enumerate() {
            s.push_str(&format!("  {}. {}\n", i + 1, c.prompt()));
        }
    }
    s
}

/// Render the gated ladder for the given progress. Pure - no env, no I/O -
/// so it is fully unit-testable; `progress()` below is the thin disk-reading
/// wrapper around it.
fn progress_with(progress: &Progress) -> String {
    let modules = Curriculum::all();
    let ladder = Curriculum::ladder();
    let statuses = ladder_state(&ladder, progress);
    let mut s =
        String::from("Mastery ladder - pass every check in a module to unlock the next:\n\n");
    for ((m, (_, checks)), status) in modules.iter().zip(ladder.iter()).zip(statuses.iter()) {
        let word = match status {
            ModuleStatus::Mastered => "mastered",
            ModuleStatus::Unlocked => "unlocked",
            ModuleStatus::Locked => "locked",
        };
        s.push_str(&format!(
            "  {:3} {:24} {}",
            ladder_tag(&m.id.0),
            m.title,
            word
        ));
        if *status == ModuleStatus::Unlocked {
            let passed = checks
                .iter()
                .filter(|c| progress.checks_passed.contains(c))
                .count();
            s.push_str(&format!("  ({passed}/{} checks)", checks.len()));
        }
        s.push('\n');
    }
    s
}

/// Saved progress from the environment-resolved state file (a fresh start
/// when there is none) - the one load path `progress` and `--export` share.
fn saved_progress() -> (std::path::PathBuf, Progress) {
    let state_dir = std::env::var("THUNK_STATE_DIR").ok();
    let xdg = std::env::var("XDG_DATA_HOME").ok();
    let home = std::env::var("HOME").ok();
    let path = state_path(state_dir.as_deref(), xdg.as_deref(), home.as_deref());
    let saved = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| progress_from_ron(&s))
        .unwrap_or_default();
    (path, saved)
}

/// The real entry point: loads saved progress and prints the ladder.
fn progress() -> String {
    let (path, saved) = saved_progress();
    let mut s = progress_with(&saved);
    s.push_str(&format!("\nProgress file: {}\n", path.display()));
    s
}

fn sim(splash: bool, trace: bool) -> String {
    let mut bus = SimSpi::new();
    let what = if splash {
        boot_splash_via_display(&mut bus, 240, 320);
        "boot splash (color bars)"
    } else {
        boot_finale(&mut bus, 240, 320);
        "the finale: a rendered corridor, drawn by the display driver"
    };
    if trace {
        // The same drive, seen as the logic analyzer would show it: every
        // annotated row (grouping keeps even the pixel stream to one line).
        let rows = thunk_sim::trace::annotate(bus.trace());
        return format!(
            "bus trace - {what}\n{} events, annotated:\n\n{}\n",
            bus.trace().len(),
            rows.join("\n")
        );
    }
    let mut panel = Ili9341::new(240, 320);
    panel.replay(bus.trace());
    let events = bus.trace().len();
    format!(
        "simulated panel - {what}\n\
         {events} bus events: init (SWRESET, SLPOUT, COLMOD, DISPON), \
         window (CASET, PASET), then RAMWR + pixel data\n\n{}",
        panel.framebuffer().to_ascii(60, 24)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overview_lists_the_whole_ladder() {
        let s = overview();
        for needle in [
            "M0",
            "Power On",
            "M1",
            "The Kernel",
            "M2",
            "Rust for the Metal",
            "M3",
            "The Bus",
            "M4",
            "The Panel",
            "M5",
            "DOOM",
            "M6",
            "Intro to Open Source",
        ] {
            assert!(s.contains(needle), "overview missing {needle:?}:\n{s}");
        }
    }

    #[test]
    fn read_defaults_to_the_first_lesson_of_the_course() {
        // The course now starts at true zero: M0, The Machine.
        assert!(read(None).to_lowercase().contains("machine"));
    }

    #[test]
    fn read_finds_a_lesson_in_any_module() {
        assert!(read(Some("02-syscalls")).to_lowercase().contains("syscall"));
        assert!(read(Some("01-why-rust")).to_lowercase().contains("rust"));
    }

    #[test]
    fn sim_boots_the_finale_by_default() {
        let s = sim(false, false);
        assert!(s.lines().count() > 20);
        assert!(s.contains("finale"), "names the scene:\n{s}");
        assert!(s.contains("bus events"), "reports the traffic:\n{s}");
    }

    #[test]
    fn sim_splash_flag_keeps_the_color_bars() {
        let s = sim(true, false);
        assert!(s.contains("color bars"), "splash still available:\n{s}");
    }

    #[test]
    fn sim_trace_prints_annotated_protocol_rows() {
        let s = sim(false, true);
        for needle in ["SWRESET", "CASET", "RAMWR", "bytes)"] {
            assert!(s.contains(needle), "missing {needle:?}:\n{s}");
        }
    }

    #[test]
    fn web_writes_the_site_to_disk() {
        let dir = std::env::temp_dir().join(format!("thunk-web-{}", std::process::id()));
        write_site(&dir).expect("site written");
        assert!(dir.join("index.html").exists());
        assert!(dir.join("sim").join("index.html").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn serve_binds_loopback_only_and_answers_one_get() {
        use std::io::{Read, Write};
        // The same bind `serve` uses: loopback EXPLICITLY, never 0.0.0.0.
        let listener = bind_loopback(0).expect("bind");
        let addr = listener.local_addr().expect("addr");
        assert_eq!(addr.ip().to_string(), "127.0.0.1");
        // Exactly one connection: the accept loop's body runs once in a
        // thread, so the test can never hang CI.
        let server = std::thread::spawn(move || {
            let site = site_map();
            let (stream, _) = listener.accept().expect("accept");
            handle(stream, &site).expect("handled");
        });
        let mut client = std::net::TcpStream::connect(addr).expect("connect");
        client
            .write_all(b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
            .expect("request");
        let mut response = String::new();
        client.read_to_string(&mut response).expect("response");
        server.join().expect("server thread");
        assert!(response.contains("200 OK"), "no 200:\n{response}");
        assert!(response.contains("text/html"), "wrong type:\n{response}");
        assert!(response.contains("thunk"), "not the site:\n{response}");
    }

    #[test]
    fn serve_maps_content_types_and_404s_the_unknown() {
        assert_eq!(content_type("/assets/thunk.css"), "text/css; charset=utf-8");
        assert_eq!(
            content_type("/assets/check.js"),
            "text/javascript; charset=utf-8"
        );
        assert_eq!(content_type("/index.html"), "text/html; charset=utf-8");
        use std::io::{Read, Write};
        let listener = bind_loopback(0).expect("bind");
        let addr = listener.local_addr().expect("addr");
        let server = std::thread::spawn(move || {
            let site = site_map();
            let (stream, _) = listener.accept().expect("accept");
            handle(stream, &site).expect("handled");
        });
        let mut client = std::net::TcpStream::connect(addr).expect("connect");
        client
            .write_all(b"GET /no-such-page HTTP/1.1\r\n\r\n")
            .expect("request");
        let mut response = String::new();
        client.read_to_string(&mut response).expect("response");
        server.join().expect("server thread");
        assert!(response.contains("404 Not Found"), "no 404:\n{response}");
    }

    #[cfg(feature = "open")]
    #[test]
    fn the_open_build_offers_the_hw_command_and_the_full_ladder() {
        use clap::CommandFactory;
        let cmd = Cli::command();
        assert!(cmd.get_subcommands().any(|s| s.get_name() == "hw"));
        assert_eq!(thunk_content::LADDER.last(), Some(&"m7-first-patch"));
    }

    #[test]
    fn kit_writes_the_facilitator_files_to_disk() {
        let dir = std::env::temp_dir().join(format!("thunk-kit-{}", std::process::id()));
        write_kit(&dir).expect("kit written");
        assert!(dir.join("pacing.md").exists());
        assert!(dir.join("answer-key.md").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn progress_export_is_csv_with_one_row_per_module() {
        let csv = kit::export_csv(&thunk_core::Progress::default());
        let mut lines = csv.lines();
        assert_eq!(
            lines.next(),
            Some("module,title,checks_passed,checks_total,mastered")
        );
        let ladder = Curriculum::ladder();
        assert_eq!(
            csv.lines().count(),
            ladder.len() + 1,
            "header + one row per module"
        );
        let first = csv.lines().nth(1).unwrap();
        assert!(first.starts_with("m0-power-on,"));
        assert!(first.ends_with(",no"), "empty progress masters nothing");
    }

    #[test]
    fn progress_prints_the_ladder_with_status() {
        // Pure and hermetic: a fresh default Progress (M0 unlocked, the rest
        // locked) exercises both status words without touching env or disk.
        let s = progress_with(&thunk_core::Progress::default());
        for needle in ["M0", "M6", "unlocked", "locked"] {
            assert!(s.contains(needle), "missing {needle:?}:\n{s}");
        }
    }
}
