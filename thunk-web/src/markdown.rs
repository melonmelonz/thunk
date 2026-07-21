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

/// The static, JS-free fallback caption emitted into the offline bundle for a
/// known widget id. `None` for an id this renderer does not recognize, so a
/// stray or misspelled directive degrades to inert text instead of a figure.
/// These ids are the ones `thunk_content::WIDGET_IDS` allowlists; the content
/// suite pins that no lesson references an id outside that set.
fn widget_caption(id: &str) -> Option<&'static str> {
    Some(match id {
        "spi-scope" => {
            "An interactive SPI waveform: drag a byte and watch each bit latch \
             on the clock's rising edge (open the course site to use it)."
        }
        "bit-lab" => {
            "An interactive byte: flip eight switches and read it out in binary, \
             decimal, hex, and ASCII (open the course site to use it)."
        }
        "byte-decoder" => {
            "An interactive byte decoder: type a value in binary, decimal, or hex \
             and watch the same number appear in all four readings plus its \
             character (open the course site to use it)."
        }
        "volatile-memory" => {
            "An interactive memory model: cut power and the volatile memory row \
             clears while the storage row keeps its bytes (open the course site \
             to use it)."
        }
        "ownership-move" => {
            "An interactive borrow checker: move a value between two bindings and \
             take shared or mutable borrows; illegal moves are refused with the \
             real compiler error (open the course site to use it)."
        }
        "pixel-forge" => {
            "An interactive RGB565 mixer: set the five red, six green, and five \
             blue bits and see the 16-bit word, its two bytes, and the resulting \
             pixel (open the course site to use it)."
        }
        "diff-reader" => {
            "An interactive diff reader: a real unified patch with added and \
             removed lines, hunk header, and line numbers, plus a reveal of what \
             the change does (open the course site to use it)."
        }
        "frame-budget" => {
            "An interactive frame budget: turn the bus clock and read whether the \
             loop closes inside its thirtieth of a second, then swap the window \
             trick for per-pixel aim and watch it blow (open the course site to \
             use it)."
        }
        _ => return None,
    })
}

/// A widget directive placeholder: a labeled `<figure>` the site hydrates and
/// the offline bundle shows as its static caption. JS-free and valid on its own.
fn widget_figure(id: &str, caption: &str) -> String {
    format!(
        "<figure class=\"widget\" data-widget=\"{}\"><figcaption>{}</figcaption></figure>\n",
        esc(id),
        esc(caption),
    )
}

/// Render the constrained lesson dialect to HTML.
pub fn render(md: &str) -> String {
    let lines: Vec<&str> = md.lines().collect();
    let mut out = String::with_capacity(md.len() * 2);
    let mut block = Block::None;
    let mut in_fence = false;

    let mut idx = 0;
    while idx < lines.len() {
        let line = lines[idx];
        idx += 1;
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
        // A widget directive: `:::widget <id>` on its own line, closed by a bare
        // `:::` on the next. A well-formed directive whose id this renderer knows
        // becomes a hydratable placeholder figure; anything else (no id, unknown
        // id, or a missing close) falls through and renders as inert prose, never
        // a panic.
        if let Some(rest) = line.strip_prefix(":::widget ") {
            let id = rest.trim();
            let closed = lines.get(idx).map(|l| l.trim() == ":::").unwrap_or(false);
            if let (true, Some(caption)) = (closed, widget_caption(id)) {
                flush(&mut block, &mut out);
                idx += 1; // consume the closing `:::`
                out.push_str(&widget_figure(id, caption));
                continue;
            }
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
    fn widget_directive_renders_a_hydratable_figure() {
        let html = render(":::widget spi-scope\n:::\n");
        assert!(html.contains("<figure class=\"widget\" data-widget=\"spi-scope\">"));
        assert!(html.contains("<figcaption>"));
        assert!(html.contains("open the course site to use it"));
        // The figure closes and nothing leaks the raw directive markers.
        assert!(html.contains("</figure>"));
        assert!(!html.contains(":::"));
    }

    #[test]
    fn bit_lab_directive_gets_its_own_caption() {
        let html = render(":::widget bit-lab\n:::\n");
        assert!(html.contains("data-widget=\"bit-lab\""));
        assert!(html.contains("flip eight switches"));
        assert!(!html.contains("spi-scope"));
    }

    #[test]
    fn each_d_b_widget_gets_its_own_caption() {
        // Every D-B widget renders a hydratable figure with an id-specific,
        // JS-free fallback caption. A missing arm here would degrade the widget
        // to inert text in the offline bundle, so pin one distinctive phrase each.
        let cases = [
            ("byte-decoder", "type a value"),
            ("volatile-memory", "cut power"),
            ("ownership-move", "borrow checker"),
            ("pixel-forge", "RGB565 mixer"),
            ("diff-reader", "unified patch"),
        ];
        for (id, phrase) in cases {
            let html = render(&format!(":::widget {id}\n:::\n"));
            assert!(
                html.contains(&format!("data-widget=\"{id}\"")),
                "no figure for {id}"
            );
            assert!(html.contains("<figcaption>"), "no caption for {id}");
            assert!(html.contains(phrase), "caption for {id} missing {phrase:?}");
            assert!(
                html.contains("open the course site to use it"),
                "caption for {id} missing the offline note"
            );
            assert!(!html.contains(":::"), "raw directive leaked for {id}");
        }
    }

    #[test]
    fn a_directive_flushes_the_surrounding_prose() {
        let html = render("Before it.\n\n:::widget spi-scope\n:::\n\nAfter it.\n");
        assert!(html.contains("<p>Before it.</p>"));
        assert!(html.contains("<figure class=\"widget\" data-widget=\"spi-scope\">"));
        assert!(html.contains("<p>After it.</p>"));
        // Order preserved: figure between the two paragraphs.
        let fig = html.find("<figure").unwrap();
        assert!(html.find("Before it.").unwrap() < fig);
        assert!(fig < html.find("After it.").unwrap());
    }

    #[test]
    fn an_unknown_widget_id_is_inert_text_not_a_figure() {
        // A misspelled or not-yet-registered id must never panic and must never
        // emit a figure the site can't hydrate; it degrades to escaped prose.
        let html = render(":::widget no-such-widget\n:::\n");
        assert!(!html.contains("<figure"));
        assert!(html.contains(":::widget no-such-widget"));
    }

    #[test]
    fn a_directive_missing_its_close_is_inert() {
        // No trailing `:::`: not a directive. Rendered as ordinary prose.
        let html = render(":::widget spi-scope\nand then some prose\n");
        assert!(!html.contains("<figure"));
        assert!(html.contains(":::widget spi-scope"));
    }

    #[test]
    fn a_directive_inside_a_fence_is_left_verbatim() {
        // Documenting the directive in a code block must not trigger a figure.
        let html = render("```\n:::widget spi-scope\n:::\n```\n");
        assert!(!html.contains("<figure"));
        assert!(html.contains(":::widget spi-scope"));
        assert_eq!(
            html.matches("<pre>").count(),
            html.matches("</pre>").count()
        );
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
                assert_eq!(
                    html.matches("<figure").count(),
                    html.matches("</figure>").count(),
                    "{}",
                    l.id.0
                );
                assert!(!html.contains("```"), "unrendered fence in {}", l.id.0);
                assert!(
                    !html.contains(":::widget"),
                    "unrendered widget in {}",
                    l.id.0
                );
            }
        }
    }
}
