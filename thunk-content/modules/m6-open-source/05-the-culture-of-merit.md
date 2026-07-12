# The Culture of Merit

So far this module has covered things: licenses, commits, diffs. This last lesson is about how the
people are organized, because you may want to work among them, and you should know exactly what
that is like before you decide.

## Who decides

An open source project is not a committee of equals. Every project has **maintainers**: the people
with the authority to accept a change into the repository. Usually they are the ones who started
the project or have done sustained, visible work on it. When you propose a diff, a maintainer
decides whether it merges. There is no appeal past them; it is their project.

Before that decision, there is review. **Reviewers** read your diff and say what they see, plainly.
"This breaks when x is zero." "This duplicates a function that already exists." "The message on
this error is unclear." Anyone can review, and on healthy projects many people do; maintainers
weigh what the reviewers found.

## What review judges

Review judges the change, not the person who sent it. That sentence is what **merit** means here,
and both halves of it are true in ways you should take literally.

The first half means the standard is the work. Review is exacting, and it can be blunt. Your diff
may come back with a dozen objections, each one specific, none of them softened. A maintainer may
reject outright a change you spent a week on, with two sentences about why. This is normal. The
project lives with every merged line for years, so the questions are narrow and hard: is it
correct, is it clear, does it fit.

The second half means the standard is only the work. Nobody in a review thread is asked who they
are, what they did before, or where they are writing from. The diff does not carry your history,
your schooling, or your record. Regulars and strangers get the same questions, the questions you
learned to read in the last lesson: what does this change do, and is it right. The culture is
blunt about code and blind to everything else. People with gaps in their story have found that
combination unusual, and useful.

## The record

Lesson 03 said merged work stays credited to its author, permanently and publicly. Follow that
through. Every change you get merged is in the project's history with your name and date on it,
in a public repository, verifiable by anyone who cares to look. Not claimed on a resume: checkable
at the source, with the diff itself still readable. A **contribution history** is a work record
that proves itself, built one accepted change at a time.

You now know what open source is, what its licenses promise, how its history is kept, how to read
the diffs it runs on, and who decides what merges. What remains is to do it once: take a real
project, make a real change, and send it. That is M7, on the open build, where thunk's own
repository is on hand. Your first merged diff starts the record.

## Key terms

- **maintainer** — a person with the authority to accept a change into a project.
- **reviewer** — a person who reads a proposed diff and says, plainly, what they see.
- **merit** — the standard review applies: the change is judged, not the person who sent it.
- **contribution history** — the public, verifiable record of the changes merged under your name.
