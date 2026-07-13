# Review and Merge

The patch is sent. This lesson is what happens next, because the gap between sending a first patch
and getting it merged is mostly the part nobody warns you about.

## The machines go first

Before a person reads your patch, machines do. Most projects run **CI**, continuous integration:
the project's own scripted checks, run automatically against every proposed change. Builds, test
suites, formatters, lints. You have lived under this discipline all course; every module here had
to pass its checks before it counted, and CI is the same bar applied to you from outside. If CI
fails on your patch, fix that first. No reviewer should spend time on a change the machines have
already rejected, and a red check next to your name answers a question nobody asked yet.

## Then the people

Often, at first, nothing happens. M6 lesson 05 named silence the most common first outcome, and a
first patch can sit unreviewed for weeks; that is the length of the queue, not a judgment on the
patch or on you. Give it a week or two. Then ping once, politely: one courteous reply in your own
thread, asking whether anything is needed from your side. Not a new submission, not a private
message to the maintainer. Then wait again. Queues are long everywhere.

When review comes, it comes as comments, and M6 told you the register: specific, plain, sometimes blunt. "This
sentence contradicts the section above it." "Wrap this at 80 columns like the rest of the file."
A reviewer may file a **request for changes**, which means: not as it stands, and here is what
must be different. This is the normal middle of the process, not a rejection. Most patches, from
everyone, go around this loop at least once.

The rule for the loop is simple: respond to every comment. Fix what is right, and push the fix.
Where you think the reviewer is wrong, say why, in the thread, with your reasoning. What you do
not do is go silent, and what you do not do is take it personally, because it is not personal in
either direction. The tone that reads harsh on your first patch is the same tone the project's
twenty-year veterans get on theirs. M6 lesson 05 said the culture is exacting, blunt about the
work, and blind to everything else, including your past. Now you are standing in it, and you can
check that claim against experience: no comment in that thread is about you. Every one is about
the patch, and every one you resolve makes the patch better than what you sent.

## The merge

Then a maintainer accepts it, and the thing M6 promised becomes yours specifically. Your commit
joins the project's history with your name and the date on it, public and permanent, verifiable
by anyone at the source. The record did not ask where you have been, and it never will. You are
now a **contributor**: a person with merged work in the project, which is the only definition the
word has. It is checkable by an employer, and it grows one accepted change at a time, starting
now.

## The ladder from here

The second patch is easier than the first, and there is a natural order to what comes after. More
docs fixes while you learn the project's habits. Then a small bug from the issue tracker:
reproduce it, fix it, write the test that proves the fix. Then, for the ambitious, there is a
kernel path, and you are better prepared for it than you may think: this course had you walk
buses, drive a panel over SPI, and reason about drivers against a simulator. kernelnewbies.org,
from lesson 01, documents the road from where you are standing to a driver patch in the Linux
kernel. Take the rungs in order, and keep each patch small enough to review.

## Key terms

- **CI** — continuous integration: a project's scripted checks, run automatically against every proposed change.
- **request for changes** — a reviewer's verdict that a patch needs specific revisions before it can merge.
- **contributor** — a person with merged work in a project; the word has no other requirement.
