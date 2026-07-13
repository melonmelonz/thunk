//! The page shell: layout, nav, escaping.
//!
//! One shell wraps every page: semantic landmarks (`<nav>`, `<main>`,
//! `<footer>`), a skip link, and a depth-aware relative link to the one
//! stylesheet. No external URL ever appears - the shell test pins that.

/// Escape the five HTML-significant characters; used everywhere a domain
/// string meets markup.
pub fn esc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

/// Wrap `main_html` in the full document shell. `depth` is how many
/// directories deep the page sits, so asset and home links stay relative
/// and the site works from `file://`.
pub fn shell(title: &str, site_name: &str, main_html: &str, depth: usize) -> String {
    let root = "../".repeat(depth);
    let title = esc(title);
    let site = esc(site_name);
    format!(
        "<!doctype html>\n\
         <html lang=\"en\">\n\
         <head>\n\
         <meta charset=\"utf-8\">\n\
         <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\
         <title>{title} · {site}</title>\n\
         <link rel=\"stylesheet\" href=\"{root}assets/thunk.css\">\n\
         </head>\n\
         <body>\n\
         <a class=\"skip\" href=\"#main\">skip to content</a>\n\
         <header><nav aria-label=\"course\"><a class=\"site\" href=\"{root}index.html\">{site}</a></nav></header>\n\
         <main id=\"main\">\n\
         {main_html}\n\
         </main>\n\
         <footer><p>{site} · MIT OR Apache-2.0 · fully offline, nothing leaves this machine</p></footer>\n\
         <script src=\"{root}assets/check.js\"></script>\n\
         </body>\n\
         </html>\n"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_is_semantic_and_self_contained() {
        let html = shell("Power On", "thunk", "<p>x</p>", 1);
        for needle in [
            "<!doctype html>",
            "<html lang=\"en\">",
            "<meta charset=\"utf-8\">",
            "<meta name=\"viewport\"",
            "<main",
            "</main>",
            "<nav",
            "aria-label",
            "href=\"../assets/thunk.css\"",
        ] {
            assert!(html.contains(needle), "missing {needle}");
        }
        assert!(!html.contains("http://"), "external URL leaked");
        assert!(!html.contains("https://"), "external URL leaked");
    }

    #[test]
    fn esc_neutralizes_markup_and_keeps_utf8() {
        assert_eq!(
            esc("a<b & \"c\"'d'"),
            "a&lt;b &amp; &quot;c&quot;&#39;d&#39;"
        );
        assert_eq!(esc("bit — a digit"), "bit — a digit");
    }

    #[test]
    fn the_shell_includes_the_grader_and_the_grader_is_framework_free() {
        let js = include_str!("../assets/check.js");
        for forbidden in ["fetch(", "XMLHttpRequest", "import ", "require(", "http"] {
            assert!(
                !js.contains(forbidden),
                "check.js must be inert: found {forbidden}"
            );
        }
        assert!(js.contains("aria-live") || js.contains("verdict"));
        let html = shell("t", "thunk", "<p>x</p>", 0);
        assert!(html.contains("check.js"));
    }

    #[test]
    fn depth_zero_links_are_local() {
        let html = shell("thunk", "thunk", "<p>x</p>", 0);
        assert!(html.contains("href=\"assets/thunk.css\""));
        assert!(html.contains("href=\"index.html\""));
    }
}
