//! thunk terminal classroom. `run()` owns the terminal; `app`/`ui` stay pure.

mod app;
mod ui;

pub use app::{Action, App, Scene};

use crossterm::event::{self, Event, KeyCode, KeyEventKind};
use crossterm::execute;
use crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use ratatui::backend::CrosstermBackend;
use ratatui::Terminal;
use std::io::{self, Stdout};
use std::time::Duration;

/// Launch the classroom. Restores the terminal on the way out, even on error.
pub fn run() -> io::Result<()> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let mut terminal = Terminal::new(CrosstermBackend::new(stdout))?;

    let mut app = App::new();
    let result = event_loop(&mut terminal, &mut app);

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    result
}

fn event_loop(terminal: &mut Terminal<CrosstermBackend<Stdout>>, app: &mut App) -> io::Result<()> {
    while !app.should_quit {
        terminal.draw(|f| ui::draw(f, app))?;
        // Only the animated panel scene needs a Tick clock; everywhere else,
        // block on the next key so the classroom is not redrawn at ~16Hz for
        // nothing. Note: a held key makes poll() always true, so Tick never
        // fires while a key is being held down - accepted.
        if app.scene == Scene::Panel {
            if event::poll(Duration::from_millis(60))? {
                if let Event::Key(key) = event::read()? {
                    if key.kind != KeyEventKind::Press {
                        continue;
                    }
                    if let Some(action) = map_key(app, key.code) {
                        app.update(action);
                    }
                }
            } else {
                app.update(Action::Tick);
            }
        } else if let Event::Key(key) = event::read()? {
            if key.kind != KeyEventKind::Press {
                continue;
            }
            if let Some(action) = map_key(app, key.code) {
                app.update(action);
            }
        }
    }
    Ok(())
}

/// Translate a keypress into an `Action`, given the current scene.
fn map_key(app: &App, code: KeyCode) -> Option<Action> {
    match app.scene {
        Scene::Modules => match code {
            KeyCode::Char('q') => Some(Action::Quit),
            KeyCode::Char('j') | KeyCode::Down => Some(Action::SelectNext),
            KeyCode::Char('k') | KeyCode::Up => Some(Action::SelectPrev),
            KeyCode::Enter => Some(Action::EnterModule),
            KeyCode::Char('p') => Some(Action::OpenPlacement),
            _ => None,
        },
        Scene::Reader => match code {
            KeyCode::Char('q') => Some(Action::Quit),
            KeyCode::Char('j') | KeyCode::Down => Some(Action::ScrollDown),
            KeyCode::Char('k') | KeyCode::Up => Some(Action::ScrollUp),
            KeyCode::Char('n') => Some(Action::NextLesson),
            KeyCode::Char('p') => Some(Action::PrevLesson),
            KeyCode::Char('c') => Some(Action::OpenChecks),
            KeyCode::Char('s') => Some(Action::OpenPanel),
            KeyCode::Char('m') | KeyCode::Esc => Some(Action::OpenModules),
            KeyCode::Char('?') => Some(Action::OpenHelp),
            _ => None,
        },
        Scene::Checks => {
            // Short checks capture typing; Choice checks navigate options.
            let is_short = matches!(app.current_check(), Some(thunk_core::Check::Short { .. }));
            match code {
                KeyCode::Esc => Some(Action::Back),
                KeyCode::Enter => Some(Action::Submit),
                KeyCode::Tab => Some(Action::NextCheck),
                _ if is_short => match code {
                    KeyCode::Char(c) => Some(Action::Char(c)),
                    KeyCode::Backspace => Some(Action::Backspace),
                    _ => None,
                },
                KeyCode::Up => Some(Action::SelectPrev),
                KeyCode::Down => Some(Action::SelectNext),
                KeyCode::Char('n') => Some(Action::NextCheck),
                KeyCode::Char('q') => Some(Action::Quit),
                _ => None,
            }
        }
        Scene::Panel => match code {
            KeyCode::Char('q') => Some(Action::Quit),
            KeyCode::Char('t') => Some(Action::OpenTrace),
            _ => Some(Action::Back),
        },
        Scene::Trace => match code {
            KeyCode::Char('q') => Some(Action::Quit),
            KeyCode::Char('j') | KeyCode::Down => Some(Action::SelectNext),
            KeyCode::Char('k') | KeyCode::Up => Some(Action::SelectPrev),
            KeyCode::Esc => Some(Action::Back),
            _ => None,
        },
        Scene::Help => Some(Action::Back),
        Scene::Placement => {
            // Like Checks, but Esc abandons the run back to the module ladder
            // and items advance on submit rather than by `n`/Tab.
            let is_short = matches!(
                app.current_placement_item().map(|i| &i.check),
                Some(thunk_core::Check::Short { .. })
            );
            match code {
                KeyCode::Esc => Some(Action::OpenModules),
                KeyCode::Enter => Some(Action::Submit),
                _ if is_short => match code {
                    KeyCode::Char(c) => Some(Action::Char(c)),
                    KeyCode::Backspace => Some(Action::Backspace),
                    _ => None,
                },
                KeyCode::Up => Some(Action::SelectPrev),
                KeyCode::Down => Some(Action::SelectNext),
                KeyCode::Char('q') => Some(Action::Quit),
                _ => None,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::test_app;

    #[test]
    fn modules_keys_select_enter_and_place() {
        let app = test_app(); // home scene
        assert_eq!(map_key(&app, KeyCode::Char('j')), Some(Action::SelectNext));
        assert_eq!(map_key(&app, KeyCode::Char('k')), Some(Action::SelectPrev));
        assert_eq!(map_key(&app, KeyCode::Enter), Some(Action::EnterModule));
        assert_eq!(
            map_key(&app, KeyCode::Char('p')),
            Some(Action::OpenPlacement)
        );
        assert_eq!(map_key(&app, KeyCode::Char('q')), Some(Action::Quit));
    }

    #[test]
    fn reader_c_opens_checks_and_esc_returns_home() {
        let mut app = test_app();
        app.update(Action::EnterModule);
        assert_eq!(map_key(&app, KeyCode::Char('c')), Some(Action::OpenChecks));
        assert_eq!(map_key(&app, KeyCode::Esc), Some(Action::OpenModules));
        assert_eq!(map_key(&app, KeyCode::Char('m')), Some(Action::OpenModules));
    }

    #[test]
    fn placement_esc_abandons_the_run() {
        let mut app = test_app();
        app.update(Action::OpenPlacement);
        assert_eq!(map_key(&app, KeyCode::Esc), Some(Action::OpenModules));
        assert_eq!(map_key(&app, KeyCode::Enter), Some(Action::Submit));
    }

    #[test]
    fn panel_any_key_returns() {
        let mut app = test_app();
        app.update(Action::EnterModule);
        app.update(Action::OpenPanel);
        assert_eq!(map_key(&app, KeyCode::Char('x')), Some(Action::Back));
        assert_eq!(map_key(&app, KeyCode::Char('q')), Some(Action::Quit));
    }

    #[test]
    fn panel_t_opens_the_trace_and_its_keys_move_the_cursor() {
        let mut app = test_app();
        app.update(Action::EnterModule);
        app.update(Action::OpenPanel);
        assert_eq!(map_key(&app, KeyCode::Char('t')), Some(Action::OpenTrace));
        app.update(Action::OpenTrace);
        assert_eq!(map_key(&app, KeyCode::Char('j')), Some(Action::SelectNext));
        assert_eq!(map_key(&app, KeyCode::Char('k')), Some(Action::SelectPrev));
        assert_eq!(map_key(&app, KeyCode::Esc), Some(Action::Back));
        assert_eq!(map_key(&app, KeyCode::Char('q')), Some(Action::Quit));
    }
}
