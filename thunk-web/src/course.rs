//! The course pages: index, module, lesson (with check widgets).
//!
//! Pages sit at `index.html`, `<module>/index.html`, and
//! `<module>/lessons/<lesson>.html`, so the shell depths are 0, 1, and 2.
//! A lesson's checks are matched by the `mN-NN-` id prefix convention the
//! validation suite pins (`every_check_belongs_to_a_lesson`).

use crate::markdown;
use crate::page::{esc, shell};
use thunk_content::Curriculum;
use thunk_core::{Check, Module};

/// The `mN-NN-` prefix that ties a check id to its lesson.
fn check_prefix(dir: &str, lesson_id: &str) -> String {
    let module = dir.split('-').next().expect("module dir starts with mN-");
    let lesson = lesson_id
        .split('-')
        .next()
        .expect("lesson id starts with NN-");
    format!("{module}-{lesson}-")
}

/// One check as a quiet card the client-side grader understands.
/// Choice answers ride in `data-answer` (the option index); Short answers in
/// `data-answers`, joined with `|` - safe because no accepted answer in any
/// checks.ron contains a pipe (verified across the whole bank).
fn check_widget(check: &Check) -> String {
    let id = esc(&check.id().0);
    let mut w = format!("<section class=\"check\" data-check-id=\"{id}\">\n");
    match check {
        Check::Choice {
            prompt,
            options,
            answer,
            ..
        } => {
            w.push_str(&format!(
                "<fieldset data-answer=\"{answer}\">\n<legend>{}</legend>\n",
                esc(prompt)
            ));
            for (i, option) in options.iter().enumerate() {
                w.push_str(&format!(
                    "<label><input type=\"radio\" name=\"{id}\" value=\"{i}\"> {}</label>\n",
                    esc(option)
                ));
            }
            w.push_str("</fieldset>\n");
        }
        Check::Short {
            prompt, answers, ..
        } => {
            w.push_str(&format!(
                "<label>{}\n<input type=\"text\" data-answers=\"{}\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\">\n</label>\n",
                esc(prompt),
                esc(&answers.join("|"))
            ));
        }
    }
    w.push_str(
        "<button type=\"button\" class=\"grade\">check</button>\n\
         <p class=\"verdict\" aria-live=\"polite\"></p>\n\
         </section>\n",
    );
    w
}

/// The course ladder: every module as a card, in order.
pub fn index_page() -> String {
    let mut main = String::from(
        "<h1>thunk</h1>\n\
         <p class=\"tagline\">A self-contained, offline systems course. \
         From true zero to DOOM on a panel.</p>\n\
         <ol class=\"ladder\">\n",
    );
    for module in Curriculum::all() {
        let dir = esc(&module.id.0);
        let tag = esc(module.id.0.split('-').next().unwrap_or(""));
        let checks = Curriculum::load_checks(&module.id.0).len();
        main.push_str(&format!(
            "<li class=\"card\"><span class=\"tag\">{tag}</span> \
             <a href=\"{dir}/index.html\">{}</a> \
             <span class=\"meta\" data-module=\"{dir}\">{} lessons · {checks} checks</span></li>\n",
            esc(&module.title),
            module.lessons.len(),
        ));
    }
    main.push_str("</ol>\n");
    shell("thunk", "thunk", &main, 0)
}

/// One module: its lessons, in order.
pub fn module_page(dir: &str) -> String {
    let module = Curriculum::load_module(dir);
    let checks = Curriculum::load_checks(dir).len();
    let mut main = format!(
        "<p class=\"crumbs\"><a href=\"../index.html\">thunk</a> / {}</p>\n\
         <h1>{}</h1>\n\
         <p class=\"meta\">{} lessons · {checks} checks</p>\n\
         <ol class=\"lessons\">\n",
        esc(&module.title),
        esc(&module.title),
        module.lessons.len(),
    );
    for lesson in &module.lessons {
        main.push_str(&format!(
            "<li><a href=\"lessons/{}.html\">{}</a></li>\n",
            esc(&lesson.id.0),
            esc(&lesson.title),
        ));
    }
    main.push_str("</ol>\n");
    shell(&module.title, "thunk", &main, 1)
}

/// Prev/next links within the module, when a neighbor exists.
fn pager(module: &Module, index: usize) -> String {
    let mut nav = String::from("<nav class=\"pager\" aria-label=\"lesson\">\n");
    if let Some(prev) = index.checked_sub(1).and_then(|i| module.lessons.get(i)) {
        nav.push_str(&format!(
            "<a rel=\"prev\" href=\"{}.html\">← {}</a>\n",
            esc(&prev.id.0),
            esc(&prev.title),
        ));
    }
    if let Some(next) = module.lessons.get(index + 1) {
        nav.push_str(&format!(
            "<a rel=\"next\" href=\"{}.html\">{} →</a>\n",
            esc(&next.id.0),
            esc(&next.title),
        ));
    }
    nav.push_str("</nav>\n");
    nav
}

/// One lesson: breadcrumb, the rendered prose, its checks, prev/next.
pub fn lesson_page(dir: &str, lesson_id: &str) -> String {
    let module = Curriculum::load_module(dir);
    let index = module
        .lessons
        .iter()
        .position(|l| l.id.0 == lesson_id)
        .unwrap_or_else(|| panic!("no lesson {lesson_id} in {dir}"));
    let lesson = &module.lessons[index];
    let prefix = check_prefix(dir, lesson_id);
    let checks: Vec<Check> = Curriculum::load_checks(dir)
        .into_iter()
        .filter(|c| c.id().0.starts_with(&prefix))
        .collect();

    let mut main = format!(
        "<p class=\"crumbs\"><a href=\"../../index.html\">thunk</a> / \
         <a href=\"../index.html\">{}</a> / {}</p>\n\
         <article class=\"lesson\">\n{}</article>\n\
         <section class=\"checks\" aria-label=\"checks\">\n<h2>Checks</h2>\n\
         <p class=\"meta\">Answer these to prove the lesson landed. Graded right here; nothing is sent anywhere.</p>\n",
        esc(&module.title),
        esc(&lesson.title),
        markdown::render(&lesson.body),
    );
    for check in &checks {
        main.push_str(&check_widget(check));
    }
    main.push_str("</section>\n");
    main.push_str(&pager(&module, index));
    shell(&lesson.title, "thunk", &main, 2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_index_lists_the_whole_ladder() {
        let html = index_page();
        for needle in [
            "Power On",
            "The Kernel",
            "Rust for the Metal",
            "The Bus",
            "The Panel",
            "DOOM",
            "Intro to Open Source",
        ] {
            assert!(html.contains(needle));
        }
        assert!(html.contains("thunk"));
    }

    #[test]
    fn a_lesson_page_carries_prose_and_its_checks() {
        let html = lesson_page("m0-power-on", "01-the-machine");
        assert!(html.contains("<h1>The Machine</h1>"));
        assert!(html.contains("data-check-id=\"m0-01-processor\""));
        assert!(html.contains("aria-live"));
    }

    #[test]
    fn check_widgets_encode_answers_for_client_grading() {
        let html = lesson_page("m0-power-on", "02-bits-and-bytes");
        // Choice: radio group with data-answer index; Short: input with data-answers list
        assert!(html.contains("type=\"radio\""));
        assert!(html.contains("data-answer="));
        assert!(html.contains("data-answers="));
    }

    #[test]
    fn every_lesson_page_builds_with_checks_and_a_pager_somewhere() {
        for module in Curriculum::all() {
            for lesson in &module.lessons {
                let html = lesson_page(&module.id.0, &lesson.id.0);
                assert!(
                    html.matches("data-check-id=").count() >= 3,
                    "lesson {} lost its checks",
                    lesson.id.0
                );
                assert!(!html.contains("http://") && !html.contains("https://"));
            }
        }
    }

    #[test]
    fn module_pages_link_every_lesson() {
        for module in Curriculum::all() {
            let html = module_page(&module.id.0);
            for lesson in &module.lessons {
                assert!(html.contains(&format!("lessons/{}.html", lesson.id.0)));
            }
        }
    }
}
