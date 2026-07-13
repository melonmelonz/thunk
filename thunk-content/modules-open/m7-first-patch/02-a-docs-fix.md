# A Docs Fix

Your first contribution should be to documentation. Not because documentation is easy, but
because a docs change exercises the entire contribution workflow, fork to merge, with almost no
risk on the far end. A bad code change can break the software for everyone who runs it. A bad
docs change has a much smaller blast radius: the worst case is that the document stays as wrong
as it already was. Reviewers can check a docs
change in minutes, which spends less of the scarce resource from last lesson. You get the full
experience, the project gets a real improvement, and nothing can catch fire.

## The newcomer's advantage

Documentation has a defect class its own authors cannot see. The people who wrote it already knew
the answers, so their eyes slide over the step that no longer works. You are reading it cold, and
that is a genuine advantage: you hit the defects for real. A command whose flags no longer match
what the program accepts. A link that goes nowhere. A default value the code changed two years ago
while the paragraph kept the old number. An install step that assumes a file the repository no
longer contains.

So the method is simple: pick the project from last lesson and follow its documentation as if you
knew nothing, doing each step exactly as written. Anywhere the document and the software disagree,
you have found real work. Confirm which side is wrong by checking the source, then fix the
document to match the truth.

## The mechanics, once more

M6 covered the machinery; here is the pass you actually make. Take a fork, your own copy of the
repository. Inside it, make a **branch**: a named line of commits that keeps this one change
separate from anything else you might do in the fork; one change, one branch, always. Edit the
document, then commit, with a message that explains the change in your own words.

What you offer back is a **patch**: the change itself plus its description, the unit a reviewer
reads and judges. On most hosting sites the way you offer it is a **pull request**, a request that
the project pull your branch's commits into its history. Some projects say merge request; the
kernel takes patches by email. The CONTRIBUTING file from last lesson already told you which form
this project expects.

## Describing the change

The description is half the patch, and it answers three questions in order. What was wrong: the
command in the install section fails, because the program renamed the flag. What is right now: the
document shows the flag the program actually accepts. How you verified it: you ran the corrected
command against the current release, and it behaves as the document now says.

That last answer is the one first-timers skip, and it is the one that makes a maintainer trust the
patch. Verify before you send, every time; for documentation that means you ran the command,
followed the link, or read the code that sets the default. A reviewer who can see how you checked
your work barely has to redo it, and a patch that is cheap to trust is cheap to merge.

## Key terms

- **branch** — a named line of commits inside a repository, keeping one change separate from the rest.
- **patch** — a proposed change plus its description: the unit review reads and judges.
- **pull request** — a request that a project pull your branch's commits into its history; the common way patches travel on hosting sites.
