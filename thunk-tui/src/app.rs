//! The classroom state machine. Pure and testable: no terminal here. The one
//! file it touches is the local progress file the learner asked us to keep.

use std::path::{Path, PathBuf};
use thunk_content::Curriculum;
use thunk_core::{
    evaluate_placement, ladder_state, progress_from_ron, progress_to_ron, state_path, Answer,
    Check, CheckId, Lesson, Module, ModuleId, ModuleStatus, PlacementItem, Progress, Verdict,
};
use thunk_sim::{boot_finale, finale_tick, Ili9341, SimSpi};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scene {
    /// The home screen: the module ladder with each gate's status.
    Modules,
    Reader,
    Checks,
    Panel,
    Help,
    /// The placement diagnostic: test out of modules you already know.
    Placement,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Action {
    Quit,
    Back,
    OpenChecks,
    OpenPanel,
    OpenHelp,
    OpenModules,
    OpenPlacement,
    EnterModule,
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
    Tick,
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
    /// The full course ladder: every module's id and check ids, in order.
    pub ladder: Vec<(ModuleId, Vec<CheckId>)>,
    /// Display titles, one per ladder rung.
    pub ladder_titles: Vec<String>,
    /// Which ladder rung the selection highlight is on.
    pub module_sel: usize,
    /// The placement diagnostic items, in ladder order.
    pub placement: Vec<PlacementItem>,
    /// Answers given so far in the current placement run; its length is also
    /// the index of the current item.
    pub placement_answers: Vec<Answer>,
    /// Where progress is saved: resolved once from the environment, or given
    /// directly by tests (which keeps them hermetic and parallel-safe).
    pub state_dir: PathBuf,
    /// The simulated panel, its state decoded from the recorded bus trace.
    pub panel: Ili9341,
    /// The bus the finale is drawn over; its trace is drained per frame.
    pub bus: SimSpi,
    /// The finale's current frame number.
    pub frame_t: u32,
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}

impl App {
    /// The real entry point: the state directory comes from the environment.
    pub fn new() -> Self {
        let state_dir = std::env::var("THUNK_STATE_DIR").ok();
        let xdg = std::env::var("XDG_DATA_HOME").ok();
        let home = std::env::var("HOME").ok();
        let mut dir = state_path(state_dir.as_deref(), xdg.as_deref(), home.as_deref());
        dir.pop(); // state_path names the file; the app keeps its directory
        Self::with_state_dir(dir)
    }

    /// Build the classroom over an explicit state directory.
    pub fn with_state_dir(state_dir: PathBuf) -> Self {
        let progress = Self::load_progress_from(&state_dir);
        let modules = Curriculum::all();
        let ladder: Vec<(ModuleId, Vec<CheckId>)> = modules
            .iter()
            .map(|m| {
                let ids = Curriculum::load_checks(&m.id.0)
                    .iter()
                    .map(|c| c.id().clone())
                    .collect();
                (m.id.clone(), ids)
            })
            .collect();
        let ladder_titles = modules.iter().map(|m| m.title.clone()).collect();
        // Start the selection on the first unlocked module (m0 on a fresh
        // start); when everything is mastered, on the last one.
        let statuses = ladder_state(&ladder, &progress);
        let module_sel = statuses
            .iter()
            .position(|s| *s == ModuleStatus::Unlocked)
            .unwrap_or(ladder.len().saturating_sub(1));
        let dir = ladder[module_sel].0 .0.clone();
        let module = Curriculum::load_module(&dir);
        let checks = Curriculum::load_checks(&dir);
        let mut bus = SimSpi::new();
        boot_finale(&mut bus, 240, 320);
        let mut panel = Ili9341::new(240, 320);
        panel.replay(&bus.take_trace());
        Self {
            module,
            checks,
            progress,
            scene: Scene::Modules,
            lesson_idx: 0,
            scroll: 0,
            check_idx: 0,
            selected: 0,
            input: String::new(),
            last_verdict: None,
            should_quit: false,
            ladder,
            ladder_titles,
            module_sel,
            placement: Curriculum::placement(),
            placement_answers: Vec::new(),
            state_dir,
            panel,
            bus,
            frame_t: 0,
        }
    }

    pub fn current_lesson(&self) -> &Lesson {
        &self.module.lessons[self.lesson_idx]
    }

    pub fn current_check(&self) -> Option<&Check> {
        self.checks.get(self.check_idx)
    }

    /// The placement item awaiting an answer, `None` once the run is over.
    pub fn current_placement_item(&self) -> Option<&PlacementItem> {
        self.placement.get(self.placement_answers.len())
    }

    /// The gate status of every ladder rung, in order.
    pub fn module_status(&self) -> Vec<ModuleStatus> {
        ladder_state(&self.ladder, &self.progress)
    }

    /// Write progress into `dir/progress.ron`. Failure to save is not worth
    /// crashing the classroom over; the learner keeps working.
    pub fn save_progress_to(&self, dir: &Path) {
        if let Some(s) = progress_to_ron(&self.progress) {
            if std::fs::create_dir_all(dir).is_ok() {
                let _ = std::fs::write(dir.join("progress.ron"), s);
            }
        }
    }

    /// Read progress from `dir/progress.ron`. A missing or unreadable file is
    /// a fresh start, never an error.
    pub fn load_progress_from(dir: &Path) -> Progress {
        std::fs::read_to_string(dir.join("progress.ron"))
            .ok()
            .and_then(|s| progress_from_ron(&s))
            .unwrap_or_default()
    }

    fn save(&self) {
        self.save_progress_to(&self.state_dir);
    }

    /// Enter the selected module if its gate is open: load its lessons and
    /// checks, mark the first lesson read, and hand over to the reader.
    fn enter_selected_module(&mut self) {
        match self.module_status().get(self.module_sel) {
            None | Some(ModuleStatus::Locked) => {}
            Some(_) => {
                let dir = self.ladder[self.module_sel].0 .0.clone();
                self.module = Curriculum::load_module(&dir);
                self.checks = Curriculum::load_checks(&dir);
                self.lesson_idx = 0;
                self.scroll = 0;
                self.check_idx = 0;
                self.reset_check_input();
                self.mark_current_read();
                self.scene = Scene::Reader;
            }
        }
    }

    /// Record the answer to the current placement item. Placement answers do
    /// not touch check progress; when the last item is answered the whole run
    /// is evaluated, placed modules are recorded, and we return home.
    fn submit_placement(&mut self) {
        let Some(item) = self.current_placement_item() else {
            return;
        };
        let answer = match &item.check {
            Check::Choice { .. } => Answer::Choice(self.selected),
            Check::Short { .. } => Answer::Text(self.input.clone()),
        };
        self.placement_answers.push(answer);
        self.reset_check_input();
        if self.placement_answers.len() == self.placement.len() {
            for m in evaluate_placement(&self.placement, &self.placement_answers) {
                self.progress.place_module(&m);
            }
            self.save();
            self.scene = Scene::Modules;
        }
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
            Action::Quit => {
                self.save();
                self.should_quit = true;
            }
            Action::Back => self.scene = Scene::Reader,
            Action::OpenChecks => {
                self.scene = Scene::Checks;
                self.reset_check_input();
            }
            Action::OpenPanel => self.scene = Scene::Panel,
            Action::OpenHelp => self.scene = Scene::Help,
            Action::OpenModules => self.scene = Scene::Modules,
            Action::OpenPlacement => {
                self.scene = Scene::Placement;
                self.placement_answers.clear();
                self.reset_check_input();
            }
            Action::EnterModule => self.enter_selected_module(),
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
            Action::SelectPrev => match self.scene {
                Scene::Modules => self.module_sel = self.module_sel.saturating_sub(1),
                _ => self.selected = self.selected.saturating_sub(1),
            },
            Action::SelectNext => match self.scene {
                Scene::Modules => {
                    if self.module_sel + 1 < self.ladder.len() {
                        self.module_sel += 1;
                    }
                }
                Scene::Placement => {
                    if let Some(PlacementItem {
                        check: Check::Choice { options, .. },
                        ..
                    }) = self.current_placement_item()
                    {
                        if self.selected + 1 < options.len() {
                            self.selected += 1;
                        }
                    }
                }
                _ => {
                    if let Some(Check::Choice { options, .. }) = self.checks.get(self.check_idx) {
                        if self.selected + 1 < options.len() {
                            self.selected += 1;
                        }
                    }
                }
            },
            Action::Char(c) => self.input.push(c),
            Action::Backspace => {
                self.input.pop();
            }
            Action::Submit => {
                if self.scene == Scene::Placement {
                    self.submit_placement();
                } else if let Some(c) = self.checks.get(self.check_idx) {
                    let answer = match c {
                        Check::Choice { .. } => Answer::Choice(self.selected),
                        Check::Short { .. } => Answer::Text(self.input.clone()),
                    };
                    let v = c.grade(&answer);
                    self.progress.record(c.id(), v);
                    self.last_verdict = Some(v);
                    if v == Verdict::Correct {
                        self.save();
                    }
                }
            }
            Action::NextCheck => {
                // Placement advances by itself on submit; Modules has no checks.
                if !matches!(self.scene, Scene::Placement | Scene::Modules)
                    && !self.checks.is_empty()
                {
                    self.check_idx = (self.check_idx + 1) % self.checks.len();
                    self.reset_check_input();
                }
            }
            Action::Tick => {
                if self.scene == Scene::Panel {
                    self.frame_t += 1;
                    finale_tick(&mut self.bus, 240, 320, self.frame_t);
                    self.panel.replay(&self.bus.take_trace());
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

/// A fresh app over a unique empty state directory: hermetic and
/// parallel-safe (env vars are process-global; a constructor argument is not).
#[cfg(test)]
pub(crate) fn test_app() -> App {
    App::with_state_dir(test_state_dir())
}

/// A unique, empty state directory per call.
#[cfg(test)]
pub(crate) fn test_state_dir() -> std::path::PathBuf {
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    let dir = std::env::temp_dir().join(format!(
        "thunk-tui-test-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir_all(&dir).expect("temp state dir");
    dir
}

#[cfg(test)]
mod tests {
    use super::*;
    use thunk_core::{CheckId, ModuleStatus};

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
    fn panel_is_decoded_from_the_bus_trace() {
        let app = test_app();
        assert!(app.panel.is_on(), "protocol init turned the panel on");
        // the finale's frame 0, decoded from RAMWR bytes
        let expected = thunk_sim::finale::frame(240, 320, 0);
        assert_eq!(
            app.panel.framebuffer().get_pixel(0, 160),
            expected[160 * 240]
        );
        assert_eq!(
            app.panel.framebuffer().get_pixel(120, 160),
            expected[160 * 240 + 120]
        );
    }

    #[test]
    fn ticks_animate_the_panel_scene() {
        let mut app = test_app();
        app.update(Action::OpenPanel);
        let before: Vec<u16> = (0..240)
            .map(|x| app.panel.framebuffer().get_pixel(x, 160))
            .collect();
        for _ in 0..8 {
            app.update(Action::Tick);
        }
        let after: Vec<u16> = (0..240)
            .map(|x| app.panel.framebuffer().get_pixel(x, 160))
            .collect();
        assert_ne!(before, after, "the corridor bands moved");
    }

    #[test]
    fn ticks_outside_the_panel_scene_do_nothing() {
        let mut app = test_app();
        let frame_before = app.frame_t;
        app.update(Action::Tick); // Modules scene
        assert_eq!(app.frame_t, frame_before);
    }

    #[test]
    fn entering_a_module_marks_first_lesson_read() {
        // Marking-read happens on entering a module, not on construction.
        let mut app = test_app();
        assert!(app.progress.lessons_read.is_empty());
        app.update(Action::EnterModule); // module_sel starts at 0 = m0
        assert!(app
            .progress
            .lessons_read
            .contains(&app.module.lessons[0].id));
    }

    #[test]
    fn choice_submit_correct_records_progress() {
        let mut app = test_app();
        let (answer, _) = choice_shape(&app, "m0-01-processor");
        app.update(Action::EnterModule);
        app.update(Action::OpenChecks); // resets, but keep index
        app.check_idx = idx_of(&app, "m0-01-processor");
        for _ in 0..answer {
            app.update(Action::SelectNext);
        }
        app.update(Action::Submit);
        assert_eq!(app.last_verdict, Some(Verdict::Correct));
        assert_eq!(app.passed_count(), 1);
    }

    #[test]
    fn choice_submit_wrong_does_not_pass() {
        let mut app = test_app();
        let (answer, len) = choice_shape(&app, "m0-01-processor");
        app.update(Action::EnterModule);
        app.update(Action::OpenChecks);
        app.check_idx = idx_of(&app, "m0-01-processor");
        for _ in 0..(answer + 1) % len {
            app.update(Action::SelectNext); // land on a wrong option
        }
        app.update(Action::Submit);
        assert_eq!(app.last_verdict, Some(Verdict::Incorrect));
        assert_eq!(app.passed_count(), 0);
    }

    #[test]
    fn short_submit_grades_typed_answer() {
        let mut app = test_app();
        app.update(Action::EnterModule);
        app.update(Action::OpenChecks);
        app.check_idx = idx_of(&app, "m0-01-switch"); // Short, accepts "one"
        for ch in "one".chars() {
            app.update(Action::Char(ch));
        }
        app.update(Action::Submit);
        assert_eq!(app.last_verdict, Some(Verdict::Correct));
    }

    #[test]
    fn lesson_navigation_clamps() {
        let mut app = test_app();
        app.update(Action::EnterModule);
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

    // --- M-B: the module ladder, gating, placement, persistence ---

    #[test]
    fn the_home_scene_is_the_module_ladder() {
        let app = test_app();
        assert_eq!(app.scene, Scene::Modules);
        assert_eq!(app.ladder.len(), 7);
        assert_eq!(app.module_status()[0], ModuleStatus::Unlocked);
        assert_eq!(app.module_status()[1], ModuleStatus::Locked);
    }

    #[test]
    fn entering_a_locked_module_is_refused() {
        let mut app = test_app();
        app.module_sel = 3; // m3-bus, locked at start
        app.update(Action::EnterModule);
        assert_eq!(app.scene, Scene::Modules, "locked module refused");
        app.module_sel = 0;
        app.update(Action::EnterModule);
        assert_eq!(app.scene, Scene::Reader);
        assert_eq!(app.module.id.0, "m0-power-on");
    }

    #[test]
    fn mastering_a_module_unlocks_the_next_in_the_tui() {
        let mut app = test_app();
        // pass every m0 check directly on progress
        for c in Curriculum::load_checks("m0-power-on") {
            app.progress.record(c.id(), c.grade(&c.canonical_answer()));
        }
        assert_eq!(app.module_status()[0], ModuleStatus::Mastered);
        assert_eq!(app.module_status()[1], ModuleStatus::Unlocked);
    }

    #[test]
    fn the_placement_scene_places_and_unlocks() {
        let mut app = test_app();
        app.update(Action::OpenPlacement);
        assert_eq!(app.scene, Scene::Placement);
        // answer every item with its canonical answer
        let items = app.placement.clone();
        for item in &items {
            match &item.check {
                Check::Choice { answer, .. } => {
                    app.selected = *answer;
                    app.update(Action::Submit);
                }
                Check::Short { answers, .. } => {
                    app.input = answers[0].clone();
                    app.update(Action::Submit);
                }
            }
            app.update(Action::NextCheck);
        }
        // finishing the run applies placement: everything mastered
        assert!(app
            .module_status()
            .iter()
            .all(|s| *s == ModuleStatus::Mastered));
    }

    #[test]
    fn progress_survives_a_save_load_round_trip() {
        let dir = test_state_dir();
        let mut app = test_app();
        app.progress
            .record(&CheckId("m0-01-processor".into()), Verdict::Correct);
        app.save_progress_to(&dir);
        let loaded = App::load_progress_from(&dir);
        assert!(loaded
            .checks_passed
            .contains(&CheckId("m0-01-processor".into())));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_restart_resumes_at_the_first_unlocked_module() {
        let dir = test_state_dir();
        let mut app = App::with_state_dir(dir.clone());
        for c in Curriculum::load_checks("m0-power-on") {
            app.progress.record(c.id(), c.grade(&c.canonical_answer()));
        }
        app.update(Action::Quit); // quitting saves
        let resumed = App::with_state_dir(dir.clone());
        assert_eq!(resumed.module.id.0, "m1-kernel");
        assert_eq!(resumed.module_sel, 1);
        std::fs::remove_dir_all(&dir).ok();
    }
}
