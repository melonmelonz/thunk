//! The constrained-dialect markdown renderer.
//!
//! The 31 lessons use exactly this dialect (pinned by thunk-content's
//! validation suite and the real-lesson test below): `#`/`##`/`###` headings,
//! blank-line-separated paragraphs, `- ` and `N. ` list runs whose items may
//! wrap onto indented continuation lines, fenced code blocks (rust, diffs,
//! ASCII waveforms - all verbatim), one four-space indented code line, and an
//! inline layer of `**bold**` and `` `code` `` (bold may span a line break
//! inside a paragraph, and may wrap a code span). Everything is escaped
//! before any tag is emitted; UTF-8 prose such as the Key-terms em dash
//! passes through untouched.

/// Escape the five HTML-significant characters; everything else (em dashes,
/// arrows, box-drawing) passes through as the UTF-8 it already is.
fn esc(s: &str) -> String {
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

/// `**bold**` on already-escaped text. An unpaired `**` is left literal.
fn bold(escaped: &str) -> String {
    let parts: Vec<&str> = escaped.split("**").collect();
    let mut out = String::with_capacity(escaped.len());
    for (i, part) in parts.iter().enumerate() {
        if i % 2 == 1 {
            if i == parts.len() - 1 {
                out.push_str("**"); // opener with no closer: keep it literal
                out.push_str(part);
            } else {
                out.push_str("<strong>");
                out.push_str(part);
                out.push_str("</strong>");
            }
        } else {
            out.push_str(part);
        }
    }
    out
}

/// The inline pass: escape FIRST, then markers (they survive escaping since
/// they are not `<>&"'`). Code spans are cut out before bold runs, so a `*`
/// inside backticks is never a bold marker.
fn inline(raw: &str) -> String {
    let escaped = esc(raw);
    let parts: Vec<&str> = escaped.split('`').collect();
    let mut out = String::with_capacity(escaped.len());
    for (i, part) in parts.iter().enumerate() {
        if i % 2 == 1 {
            if i == parts.len() - 1 {
                out.push('`'); // opener with no closer: keep it literal
                out.push_str(&bold(part));
            } else {
                out.push_str("<code>");
                out.push_str(part);
                out.push_str("</code>");
            }
        } else {
            out.push_str(&bold(part));
        }
    }
    out
}

/// The block being accumulated while scanning lines.
enum Block {
    None,
    Para(String),
    List {
        tag: &'static str,
        items: Vec<String>,
    },
    Indented(String),
}

fn flush(block: &mut Block, out: &mut String) {
    match std::mem::replace(block, Block::None) {
        Block::None => {}
        Block::Para(text) => {
            out.push_str("<p>");
            out.push_str(&inline(&text));
            out.push_str("</p>\n");
        }
        Block::List { tag, items } => {
            out.push('<');
            out.push_str(tag);
            out.push_str(">\n");
            for item in items {
                out.push_str("<li>");
                out.push_str(&inline(&item));
                out.push_str("</li>\n");
            }
            out.push_str("</");
            out.push_str(tag);
            out.push_str(">\n");
        }
        Block::Indented(code) => {
            out.push_str("<pre><code>");
            out.push_str(&code);
            out.push_str("</code></pre>\n");
        }
    }
}

/// A `N. ` ordered-list marker; returns the text after it.
fn ordered_item(line: &str) -> Option<&str> {
    let digits = line.len() - line.trim_start_matches(|c: char| c.is_ascii_digit()).len();
    if digits == 0 {
        return None;
    }
    line[digits..].strip_prefix(". ")
}

/// Render the constrained lesson dialect to HTML.
pub fn render(md: &str) -> String {
    let mut out = String::with_capacity(md.len() * 2);
    let mut block = Block::None;
    let mut in_fence = false;

    for line in md.lines() {
        if in_fence {
            if line.starts_with("```") {
                out.push_str("</code></pre>\n");
                in_fence = false;
            } else {
                out.push_str(&esc(line));
                out.push('\n');
            }
            continue;
        }
        if line.starts_with("```") {
            flush(&mut block, &mut out);
            out.push_str("<pre><code>");
            in_fence = true;
            continue;
        }
        if line.trim().is_empty() {
            flush(&mut block, &mut out);
            continue;
        }
        if let Some(rest) = line
            .strip_prefix("# ")
            .map(|r| (1, r))
            .or_else(|| line.strip_prefix("## ").map(|r| (2, r)))
            .or_else(|| line.strip_prefix("### ").map(|r| (3, r)))
        {
            let (level, text) = rest;
            flush(&mut block, &mut out);
            out.push_str(&format!("<h{level}>{}</h{level}>\n", inline(text.trim())));
            continue;
        }
        if let Some(item) = line.strip_prefix("- ") {
            match &mut block {
                Block::List { tag: "ul", items } => items.push(item.to_string()),
                _ => {
                    flush(&mut block, &mut out);
                    block = Block::List {
                        tag: "ul",
                        items: vec![item.to_string()],
                    };
                }
            }
            continue;
        }
        if let Some(item) = ordered_item(line) {
            // A run continues on any `N. `; a NEW run only starts on `1. `,
            // so a wrapped paragraph line that happens to begin with "65. "
            // (m0-03 has one) stays in its paragraph.
            match &mut block {
                Block::List { tag: "ol", items } => {
                    items.push(item.to_string());
                    continue;
                }
                _ if line.starts_with("1. ") => {
                    flush(&mut block, &mut out);
                    block = Block::List {
                        tag: "ol",
                        items: vec![item.to_string()],
                    };
                    continue;
                }
                _ => {} // fall through: paragraph continuation
            }
        }
        if line.starts_with(' ') {
            // Indented: a list item's wrapped continuation, or (at a block
            // boundary, four spaces deep) an indented code line.
            match &mut block {
                Block::List { items, .. } => {
                    let last = items.last_mut().expect("list block is never empty");
                    last.push(' ');
                    last.push_str(line.trim_start());
                    continue;
                }
                Block::Indented(code) if line.starts_with("    ") => {
                    code.push_str(&esc(&line[4..]));
                    code.push('\n');
                    continue;
                }
                Block::None if line.starts_with("    ") => {
                    let mut code = esc(&line[4..]);
                    code.push('\n');
                    block = Block::Indented(code);
                    continue;
                }
                _ => {} // fall through: paragraph continuation
            }
        }
        match &mut block {
            Block::Para(text) => {
                text.push('\n');
                text.push_str(line.trim());
            }
            _ => {
                flush(&mut block, &mut out);
                block = Block::Para(line.trim().to_string());
            }
        }
    }
    if in_fence {
        out.push_str("</code></pre>\n"); // unterminated fence: close honestly
    }
    flush(&mut block, &mut out);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn headings_paragraphs_and_bold() {
        let html =
            render("# The Machine\n\nA computer is a **machine** that follows instructions.\n");
        assert!(html.contains("<h1>The Machine</h1>"));
        assert!(html.contains(
            "<p>A computer is a <strong>machine</strong> that follows instructions.</p>"
        ));
    }

    #[test]
    fn code_fences_are_preserved_verbatim_and_escaped() {
        let html = render("```\nlet a = <b> & 'c';\n```\n");
        assert!(html.contains("<pre><code>let a = &lt;b&gt; &amp; &#39;c&#39;;\n</code></pre>"));
    }

    #[test]
    fn inline_code_and_lists() {
        let html = render(
            "- **bit** — a digit\n- **byte** — eight bits\n\nUse `mmap` here.\n1. first\n2. second\n",
        );
        assert!(html.contains("<ul>"));
        assert!(html.contains("<li><strong>bit</strong> — a digit</li>"));
        assert!(html.contains("<code>mmap</code>"));
        assert!(html.contains("<ol>"));
        assert!(html.contains("<li>first</li>"));
    }

    #[test]
    fn html_in_prose_is_escaped() {
        let html = render("a < b & c > d\n");
        assert!(html.contains("a &lt; b &amp; c &gt; d"));
        assert!(!html.contains("<script"));
    }

    #[test]
    fn every_real_lesson_renders_without_panicking_and_balanced() {
        for m in thunk_content::Curriculum::all() {
            for l in &m.lessons {
                let html = render(&l.body);
                assert_eq!(
                    html.matches("<pre>").count(),
                    html.matches("</pre>").count(),
                    "{}",
                    l.id.0
                );
                assert_eq!(
                    html.matches("<ul>").count(),
                    html.matches("</ul>").count(),
                    "{}",
                    l.id.0
                );
                assert!(!html.contains("```"), "unrendered fence in {}", l.id.0);
            }
        }
    }
}
