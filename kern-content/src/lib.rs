//! The curriculum, baked into the binary at compile time. No files ship alongside.

use kern_core::{Check, Lesson, LessonId, Module, ModuleId};
use rust_embed::RustEmbed;
use serde::Deserialize;

#[derive(RustEmbed)]
#[folder = "modules/"]
struct Assets;

#[derive(Deserialize)]
struct ModuleMeta {
    id: String,
    title: String,
    lessons: Vec<String>,
}

fn read(path: &str) -> String {
    let f = Assets::get(path).unwrap_or_else(|| panic!("missing embedded asset: {path}"));
    String::from_utf8(f.data.into_owned()).expect("embedded asset is valid utf8")
}

/// Title = the first `# ` heading in the markdown, falling back to the id.
fn title_of(body: &str, fallback: &str) -> String {
    body.lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l[2..].trim().to_string())
        .unwrap_or_else(|| fallback.to_string())
}

pub struct Curriculum;

impl Curriculum {
    pub fn module_one() -> Module {
        Self::load_module("m1-kernel")
    }
    pub fn module_one_checks() -> Vec<Check> {
        Self::load_checks("m1-kernel")
    }

    pub fn load_module(dir: &str) -> Module {
        let meta: ModuleMeta =
            ron::from_str(&read(&format!("{dir}/module.ron"))).expect("valid module.ron");
        let lessons = meta
            .lessons
            .iter()
            .map(|lid| {
                let body = read(&format!("{dir}/{lid}.md"));
                let title = title_of(&body, lid);
                Lesson { id: LessonId(lid.clone()), title, body }
            })
            .collect();
        Module { id: ModuleId(meta.id), title: meta.title, lessons }
    }

    pub fn load_checks(dir: &str) -> Vec<Check> {
        ron::from_str(&read(&format!("{dir}/checks.ron"))).expect("valid checks.ron")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use kern_core::Verdict;

    #[test]
    fn loads_module_one() {
        let m = Curriculum::module_one();
        assert_eq!(m.id.0, "m1-kernel");
        assert!(!m.lessons.is_empty());
        assert!(m.lessons[0].body.to_lowercase().contains("kernel"));
    }

    #[test]
    fn every_check_canonical_answer_is_correct() {
        let checks = Curriculum::module_one_checks();
        assert!(checks.len() >= 3, "module one should ship at least 3 checks");
        for c in &checks {
            assert_eq!(c.grade(&c.canonical_answer()), Verdict::Correct, "check {:?}", c.id());
        }
    }
}
