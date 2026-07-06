//! `thunk` command-line front-end. Renders the one content source to the terminal.

use clap::{Parser, Subcommand};
use thunk_content::Curriculum;
use thunk_sim::{boot::boot_splash, panel::Panel};

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
    /// Print a lesson (defaults to the first lesson of Module 1).
    Read { lesson: Option<String> },
    /// List the checks for Module 1.
    Check,
    /// Show what mastery of Module 1 requires.
    Progress,
    /// Boot the simulated panel and print it as ASCII.
    Sim,
}

fn main() {
    match Cli::parse().cmd {
        None => print!("{}", overview()),
        Some(Cmd::Read { lesson }) => print!("{}", read(lesson.as_deref())),
        Some(Cmd::Check) => print!("{}", checks()),
        Some(Cmd::Progress) => print!("{}", progress()),
        Some(Cmd::Sim) => print!("{}", sim()),
    }
}

fn overview() -> String {
    let m = Curriculum::module_one();
    let mut s = format!("thunk - Module 1: {}\n\nLessons:\n", m.title);
    for l in &m.lessons {
        s.push_str(&format!("  {}  {}\n", l.id.0, l.title));
    }
    s.push_str("\nTry:  thunk read   |   thunk check   |   thunk sim\n");
    s
}

fn read(which: Option<&str>) -> String {
    let m = Curriculum::module_one();
    let lesson = match which {
        Some(id) => m.lessons.iter().find(|l| l.id.0 == id),
        None => m.lessons.first(),
    };
    match lesson {
        Some(l) => format!("{}\n", l.body),
        None => "no such lesson\n".to_string(),
    }
}

fn checks() -> String {
    let mut s = String::from("Module 1 checks:\n\n");
    for (i, c) in Curriculum::module_one_checks().iter().enumerate() {
        s.push_str(&format!("{}. {}\n", i + 1, c.prompt()));
    }
    s
}

fn progress() -> String {
    let n = Curriculum::module_one_checks().len();
    format!(
        "Mastery of Module 1 = pass all {n} checks. Interactive tracking arrives with the TUI.\n"
    )
}

fn sim() -> String {
    let mut p = Panel::new(240, 320);
    boot_splash(&mut p);
    format!(
        "simulated panel - boot splash (color bars)\n\n{}",
        p.to_ascii(60, 24)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overview_lists_module_one() {
        assert!(overview().contains("The Kernel"));
    }

    #[test]
    fn read_defaults_to_first_lesson() {
        assert!(read(None).to_lowercase().contains("kernel"));
    }

    #[test]
    fn sim_renders_ascii_rows() {
        assert!(sim().lines().count() > 20);
    }
}
