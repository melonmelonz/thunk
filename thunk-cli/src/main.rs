//! `thunk` command-line front-end. Renders the one content source to the terminal.

use clap::{Parser, Subcommand};
use thunk_content::Curriculum;
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
    Progress,
    /// Boot the simulated panel and print it as ASCII.
    Sim {
        /// Show the boot splash (color bars) instead of the finale.
        #[arg(long)]
        splash: bool,
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
        Some(Cmd::Progress) => print!("{}", progress()),
        Some(Cmd::Sim { splash }) => print!("{}", sim(splash)),
    }
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

fn progress() -> String {
    let total: usize = Curriculum::all()
        .iter()
        .map(|m| Curriculum::load_checks(&m.id.0).len())
        .sum();
    format!("Mastery = pass every check in a module to unlock the next. {total} checks across the course.\n")
}

fn sim(splash: bool) -> String {
    let mut bus = SimSpi::new();
    let what = if splash {
        boot_splash_via_display(&mut bus, 240, 320);
        "boot splash (color bars)"
    } else {
        boot_finale(&mut bus, 240, 320);
        "the finale: a rendered corridor, drawn by the display driver"
    };
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
        let s = sim(false);
        assert!(s.lines().count() > 20);
        assert!(s.contains("finale"), "names the scene:\n{s}");
        assert!(s.contains("bus events"), "reports the traffic:\n{s}");
    }

    #[test]
    fn sim_splash_flag_keeps_the_color_bars() {
        let s = sim(true);
        assert!(s.contains("color bars"), "splash still available:\n{s}");
    }
}
