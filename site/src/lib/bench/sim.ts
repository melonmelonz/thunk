// Lazy loader + typed facade over the thunk-wasm bench (site/wasm/pkg, built by
// `npm run wasm` in prebuild). The wasm is dynamically imported so only the
// /bench route pays for it. Everything the page needs crosses as flat data:
// the frame is a zero-copy view over wasm memory, the trace is parallel arrays
// + one newline-joined string.

// Row-kind codes, mirrored from the Rust side (see thunk-wasm KIND_*).
export const KIND = { CMD: 0, DATA: 1, SELECT: 2 } as const;

export interface Row {
	/** 0 command, 1 data run, 2 select edge. */
	kind: number;
	/** The row's first byte, or -1 for a select edge. */
	byte: number;
	/** The annotated row text (one logic-analyzer line). */
	text: string;
}

export interface Sim {
	readonly width: number;
	readonly height: number;
	readonly frame: number;
	readonly bootEvents: number;
	readonly fps: number;
	/** Power on: boot the finale, paint frame zero, return the boot trace rows. */
	boot(): Row[];
	/** One animation step: draw the next frame, return that tick's trace rows. */
	tick(): Row[];
	/** Power on for DOOM: init + paint the black letterbox once, return boot rows. */
	bootDoom(): Row[];
	/**
	 * Blit one external RGBA8888 frame (320x200, from the DOOM module) through
	 * the real Display/SpiBus path into the letterboxed 240x150 center window.
	 * Advances the frame counter; returns the tick's trace rows.
	 */
	blitExternalFrame(rgba: Uint8Array, w: number, h: number): Row[];
	/** Blit the current frame to a 2D context (zero-copy view over wasm memory). */
	paint(ctx: CanvasRenderingContext2D): void;
	/** The three-line M3 waveform diagram for a byte. */
	waveform(byte: number): string[];
}

// The generated bindings are typed loosely here; the real types live in the
// pkg .d.ts, which relative imports pick up at build time.
interface WasmTraceRows {
	kinds: Uint8Array;
	bytes: Int16Array;
	text: string;
	len: number;
	is_empty: boolean;
	free(): void;
}
interface WasmBench {
	boot(): WasmTraceRows;
	tick(): WasmTraceRows;
	boot_doom(): WasmTraceRows;
	blit_external_frame(rgba: Uint8Array, w: number, h: number): WasmTraceRows;
	waveform(byte: number): string;
	frame_ptr(): number;
	frame_len(): number;
	readonly width: number;
	readonly height: number;
	readonly frame: number;
	readonly boot_events: number;
}

function toRows(tr: WasmTraceRows): Row[] {
	const rows: Row[] = [];
	if (!tr.is_empty) {
		const kinds = tr.kinds;
		const bytes = tr.bytes;
		const lines = tr.text.split('\n');
		for (let i = 0; i < lines.length; i++) {
			rows.push({ kind: kinds[i], byte: bytes[i], text: lines[i] });
		}
	}
	tr.free();
	return rows;
}

/**
 * Dynamically import the wasm and construct a bench. The `.wasm` is imported a
 * second time only to reach its exported `memory`; ESM caches modules by URL,
 * so this is the same instance the bindings drive - not a second linear memory.
 */
export async function loadSim(w = 240, h = 320): Promise<Sim> {
	const [bindings, wasmMod] = await Promise.all([
		import('../../../wasm/pkg/thunk_wasm.js'),
		import('../../../wasm/pkg/thunk_wasm_bg.wasm')
	]);
	const memory = (wasmMod as unknown as { memory: WebAssembly.Memory }).memory;
	const bench = new (bindings as unknown as { Bench: new (w: number, h: number) => WasmBench }).Bench(
		w,
		h
	);

	let lastMs = 0;

	return {
		get width() {
			return bench.width;
		},
		get height() {
			return bench.height;
		},
		get frame() {
			return bench.frame;
		},
		get bootEvents() {
			return bench.boot_events;
		},
		get fps() {
			return lastMs > 0 ? 1000 / lastMs : 0;
		},
		boot() {
			const t0 = performance.now();
			const rows = toRows(bench.boot());
			lastMs = performance.now() - t0;
			return rows;
		},
		tick() {
			const t0 = performance.now();
			const rows = toRows(bench.tick());
			lastMs = performance.now() - t0;
			return rows;
		},
		bootDoom() {
			const t0 = performance.now();
			const rows = toRows(bench.boot_doom());
			lastMs = performance.now() - t0;
			return rows;
		},
		blitExternalFrame(rgba: Uint8Array, w: number, h: number) {
			const t0 = performance.now();
			const rows = toRows(bench.blit_external_frame(rgba, w, h));
			lastMs = performance.now() - t0;
			return rows;
		},
		paint(ctx: CanvasRenderingContext2D) {
			// Rebuild the view every frame: any wasm memory growth detaches the
			// old ArrayBuffer, and constructing the view + ImageData is cheap
			// (no pixel copy - ImageData wraps the wasm-memory-backed array).
			const view = new Uint8ClampedArray(memory.buffer, bench.frame_ptr(), bench.frame_len());
			const img = new ImageData(view, bench.width, bench.height);
			ctx.putImageData(img, 0, 0);
		},
		waveform(byte: number) {
			return bench.waveform(byte).split('\n');
		}
	};
}
