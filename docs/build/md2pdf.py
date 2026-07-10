#!/usr/bin/env python3
"""Render project markdown docs to uniformly-styled PDFs that match the HTML doc set.

Usage: run from the repo root:  python3 docs/build/md2pdf.py
Requires: python-markdown, weasyprint.
"""
import markdown
import weasyprint

CSS = r"""
@page { margin: 20mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #1b1b1a;
  font-family: Georgia, "Liberation Serif", "Times New Roman", serif;
  font-size: 11pt; line-height: 1.55; }
.eyebrow { font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 8.5pt; letter-spacing: .2em; text-transform: uppercase; color: #165c4f; margin: 0 0 8px; }
h1 { font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-weight: 700; font-size: 22pt; letter-spacing: -.01em; margin: 0 0 8px; line-height: 1.1; }
h2 { font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 11.5pt; letter-spacing: .06em; text-transform: uppercase; color: #165c4f;
  margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #ddd7ca; break-after: avoid; }
h3 { font-family: Georgia, serif; font-weight: 700; font-size: 12pt; margin: 16px 0 4px; break-after: avoid; }
p { margin: 0 0 10px; }
ul, ol { margin: 6px 0 12px; padding-left: 22px; }
li { margin: 0 0 5px; }
strong { font-weight: 700; }
em { font-style: italic; }
code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 9.5pt;
  background: #f2efe7; padding: 1px 4px; border-radius: 3px; }
pre { background: #f2efe7; border: 1px solid #ddd7ca; border-radius: 6px; padding: 10px 12px;
  font-size: 9pt; white-space: pre-wrap; }
pre code { background: none; padding: 0; }
hr { border: 0; border-top: 1px solid #ddd7ca; margin: 18px 0; }
blockquote { margin: 14px 0; padding: 8px 16px; border-left: 3px solid #165c4f;
  background: #e4efe9; font-style: italic; }
a { color: #165c4f; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 10px 0; }
th, td { border: 1px solid #ddd7ca; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #e4efe9; font-family: "SF Mono", monospace; font-size: 8.5pt;
  text-transform: uppercase; letter-spacing: .04em; color: #165c4f; }
"""

TEMPLATE = ('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
            '<style>{css}</style></head><body>{eyebrow}{body}</body></html>')


def build(md_path, pdf_path, eyebrow=""):
    text = open(md_path, encoding="utf-8").read()
    body = markdown.markdown(text, extensions=["tables", "fenced_code", "sane_lists"])
    eb = '<p class="eyebrow">{}</p>'.format(eyebrow) if eyebrow else ""
    html = TEMPLATE.format(css=CSS, eyebrow=eb, body=body)
    weasyprint.HTML(string=html).write_pdf(pdf_path)
    print("built", pdf_path)


JOBS = [
    ("docs/PRD.md", "docs/pdf/PRD.pdf", "Product Requirements Document · Next Chapter"),
    ("docs/DESIGN-SPEC.md", "docs/pdf/DESIGN-SPEC.pdf", "Design Spec · Next Chapter"),
    ("docs/PITCH.md", "docs/pdf/PITCH.pdf", "Pitch · Next Chapter"),
]

if __name__ == "__main__":
    for md, pdf, eyebrow in JOBS:
        build(md, pdf, eyebrow)
