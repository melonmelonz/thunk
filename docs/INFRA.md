# thunk — Infrastructure

**Status:** defined 2026-07-12. The repo is local-only; nothing here is live until Penn pushes.
This document is the checklist for taking it public and the architecture for everything that runs
outside the offline core.

---

## 1. The two worlds

thunk has exactly two deployment worlds, and they must never blur:

| | Offline core | Hosted after-release platform |
|---|---|---|
| What | The course: one static Rust binary + static web bundle | Website for released learners: accounts, cohorts, progress |
| Network | None. No sockets at runtime | Yes; its whole point |
| Where it runs | Facility machines, any laptop | Cloudflare |
| Status | Built (M-A done; M-B..M-H in flight) | Future; own sub-spec before any code |

Rule: no code, dependency, or config for the hosted platform ever enters the core workspace. The
platform gets its own repository when its spec lands.

## 2. GitHub

Intended remote: `github.com/melonmelonz/thunk` (matches `Cargo.toml` `repository`). Public from
day one; the code being auditable is part of the pitch. **Nobody pushes except Penn, and never to
an upstream he does not own.**

Checklist at first push (all in repo Settings unless noted):

1. Default branch `main` (rename local `master` at push time: `git push -u origin master:main`).
2. Branch protection on `main`: require the `ci` workflow checks (`fmt + clippy + test +
   vocab-lint`, `static musl build`) to pass; require linear history; no force pushes. Solo-dev
   note: require-PR-review stays off until there is a second maintainer.
3. Actions: default permissions read-only (the workflow also states `permissions: contents: read`).
4. Dependabot alerts + security updates on (`.github/dependabot.yml` is already in the repo).
5. Secret scanning + push protection on. The repo holds no secrets and never should.
6. Issues on. Discussions off until there is a community to host.
7. About: the value-prop line and `docs/README.md` link.

### CI (`.github/workflows/ci.yml`, in repo)

Two jobs, both required:

- **check** — `cargo fmt --check`, `clippy -D warnings`, `cargo test --workspace`, `vocab-lint`.
  Exactly the four gates a contributor runs locally; CI must never be the only place a rule lives.
- **static-musl** — builds `thunk-cli` for `x86_64-unknown-linux-musl` in release and verifies the
  binary is statically linked. This is the facility deliverable; it must never quietly regress into
  a dynamic build.

The wasm bundle job is added when M-F lands (build the web crate, assert zero external URLs in the
output). Placeholder intentionally not committed; a skipped job is noise.

### Releases

Tag `vX.Y.Z`, GitHub release carries: the static musl `thunk` binary, `SHA256SUMS`, and (post M-F)
the offline web bundle as a zip. A facility reviewer should be able to download one file, check one
hash, and run it. Release automation (a `release.yml` building on tag) is worth adding at the first
real release, not before.

## 3. Cloudflare

Cloudflare serves the *public, online* half. Two stages:

### Stage 1 — static site (with M-F, no accounts)

The offline web bundle doubles as the public demo site. **Cloudflare Pages**, static assets only:

- Project `thunk`, production branch `main`, build output = the M-F web bundle directory.
- No Workers code, no KV/D1, no analytics scripts. The bundle is already self-contained; Pages just
  serves it.
- Custom domain when Penn picks one; Cloudflare-managed TLS; HSTS on.
- Headers (`_headers` file ships with the bundle): a strict `Content-Security-Policy` with no
  external origins (`default-src 'self'`), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`. The offline constraint makes a no-exceptions CSP free; take it.

Deploy stays manual (`wrangler pages deploy` from a tagged checkout) until the site matters enough
to automate; then a deploy workflow keyed to release tags, with the Cloudflare API token stored as
a GitHub Actions secret scoped to Pages only.

### Stage 2 — the after-release platform (own sub-spec first)

Accounts, cohort progress, mentor review queues. Architecture direction, to be pinned by its spec:

- **Workers** for the application, **D1** for relational state, **Turnstile** on auth endpoints,
  **Cloudflare Access** in front of any facilitator/admin surface, WAF managed rules on.
- Identity: passkeys-first (the audience may not keep a phone number or email long-term; the spec
  must treat account recovery as a first-class problem, not an afterthought).
- Data minimalism as policy: the platform never stores criminal-history data, period. Progress and
  portfolio only. Privacy here is a safety property for the users.
- Separate repo, separate CI, its own security review before launch.

## 4. Secrets and access

- The core repo: zero secrets, enforced by GitHub push protection. CI needs no credentials.
- Cloudflare tokens (stage 1+): least-privilege API tokens, stored only in GitHub Actions secrets,
  rotated when anyone with access leaves.
- Penn's accounts (GitHub, Cloudflare, domain registrar): hardware-key 2FA. These three accounts
  *are* the project's supply chain.

## 5. What "solid" means here, ongoing

- Every gate lives in a script a human can run (`cargo …`, `./scripts/vocab-lint.sh`); CI only
  repeats them.
- Toolchain pinned (`rust-toolchain.toml`); dependencies patched weekly by Dependabot in one
  grouped PR; lockfile committed.
- Any new workflow gets `permissions:` stated explicitly and a `timeout-minutes`.
- The static-linked check is the canary: if it fails, the facility story is broken, fix before
  anything else.
