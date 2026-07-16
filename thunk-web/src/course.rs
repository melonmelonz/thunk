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

/// A deterministic, id-keyed permutation of `0..n`: a small FNV-1a hash of the
/// check id seeds an LCG that drives a Fisher-Yates shuffle. Stable across
/// builds (same id -> same order) so the offline "put these in order" list does
/// not shuffle on every regen, and independent of the authored order so it does
/// NOT leak the answer.
fn display_order(id: &str, n: usize) -> Vec<usize> {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for b in id.bytes() {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    let mut idx: Vec<usize> = (0..n).collect();
    // Fisher-Yates from the back, drawing each swap position from the LCG.
    for i in (1..n).rev() {
        hash = hash
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        let j = (hash >> 33) as usize % (i + 1);
        idx.swap(i, j);
    }
    idx
}

/// One check as a quiet card the client-side grader understands.
/// Choice answers ride in `data-answer` (the option index); Short and Predict
/// answers in `data-answers`, joined with `|` - safe because no accepted answer
/// in any checks.ron contains a pipe (verified across the whole bank). Order is
/// rendered static and ungraded here: the offline bundle is read-only, so it
/// shows the items shuffled ("put these in order") and keeps the correct
/// sequence out of the learner HTML - the facilitator answer key holds it.
fn check_widget(check: &Check) -> String {
    let id = esc(&check.id().0);
    let mut w = format!("<section class=\"check\" data-check-id=\"{id}\">\n");
    let mut gradeable = true;
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
        // Predict grades exactly like Short offline (same data-answers path in
        // check.js); the hint rides along as the input placeholder.
        Check::Predict {
            prompt,
            answers,
            hint,
            ..
        } => {
            w.push_str(&format!(
                "<label>{}\n<input type=\"text\" class=\"predict\" data-answers=\"{}\" placeholder=\"{}\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\">\n</label>\n",
                esc(prompt),
                esc(&answers.join("|")),
                esc(hint),
            ));
        }
        // Order: a static, ungraded "arrange these" list. Items are shown in a
        // deterministic shuffle so the correct sequence is never in the markup;
        // grading lives in the classroom, and the answer key holds the order.
        Check::Order { prompt, items, .. } => {
            gradeable = false;
            w.push_str(&format!("<fieldset>\n<legend>{}</legend>\n", esc(prompt)));
            w.push_str(
                "<p class=\"order-note\">Put these in the correct order. \
                 The sequence is checked in the classroom; the answer key holds it.</p>\n",
            );
            w.push_str("<ul class=\"order\">\n");
            for i in display_order(&check.id().0, items.len()) {
                w.push_str(&format!("<li>{}</li>\n", esc(&items[i])));
            }
            w.push_str("</ul>\n</fieldset>\n");
        }
    }
    if gradeable {
        w.push_str(
            "<button type=\"button\" class=\"grade\">check</button>\n\
             <p class=\"verdict\" aria-live=\"polite\"></p>\n",
        );
    }
    w.push_str("</section>\n");
    w
}

/// The course ladder: every module as a card, in order.
pub fn index_page() -> String {
    let mut main = String::from(
        "<div class=\"hero\">\n\
         <p class=\"eyebrow\">A self-contained, offline systems course</p>\n\
         <h1>thunk</h1>\n\
         <p class=\"tagline\">From true zero to DOOM on a panel. \
         Nothing leaves this machine.</p>\n\
         </div>\n\
         <ol class=\"ladder\">\n",
    );
    for module in Curriculum::all() {
        let dir = esc(&module.id.0);
        let tag = esc(&module.id.0.split('-').next().unwrap_or("").to_uppercase());
        let checks = Curriculum::load_checks(&module.id.0).len();
        main.push_str(&format!(
            "<li class=\"card\"><a class=\"session\" href=\"{dir}/index.html\">\
             <span class=\"tag\" aria-hidden=\"true\">{tag}</span>\
             <span class=\"s-body\"><span class=\"ttl\">{}</span>\
             <span class=\"meta\" data-module=\"{dir}\">{} lessons · {checks} checks</span></span>\
             <span class=\"go\" aria-hidden=\"true\">&#9654;</span></a></li>\n",
            esc(&module.title),
            module.lessons.len(),
        ));
    }
    main.push_str(
        "</ol>\n\
         <p class=\"bench\"><a href=\"sim/index.html\">The Bench</a> - \
         the simulated panel and the bus trace that drew it.</p>\n",
    );
    shell("thunk", "thunk", &main, 0)
}

/// One module: its lessons, in order.
pub fn module_page(dir: &str) -> String {
    let module = Curriculum::load_module(dir);
    let checks = Curriculum::load_checks(dir).len();
    let tag = dir.split('-').next().unwrap_or("").to_uppercase();
    let mut main = format!(
        "<p class=\"crumbs\"><a href=\"../index.html\">thunk</a> / {}</p>\n\
         <div class=\"head\">\n\
         <p class=\"eyebrow\">Session {}</p>\n\
         <h1>{}</h1>\n\
         <p class=\"meta\">{} lessons · {checks} checks</p>\n\
         </div>\n\
         <ol class=\"lessons\">\n",
        esc(&module.title),
        esc(&tag),
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

    let tag = dir.split('-').next().unwrap_or("").to_uppercase();
    let mut main = format!(
        "<p class=\"crumbs\"><a href=\"../../index.html\">thunk</a> / \
         <a href=\"../index.html\">{}</a> / {}</p>\n\
         <p class=\"eyebrow\">Session {} &middot; Lesson {:02} of {:02}</p>\n\
         <article class=\"lesson\">\n{}</article>\n\
         <section class=\"checks\" aria-label=\"checks\">\n<h2>Checks</h2>\n\
         <p class=\"meta\">Answer these to prove the lesson landed. Graded right here; nothing is sent anywhere.</p>\n",
        esc(&module.title),
        esc(&lesson.title),
        esc(&tag),
        index + 1,
        module.lessons.len(),
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
        assert!(html.contains("sim/index.html"), "the bench is reachable");
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
    fn a_predict_check_renders_a_gradeable_input_with_its_hint() {
        let html = lesson_page("m4-panel", "02-color-in-sixteen-bits");
        assert!(html.contains("data-check-id=\"m4-02-redbyte\""));
        // Predict rides the same data-answers path as Short, so check.js grades
        // it offline; the hint is the placeholder.
        assert!(html.contains("class=\"predict\""));
        assert!(html.contains("data-answers=\"0xF8|f8|248|11111000\""));
        assert!(html.contains("placeholder=\"hex byte, e.g. 0x2C\""));
    }

    #[test]
    fn an_order_check_renders_a_static_list_without_leaking_the_sequence() {
        let html = lesson_page("m4-panel", "04-commands-and-data");
        assert!(html.contains("data-check-id=\"m4-04-draw\""));
        // The items are visible as an "arrange these" list...
        assert!(html.contains("class=\"order\""));
        assert!(html.contains("Put these in the correct order"));
        // ...but the correct sequence is NOT leaked: the displayed order is the
        // deterministic shuffle, not the authored (identity) order.
        let items = [
            "Send the column address command (0x2A) with the first and last column",
            "Send the page address command (0x2B) with the first and last row",
            "Send the memory-write command RAMWR (0x2C)",
            "Hold DC high and stream the pixel bytes, high byte first",
        ];
        let shown: Vec<usize> = super::display_order("m4-04-draw", items.len());
        assert_ne!(
            shown,
            vec![0, 1, 2, 3],
            "display order must not be the answer"
        );
        // There is nothing to grade offline: no answer index, no grade button
        // inside the Order card (it carries no data-answer at all).
        let card = html
            .split("data-check-id=\"m4-04-draw\"")
            .nth(1)
            .and_then(|rest| rest.split("</section>").next())
            .expect("the order card");
        assert!(
            !card.contains("data-answer"),
            "order must not leak an answer"
        );
        assert!(
            !card.contains("class=\"grade\""),
            "order is ungraded offline"
        );
    }

    #[test]
    fn the_offline_display_order_is_stable_and_a_real_permutation() {
        // Same id -> same order across builds; and it is a permutation of every
        // index (nothing dropped or duplicated).
        let a = super::display_order("m4-04-draw", 4);
        let b = super::display_order("m4-04-draw", 4);
        assert_eq!(a, b, "stable per id");
        let mut sorted = a.clone();
        sorted.sort_unstable();
        assert_eq!(sorted, vec![0, 1, 2, 3], "a true permutation");
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
