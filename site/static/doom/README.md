# /doom assets

The DOOM finale on the bench. Nothing here loads until the bench source switch
is flipped to DOOM; then the module and the WAD are fetched lazily and DOOM
plays on the simulated ILI9341 panel, its frames streamed through the real
thunk-sim Display/SpiBus pipeline (the bus trace under the panel stays live).

| file | what it is | license |
|------|-----------|---------|
| `doom.js` | headless doomgeneric wasm module (ES6 factory `createDoom`), built by `site/wasm-doom/build.sh`. No WAD embedded. | GPL-2.0 |
| `doom.wasm` | the engine, loaded by `doom.js` (`new URL("doom.wasm", import.meta.url)`). | GPL-2.0 |
| `freedoom1.wad.gz` | Freedoom Phase 1 IWAD v0.13.0, gzipped. The raw IWAD (27.5MB) exceeds Cloudflare Pages' 25MiB per-file cap, so it ships compressed (~9.8MB); the page fetches it, inflates it with `DecompressionStream`, and `FS.writeFile`s it into MEMFS before `dg_init()`. | BSD-3-Clause (see `COPYING.txt`) |
| `COPYING.txt` | Freedoom's license and attribution notice. | BSD-3-Clause |
| `doomgeneric-src.tar.gz` | the complete corresponding source for `doom.js`/`doom.wasm`: the doomgeneric fork including the headless port `doomgeneric_wasm.c`, its `LICENSE`, and `build.sh`. No build artifacts, no WAD. | GPL-2.0 |

## Why the source tarball is here

`doom.js`/`doom.wasm` are a distributed GPL-2.0 binary, so we offer the exact
corresponding source next to it. The tarball is that offer; it mirrors
`site/wasm-doom/`, which is the buildable fork in this repo. thunk's own crates
(Apache-2.0 OR MIT) and the rest of the site are a separate program that
communicates with the DOOM module over a pixel-buffer data boundary, not linked
into one binary, so the GPL obligation attaches only to the DOOM module and this
source, not to thunk-sim or the site.

## Rebuilding

`doom.js`/`doom.wasm` are committed so CI never needs emscripten. To regenerate
after changing the C port, install emscripten and run `site/wasm-doom/build.sh`
(read its header first: there is a shallow-cwd first-build gotcha). Then rebuild
the source tarball:

```sh
cd site
tar --exclude='.git' --transform 's,^wasm-doom,doomgeneric-src,' \
  -czf static/doom/doomgeneric-src.tar.gz wasm-doom
```
