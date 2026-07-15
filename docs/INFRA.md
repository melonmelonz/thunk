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
| Status | Built (M-A..M-F done; M-G/M-H in flight) | Future; own sub-spec before any code |

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

Three jobs, all required:

- **check** — `cargo fmt --check`, `clippy -D warnings`, `cargo test --workspace`, `vocab-lint`.
  Exactly the four gates a contributor runs locally; CI must never be the only place a rule lives.
- **static-musl** — builds `thunk-cli` for `x86_64-unknown-linux-musl` in release and verifies the
  binary is statically linked. This is the facility deliverable; it must never quietly regress into
  a dynamic build.
- **web** — generates the static site (`thunk web --out site`) and asserts the output is hermetic:
  `! grep -rE "https?://" site/`. M-F shipped plain Rust-generated semantic HTML rather than a wasm
  bundle (the UI/UX research overturned the ratzilla/Trunk idea on accessibility grounds), so this
  job replaces the wasm job earlier drafts of this document promised.

### Releases

Tag `vX.Y.Z`, GitHub release carries: the static musl `thunk` binary, `SHA256SUMS`, and (post M-F)
the offline web bundle as a zip. A facility reviewer should be able to download one file, check one
hash, and run it. Release automation (a `release.yml` building on tag) is worth adding at the first
real release, not before.

## 3. Cloudflare

Cloudflare serves the *public, online* half. Two stages:

### Stage 1 — static sites (with M-F, no accounts)

There are now **two** Cloudflare Pages projects, both static assets only, no Workers/KV/D1, no
analytics. The public face moved to the course SPA at cutover (2026-07-15); the offline-bundle demo
stays put as the facility artifact.

**Project `thunk`** — the offline web bundle, unchanged.

- Live at `https://thunk-2dc.pages.dev`. Production branch `main`, build output = the M-F web
  bundle directory. The bundle is self-contained; Pages just serves it. Not deleted or redeployed
  at cutover; it keeps demonstrating the facility artifact exactly as a reviewer would receive it.

**Project `thunk-course`** — the course SPA (the public identity).

- Live at `https://thunk-course.pages.dev`; the repo homepage and README point here. SvelteKit SPA
  (`@sveltejs/adapter-static`, fully prerendered) plus the thunk-sim bench compiled to WebAssembly.
- Production branch `main`, direct `wrangler pages deploy` from `site/build`. CI has a `site` job
  that builds node + wasm and runs the content-freshness check.
- Headers: `site/static/_headers` carries the CSP (created 2026-07-15; it was absent, so this is the
  one site/ file this cutover touches). `default-src 'self'` with no external origins, plus
  `'wasm-unsafe-eval'` in `script-src` for the bench module and `'unsafe-inline'` retained for the
  SvelteKit hydration bootstrap and injected styles (adapter-static prerenders without CSP hashing).
  Also `nosniff`, `no-referrer`, `X-Frame-Options: DENY`. It ships with the **next** site deploy;
  confirm the live SPA still loads (bench included) after that deploy before tightening the CSP.

The offline bundle does not currently emit its own `_headers`; when it inherits the SPA design
language its generator should emit the same strict CSP (there the offline constraint makes a
no-exceptions `default-src 'self'` free, with no `wasm-unsafe-eval` or `unsafe-inline` needed).

Deploy stays manual (`wrangler pages deploy`) until the site matters enough to automate; then a
deploy workflow keyed to release tags, with the Cloudflare API token stored as a GitHub Actions
secret scoped to Pages only.

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
