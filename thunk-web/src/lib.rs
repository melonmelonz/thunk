//! thunk-web: the course rendered as a fully offline static site.
//!
//! Pure functions from domain values to HTML/CSS strings. No dependencies
//! beyond the thunk workspace crates; no external assets, ever.

pub mod course;
pub mod markdown;
pub mod page;
pub mod sim;

use std::path::PathBuf;
use thunk_content::Curriculum;

/// The whole site, assembled in memory. Writers (thunk-cli's `web` and
/// `serve`) are thin loops over what this returns.
pub struct Site;

impl Site {
    /// Every file the site contains, as (relative path, contents): the
    /// index, one page per module, one page per lesson, the sim page, and
    /// the two assets. All links inside are depth-aware and relative, so
    /// the tree works opened straight from `file://`.
    pub fn generate() -> Vec<(PathBuf, String)> {
        let mut files = vec![
            (PathBuf::from("index.html"), course::index_page()),
            (PathBuf::from("sim/index.html"), sim::sim_page()),
            (
                PathBuf::from("assets/thunk.css"),
                include_str!("../assets/thunk.css").to_string(),
            ),
            (
                PathBuf::from("assets/check.js"),
                include_str!("../assets/check.js").to_string(),
            ),
        ];
        for module in Curriculum::all() {
            let dir = &module.id.0;
            files.push((
                PathBuf::from(format!("{dir}/index.html")),
                course::module_page(dir),
            ));
            for lesson in &module.lessons {
                files.push((
                    PathBuf::from(format!("{dir}/lessons/{}.html", lesson.id.0)),
                    course::lesson_page(dir, &lesson.id.0),
                ));
            }
        }
        files
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_site_is_complete_and_hermetic() {
        let files = Site::generate();
        let paths: Vec<String> = files
            .iter()
            .map(|(p, _)| p.to_string_lossy().into())
            .collect();
        assert!(paths.contains(&"index.html".to_string()));
        assert!(paths.contains(&"assets/thunk.css".to_string()));
        assert!(paths.contains(&"assets/check.js".to_string()));
        assert!(paths.contains(&"sim/index.html".to_string()));
        let lesson_pages = paths.iter().filter(|p| p.contains("/lessons/")).count();
        assert_eq!(lesson_pages, 31);
        for (p, body) in &files {
            assert!(
                !body.contains("http://") && !body.contains("https://"),
                "external URL in {}",
                p.display()
            );
        }
    }
}
