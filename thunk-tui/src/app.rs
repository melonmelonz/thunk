//! The classroom state machine. Pure and testable: no terminal, no I/O here.

use thunk_content::Curriculum;
use thunk_core::{Answer, Check, Lesson, Module, Progress, Verdict};
use thunk_sim::{boot_splash, Panel};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scene {
    Reader,
    Checks,
    Panel,
    Help,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Action {
    Quit,
    Back,
    OpenChecks,
    OpenPanel,
    OpenHelp,
    ScrollUp,
    ScrollDown,
    NextLesson,
    PrevLesson,
    SelectPrev,
    SelectNext,
    Char(char),
    Backspace,
    Submit,
    NextCheck,
}

pub struct App {
    pub module: Module,
    pub checks: Vec<Check>,
    pub progress: Progress,
    pub scene: Scene,
    pub lesson_idx: usize,
    pub scroll: u16,
    pub check_idx: usize,
    pub selected: usize,
    pub input: String,
    pub last_verdict: Option<Verdict>,
    pub should_quit: bool,
    pub panel: Panel,
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}

impl App {
    pub fn new() -> Self {
        let module = Curriculum::module_one();
        let checks = Curriculum::module_one_checks();
        let mut panel = Panel::new(240, 320);
        boot_splash(&mut panel);
        let mut app = Self {
            module,
            checks,
            progress: Progress::default(),
            scene: Scene::Reader,
            lesson_idx: 0,
            scroll: 0,
            check_idx: 0,
            selected: 0,
            input: String::new(),
            last_verdict: None,
            should_quit: false,
            panel,
        };
        app.mark_current_read();
        app
    }

    pub fn current_lesson(&self) -> &Lesson {
        &self.module.lessons[self.lesson_idx]
    }

    pub fn current_check(&self) -> Option<&Check> {
        self.checks.get(self.check_idx)
    }

    fn mark_current_read(&mut self) {
        let id = self.module.lessons[self.lesson_idx].id.clone();
        self.progress.read_lesson(&id);
    }

    fn reset_check_input(&mut self) {
        self.selected = 0;
        self.input.clear();
        self.last_verdict = None;
    }

    pub fn update(&mut self, action: Action) {
        match action {
            Action::Quit => self.should_quit = true,
            Action::Back => self.scene = Scene::Reader,
            Action::OpenChecks => {
                self.scene = Scene::Checks;
                self.reset_check_input();
            }
            Action::OpenPanel => self.scene = Scene::Panel,
            Action::OpenHelp => self.scene = Scene::Help,
            Action::ScrollUp => self.scroll = self.scroll.saturating_sub(1),
            Action::ScrollDown => self.scroll = self.scroll.saturating_add(1),
            Action::NextLesson => {
                if self.lesson_idx + 1 < self.module.lessons.len() {
                    self.lesson_idx += 1;
                    self.scroll = 0;
                    self.mark_current_read();
                }
            }
            Action::PrevLesson => {
                if self.lesson_idx > 0 {
                    self.lesson_idx -= 1;
                    self.scroll = 0;
                    self.mark_current_read();
                }
            }
            Action::SelectPrev => self.selected = self.selected.saturating_sub(1),
            Action::SelectNext => {
                if let Some(Check::Choice { options, .. }) = self.checks.get(self.check_idx) {
                    if self.selected + 1 < options.len() {
                        self.selected += 1;
                    }
                }
            }
            Action::Char(c) => self.input.push(c),
            Action::Backspace => {
                self.input.pop();
            }
            Action::Submit => {
                if let Some(c) = self.checks.get(self.check_idx) {
                    let answer = match c {
                        Check::Choice { .. } => Answer::Choice(self.selected),
                        Check::Short { .. } => Answer::Text(self.input.clone()),
                    };
                    let v = c.grade(&answer);
                    self.progress.record(c.id(), v);
                    self.last_verdict = Some(v);
                }
            }
            Action::NextCheck => {
                if !self.checks.is_empty() {
                    self.check_idx = (self.check_idx + 1) % self.checks.len();
                    self.reset_check_input();
                }
            }
        }
    }

    /// How many of the module's checks have been passed.
    pub fn passed_count(&self) -> usize {
        self.checks
            .iter()
            .filter(|c| self.progress.checks_passed.contains(c.id()))
            .count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn idx_of(app: &App, id: &str) -> usize {
        app.checks.iter().position(|c| c.id().0 == id).unwrap()
    }

    /// The correct option index and option count of a Choice check, read from
    /// the data so tests survive answer-position rebalancing.
    fn choice_shape(app: &App, id: &str) -> (usize, usize) {
        match &app.checks[idx_of(app, id)] {
            Check::Choice {
                answer, options, ..
            } => (*answer, options.len()),
            other => panic!("expected {id} to be a Choice, got {other:?}"),
        }
    }

    #[test]
    fn new_marks_first_lesson_read() {
        let app = App::new();
        assert!(app
            .progress
            .lessons_read
            .contains(&app.module.lessons[0].id));
    }

    #[test]
    fn choice_submit_correct_records_progress() {
        let mut app = App::new();
        let (answer, _) = choice_shape(&app, "m1-01-privilege");
        app.update(Action::OpenChecks); // resets, but keep index
        app.check_idx = idx_of(&app, "m1-01-privilege");
        for _ in 0..answer {
            app.update(Action::SelectNext);
        }
        app.update(Action::Submit);
        assert_eq!(app.last_verdict, Some(Verdict::Correct));
        assert_eq!(app.passed_count(), 1);
    }

    #[test]
    fn choice_submit_wrong_does_not_pass() {
        let mut app = App::new();
        let (answer, len) = choice_shape(&app, "m1-01-privilege");
        app.check_idx = idx_of(&app, "m1-01-privilege");
        for _ in 0..(answer + 1) % len {
            app.update(Action::SelectNext); // land on a wrong option
        }
        app.update(Action::Submit);
        assert_eq!(app.last_verdict, Some(Verdict::Incorrect));
        assert_eq!(app.passed_count(), 0);
    }

    #[test]
    fn short_submit_grades_typed_answer() {
        let mut app = App::new();
        app.check_idx = idx_of(&app, "m1-01-syscall"); // Short, accepts "syscall"
        for ch in "syscall".chars() {
            app.update(Action::Char(ch));
        }
        app.update(Action::Submit);
        assert_eq!(app.last_verdict, Some(Verdict::Correct));
    }

    #[test]
    fn lesson_navigation_clamps() {
        let mut app = App::new();
        app.update(Action::PrevLesson);
        assert_eq!(app.lesson_idx, 0);
        let last = app.module.lessons.len() - 1;
        for _ in 0..20 {
            app.update(Action::NextLesson);
        }
        assert_eq!(app.lesson_idx, last);
        // every lesson visited is marked read
        assert_eq!(app.progress.lessons_read.len(), app.module.lessons.len());
    }
}
