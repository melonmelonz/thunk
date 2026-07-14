# thunk public course site — SPA tech research

**Status:** researched 2026-07-14 against live docs (svelte.dev, developers.cloudflare.com, caniuse, npm).
Scope: the NEW public course site only. The offline static bundle (`thunk web --out site`) is untouched;
the facility rule set in INFRA.md still governs the core workspace.

---

## Recommended architecture (decisive)

- **SvelteKit 2 (~2.63) + Svelte 5 runes + Vite 7 + `@sveltejs/adapter-static`**, fully prerendered
  (`export const prerender = true` in the root layout; no fallback page needed — all ~40 routes are
  known at build time). SvelteKit's client router gives SPA navigation over prerendered pages for
  free. Do not adopt Kit 3 (`3.0.0-next.*`, requires Vite 8/Rolldown) yet.
- **Content pipeline:** add `thunk export --json` to thunk-cli. It walks `Curriculum::all()` +
  checks + placement and emits one `content.json`, with lesson bodies pre-rendered to HTML by the
  existing constrained-dialect renderer in `thunk-web/src/markdown.rs`. The site imports
  `content.json` statically. **mdsvex rejected** — it would re-parse markdown outside the validated
  dialect and split the source of truth.
- **Live bench:** new thin `thunk-wasm` crate (wasm-bindgen) wrapping thunk-sim, living at
  `site/wasm/`, **excluded from the cargo workspace** (`exclude` in root Cargo.toml, own lockfile) so
  zero deps leak into the inside build. Build with `wasm-pack build --target bundler` +
  `vite-plugin-wasm`. thunk-sim verified WASM-clean: zero dependencies, no `std::{fs,io,time,thread}`.
- **Panel rendering:** RGB565→RGBA8888 conversion in Rust (bit-replication) into a fixed buffer;
  JS holds one reused `ImageData` + rAF loop + `putImageData`. 240×320 is trivial at 60fps. CSS
  `image-rendering: pixelated` for upscale; CSS scanline overlay for the CRT feel, optional
  single-pass WebGL shader later. Trace events cross the boundary as a flat `Uint16Array`
  (tag+payload packing), not serde-wasm-bindgen.
- **Repo/deploy:** `site/` directory in the thunk repo (content coupling wins over a second repo);
  new CI job (rust + wasm32 target + node); **second CF Pages project** deployed via direct
  `wrangler pages deploy` — never touch the facility bundle's pipeline.
- **Now:** View Transitions (`onNavigate`), Popover API, self-hosted fontsource fonts.
  **Progressive enhancement only:** scroll-driven animations, anchor positioning.
  **Defer:** presence DO, Web Audio, WebGL shader.

---

## 1. SvelteKit 2 + Svelte 5 on CF Pages

**Versions (July 2026):** `@sveltejs/kit` ~2.63.x (2.62 added config-in-vite.config; 2.63 previews
explicit env vars), Svelte 5.x stable, Vite 7 fully supported (`peerDeps: vite ^5||^6||^7||^8`),
`@sveltejs/adapter-static` v3, `@sveltejs/adapter-cloudflare` v7 stable (v8-next in progress;
`adapter-cloudflare-workers` is deprecated). SvelteKit 3 is `3.0.0-next.6` on the `next` tag and
requires Vite 8 (Rolldown) — not for this project yet.

**Adapter: `adapter-static`, not `adapter-cloudflare`.** The site has no server-side logic: content
is baked at build, the sim runs client-side in WASM. adapter-cloudflare would deploy a Worker
runtime we never call, complicate local dev, and make hermeticity harder to reason about. If a DO
presence toy ever ships, it goes in a sibling Worker (Penn's established Pages+DO pattern), not in
the site's adapter.

**Prerender + SPA nav:** with all routes prerenderable, set in `src/routes/+layout.js`:
`export const prerender = true;` and no `fallback` option (adapter-static's `strict: true` default
then proves every route was emitted). After hydration, SvelteKit intercepts link clicks and does
client-side navigation between prerendered pages — SPA feel with real HTML for every lesson URL
(SEO + no-JS reading both work). Use `data-sveltekit-preload-data="hover"` on the nav for
instant-feeling lesson switches. On Pages, set build output dir to `build`.

**View transitions (current documented pattern, in the Kit FAQ):**

```js
import { onNavigate } from '$app/navigation';

onNavigate((navigation) => {
  if (!document.startViewTransition) return;
  return new Promise((resolve) => {
    document.startViewTransition(async () => {
      resolve();
      await navigation.complete;
    });
  });
});
```

Same-document view transitions are Baseline in 2026 (Chrome 111+, Safari 18+, Firefox 144+). The
guard makes it pure progressive enhancement. Note Firefox is Level-1 only: no
`:active-view-transition-type()` — key transitions off route, not off types.

**Shallow routing:** `pushState`/`replaceState` from `$app/navigation` + `page.state` from
`$app/state`. The right tool for the bench's trace-inspector overlay or a check-detail panel:
opening a trace byte gets a history entry (back button closes it) without a navigation. Pair with
`preloadData` when the overlay renders another route's page component.

## 2. Rust → WASM for the live bench

**thunk-sim verified:** `[dependencies]` is literally empty; no std IO/time/threads anywhere in
`src/`. `Panel` is `Vec<u16>` RGB565; `TraceEvent` is `{SelectLow, SelectHigh, Byte{value: u8, dc: Dc}}`;
`finale::frame(w, h, t) -> Vec<u16>` is already a pure frame generator. No blockers of any kind.

**Toolchain (2026 consensus):** `wasm-pack build --target bundler` (the default) +
[`vite-plugin-wasm`](https://github.com/Menci/vite-plugin-wasm) (supports Vite 2–8) +
`vite-plugin-top-level-await` (or `build.target: 'esnext'`, which is fine for this audience).
`--target web` with a manual `init(new URL(...))` still works but is the legacy path; Vite cannot
consume the bundler target without the plugin, and wasm-pack drives `wasm-opt` for us.
Add the generated `pkg` to `optimizeDeps.exclude` if dev pre-bundling misbehaves.

**Bundle size:** a crate this size (no serde, no allocator-heavy deps, `opt-level = "z"`, LTO,
wasm-opt -Oz) lands around 30–80 KB of .wasm, roughly 15–40 KB over the wire. Budget 100 KB
worst case; it will come in under. Lazy-load the bench module per-route so lesson pages never pay
for it.

**Framebuffer → canvas at 60fps:** for 240×320 (76,800 px, 300 KB RGBA), plain `putImageData` is
comfortably within budget — emulators blit larger buffers this way. Pattern:

1. Rust: `thunk-wasm` owns a fixed `[u8; W*H*4]` RGBA buffer; each tick converts RGB565 with
   bit-replication (`r = (r<<3)|(r>>2)` etc., alpha 0xFF). Do the conversion in Rust, not JS — it's
   one tight loop over wasm memory. (A 64K LUT is available if profiling ever demands it; it won't.)
2. Expose `frame_ptr()`/`frame_len()`; JS builds `new Uint8ClampedArray(memory.buffer, ptr, len)`
   and one reused `ImageData`. Rebuild the view if `memory.buffer` detaches after growth (allocate
   everything up front and it never grows).
3. rAF loop in JS (never loop inside wasm), `ctx.putImageData(imageData, 0, 0)` per frame.
4. Canvas at native 240×320; scale with CSS + `image-rendering: pixelated`.

OffscreenCanvas/workers: unnecessary at this size; skip unless the bench ever runs long synchronous
sim batches. WebGL `texSubImage2D` is the escape hatch if a real CRT shader ships (below).

**Trace stream across the boundary:** flat typed arrays, not serde-wasm-bindgen. TraceEvent packs
into one `u16`: tag in bits 9..8 (0=SelectLow, 1=SelectHigh, 2=Byte), dc in bit 8 for bytes, value
in bits 7..0 — return `Vec<u16>` (wasm-bindgen hands JS a copied `Uint16Array`), decode with a
10-line JS function. serde-wasm-bindgen would add a serde dependency to thunk-wasm and per-event
object allocation for zero benefit on a 3-variant enum. Keep the annotation logic (labels,
transaction grouping) in Rust and export it as indices into the packed array.

## 3. Content pipeline

**Recommendation: `thunk export --json`** (new subcommand in thunk-cli; adds `serde_json` — one
ubiquitous, auditable dep in a crate that already carries clap/anyhow). Emits a single
`content.json`: modules → lessons (id, title, body pre-rendered to HTML) → checks (id, prompt,
kind) + ladder + placement. Reuse `thunk_web::markdown::render` for bodies — the dialect is pinned
by thunk-content's validation suite, so the public site can never drift from the facility site.
CI/build step: `cargo run -p thunk-cli -- export --json > site/src/lib/content.json`, checked-in or
generated in CI (recommend generated + a freshness assertion, so it cannot go stale).

SvelteKit side: `import content from '$lib/content.json'` in `+page.js` load functions with
`entries` generated from module/lesson ids for the dynamic routes; everything prerenders. ~40 pages
from one JSON file — no mdsvex, no duplicate markdown parser, no second content pipeline to review.

## 4. Honest assessment of the shiny things

| Tech | Verdict | Why |
|---|---|---|
| View Transitions | **Yes** | Baseline same-doc; 10 lines in root layout; degrades to nothing. |
| Popover API | **Yes** | Baseline since Jan 2025 (Safari 18.3 fixed light-dismiss). Perfect for key-term/glossary popovers on lesson pages. Avoid `popover="hint"` (Chrome-only). |
| Shallow routing | **Yes** | Trace inspector / check panels with back-button semantics. |
| CSS anchor positioning | **Enhance only** | Cross-browser only since Firefox 147 (Jan 2026), ~76% global. Use for popover placement inside `@supports (anchor-name: --a)` with a static-position fallback. |
| Scroll-driven animations | **Enhance only** | Firefox still behind a flag; not Baseline. Fine for a module-progress rail that simply doesn't animate elsewhere (`animation-timeline` is ignored gracefully). No JS fallback — if it's load-bearing, don't use it. |
| CRT shader (WebGL) | **Later, maybe** | Honest first pass: CSS scanline overlay + subtle vignette on the pixelated canvas — zero cost, no second render path. If the bench becomes the marketing centerpiece: single-pass fragment shader (scanlines + phosphor triads + barrel distortion) on a fullscreen quad, framebuffer uploaded via `texSubImage2D` into an RGBA8 texture, context `{alpha: false}`. Keep upload <1ms (trivial at 240×320). Do not import a shader library for this. |
| Presence DO ("N studying now") | **Defer** | Feasible and nearly free: SQLite-backed DOs are on Workers Free (100k req/day, WebSocket hibernation avoids duration burn; `getWebSockets().length` is the whole counter). But INFRA.md draws a hard line — the hosted platform owns accounts/cohorts later, and a justice-impacted audience deserves zero ambient tracking, even anonymous. A counter nobody asked for is the definition of unearned cleverness here. Revisit for the after-release platform. |
| Web Audio | **No** | UI blips fight the tone of the product. The bench is silent hardware; silence is correct. |
| WebSockets/cohorts | **No (now)** | Platform-repo territory per INFRA.md rule 1. |

## 5. Fonts

Self-host via **fontsource** (`@fontsource-variable/*` npm packages): subsets pre-built, Vite
hashes/bundles the woff2, no third-party requests (cache partitioning killed the Google Fonts CDN
argument years ago). Preload only the body-text face using the documented Vite pattern:
`import woff2Url from '@fontsource-variable/x/files/x-latin-wght-normal.woff2?url'` → emit
`<link rel="preload" as="font" type="font/woff2" crossorigin href={woff2Url}>` in `app.html`/head.
`font-display: swap` + a `size-adjust` metric-matched local fallback for CLS discipline. Budget:
≤2 files, <100 KB total. glyphhanger/hb-subset only if a non-fontsource display face gets picked —
then the subsetting command lives in package.json, output treated as a build artifact.

## 6. Repo, CI, deploy shape

**In-repo `site/` directory, not a separate repo.** The content pipeline is the argument: the site
consumes `thunk export --json` output and must track curriculum changes atomically. INFRA.md's
separate-repo rule targets the *accounts platform* (stateful, networked); this site is a static
render of the same course and belongs beside it. Document that boundary in INFRA.md when building.

**Workspace hygiene:** root `Cargo.toml` gains `exclude = ["site/wasm"]`. `site/wasm/thunk-wasm`
is a standalone crate (own `Cargo.lock`) with `thunk-sim = { path = "../../thunk-sim" }` +
`wasm-bindgen`. Result: `cargo build/test/clippy --workspace` never sees wasm-bindgen; the inside
build's dependency tree and lockfile are byte-identical to today. No feature flag on thunk-sim at
all — it needs none.

**CI:** one new job (`site`), parallel to the existing three: pinned toolchain +
`rustup target add wasm32-unknown-unknown` + wasm-pack, Node 22, `cargo run -p thunk-cli -- export
--json`, wasm-pack build, `npm ci && npm run build` in `site/`, optionally `wrangler pages deploy`
on main. Existing check/static-musl/web jobs untouched.

**CF Pages: second project** (e.g. `thunk-course`), direct-upload via `wrangler pages deploy
site/build` (Penn's standard — Git Provider off; ASCII commit messages; nothing from `target/` in
the upload tree). Do not repoint any existing 'thunk' Pages project that serves or mirrors the
facility bundle — the two worlds must never blur. Note: Cloudflare's 2026 direction for new
projects is Workers static assets (Pages is de-emphasized but fully supported, no sunset date);
Pages still matches every tool and habit in this shop, so Pages it is — migration to a Worker is a
config-level move if ever needed.

---

## Risks

1. **Kit 3 / Vite 8 (Rolldown) transition is imminent** — pin Kit 2.63.x/Vite 7; upgrade
   deliberately, not via `^` drift. vite-plugin-wasm already claims Vite 8 support.
2. **content.json staleness** — if checked in rather than CI-generated, it will drift; make CI
   regenerate and diff-fail.
3. **wasm memory-growth detaching typed-array views** — allocate the frame buffer up front;
   rebuild views defensively.
4. **Scope creep from the shiny list** — the deferred column (DO presence, WebGL shader, audio) is
   deferred on purpose; each one added later must re-justify itself against the facility-trust tone.
5. **INFRA.md boundary** — putting `site/` in-repo bends the letter of rule 1; the workspace
   `exclude` keeps its spirit (zero deps into the core build). Update INFRA.md explicitly so a
   reviewer doesn't read it as a violation.

Sources: svelte.dev/docs/kit (adapter-static, single-page-apps, shallow-routing, FAQ view
transitions), sveltejs/kit releases, developers.cloudflare.com (durable-objects pricing/limits,
websocket hibernation, pages-to-workers migration), caniuse (view-transitions, css-anchor-
positioning, popover), MDN (scroll-driven animations, optimizing canvas, ImageData), Menci/
vite-plugin-wasm, fontsource.org/docs/getting-started/preload, web.dev popover-baseline.
