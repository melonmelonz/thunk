//! `thunk export`: the whole curriculum as one JSON document, the build-time
//! source of truth for the public course site. It is the same content the TUI
//! and the offline bundle render - modules, lessons, checks, placement - only
//! serialized. Lesson bodies carry both the raw markdown and the HTML produced
//! by the pinned constrained-dialect renderer, so the site never needs a second
//! markdown parser and can never drift from the facility render.

use serde::Serialize;
use thunk_content::Curriculum;
use thunk_core::Check;

/// The `mN-NN-` prefix that ties a check id to its lesson - the same rule the
/// offline bundle and the validation suite pin.
fn check_prefix(dir: &str, lesson_id: &str) -> String {
    let module = dir.split('-').next().unwrap_or(dir);
    let lesson = lesson_id.split('-').next().unwrap_or(lesson_id);
    format!("{module}-{lesson}-")
}

/// The tag shown on a module (its ladder rung): `m3-bus` -> `M3`.
fn module_tag(id: &str) -> String {
    id.split('-').next().unwrap_or(id).to_uppercase()
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum CheckJson {
    Choice {
        id: String,
        prompt: String,
        options: Vec<String>,
        answer: usize,
    },
    Short {
        id: String,
        prompt: String,
        answers: Vec<String>,
    },
}

impl From<&Check> for CheckJson {
    fn from(c: &Check) -> Self {
        match c {
            Check::Choice {
                id,
                prompt,
                options,
                answer,
            } => CheckJson::Choice {
                id: id.0.clone(),
                prompt: prompt.clone(),
                options: options.clone(),
                answer: *answer,
            },
            Check::Short {
                id,
                prompt,
                answers,
            } => CheckJson::Short {
                id: id.0.clone(),
                prompt: prompt.clone(),
                answers: answers.clone(),
            },
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LessonJson {
    id: String,
    title: String,
    body: String,
    body_html: String,
    checks: Vec<CheckJson>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModuleJson {
    id: String,
    tag: String,
    title: String,
    lesson_count: usize,
    check_count: usize,
    lessons: Vec<LessonJson>,
}

#[derive(Serialize)]
struct PlacementJson {
    module: String,
    check: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CurriculumJson {
    modules: Vec<ModuleJson>,
    placement: Vec<PlacementJson>,
    module_count: usize,
    lesson_count: usize,
    check_count: usize,
}

/// Build the whole-curriculum value from the one content source.
fn curriculum_json() -> CurriculumJson {
    let mut modules = Vec::new();
    let mut lesson_total = 0usize;
    let mut check_total = 0usize;

    for module in Curriculum::all() {
        let dir = &module.id.0;
        let checks = Curriculum::load_checks(dir);
        let mut lessons = Vec::new();
        for lesson in &module.lessons {
            let prefix = check_prefix(dir, &lesson.id.0);
            let lesson_checks: Vec<CheckJson> = checks
                .iter()
                .filter(|c| c.id().0.starts_with(&prefix))
                .map(CheckJson::from)
                .collect();
            lessons.push(LessonJson {
                id: lesson.id.0.clone(),
                title: lesson.title.clone(),
                body: lesson.body.clone(),
                body_html: thunk_web::markdown::render(&lesson.body),
                checks: lesson_checks,
            });
        }
        lesson_total += module.lessons.len();
        check_total += checks.len();
        modules.push(ModuleJson {
            id: dir.clone(),
            tag: module_tag(dir),
            title: module.title.clone(),
            lesson_count: module.lessons.len(),
            check_count: checks.len(),
            lessons,
        });
    }

    let placement = Curriculum::placement()
        .iter()
        .map(|i| PlacementJson {
            module: i.module.0.clone(),
            check: i.check.id().0.clone(),
        })
        .collect();

    CurriculumJson {
        module_count: modules.len(),
        lesson_count: lesson_total,
        check_count: check_total,
        modules,
        placement,
    }
}

/// The curriculum serialized as pretty JSON with a trailing newline - stable
/// enough to check in and diff-assert for freshness in CI.
pub fn export_json() -> String {
    let mut s = serde_json::to_string_pretty(&curriculum_json())
        .expect("the curriculum value is always serializable");
    s.push('\n');
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn export_is_the_whole_curriculum_as_valid_json() {
        let json = export_json();
        let v: Value = serde_json::from_str(&json).expect("export emits valid JSON");

        let modules = v["modules"].as_array().expect("modules array");
        assert_eq!(modules.len(), 7, "seven modules on the inside ladder");
        assert_eq!(v["moduleCount"], 7);

        let lessons: usize = modules
            .iter()
            .map(|m| m["lessons"].as_array().unwrap().len())
            .sum();
        assert_eq!(lessons, 31, "thirty-one lessons in all");
        assert_eq!(v["lessonCount"], 31);

        let checks: usize = modules
            .iter()
            .flat_map(|m| m["lessons"].as_array().unwrap())
            .map(|l| l["checks"].as_array().unwrap().len())
            .sum();
        assert_eq!(checks, 93, "ninety-three checks in all");
        assert_eq!(v["checkCount"], 93);
    }

    #[test]
    fn a_known_choice_answer_round_trips() {
        let v: Value = serde_json::from_str(&export_json()).unwrap();
        let check = v["modules"]
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|m| m["lessons"].as_array().unwrap())
            .flat_map(|l| l["checks"].as_array().unwrap())
            .find(|c| c["id"] == "m0-01-processor")
            .expect("m0-01-processor is present");
        assert_eq!(check["kind"], "choice");
        assert_eq!(check["answer"], 1, "the processor is option index 1");
        assert_eq!(check["options"][1], "the processor");
    }

    #[test]
    fn short_checks_carry_their_accepted_answers() {
        let v: Value = serde_json::from_str(&export_json()).unwrap();
        let check = v["modules"]
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|m| m["lessons"].as_array().unwrap())
            .flat_map(|l| l["checks"].as_array().unwrap())
            .find(|c| c["id"] == "m0-01-switch")
            .expect("m0-01-switch is present");
        assert_eq!(check["kind"], "short");
        let answers: Vec<String> = check["answers"]
            .as_array()
            .unwrap()
            .iter()
            .map(|a| a.as_str().unwrap().to_string())
            .collect();
        assert!(answers.contains(&"1".to_string()));
    }

    #[test]
    fn lessons_carry_prerendered_html_and_tags() {
        let v: Value = serde_json::from_str(&export_json()).unwrap();
        let m0 = &v["modules"][0];
        assert_eq!(m0["tag"], "M0");
        let first = &m0["lessons"][0];
        assert!(
            first["bodyHtml"].as_str().unwrap().contains("<h1>"),
            "body_html is the rendered dialect, not raw markdown"
        );
        assert!(
            first["body"].as_str().unwrap().starts_with('#'),
            "body keeps the raw markdown too"
        );
    }

    #[test]
    fn placement_lists_three_check_ids_per_module() {
        let v: Value = serde_json::from_str(&export_json()).unwrap();
        let placement = v["placement"].as_array().expect("placement array");
        assert_eq!(placement.len(), 21, "seven modules, three items each");
        assert!(placement
            .iter()
            .any(|p| p["check"] == "m0-03-same" && p["module"] == "m0-power-on"));
    }
}
