//! `thunk` command-line front-end. Renders the one content source to the terminal.

use clap::{Parser, Subcommand};
use thunk_content::Curriculum;
use thunk_core::{
    ladder_state, progress_from_ron, state_path, CheckId, ModuleId, ModuleStatus, Progress,
};
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

/// Every module paired with the check ids that must all pass to master it,
/// in ladder order - the shape `ladder_state` expects.
fn ladder() -> Vec<(ModuleId, Vec<CheckId>)> {
    Curriculum::all()
        .iter()
        .map(|m| {
            let ids = Curriculum::load_checks(&m.id.0)
                .iter()
                .map(|c| c.id().clone())
                .collect();
            (m.id.clone(), ids)
        })
        .collect()
}

/// Render the gated ladder for the given progress. Pure - no env, no I/O -
/// so it is fully unit-testable; `progress()` below is the thin disk-reading
/// wrapper around it.
fn progress_with(progress: &Progress) -> String {
    let modules = Curriculum::all();
    let ladder = ladder();
    let statuses = ladder_state(&ladder, progress);
    let mut s = String::from("Mastery ladder - pass every check in a module to unlock the next:\n\n");
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

/// The real entry point: loads saved progress from the environment-resolved
/// state file (a fresh start when there is none) and prints the ladder.
fn progress() -> String {
    let state_dir = std::env::var("THUNK_STATE_DIR").ok();
    let xdg = std::env::var("XDG_DATA_HOME").ok();
    let home = std::env::var("HOME").ok();
    let path = state_path(state_dir.as_deref(), xdg.as_deref(), home.as_deref());
    let saved = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| progress_from_ron(&s))
        .unwrap_or_default();
    let mut s = progress_with(&saved);
    s.push_str(&format!("\nProgress saved to {}\n", path.display()));
    s
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
