//! Drawing. Reads `App`, renders frames. No state changes here.

use crate::app::{App, Scene};
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};
use thunk_core::{Check, ModuleStatus, Verdict};

fn rgb565(c: u16) -> (u8, u8, u8) {
    let r = (((c >> 11) & 0x1f) as u8) << 3;
    let g = (((c >> 5) & 0x3f) as u8) << 2;
    let b = ((c & 0x1f) as u8) << 3;
    (r, g, b)
}

pub fn draw(f: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1),
            Constraint::Min(1),
            Constraint::Length(1),
        ])
        .split(f.area());

    render_header(f, chunks[0], app);
    match app.scene {
        Scene::Modules => render_modules(f, chunks[1], app),
        Scene::Reader => render_reader(f, chunks[1], app),
        Scene::Checks => render_checks(f, chunks[1], app),
        Scene::Panel => render_panel(f, chunks[1], app),
        Scene::Trace => render_trace(f, chunks[1], app),
        Scene::Help => render_help(f, chunks[1]),
        Scene::Placement => render_placement(f, chunks[1], app),
    }
    render_footer(f, chunks[2], app);
}

fn render_header(f: &mut Frame, area: Rect, app: &App) {
    let scene = match app.scene {
        Scene::Modules => "modules",
        Scene::Reader => "reader",
        Scene::Checks => "checks",
        Scene::Panel => "panel",
        Scene::Trace => "trace",
        Scene::Help => "help",
        Scene::Placement => "placement",
    };
    // The loaded module's title and check count only mean something inside a
    // module; the home and placement scenes get their own words.
    let left = match app.scene {
        Scene::Modules | Scene::Help => " thunk - a systems course ".to_string(),
        Scene::Placement => " thunk - placement diagnostic ".to_string(),
        Scene::Reader | Scene::Checks | Scene::Panel | Scene::Trace => {
            format!(" thunk - {} ", app.module.title)
        }
    };
    let right = match app.scene {
        Scene::Reader | Scene::Checks | Scene::Panel | Scene::Trace => format!(
            "[{}]  checks passed {}/{} ",
            scene,
            app.passed_count(),
            app.checks.len()
        ),
        Scene::Modules | Scene::Help | Scene::Placement => format!("[{scene}] "),
    };
    let line = Line::from(vec![
        Span::styled(
            left,
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" "),
        Span::styled(right, Style::default().fg(Color::DarkGray)),
    ]);
    f.render_widget(Paragraph::new(line), area);
}

fn render_modules(f: &mut Frame, area: Rect, app: &App) {
    let block = Block::default()
        .borders(Borders::ALL)
        .title(" modules - master one to open the next ");
    let inner = block.inner(area);
    f.render_widget(block, area);
    let statuses = app.module_status();
    let mut lines: Vec<Line> = Vec::with_capacity(app.ladder.len());
    for (i, ((id, _), status)) in app.ladder.iter().zip(&statuses).enumerate() {
        let is_sel = i == app.module_sel;
        let marker = if is_sel { "> " } else { "  " };
        let tag = id.0.split('-').next().unwrap_or("").to_uppercase();
        let (word, color) = match status {
            ModuleStatus::Mastered => ("mastered", Color::Green),
            ModuleStatus::Unlocked => ("unlocked", Color::Cyan),
            ModuleStatus::Locked => ("locked", Color::DarkGray),
        };
        let name_style = if is_sel {
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default()
        };
        lines.push(Line::from(vec![
            Span::styled(
                format!("{marker}{tag:<4}{:<28}", app.ladder_titles[i]),
                name_style,
            ),
            Span::styled(word, Style::default().fg(color)),
        ]));
    }
    if let Some(n) = &app.notice {
        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            n.clone(),
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )));
    }
    f.render_widget(Paragraph::new(lines), inner);
}

/// The body of one check: prompt, then options / the typed answer / the
/// reorderable list. Shared by the checks scene and the placement scene.
/// `order` is the working item order for an Order check (empty otherwise).
fn check_body_lines(
    c: &Check,
    selected: usize,
    input: &str,
    order: &[usize],
) -> Vec<Line<'static>> {
    let mut lines: Vec<Line> = Vec::new();
    lines.push(Line::from(Span::styled(
        c.prompt().to_string(),
        Style::default().add_modifier(Modifier::BOLD),
    )));
    lines.push(Line::from(""));
    match c {
        Check::Choice { options, .. } => {
            for (i, opt) in options.iter().enumerate() {
                let is_sel = i == selected;
                let marker = if is_sel { "> " } else { "  " };
                let style = if is_sel {
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD)
                } else {
                    Style::default()
                };
                lines.push(Line::from(Span::styled(format!("{marker}{opt}"), style)));
            }
        }
        // Predict reads like Short in the classroom: a monospace-ish prompt for
        // a typed value. The grading is the same helper; only the framing (and
        // the hint) differ.
        Check::Short { .. } => {
            lines.push(Line::from(format!("your answer: {input}_")));
        }
        Check::Predict { hint, .. } => {
            if !hint.is_empty() {
                lines.push(Line::from(Span::styled(
                    format!("expected: {hint}"),
                    Style::default().fg(Color::DarkGray),
                )));
            }
            lines.push(Line::from(format!("predict: {input}_")));
        }
        Check::Order { items, .. } => {
            // Render the items in the learner's current order, numbered, with
            // the reorder cursor on the selected row.
            for (pos, &idx) in order.iter().enumerate() {
                let is_sel = pos == selected;
                let marker = if is_sel { "> " } else { "  " };
                let text = items.get(idx).map(String::as_str).unwrap_or("");
                let style = if is_sel {
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD)
                } else {
                    Style::default()
                };
                lines.push(Line::from(Span::styled(
                    format!("{marker}{}. {text}", pos + 1),
                    style,
                )));
            }
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "up/down to pick a step  ·  [ and ] to move it  ·  enter to submit",
                Style::default().fg(Color::DarkGray),
            )));
        }
    }
    lines.push(Line::from(""));
    lines
}

fn render_placement(f: &mut Frame, area: Rect, app: &App) {
    let n = app.placement.len();
    let i = (app.placement_answers.len() + 1).min(n.max(1));
    let block = Block::default()
        .borders(Borders::ALL)
        .title(format!(" placement diagnostic - item {i} of {n} "));
    let inner = block.inner(area);
    f.render_widget(block, area);
    let mut lines: Vec<Line> = Vec::new();
    if let Some(item) = app.current_placement_item() {
        // Placement banks carry no Order checks, so an empty working order is
        // always right here.
        lines.extend(check_body_lines(&item.check, app.selected, &app.input, &[]));
    }
    lines.push(Line::from(Span::styled(
        "answers here do not change module progress; they only place you",
        Style::default().fg(Color::DarkGray),
    )));
    f.render_widget(Paragraph::new(lines).wrap(Wrap { trim: false }), inner);
}

fn render_reader(f: &mut Frame, area: Rect, app: &App) {
    let lesson = app.current_lesson();
    let title = format!(
        " {}/{}  {} ",
        app.lesson_idx + 1,
        app.module.lessons.len(),
        lesson.title
    );
    let block = Block::default().borders(Borders::ALL).title(title);
    let inner = block.inner(area);
    f.render_widget(block, area);
    let para = Paragraph::new(lesson.body.as_str())
        .wrap(Wrap { trim: false })
        .scroll((app.scroll, 0));
    f.render_widget(para, inner);
}

fn render_checks(f: &mut Frame, area: Rect, app: &App) {
    let title = format!(" checks  {}/{} ", app.check_idx + 1, app.checks.len());
    let block = Block::default().borders(Borders::ALL).title(title);
    let inner = block.inner(area);
    f.render_widget(block, area);

    let mut lines: Vec<Line> = Vec::new();
    if let Some(c) = app.current_check() {
        lines.extend(check_body_lines(c, app.selected, &app.input, &app.order));
        if let Some(v) = app.last_verdict {
            let (text, color) = match v {
                Verdict::Correct => ("correct", Color::Green),
                Verdict::Incorrect => ("not quite - try again", Color::Red),
            };
            lines.push(Line::from(Span::styled(
                text,
                Style::default().fg(color).add_modifier(Modifier::BOLD),
            )));
        }
    }
    f.render_widget(Paragraph::new(lines).wrap(Wrap { trim: false }), inner);
}

fn render_panel(f: &mut Frame, area: Rect, app: &App) {
    let block = Block::default()
        .borders(Borders::ALL)
        .title(" simulated panel - the finale ");
    let inner = block.inner(area);
    f.render_widget(block, area);
    let cols = inner.width as usize;
    let rows = inner.height as usize;
    if cols == 0 || rows == 0 {
        return;
    }
    let fb = app.panel.framebuffer();
    let mut lines: Vec<Line> = Vec::with_capacity(rows);
    for ry in 0..rows {
        let mut spans: Vec<Span> = Vec::with_capacity(cols);
        for rx in 0..cols {
            let x = rx * fb.w / cols;
            let y = ry * fb.h / rows;
            let (r, g, b) = rgb565(fb.get_pixel(x, y));
            spans.push(Span::styled(
                "\u{2588}",
                Style::default().fg(Color::Rgb(r, g, b)),
            ));
        }
        lines.push(Line::from(spans));
    }
    f.render_widget(Paragraph::new(lines), inner);
}

fn render_trace(f: &mut Frame, area: Rect, app: &App) {
    let block = Block::default()
        .borders(Borders::ALL)
        .title(" bus trace - the logic analyzer's view ");
    let inner = block.inner(area);
    f.render_widget(block, area);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Min(1),
            Constraint::Length(5),
            Constraint::Length(1),
        ])
        .split(inner);

    let rows = app.trace_rows();
    let sel = app.trace_sel.min(rows.len().saturating_sub(1));
    let mut lines: Vec<Line> = Vec::with_capacity(rows.len());
    for (i, row) in rows.iter().enumerate() {
        let is_sel = i == sel;
        let marker = if is_sel { "> " } else { "  " };
        let style = if is_sel {
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default()
        };
        lines.push(Line::from(Span::styled(format!("{marker}{row}"), style)));
    }
    f.render_widget(Paragraph::new(lines), chunks[0]);

    let wave_block = Block::default()
        .borders(Borders::ALL)
        .title(" selected byte, on the wires ");
    let wave_inner = wave_block.inner(chunks[1]);
    f.render_widget(wave_block, chunks[1]);
    if let Some(wave) = app.selected_waveform() {
        let wave_lines: Vec<Line> = wave.into_iter().map(Line::from).collect();
        f.render_widget(Paragraph::new(wave_lines), wave_inner);
    }

    f.render_widget(
        Paragraph::new(Span::styled(
            "this is the traffic your driver put on the bus; M3 taught you to read it",
            Style::default().fg(Color::DarkGray),
        )),
        chunks[2],
    );
}

fn render_help(f: &mut Frame, area: Rect) {
    let block = Block::default().borders(Borders::ALL).title(" help ");
    let inner = block.inner(area);
    f.render_widget(block, area);
    let text = vec![
        Line::from("modules: j/k select   enter open an unlocked module"),
        Line::from("         p placement diagnostic   q quit"),
        Line::from("reader:  j/k scroll   n/p next/prev lesson   m/esc modules"),
        Line::from("         c checks     s panel view     ? help"),
        Line::from("checks:  up/down pick an option, or type a short answer"),
        Line::from("         order checks: up/down pick a step, [ and ] move it"),
        Line::from("         enter submit   n next check   esc back"),
        Line::from("placement: enter submits each item   esc abandons the run"),
        Line::from("panel:   t trace view   any other key returns to the reader"),
        Line::from("trace:   j/k move the cursor   esc back to the panel"),
        Line::from("         q quits anywhere it is not a typed letter"),
        Line::from(""),
        Line::from("progress saves to a local file. nothing leaves the machine."),
        Line::from("this is a course. it runs offline. it cannot get stuck."),
    ];
    f.render_widget(Paragraph::new(text), inner);
}

fn render_footer(f: &mut Frame, area: Rect, app: &App) {
    let keys = match app.scene {
        Scene::Modules => "j/k select  enter open  p placement  q quit",
        Scene::Reader => "j/k scroll  n/p lesson  c checks  s panel  m modules  ? help  q quit",
        Scene::Checks => "up/down pick or type  [ ] reorder  enter submit  n next  esc back",
        Scene::Panel => "t trace  any other key back  q quit",
        Scene::Trace => "j/k move  esc back  q quit",
        Scene::Help => "any key back",
        Scene::Placement => "up/down or type  enter submit  esc back to modules",
    };
    f.render_widget(
        Paragraph::new(Span::styled(
            format!(" {keys} "),
            Style::default().fg(Color::DarkGray),
        )),
        area,
    );
}
