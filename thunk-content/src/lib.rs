//! The curriculum, baked into the binary at compile time. No files ship alongside.

use rust_embed::RustEmbed;
use serde::Deserialize;
use thunk_core::{Check, Lesson, LessonId, Module, ModuleId};

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

/// The course ladder, in order. Grows as modules are authored (M-A);
/// completeness is pinned by `the_ladder_is_complete` once M0-M6 land.
pub const LADDER: &[&str] = &["m0-power-on", "m1-kernel", "m2-rust", "m3-bus"];

pub struct Curriculum;

impl Curriculum {
    pub fn module_one() -> Module {
        Self::load_module("m1-kernel")
    }
    pub fn module_one_checks() -> Vec<Check> {
        Self::load_checks("m1-kernel")
    }

    /// Every module on the ladder, in course order.
    pub fn all() -> Vec<Module> {
        LADDER.iter().map(|dir| Self::load_module(dir)).collect()
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
                Lesson {
                    id: LessonId(lid.clone()),
                    title,
                    body,
                }
            })
            .collect();
        Module {
            id: ModuleId(meta.id),
            title: meta.title,
            lessons,
        }
    }

    pub fn load_checks(dir: &str) -> Vec<Check> {
        ron::from_str(&read(&format!("{dir}/checks.ron"))).expect("valid checks.ron")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use thunk_core::Verdict;

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
        assert!(
            checks.len() >= 3,
            "module one should ship at least 3 checks"
        );
        for c in &checks {
            assert_eq!(
                c.grade(&c.canonical_answer()),
                Verdict::Correct,
                "check {:?}",
                c.id()
            );
        }
    }

    #[test]
    fn ladder_modules_load_in_order() {
        let mods = Curriculum::all();
        assert_eq!(mods.len(), LADDER.len());
        for (m, dir) in mods.iter().zip(LADDER) {
            assert_eq!(&m.id.0, dir, "module id must equal its directory name");
            assert!(!m.lessons.is_empty(), "module {dir} has no lessons");
            for l in &m.lessons {
                assert!(!l.title.trim().is_empty(), "untitled lesson in {dir}");
                assert!(
                    l.body.lines().count() >= 20,
                    "lesson {} in {dir} is a stub",
                    l.id.0
                );
                assert!(
                    l.body.contains("## Key terms"),
                    "lesson {} in {dir} lacks key terms",
                    l.id.0
                );
            }
        }
    }

    #[test]
    fn every_check_in_every_module_self_validates() {
        for dir in LADDER {
            let checks = Curriculum::load_checks(dir);
            assert!(!checks.is_empty(), "module {dir} has no checks");
            for c in &checks {
                assert_eq!(
                    c.grade(&c.canonical_answer()),
                    Verdict::Correct,
                    "check {:?} in {dir}",
                    c.id()
                );
            }
        }
    }

    #[test]
    fn every_lesson_has_at_least_three_checks() {
        for dir in LADDER {
            let m = Curriculum::load_module(dir);
            let checks = Curriculum::load_checks(dir);
            let prefix = dir.split('-').next().expect("module dir starts with mN-");
            for l in &m.lessons {
                let n =
                    l.id.0
                        .split('-')
                        .next()
                        .expect("lesson file starts with NN-");
                let want = format!("{prefix}-{n}-");
                let count = checks
                    .iter()
                    .filter(|c| c.id().0.starts_with(&want))
                    .count();
                assert!(
                    count >= 3,
                    "lesson {} in {dir} has {count} checks, needs 3+",
                    l.id.0
                );
            }
        }
    }

    #[test]
    fn check_ids_are_unique_across_the_course() {
        let mut seen = std::collections::BTreeSet::new();
        for dir in LADDER {
            for c in Curriculum::load_checks(dir) {
                assert!(
                    seen.insert(c.id().clone()),
                    "duplicate check id {:?}",
                    c.id()
                );
            }
        }
    }

    #[test]
    fn every_module_gate_is_satisfiable() {
        use thunk_core::Progress;
        for dir in LADDER {
            let checks = Curriculum::load_checks(dir);
            let mut p = Progress::default();
            for c in &checks {
                p.record(c.id(), c.grade(&c.canonical_answer()));
            }
            let ids: Vec<_> = checks.iter().map(|c| c.id().clone()).collect();
            assert!(
                p.module_mastered(&ids),
                "module {dir} can never be mastered"
            );
        }
    }
}
