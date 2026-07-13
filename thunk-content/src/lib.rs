//! The curriculum, baked into the binary at compile time. No files ship alongside.

use rust_embed::RustEmbed;
use serde::Deserialize;
use thunk_core::{Check, CheckId, Lesson, LessonId, Module, ModuleId, PlacementItem};

// Gating note: an `exclude` attribute here would need rust-embed's
// `include-exclude` feature, which pulls in `globset` - a dependency the
// offline build cannot add. Two embed roots give the same guarantee with zero
// new dependencies: `modules/` ships on every build, and `modules-open/` (M7,
// the internet-facing module) is compiled in only when `open` is on, so the
// inside binary carries no M7 bytes at all.
#[derive(RustEmbed)]
#[folder = "modules/"]
struct Assets;

#[cfg(feature = "open")]
#[derive(RustEmbed)]
#[folder = "modules-open/"]
struct OpenAssets;

#[derive(Deserialize)]
struct ModuleMeta {
    id: String,
    title: String,
    lessons: Vec<String>,
}

fn read(path: &str) -> String {
    let asset = Assets::get(path);
    #[cfg(feature = "open")]
    let asset = asset.or_else(|| OpenAssets::get(path));
    let f = asset.unwrap_or_else(|| panic!("missing embedded asset: {path}"));
    String::from_utf8(f.data.into_owned()).expect("embedded asset is valid utf8")
}

/// Title = the first `# ` heading in the markdown, falling back to the id.
fn title_of(body: &str, fallback: &str) -> String {
    body.lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l[2..].trim().to_string())
        .unwrap_or_else(|| fallback.to_string())
}

/// The course ladder, in order. The inside build ends at M6; the open build
/// adds M7 First Patch, the internet-facing module.
#[cfg(not(feature = "open"))]
pub const LADDER: &[&str] = &[
    "m0-power-on",
    "m1-kernel",
    "m2-rust",
    "m3-bus",
    "m4-panel",
    "m5-doom",
    "m6-open-source",
];
#[cfg(feature = "open")]
pub const LADDER: &[&str] = &[
    "m0-power-on",
    "m1-kernel",
    "m2-rust",
    "m3-bus",
    "m4-panel",
    "m5-doom",
    "m6-open-source",
    "m7-first-patch",
];

/// The placement diagnostic covers M0-M6 on every build: knowledge modules
/// you can test out of. Nobody tests out of doing the first contribution.
pub const PLACEMENT_LADDER: &[&str] = &[
    "m0-power-on",
    "m1-kernel",
    "m2-rust",
    "m3-bus",
    "m4-panel",
    "m5-doom",
    "m6-open-source",
];

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

    /// Every module paired with the check ids that must all pass to master
    /// it, in course order - the shape `thunk_core::ladder_state` expects.
    pub fn ladder() -> Vec<(ModuleId, Vec<CheckId>)> {
        Self::all()
            .iter()
            .map(|m| {
                let ids = Self::load_checks(&m.id.0)
                    .iter()
                    .map(|c| c.id().clone())
                    .collect();
                (m.id.clone(), ids)
            })
            .collect()
    }

    /// The placement diagnostic: three existing checks per module, chosen to
    /// separate "already knows this" from "needs the module".
    pub fn placement() -> Vec<PlacementItem> {
        let pairs: Vec<(String, String)> =
            ron::from_str(&read("placement.ron")).expect("valid placement.ron");
        pairs
            .iter()
            .map(|(dir, check_id)| {
                let check = Self::load_checks(dir)
                    .into_iter()
                    .find(|c| c.id().0 == *check_id)
                    .unwrap_or_else(|| {
                        panic!("placement references unknown check {check_id} in {dir}")
                    });
                PlacementItem {
                    module: ModuleId(dir.clone()),
                    check,
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use thunk_core::Verdict;

    #[test]
    fn ladder_pairs_every_module_with_its_check_ids() {
        let ladder = Curriculum::ladder();
        assert_eq!(ladder.len(), LADDER.len());
        for ((id, ids), dir) in ladder.iter().zip(LADDER) {
            assert_eq!(&id.0, dir, "ladder is in course order");
            let want: Vec<_> = Curriculum::load_checks(dir)
                .iter()
                .map(|c| c.id().clone())
                .collect();
            assert_eq!(ids, &want, "every check id of {dir}, in bank order");
        }
    }

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

    #[cfg(not(feature = "open"))]
    #[test]
    fn the_inside_ladder_is_complete_m0_through_m6() {
        assert_eq!(
            LADDER,
            &[
                "m0-power-on",
                "m1-kernel",
                "m2-rust",
                "m3-bus",
                "m4-panel",
                "m5-doom",
                "m6-open-source",
            ]
        );
        for path in Assets::iter() {
            assert!(
                !path.starts_with("m7-"),
                "m7 must not be embedded inside, found: {path}"
            );
        }
    }

    #[cfg(feature = "open")]
    #[test]
    fn the_open_ladder_adds_m7_last() {
        assert_eq!(LADDER.len(), 8);
        assert_eq!(LADDER[..7], PLACEMENT_LADDER[..]);
        assert_eq!(LADDER[7], "m7-first-patch");
        assert_eq!(
            Curriculum::load_module("m7-first-patch").id.0,
            "m7-first-patch"
        );
    }

    #[test]
    fn placement_never_covers_m7() {
        assert_eq!(PLACEMENT_LADDER.last(), Some(&"m6-open-source"));
    }

    #[test]
    fn every_check_belongs_to_a_lesson() {
        // The reverse of every_lesson_has_at_least_three_checks: no orphaned or
        // mis-prefixed check ids (a typo like "m2-01-..." inside m3-bus/checks.ron,
        // or a lesson number no lesson has).
        for dir in LADDER {
            let m = Curriculum::load_module(dir);
            let prefix = dir.split('-').next().expect("module dir starts with mN-");
            let lesson_numbers: Vec<String> = m
                .lessons
                .iter()
                .map(|l| {
                    l.id.0
                        .split('-')
                        .next()
                        .expect("lesson NN- prefix")
                        .to_string()
                })
                .collect();
            for c in Curriculum::load_checks(dir) {
                let id = &c.id().0;
                let ok = lesson_numbers
                    .iter()
                    .any(|n| id.starts_with(&format!("{prefix}-{n}-")));
                assert!(ok, "check {id:?} in {dir} does not match any lesson");
            }
        }
    }

    #[test]
    fn placement_covers_every_module_with_three_existing_checks() {
        let items = Curriculum::placement();
        for dir in PLACEMENT_LADDER {
            let m = Curriculum::load_module(dir);
            let count = items.iter().filter(|i| i.module.0 == m.id.0).count();
            assert_eq!(count, 3, "module {dir} needs exactly 3 placement items");
            let bank = Curriculum::load_checks(dir);
            for item in items.iter().filter(|i| i.module.0 == m.id.0) {
                assert!(
                    bank.iter().any(|c| c == &item.check),
                    "placement item {:?} is not in {dir}'s bank",
                    item.check.id()
                );
            }
        }
        assert_eq!(items.len(), PLACEMENT_LADDER.len() * 3);
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
