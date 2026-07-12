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
    }
    Ok(())
}

/// Translate a keypress into an `Action`, given the current scene.
fn map_key(app: &App, code: KeyCode) -> Option<Action> {
    match app.scene {
        Scene::Reader => match code {
            KeyCode::Char('q') => Some(Action::Quit),
            KeyCode::Char('j') | KeyCode::Down => Some(Action::ScrollDown),
            KeyCode::Char('k') | KeyCode::Up => Some(Action::ScrollUp),
            KeyCode::Char('n') => Some(Action::NextLesson),
            KeyCode::Char('p') => Some(Action::PrevLesson),
            KeyCode::Char('c') => Some(Action::OpenChecks),
            KeyCode::Char('s') => Some(Action::OpenPanel),
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
            _ => Some(Action::Back),
        },
        Scene::Help => Some(Action::Back),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reader_c_opens_checks() {
        let app = App::new();
        assert_eq!(map_key(&app, KeyCode::Char('c')), Some(Action::OpenChecks));
    }

    #[test]
    fn panel_any_key_returns() {
        let mut app = App::new();
        app.update(Action::OpenPanel);
        assert_eq!(map_key(&app, KeyCode::Char('x')), Some(Action::Back));
        assert_eq!(map_key(&app, KeyCode::Char('q')), Some(Action::Quit));
    }
}
