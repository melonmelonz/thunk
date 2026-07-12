# Security

thunk is built to run on locked-down, air-gapped machines. Its security posture is part of the
product:

- No network code at runtime. No sockets, no telemetry, no auto-fetched resources.
- No cryptography anywhere in the dependency tree or source.
- Course-appropriate engineering language throughout content and source, enforced in CI by
  `scripts/vocab-lint.sh` (a denylist a facility reviewer can read in ten seconds).
- All course assets are embedded at compile time; the binary is a single static artifact.
- Learner state is local only. No accounts, no tracking.

## Reporting a vulnerability

If you find a security problem, email **lushfund@protonmail.ch** with a description and steps to
reproduce. Do not open a public issue for anything you believe is sensitive; everything else is
welcome on the issue tracker. You will get a reply within a week.

## Scope notes for reviewers

The inside (facility) build profile must compile with no hardware or network code present at all,
not merely disabled. Anything that violates that is a bug of the highest severity here, even if it
would be routine in another project.
