<script lang="ts">
	import { onMount } from 'svelte';
	import { KIND, loadSim, type Row, type Sim } from '$lib/bench/sim';
	import { loadDoom, toDoomKey, formatWadProgress, type Doom, type Source } from '$lib/bench/doom';
	import { CheatBuffer } from '$lib/bench/cheats';
	import { parseWindow, formatWindowLine } from '$lib/bench/window';
	import { serializeTrace } from '$lib/bench/trace';
	import Meta from '$lib/components/Meta.svelte';
	import { xp } from '$lib/xp.svelte';
	import { FINALE_FRAMES } from '$lib/xp-curve';

	// The canvas repaints at 30fps: reads more like a CRT than 60, and halves the
	// per-frame convert cost. Mirrors thunk-wasm's TARGET_FPS. DOOM sims at its
	// native 35Hz on its own accumulator (below), fully decoupled from paint.
	const FPS = 30;
	// DOOM's native simulation rate. dg_tick runs at this cadence regardless of
	// the 30fps paint; a rAF may run 0, 1, or a few dg ticks to catch the clock.
	const DOOM_HZ = 35;
	// dg ticks to pump right after boot so the Freedoom title renders past init
	// (the engine runs an intro wipe before TITLEPIC lands).
	const PRIME_TICKS = 10;
	// The trace log keeps a bounded window of rows in the DOM. A full run streams
	// ~8 rows per tick forever; hold the last LOG_CAP so scrolling stays cheap.
	const LOG_CAP = 512;
	// Per-frame append throttle: never push more than this many rows in one
	// paint, so a pathological frame can't stall layout. A finale tick emits ~8
	// rows, so this is headroom, not a limiter, today.
	const MAX_ROWS_PER_FRAME = 64;

	let canvasEl: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let logEl: HTMLDivElement | undefined = $state();

	let sim: Sim | null = null;
	let loadError = $state(false);
	let ready = $state(false);

	let powered = $state(false);
	let lit = $state(false); // panel revealed (false during the boot stream)
	let running = $state(false);
	let booting = $state(false);
	let frame = $state(0);
	let bootEvents = $state(0);

	let rows = $state<Row[]>([]);
	let follow = $state(true);
	let scanlines = $state(true);
	let selectedRow = $state(-1);
	let selectedByte = $state(-1);
	let waveformLines = $state<string[]>([]);

	// Frame source: the corridor finale (default) or DOOM. DOOM's module + WAD
	// are lazy - nothing loads until the switch is flipped to it.
	let source = $state<Source>('finale');
	let doom: Doom | null = null;
	let doomPhase = $state<'unloaded' | 'loading' | 'ready'>('unloaded');
	let doomError = $state(false);
	let wadLoaded = $state(0);
	let wadTotal = $state(0);
	let focused = $state(false); // panel has keyboard capture (phosphor ring)
	let panelEl: HTMLDivElement | undefined = $state();

	let raf = 0;
	let lastTs = 0; // rAF timestamp of the previous frame, for dt accumulation
	let lastPaintTs = 0; // last canvas repaint, throttled to FPS
	let doomAccumMs = 0; // unspent real time toward the next 35Hz dg tick
	let doomPendingRows: Row[] = []; // rows produced by dg ticks between repaints
	let streamTimers: number[] = [];

	// Rolling paint timing over the last 120 frames (tick + paint), exposed for
	// measurement. Not shown in the UI; the bench is an instrument, not a
	// benchmark readout.
	const perf = { samples: [] as number[], avgMs: 0 };

	function fmtFrame(n: number): string {
		return String(n).padStart(5, '0');
	}
	function fmtEvents(n: number): string {
		return n.toLocaleString('en-US');
	}

	function kindClass(kind: number): string {
		if (kind === KIND.CMD) return 'k-cmd';
		if (kind === KIND.SELECT) return 'k-select';
		return 'k-data';
	}

	function paint() {
		if (sim && ctx) sim.paint(ctx);
	}

	function clearCanvas() {
		if (!ctx) return;
		ctx.fillStyle = '#05070b';
		ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
	}

	function appendRows(incoming: Row[]) {
		const slice = incoming.length > MAX_ROWS_PER_FRAME ? incoming.slice(-MAX_ROWS_PER_FRAME) : incoming;
		const next = rows.concat(slice);
		rows = next.length > LOG_CAP ? next.slice(-LOG_CAP) : next;
	}

	function prefersReducedMotion(): boolean {
		return (
			typeof window !== 'undefined' &&
			!!window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	function cancelStream() {
		for (const id of streamTimers) clearTimeout(id);
		streamTimers = [];
	}

	const wadLine = $derived(formatWadProgress(wadLoaded, wadTotal));

	// The panel WINDOW register: the addressable window + pixel format the driver
	// last set, read straight off the live trace. During DOOM it shows the
	// letterbox center window (0-239 x 85-234); on the finale, the full frame. The
	// pedagogy is the point - the RAMWR only fills what CASET/PASET framed.
	const windowLine = $derived(lit ? formatWindowLine(parseWindow(rows.map((r) => r.text))) : null);

	// ---- DOOM ----------------------------------------------------------------
	// Flip to DOOM: lazily fetch the WAD (byte progress in the panel), boot the
	// module, then bring the panel up on the Freedoom title. The module + WAD
	// are a separate wasm instance; frames cross into thunk-wasm as raw RGBA.
	async function startDoomLoad() {
		if (doomPhase !== 'unloaded') return;
		doomPhase = 'loading';
		doomError = false;
		wadLoaded = 0;
		wadTotal = 0;
		try {
			const d = await loadDoom((l, t) => {
				wadLoaded = l;
				wadTotal = t;
			});
			doom = d;
			doomPhase = 'ready';
			if (source === 'doom') bootDoomPanel();
		} catch (e) {
			console.error('bench: doom load failed', e);
			doomError = true;
			doomPhase = 'unloaded';
		}
	}

	// Boot the panel for DOOM: init + a black letterbox once, then pump a few dg
	// ticks so the title renders. The letterbox bars are drawn a single time;
	// every later frame streams only the 240x150 center window.
	function bootDoomPanel() {
		if (!sim || !doom) return;
		stop();
		cancelStream();
		rows = [];
		selectedRow = -1;
		selectedByte = -1;
		waveformLines = [];
		doomPendingRows = [];
		lit = false;
		booting = true;
		powered = true;

		const bootRows = sim.bootDoom(); // init + black letterbox
		bootEvents = sim.bootEvents;
		let titleRows: Row[] = [];
		for (let i = 0; i < PRIME_TICKS; i++) {
			const rgba = doom.tick();
			titleRows = sim.blitExternalFrame(rgba, doom.width, doom.height);
		}
		frame = sim.frame;
		paint();
		// Boot trace then the last title frame's stream, capped to the log window.
		rows = bootRows.concat(titleRows).slice(-LOG_CAP);
		lit = true;
		booting = false;
		// First DOOM boot counts as the finale being watched (existing event,
		// idempotent). No new achievement - the economy is locked.
		xp.benchFinale();
	}

	// One dg tick: advance DOOM, blit the frame through the real bus (streaming
	// RAMWR), collect its trace rows. Does NOT touch the canvas - paint is on
	// its own throttle so 35Hz sim and 30fps paint stay decoupled.
	function doomTick() {
		if (!sim || !doom) return;
		const t0 = performance.now();
		const rgba = doom.tick();
		const incoming = sim.blitExternalFrame(rgba, doom.width, doom.height);
		record(performance.now() - t0);
		for (const r of incoming) doomPendingRows.push(r);
		if (doomPendingRows.length > LOG_CAP) doomPendingRows = doomPendingRows.slice(-LOG_CAP);
	}

	function flushDoomRows() {
		if (doomPendingRows.length) {
			appendRows(doomPendingRows);
			doomPendingRows = [];
		}
	}

	// Switch frame source. Always pauses first (never leave a loop running across
	// a source change). Selecting DOOM the first time kicks off the lazy load.
	function selectSource(next: Source) {
		if (next === source || !ready || booting) return;
		stop();
		cancelStream();
		source = next;
		if (next === 'doom') {
			if (doomPhase === 'ready') bootDoomPanel();
			else if (doomPhase === 'unloaded') {
				powered = false;
				lit = false;
				startDoomLoad();
			}
		} else {
			// Back to the finale: return to the idle bring-up, awaiting POWER.
			powered = false;
			lit = false;
			focused = false;
			rows = [];
			bootEvents = 0;
			frame = 0;
			clearCanvas();
		}
	}

	// ---- Cheat codes (pure homage) -------------------------------------------
	// The id* codes, watched on the panel while DOOM has the keyboard. The wink is
	// a HUD flash with the real 1993 message; the keystrokes still reach the engine
	// untouched, so typing a cheat also walks the marine, exactly as it did then.
	const cheats = new CheatBuffer();
	let cheatMessage = $state('');
	let cheatTimer = 0;

	function flashCheat(message: string) {
		cheatMessage = message;
		clearTimeout(cheatTimer);
		cheatTimer = window.setTimeout(() => (cheatMessage = ''), 2600);
	}

	// ---- Keyboard capture (DOOM only, while the panel is focused) ------------
	function onPanelKeyDown(e: KeyboardEvent) {
		if (source !== 'doom' || !doom || !powered) return;
		if (e.key === 'Escape') {
			panelEl?.blur();
			e.preventDefault();
			return;
		}
		const cheat = cheats.push(e.key);
		if (cheat) flashCheat(cheat.message);
		const k = toDoomKey(e);
		if (k) {
			doom.keyDown(k);
			e.preventDefault();
		}
	}
	function onPanelKeyUp(e: KeyboardEvent) {
		if (source !== 'doom' || !doom) return;
		const k = toDoomKey(e);
		if (k) {
			doom.keyUp(k);
			e.preventDefault();
		}
	}

	// Power on: boot the finale, then stream the boot trace into the log over
	// ~1s so it reads as a bring-up, not a dump; the panel lights with frame 0
	// as the stream lands. Pressing POWER again re-boots. On DOOM, POWER re-boots
	// the panel from the already-loaded module (never re-runs dg_init).
	function power() {
		if (!sim || booting) return;
		if (source === 'doom') {
			if (doomPhase === 'ready') bootDoomPanel();
			else if (doomPhase === 'unloaded') startDoomLoad();
			return;
		}
		stop();
		cancelStream();
		rows = [];
		selectedRow = -1;
		selectedByte = -1;
		waveformLines = [];
		lit = false;
		booting = true;
		powered = true;

		const bootRows = sim.boot(); // paints frame 0 into the canvas buffer
		frame = sim.frame;
		bootEvents = sim.bootEvents;

		if (prefersReducedMotion()) {
			rows = bootRows.slice(-LOG_CAP);
			lit = true;
			booting = false;
			paint();
			xp.benchBoot(); // first full boot watched: +10, FIRST BOOT
			return;
		}

		// ~1s total, one row at a time; light the panel on the final row.
		const total = 950;
		const step = Math.max(24, Math.floor(total / Math.max(bootRows.length, 1)));
		bootRows.forEach((r, i) => {
			const id = window.setTimeout(() => {
				rows = rows.concat(r);
				if (i === bootRows.length - 1) {
					paint();
					lit = true;
					booting = false;
					xp.benchBoot(); // first full boot watched: +10, FIRST BOOT
				}
			}, step * (i + 1));
			streamTimers.push(id);
		});
	}

	function frameStep() {
		if (!sim || !powered || booting) return;
		const t0 = performance.now();
		const incoming = sim.tick();
		paint();
		record(performance.now() - t0);
		appendRows(incoming);
		frame = sim.frame;
		// Finale watched once enough frames have been drawn: +25 (idempotent).
		if (frame >= FINALE_FRAMES) xp.benchFinale();
	}

	function record(ms: number) {
		perf.samples.push(ms);
		if (perf.samples.length > 120) perf.samples.shift();
		perf.avgMs = perf.samples.reduce((a, b) => a + b, 0) / perf.samples.length;
	}

	// One transport step, source-aware: a finale frame, or one DOOM dg tick +
	// blit + repaint. Used by the STEP button and the paused single-step path.
	function stepOnce() {
		if (source === 'doom') {
			if (!sim || !powered || booting) return;
			doomTick();
			paint();
			flushDoomRows();
			frame = sim.frame;
		} else {
			frameStep();
		}
	}

	function loop(ts: number) {
		raf = requestAnimationFrame(loop);
		const dt = lastTs ? ts - lastTs : 0;
		lastTs = ts;

		if (source === 'doom') {
			// Accumulate real time and run dg at 35Hz, catching up at most a few
			// ticks (a cap keeps a backgrounded tab from spiraling on return).
			doomAccumMs = Math.min(doomAccumMs + dt, 200);
			const stepMs = 1000 / DOOM_HZ;
			let steps = 0;
			while (doomAccumMs >= stepMs && steps < 3) {
				doomTick();
				doomAccumMs -= stepMs;
				steps++;
			}
			// Paint (putImageData) on its own 30fps throttle, decoupled from sim.
			if (sim && ts - lastPaintTs >= 1000 / FPS) {
				lastPaintTs = ts;
				paint();
				flushDoomRows();
				frame = sim.frame;
			}
		} else {
			if (ts - lastPaintTs < 1000 / FPS) return;
			lastPaintTs = ts;
			frameStep();
		}
	}

	function run() {
		if (!sim || !powered || running || booting) return;
		running = true;
		lastTs = 0;
		lastPaintTs = 0;
		doomAccumMs = 0;
		raf = requestAnimationFrame(loop);
	}
	function stop() {
		running = false;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}
	function toggleRun() {
		if (running) stop();
		else run();
	}

	function selectRow(i: number, r: Row) {
		if (r.byte < 0) return;
		selectedRow = i;
		selectedByte = r.byte;
		waveformLines = sim ? sim.waveform(r.byte) : [];
		xp.benchScope(); // first byte scoped: +10, SCOPE JOCKEY
	}

	// Follow: keep the log pinned to the newest row while follow is on.
	$effect(() => {
		void rows;
		if (follow && logEl) {
			logEl.scrollTop = logEl.scrollHeight;
		}
	});

	// SAVE TRACE: download the current annotated trace (exactly the rows shown in
	// the log) as a plain text file. Client-side Blob, no network. No-op until the
	// panel is powered and has rows.
	function saveTrace() {
		if (!powered || rows.length === 0) return;
		try {
			const blob = new Blob([serializeTrace(rows, { frame })], {
				type: 'text/plain;charset=utf-8'
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'thunk-trace.txt';
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			// download denied (rare): nothing to do
		}
	}

	// Palette actions arrive as window events: TOGGLE SCANLINES and SAVE TRACE.
	function onCmd(e: Event) {
		const action = (e as CustomEvent<string>).detail;
		if (action === 'toggle-scanlines') scanlines = !scanlines;
		else if (action === 'save-trace') saveTrace();
	}

	onMount(() => {
		ctx = canvasEl.getContext('2d');
		clearCanvas();
		window.addEventListener('thunk:cmd', onCmd);

		// Lazy-load the wasm on the bench route only: loadSim dynamically imports
		// the .wasm, so the 35KB module is a separate chunk fetched on demand,
		// never on lesson routes.
		loadSim(240, 320)
			.then((s) => {
				sim = s;
				ready = true;
				// A deterministic control surface for screenshots / live checks.
				(window as unknown as { __bench: unknown }).__bench = {
					power,
					step: (n = 1) => {
						for (let i = 0; i < n; i++) stepOnce();
					},
					run,
					pause: stop,
					isLit: () => lit,
					frame: () => frame,
					perf: () => perf.avgMs,
					// DOOM hooks for live verification.
					selectSource: (s: Source) => selectSource(s),
					source: () => source,
					doomPhase: () => doomPhase,
					wad: () => ({ loaded: wadLoaded, total: wadTotal }),
					traceText: () => rows.map((r) => r.text).join('\n'),
					pressDoomKey: (k: number, ms = 90) => {
						doom?.keyDown(k);
						return new Promise((res) =>
							setTimeout(() => {
								doom?.keyUp(k);
								res(null);
							}, ms)
						);
					},
					sampleNonBlack: () => {
						if (!ctx) return 0;
						const d = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height).data;
						let n = 0;
						for (let i = 0; i < d.length; i += 4) {
							if (d[i] | d[i + 1] | d[i + 2]) n++;
						}
						return n;
					}
				};
			})
			.catch((e) => {
				console.error('bench: wasm load failed', e);
				loadError = true;
			});

		return () => {
			stop();
			cancelStream();
			window.removeEventListener('thunk:cmd', onCmd);
		};
	});
</script>

<Meta
	title="THE BENCH · thunk"
	description="The simulated panel and the live bus trace that drew it, running the real thunk-sim in your browser."
	ogTitle="The Bench - thunk"
/>

<header class="head">
	<p class="eyebrow label">The instrument</p>
	<h1>The Bench</h1>
	<p class="lede">
		The corridor finale, drawn on a simulated ILI9341 by the real driver - boot traffic first, then
		frames - with the decoded bus trace live underneath. This is <span class="mono">thunk-sim</span>
		compiled to WebAssembly, running in your browser. Nothing leaves this machine.
	</p>
</header>

<section class="bench" aria-label="the bench">
	<!-- Left: the panel + its transport. -->
	<div class="instrument">
		<div class="transport" role="group" aria-label="transport">
			<button
				class="tbtn primary"
				class:on={powered}
				onclick={power}
				disabled={!ready || booting}
				aria-pressed={powered}
			>
				<span class="led" aria-hidden="true"></span>POWER
			</button>
			<button
				class="tbtn"
				class:on={running}
				onclick={toggleRun}
				disabled={!powered || booting}
				aria-pressed={running}
			>
				{running ? 'PAUSE' : 'RUN'}
			</button>
			<button class="tbtn" onclick={stepOnce} disabled={!powered || running || booting}>STEP</button>
			<span class="spacer" aria-hidden="true"></span>
			<span class="frame mono tnum" aria-label="frame counter">FRAME {fmtFrame(frame)}</span>
		</div>

		{#if source === 'doom' && powered}
			<p class="keys mono" aria-label="keyboard legend">
				KEYS <span class="ksep">&middot;</span> ARROWS/WASD move <span class="ksep">&middot;</span> CTRL fire
				<span class="ksep">&middot;</span> SPACE use <span class="ksep">&middot;</span> ENTER select
				<span class="ksep">&middot;</span> Y confirm <span class="ksep">&middot;</span> ESC release
				<span class="ksep">&middot;</span>
				{#if focused}<span class="kfoc">captured</span>{:else}<span class="kfoc dim">click panel to capture</span>{/if}
			</p>
		{/if}

		<div class="stage-wrap">
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<!-- The bezel is only focusable (tabindex 0) while it carries role=
			     application for DOOM keyboard capture; otherwise tabindex is -1. -->
			<div
				class="bezel"
				class:lit
				class:focusable={source === 'doom' && powered}
				class:focused={focused && source === 'doom'}
				bind:this={panelEl}
				tabindex={source === 'doom' && powered ? 0 : -1}
				role={source === 'doom' && powered ? 'application' : undefined}
				aria-label={source === 'doom' ? 'DOOM panel - click to capture keyboard' : undefined}
				onkeydown={onPanelKeyDown}
				onkeyup={onPanelKeyUp}
				onfocus={() => (focused = true)}
				onblur={() => (focused = false)}
			>
				<div class="glass">
					<canvas
						bind:this={canvasEl}
						width="240"
						height="320"
						class:lit
						aria-label="simulated display panel"
					></canvas>
					<!-- CRT treatment: scanlines + vignette on the lit content only,
					     toggleable. Cheap CSS, no second render path. -->
					<div class="crt" class:scanlines class:lit aria-hidden="true"></div>
					<!-- Cheat HUD: a DOOM status-bar wink across the foot of the glass.
					     Pure flash - the sim never sees it. Announced politely for SR. -->
					{#if cheatMessage}
						<div class="cheat mono" role="status" aria-live="polite">{cheatMessage}</div>
					{/if}
					{#if !lit}
						<div class="nosignal" aria-hidden="true">
							<span class="ns-bars">
								<i style="--c:#38443b"></i><i style="--c:#2c3730"></i><i style="--c:#3d463f"></i><i
									style="--c:#2f3a34"></i><i style="--c:#434b44"></i>
							</span>
							<span class="ns-label label">
								{#if doomError}
									WAD FETCH FAILED
								{:else if source === 'doom' && doomPhase === 'loading'}
									{wadLine}
								{:else if booting}
									BRINGING UP
								{:else}
									NO SIGNAL
								{/if}
							</span>
						</div>
					{/if}
				</div>
			</div>

			<div class="metabar">
				<div class="source" role="group" aria-label="frame source">
					<button
						class="src"
						class:on={source === 'finale'}
						onclick={() => selectSource('finale')}
						disabled={!ready || booting}
						aria-pressed={source === 'finale'}
					>
						FINALE
					</button>
					<button
						class="src"
						class:on={source === 'doom'}
						onclick={() => selectSource('doom')}
						disabled={!ready || booting}
						aria-pressed={source === 'doom'}
					>
						DOOM{#if doomPhase === 'loading'}<span class="await label">LOADING</span>{/if}
					</button>
				</div>
				<button
					class="scan-toggle mono"
					class:on={scanlines}
					onclick={() => (scanlines = !scanlines)}
					aria-pressed={scanlines}
				>
					SCANLINES {scanlines ? 'ON' : 'OFF'}
				</button>
			</div>

			{#if source === 'doom'}
				<p class="licenses mono" aria-label="doom source and licenses">
					SOURCE + LICENSES <span class="lsep">&middot;</span>
					<a href="/doom/doomgeneric-src.tar.gz">doomgeneric source</a>
					<span class="lsep">&middot;</span>
					<a href="/doom/gpl-2.0.txt">GPL-2.0</a>
					<span class="lsep">&middot;</span>
					<a href="/doom/COPYING.txt">Freedoom BSD</a>
				</p>
			{/if}

			<p class="stats mono tnum" aria-label="panel format">
				240&times;320 <span class="sd" aria-hidden="true">&middot;</span> RGB565
				<span class="sd" aria-hidden="true">&middot;</span>
				{#if bootEvents}{fmtEvents(bootEvents)} BOOT EVENTS{:else}AWAITING BOOT{/if}
			</p>

			<!-- WINDOW register: the CASET/PASET window + COLMOD the driver last set,
			     derived live from the trace. Present only once the panel is lit. -->
			{#if windowLine}
				<p class="window mono tnum" aria-label="addressable window">{windowLine}</p>
			{/if}
		</div>
	</div>

	<!-- Right: the trace readout + waveform detail. -->
	<div class="scope">
		<div class="scope-head">
			<span class="label">Bus trace</span>
			<div class="scope-tools">
				<button
					class="stool mono"
					onclick={saveTrace}
					disabled={!powered || rows.length === 0}
					title="Download the current trace as thunk-trace.txt"
				>
					SAVE TRACE
				</button>
				<button
					class="stool follow mono"
					class:on={follow}
					onclick={() => (follow = !follow)}
					aria-pressed={follow}
				>
					FOLLOW {follow ? 'ON' : 'OFF'}
				</button>
			</div>
		</div>

		<div class="log" bind:this={logEl} role="log" aria-live="off">
			{#if rows.length === 0}
				<p class="empty mono">
					{#if loadError}
						Sim failed to load.
					{:else if !ready}
						Loading the simulator...
					{:else}
						Press <span class="kbd">POWER</span> to bring the panel up.
					{/if}
				</p>
			{:else}
				{#each rows as r, i (i)}
					{#if r.byte >= 0}
						<button
							class="row {kindClass(r.kind)}"
							class:sel={selectedRow === i}
							onclick={() => selectRow(i, r)}
						>
							<span class="rtext mono">{r.text}</span>
						</button>
					{:else}
						<div class="row static {kindClass(r.kind)}">
							<span class="rtext mono">{r.text}</span>
						</div>
					{/if}
				{/each}
			{/if}
		</div>

		<div class="well" class:active={waveformLines.length > 0}>
			<div class="well-head label">
				Waveform{#if selectedByte >= 0}
					<span class="wb mono tnum">
						{selectedByte.toString(16).toUpperCase().padStart(2, '0')}</span
					>{/if}
			</div>
			{#if waveformLines.length > 0}
				<pre class="wave mono">{waveformLines.join('\n')}</pre>
			{:else}
				<p class="well-empty mono">Select a byte row to scope its clock and data lines.</p>
			{/if}
		</div>
	</div>
</section>

<a class="back" href="/">
	<svg width="14" height="14" viewBox="0 0 14 14" fill="none"
		><path d="M9 3L5 7l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg
	>
	Back to the ladder
</a>

<style>
	.head {
		max-width: 44rem;
		margin-bottom: 2rem;
	}
	.eyebrow {
		color: var(--phosphor);
		margin-bottom: 0.9rem;
	}
	.head h1 {
		font-size: clamp(1.9rem, 4.5vw, 2.6rem);
		color: var(--text-strong);
		letter-spacing: -0.02em;
	}
	.lede {
		margin-top: 1rem;
		font-size: 1rem;
		line-height: 1.65;
		color: var(--muted);
	}
	.lede .mono {
		font-size: 0.875em;
		color: var(--text);
	}

	/* The bench: panel + scope side by side, stacking on narrow. */
	.bench {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: clamp(1.5rem, 4vw, 2.75rem);
		/* Stretch both columns to the taller one (the portrait panel), so the
		   trace log fills the height beside it instead of leaving a void. */
		align-items: stretch;
	}

	.instrument {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* ---- Transport ---------------------------------------------------- */
	.transport {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
	}
	.tbtn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		color: var(--muted);
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out),
			background 140ms var(--ease-out);
	}
	.tbtn:hover:not(:disabled) {
		color: var(--text);
		border-color: var(--line-strong);
	}
	.tbtn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.tbtn.on {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
	}
	.tbtn .led {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--s3);
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.tbtn.primary.on .led {
		background: var(--phosphor);
		box-shadow: 0 0 8px var(--phosphor);
	}
	.spacer {
		flex: 1;
	}
	.frame {
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		color: var(--faint);
		white-space: nowrap;
	}

	/* KEYS legend + licenses line: hairline mono, deliberately quiet. */
	.keys {
		font-size: 0.625rem;
		letter-spacing: 0.08em;
		color: var(--faint);
		line-height: 1.5;
	}
	.keys .ksep {
		color: var(--line);
		margin-inline: 0.15em;
	}
	.keys .kfoc {
		color: var(--phosphor);
	}
	.keys .kfoc.dim {
		color: var(--faint);
	}
	.licenses {
		font-size: 0.625rem;
		letter-spacing: 0.06em;
		color: var(--faint);
	}
	.licenses a {
		color: var(--muted);
		text-decoration: none;
		border-bottom: 1px solid var(--line);
		transition: color 140ms var(--ease-out);
	}
	.licenses a:hover {
		color: var(--phosphor);
	}
	.licenses .lsep {
		color: var(--line);
		margin-inline: 0.2em;
	}

	/* ---- The panel ---------------------------------------------------- */
	.stage-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: min(480px, 68vw);
	}
	.bezel {
		width: 100%;
		aspect-ratio: 240 / 320;
		padding: 12px;
		background: linear-gradient(#0c1119, #090d12);
		border: 1px solid var(--line);
		border-radius: 4px;
		transition: border-color 220ms var(--ease-out);
	}
	.bezel.lit {
		border-color: #232f3d;
	}
	.bezel.focusable {
		cursor: pointer;
	}
	/* Keyboard capture: a quiet phosphor ring on the bezel, no new hue. Replaces
	   the default focus outline so the "instrument is live" reads on the frame. */
	.bezel.focusable:focus-visible {
		outline: none;
	}
	.bezel.focused {
		border-color: color-mix(in srgb, var(--phosphor) 60%, var(--line));
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--phosphor) 55%, transparent),
			0 0 16px color-mix(in srgb, var(--phosphor) 22%, transparent);
	}
	.glass {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 2px;
		overflow: hidden;
		background: radial-gradient(120% 90% at 50% 40%, #0e1620 0%, #080b10 80%);
		box-shadow: inset 0 0 40px #05070b;
	}
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		image-rendering: pixelated;
		opacity: 0;
		transition: opacity 260ms var(--ease-out);
	}
	canvas.lit {
		opacity: 1;
	}

	/* CRT overlay: vignette always (subtle); scanlines + a faint phosphor bloom
	   only when lit and enabled. Pure CSS, one positioned layer. */
	.crt {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(130% 100% at 50% 50%, transparent 62%, #05070b 100%);
		opacity: 0.7;
	}
	.crt.lit.scanlines {
		background:
			repeating-linear-gradient(
				to bottom,
				rgba(0, 0, 0, 0) 0,
				rgba(0, 0, 0, 0) 1px,
				rgba(5, 7, 11, 0.34) 1px,
				rgba(5, 7, 11, 0.34) 2px
			),
			radial-gradient(130% 100% at 50% 50%, transparent 60%, #05070b 100%);
		opacity: 0.85;
		mix-blend-mode: multiply;
	}

	/* Cheat HUD: a phosphor status-bar band pinned across the foot of the glass,
	   the way DOOM printed its cheat acknowledgements. Fades in, holds, fades out
	   (the message clears itself after a beat). */
	.cheat {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 0.45rem 0.6rem;
		text-align: center;
		font-size: 0.5625rem;
		letter-spacing: 0.16em;
		color: var(--phosphor);
		text-shadow: 0 0 8px var(--phosphor);
		background: linear-gradient(to top, rgba(5, 7, 11, 0.92), transparent);
		pointer-events: none;
		animation: cheat-in 220ms var(--ease-out) both;
	}
	@keyframes cheat-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cheat {
			animation: none;
		}
	}

	.nosignal {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
	}
	.ns-bars {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		width: 44%;
		height: 12%;
		border: 1px solid var(--line);
		border-radius: 2px;
		overflow: hidden;
		filter: saturate(0.7);
	}
	.ns-bars i {
		background: var(--c);
	}
	.ns-label {
		font-size: 0.625rem;
		letter-spacing: 0.22em;
		color: var(--faint);
	}

	/* ---- Meta bar (source + scanlines) -------------------------------- */
	.metabar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.source {
		display: inline-flex;
		border: 1px solid var(--line);
		border-radius: 2px;
		overflow: hidden;
	}
	.src {
		position: relative;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		letter-spacing: 0.12em;
		color: var(--faint);
		padding: 0.35rem 0.7rem;
		background: var(--s1);
		cursor: pointer;
		transition:
			color 140ms var(--ease-out),
			background 140ms var(--ease-out);
	}
	.src:hover:not(:disabled):not(.on) {
		color: var(--muted);
	}
	.src:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
	.src + .src {
		border-left: 1px solid var(--line);
	}
	.src.on {
		color: var(--phosphor);
		background: color-mix(in srgb, var(--phosphor) 10%, var(--s2));
	}
	.src .await {
		display: block;
		font-size: 0.4375rem;
		letter-spacing: 0.16em;
		color: var(--faint);
		margin-top: 0.15rem;
	}
	.scan-toggle {
		font-size: 0.625rem;
		letter-spacing: 0.12em;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.35rem 0.6rem;
		background: var(--s1);
		transition: color 140ms var(--ease-out);
	}
	.scan-toggle:hover {
		color: var(--muted);
	}
	.scan-toggle.on {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}

	.stats {
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		color: var(--faint);
	}
	.stats .sd {
		color: var(--line);
		margin-inline: 0.3em;
	}
	/* WINDOW register: a hair brighter than .stats - it is live, not a constant. */
	.window {
		font-size: 0.6875rem;
		letter-spacing: 0.08em;
		color: var(--muted);
	}

	/* ---- The scope (trace + waveform) --------------------------------- */
	.scope {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
		align-self: stretch;
	}
	.scope-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.scope-head .label {
		color: var(--muted);
	}
	.scope-tools {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.stool {
		font-size: 0.625rem;
		letter-spacing: 0.12em;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.3rem 0.55rem;
		background: var(--s1);
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.stool:hover:not(:disabled) {
		color: var(--muted);
		border-color: var(--line-strong);
	}
	.stool:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.follow.on {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}

	.log {
		/* Grow to balance the portrait panel, but cap so the waveform well below
		   stays on screen when a row is selected (no scroll to see the scope). */
		flex: 1 1 auto;
		min-height: 340px;
		max-height: 560px;
		overflow-y: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 1px;
		scroll-behavior: auto;
	}
	.empty {
		margin: auto;
		font-size: 0.8125rem;
		color: var(--faint);
		text-align: center;
	}
	.kbd {
		color: var(--phosphor);
		letter-spacing: 0.08em;
	}
	.row {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.18rem 0.5rem;
		border-radius: 2px;
		border: 1px solid transparent;
	}
	.row.static {
		cursor: default;
	}
	button.row {
		cursor: pointer;
		transition: background 120ms var(--ease-out);
	}
	button.row:hover {
		background: var(--s2);
	}
	.row.sel {
		background: var(--s3);
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.rtext {
		font-size: 0.75rem;
		line-height: 1.5;
		white-space: pre;
	}
	.k-cmd .rtext {
		color: var(--phosphor);
	}
	.k-data .rtext {
		color: var(--muted);
	}
	.k-select .rtext {
		color: var(--cyan);
	}

	.well {
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 0.7rem 0.85rem;
		transition: border-color 160ms var(--ease-out);
	}
	.well.active {
		border-color: var(--line-strong);
	}
	.well-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--muted);
		margin-bottom: 0.5rem;
	}
	.well-head .wb {
		color: var(--phosphor);
		font-size: 0.75rem;
		letter-spacing: 0.05em;
	}
	.wave {
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--text);
		white-space: pre;
		overflow-x: auto;
	}
	.well-empty {
		font-size: 0.75rem;
		color: var(--faint);
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 2rem;
		color: var(--muted);
		font-size: 0.9375rem;
		transition: color 140ms var(--ease-out);
	}
	.back:hover {
		color: var(--text);
	}

	@media (max-width: 860px) {
		.bench {
			grid-template-columns: 1fr;
		}
		.stage-wrap {
			width: min(420px, 88vw);
		}
		.scope {
			width: 100%;
		}
	}
</style>
