# Licenses in Plain Terms

Public source code, by itself, grants you nothing. Copyright law starts every piece of writing,
code included, at "all rights reserved". If you find a program's source online with no license,
you can read it, and legally that is about all. What turns visible code into open source is a
**license**: a short legal text, shipped with the code, that grants the four freedoms and states
the conditions that come with them.

The word "legal" makes people brace for a hundred pages. The common open source licenses are one
or two, and you can read the important ones in five minutes. Here are three that cover most of
what you will meet.

## MIT: use it, keep the notice

The MIT license is one paragraph of permission. In one sentence: use this for anything, and keep
the copyright notice attached. You can sell it, change it, build it into a closed product. Your
one obligation is to leave the author's name and the license text with the code. Licenses this
open-handed are called **permissive**.

## Apache 2.0: the same, plus patents

Apache 2.0 is permissive in the same spirit as MIT, with one addition worth knowing: an explicit
**patent grant**. Every contributor promises, in the license itself, that if their contribution is
covered by a patent they hold, you may use it anyway. MIT never mentions patents. Apache 2.0
settles the question in writing, which is why lawyers at large companies tend to relax around it.

## GPL: share alike

The GPL takes a different position. It is the best-known **copyleft** license: you may use, study,
change, and share the code, but if you ship a changed version, you must ship it under the same
terms, source included. The freedoms travel with the code and you may not strip them off. Linux,
the real kernel behind everything M1 described, is GPL.

## Why an author picks one

The choice comes down to one question: how much do you want changes to your code to stay open?
Pick GPL, and anyone who ships an improved version must publish their improvements. Pick MIT or
Apache 2.0, and people may take your code private, but more of them may use it, since nothing
obliges them to open their own work.

Rust projects have a convention: offer both MIT and Apache 2.0 and let the user pick either. thunk
follows it. This program is **dual-licensed** MIT/Apache-2.0, and the two files, LICENSE-MIT and
LICENSE-APACHE, sit at the top of thunk's own repository where you can read them.

A license is a promise from the author to the world, and you can hold the whole promise in your
head. The next lesson turns to the machinery a project uses to keep track of who changed what:
version control, done in public.

## Key terms

- **license** — the short legal text that grants the four freedoms and states the conditions.
- **permissive** — a license family (MIT, Apache 2.0) that asks little beyond keeping the notice.
- **patent grant** — Apache 2.0's explicit promise that contributors' patents will not be turned against users.
- **copyleft** — the GPL's condition: ship changes under the same terms, source included.
- **dual-licensed** — offered under two licenses at once; thunk is MIT/Apache-2.0, the Rust convention.
