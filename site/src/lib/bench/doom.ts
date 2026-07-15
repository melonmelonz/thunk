// Lazy loader + typed facade over the DOOM module (doomgeneric wasm, served
// from /doom/). Nothing here is imported until the bench source switch flips to
// DOOM: the module factory, the ~9.8MB-gzipped WAD, and this file are all off
// the initial graph. The module is a SEPARATE wasm instance with its own linear
// memory; it emits 320x200 RGBA frames that the page hands to thunk-wasm's
// blit_external_frame, which downscales, packs RGB565, and drives them through
// the real Display/SpiBus pipeline onto the panel.
//
// The pure parts (source-switch state machine, WAD progress formatter, keymap)
// live here as plain functions, unit-tested in doom.test.ts.

// ---- Browser -> DOOM keymap (see doomkeys.h) --------------------------------
// Arrows and WASD move/turn; Ctrl fires, Space uses, Enter confirms, y answers
// menus. Esc is NOT forwarded: on the bench it releases keyboard capture.
const DOOM_KEY = {
	left: 0xac,
	right: 0xae,
	up: 0xad,
	down: 0xaf,
	fire: 0xa3, // Ctrl
	use: 0xa2, // Space
	enter: 13
} as const;

/** Translate a KeyboardEvent to a DOOM key code, or 0 if it maps to nothing. */
export function toDoomKey(e: { key: string; code: string }): number {
	switch (e.key) {
		case 'ArrowLeft':
			return DOOM_KEY.left;
		case 'ArrowRight':
			return DOOM_KEY.right;
		case 'ArrowUp':
			return DOOM_KEY.up;
		case 'ArrowDown':
			return DOOM_KEY.down;
		case 'Enter':
			return DOOM_KEY.enter;
	}
	if (e.code === 'Space') return DOOM_KEY.use;
	if (e.code === 'ControlLeft' || e.code === 'ControlRight') return DOOM_KEY.fire;
	switch (e.key.toLowerCase()) {
		case 'w':
			return DOOM_KEY.up;
		case 'a':
			return DOOM_KEY.left;
		case 's':
			return DOOM_KEY.down;
		case 'd':
			return DOOM_KEY.right;
	}
	// A single printable char (e.g. `y` for menu answers / cheats) passes through.
	if (e.key.length === 1) return e.key.toLowerCase().charCodeAt(0);
	return 0;
}

// ---- WAD progress formatter -------------------------------------------------
const MIB = 1024 * 1024;
const mib = (n: number) => (n / MIB).toFixed(1);

/**
 * The quiet loading line: `FETCHING WAD - 4.2 / 27.5 MB`. When the total is
 * unknown, or a transparently-gzipped transfer makes the decompressed bytes
 * read exceed the declared content-length, fall back to just the bytes read so
 * the line never shows a nonsensical over-100% figure.
 */
export function formatWadProgress(loaded: number, total: number): string {
	if (total > 0 && total >= loaded) {
		return `FETCHING WAD - ${mib(loaded)} / ${mib(total)} MB`;
	}
	return `FETCHING WAD - ${mib(loaded)} MB`;
}

// ---- Source-switch state machine (pure) -------------------------------------
export type Source = 'finale' | 'doom';
export type DoomPhase = 'unloaded' | 'loading' | 'ready';

export interface SwitchState {
	source: Source;
	doom: DoomPhase;
	running: boolean;
}

export type SwitchAction =
	| { type: 'select'; source: Source }
	| { type: 'doom-loading' }
	| { type: 'doom-ready' }
	| { type: 'run' }
	| { type: 'pause' };

export function initialSwitchState(): SwitchState {
	return { source: 'finale', doom: 'unloaded', running: false };
}

/**
 * The one rule that matters: switching sources always pauses first (never leave
 * a loop running across a source change). Loading is one-way: unloaded ->
 * loading -> ready, and never regresses once the module is up.
 */
export function reduceSwitch(s: SwitchState, a: SwitchAction): SwitchState {
	switch (a.type) {
		case 'select':
			if (a.source === s.source) return s;
			return { ...s, source: a.source, running: false };
		case 'doom-loading':
			return s.doom === 'ready' ? s : { ...s, doom: 'loading' };
		case 'doom-ready':
			return { ...s, doom: 'ready' };
		case 'run':
			return { ...s, running: true };
		case 'pause':
			return { ...s, running: false };
	}
}

/** DOOM was just selected and its module has not been fetched yet. */
export function needsDoomLoad(s: SwitchState): boolean {
	return s.source === 'doom' && s.doom === 'unloaded';
}

// ---- The module facade ------------------------------------------------------
export interface Doom {
	/** Native frame size: 320x200. */
	readonly width: number;
	readonly height: number;
	/** Advance one DOOM iteration and return the fresh 320x200 RGBA view. */
	tick(): Uint8Array;
	keyDown(doomKey: number): void;
	keyUp(doomKey: number): void;
}

// Loosely-typed emscripten Module surface (the real types live in doom.js).
interface DoomModule {
	ccall(name: string, ret: string | null, argTypes: string[], args: unknown[]): number | void;
	HEAPU8: Uint8Array;
	FS: { writeFile(path: string, data: Uint8Array): void };
}

// The WAD ships gzipped: the raw IWAD is 27.5MB, over Cloudflare Pages' 25MiB
// per-file cap, and gzip halves the transfer besides. We fetch the ~9.8MB .gz
// (progress is measured on that compressed download, so the line reads in the
// wire bytes the visitor actually waits on), then inflate it in-browser with
// DecompressionStream before handing it to MEMFS.
const WAD_URL = '/doom/freedoom1.wad.gz';
const MODULE_URL = '/doom/doom.js';

function concat(chunks: Uint8Array[], total: number): Uint8Array {
	const out = new Uint8Array(total);
	let off = 0;
	for (const c of chunks) {
		out.set(c, off);
		off += c.length;
	}
	return out;
}

async function fetchWad(
	onProgress: (loaded: number, total: number) => void
): Promise<Uint8Array> {
	const res = await fetch(WAD_URL);
	if (!res.ok || !res.body) throw new Error(`WAD fetch failed: ${res.status}`);
	const total = Number(res.headers.get('content-length')) || 0;
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let loaded = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		loaded += value.length;
		onProgress(loaded, total);
	}
	const body = concat(chunks, loaded);
	// Some static hosts (vite preview's sirv, and possibly a CDN) serve a .gz
	// with `Content-Encoding: gzip`, so the browser has already inflated the
	// body by the time we read it; others serve it as an opaque application/gzip
	// blob we must inflate ourselves. Detect from the leading bytes: a gzip
	// stream begins 0x1F 0x8B; a raw IWAD begins "IWAD"/"PWAD". Inflate only when
	// it is still gzip, so we never double-decompress.
	if (body[0] === 0x1f && body[1] === 0x8b) {
		const stream = new Blob([body as BlobPart])
			.stream()
			.pipeThrough(new DecompressionStream('gzip'));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	}
	return body;
}

/**
 * Fetch and boot DOOM: import the module factory, stream the WAD with progress,
 * write it into MEMFS, run dg_init. Resolves to a live `Doom` once the title
 * screen's first frame is renderable. The module and WAD are same-origin, so
 * they load under the site CSP (script-src 'self', connect-src 'self').
 */
export async function loadDoom(
	onProgress: (loaded: number, total: number) => void
): Promise<Doom> {
	// Absolute static path, hidden from Vite's analyzer so it is never bundled
	// (keeps the DOOM module off every route's initial graph and the perf budget).
	const factory = (await import(/* @vite-ignore */ MODULE_URL)) as {
		default: (opts?: unknown) => Promise<DoomModule>;
	};
	const Module = await factory.default();
	const wad = await fetchWad(onProgress);
	Module.FS.writeFile('freedoom1.wad', wad); // replaces the prototype's --preload-file
	Module.ccall('dg_init', null, [], []);
	const rgbaPtr = Module.ccall('dg_get_rgba', 'number', [], []) as number;
	const w = Module.ccall('dg_width', 'number', [], []) as number;
	const h = Module.ccall('dg_height', 'number', [], []) as number;
	const len = w * h * 4;
	return {
		width: w,
		height: h,
		tick() {
			Module.ccall('dg_tick', null, [], []);
			// Rebuild the view each call: ALLOW_MEMORY_GROWTH can detach the old
			// ArrayBuffer; Module.HEAPU8 is re-pointed by emscripten on growth.
			return Module.HEAPU8.subarray(rgbaPtr, rgbaPtr + len);
		},
		keyDown(k: number) {
			Module.ccall('dg_key_down', null, ['number'], [k]);
		},
		keyUp(k: number) {
			Module.ccall('dg_key_up', null, ['number'], [k]);
		}
	};
}
