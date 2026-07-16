<script lang="ts">
	// SPI Scope (M3, flagship): the exact signal the bench speaks, drawn in SVG
	// from a pure function - no wasm. Set any byte, then step the clock one rising
	// edge at a time and watch each bit latch, MSB first, while the running value
	// builds. CLK, MOSI, and CS align on a hairline grid; the one motion is the
	// phosphor cursor stepping across.
	import { onDestroy } from 'svelte';
	import { spiWaveform, latchedValue } from './spi-waveform';
	import { toBin, groupBin, toHex } from './format';

	let { reducedMotion = false }: { reducedMotion?: boolean } = $props();

	// Default 0x2C = RAMWR, the byte the bench streams and the M3 lesson draws.
	let byte = $state(0x2c);
	// Latched-bit count 0..8. Starts complete so the byte reads whole on arrival;
	// RESET rewinds to 0 and STEP/RUN replay the latching.
	let step = $state(8);
	let running = $state(false);
	let hexText = $state('2C');
	let timer: ReturnType<typeof setInterval> | null = null;

	const wf = $derived(spiWaveform(byte));
	const bits = $derived(wf.bits);
	const latched = $derived(latchedValue(bits, step));

	// ---- Geometry (SVG user units; the element scales to its column) ----------
	const N = 8;
	const GUT = 46; // left gutter for row labels
	const CW = 60; // one clock cell
	const PLOT = N * CW;
	const VW = GUT + PLOT + 18;
	const CLK_HI = 34;
	const CLK_LO = 60;
	const MOSI_HI = 102;
	const MOSI_LO = 128;
	const CS_HI = 162;
	const CS_LO = 188;
	const LBL_Y = 210;
	const EDGE_Y = 14;
	const VH = 226;
	const cells = [0, 1, 2, 3, 4, 5, 6, 7];

	const cellX = (c: number) => GUT + c * CW;
	const mid = (c: number) => cellX(c) + CW / 2;

	// CLK: eight square pulses, low then high, rising edge at each cell midpoint.
	function clkPath(): string {
		let d = `M ${GUT} ${CLK_LO}`;
		for (let c = 0; c < N; c++) {
			const m = mid(c);
			const x1 = cellX(c) + CW;
			d += ` L ${m} ${CLK_LO} L ${m} ${CLK_HI} L ${x1} ${CLK_HI} L ${x1} ${CLK_LO}`;
		}
		return d;
	}

	// MOSI: idles low, holds each bit's level across its whole cell (settled
	// before the rising edge), transitions at cell boundaries.
	function mosiPath(b: number[]): string {
		let d = `M ${GUT} ${MOSI_LO}`;
		for (let c = 0; c < N; c++) {
			const y = b[c] ? MOSI_HI : MOSI_LO;
			d += ` L ${cellX(c)} ${y} L ${cellX(c) + CW} ${y}`;
		}
		return d;
	}

	// CS: high shoulders, low across the whole transaction.
	const csPath = `M ${GUT - 14} ${CS_HI} L ${GUT} ${CS_HI} L ${GUT} ${CS_LO} L ${GUT + PLOT} ${CS_LO} L ${GUT + PLOT} ${CS_HI} L ${GUT + PLOT + 14} ${CS_HI}`;

	const clk = $derived(clkPath());
	const mosi = $derived(mosiPath(bits));
	// The cursor marks the edge just latched during an active step-walk; it hides
	// at rest (0 of 8) and when the byte is fully latched (8 of 8), so the default
	// complete view stays quiet.
	const cursorX = $derived(step > 0 && step < N ? mid(step - 1) : null);

	const ariaBits = $derived(bits.join(' '));

	// ---- Byte controls --------------------------------------------------------
	function clampByte(n: number): number {
		if (Number.isNaN(n)) return byte;
		return Math.max(0, Math.min(255, Math.trunc(n)));
	}
	function setByte(n: number) {
		stop();
		byte = clampByte(n);
		hexText = byte.toString(16).toUpperCase().padStart(2, '0');
	}
	function onSlider(e: Event) {
		setByte(Number((e.target as HTMLInputElement).value));
	}
	function onDec(e: Event) {
		setByte(Number((e.target as HTMLInputElement).value));
	}
	function onHex(e: Event) {
		const raw = (e.target as HTMLInputElement).value.replace(/^0x/i, '').trim();
		hexText = raw;
		const n = parseInt(raw, 16);
		if (!Number.isNaN(n)) {
			stop();
			byte = clampByte(n);
		}
	}
	function bump(delta: number) {
		setByte(byte + delta);
	}

	// ---- Transport ------------------------------------------------------------
	function stepOnce() {
		if (step < N) step += 1;
	}
	function reset() {
		stop();
		step = 0;
	}
	function stop() {
		running = false;
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}
	function run() {
		if (reducedMotion) return;
		if (running) {
			stop();
			return;
		}
		if (step >= N) step = 0;
		running = true;
		timer = setInterval(() => {
			if (step >= N) {
				stop();
				return;
			}
			step += 1;
			if (step >= N) stop();
		}, 420);
	}

	onDestroy(stop);
</script>

<div class="scope" role="group" aria-label="SPI Scope: an interactive SPI waveform">
	<!-- Byte controls -->
	<div class="controls">
		<label class="ctl slider-ctl">
			<span class="ck label">Byte</span>
			<input
				class="slider"
				type="range"
				min="0"
				max="255"
				value={byte}
				oninput={onSlider}
				aria-label="byte value 0 to 255"
			/>
		</label>
		<div class="entries">
			<label class="ent">
				<span class="ck label">Hex</span>
				<span class="hexwrap mono">
					<span class="hx0" aria-hidden="true">0x</span>
					<input
						class="hexin mono tnum"
						type="text"
						inputmode="text"
						maxlength="2"
						value={hexText}
						oninput={onHex}
						autocomplete="off"
						autocapitalize="characters"
						spellcheck="false"
						aria-label="byte in hex"
					/>
				</span>
			</label>
			<label class="ent">
				<span class="ck label">Dec</span>
				<input
					class="decin mono tnum"
					type="number"
					min="0"
					max="255"
					value={byte}
					oninput={onDec}
					autocomplete="off"
					aria-label="byte in decimal"
				/>
			</label>
			<div class="steppers" role="group" aria-label="adjust byte">
				<button class="stp mono" onclick={() => bump(-1)} aria-label="decrement byte">&minus;</button>
				<button class="stp mono" onclick={() => bump(1)} aria-label="increment byte">+</button>
			</div>
		</div>
	</div>

	<!-- The scope -->
	<div class="screen">
		<svg
			viewBox={`0 0 ${VW} ${VH}`}
			class="wave"
			role="img"
			aria-label={`SPI waveform for ${toHex(byte)}: MSB-first bits ${ariaBits}, latched ${step} of 8`}
			preserveAspectRatio="xMidYMid meet"
		>
			<!-- Hairline grid: one vertical per cell boundary. -->
			<g class="grid" shape-rendering="crispEdges">
				{#each cells as c (c)}
					<line x1={cellX(c)} y1={EDGE_Y + 4} x2={cellX(c)} y2={LBL_Y - 4} />
				{/each}
				<line x1={GUT + PLOT} y1={EDGE_Y + 4} x2={GUT + PLOT} y2={LBL_Y - 4} />
			</g>

			<!-- Tick numbers 1..8 across the top. -->
			<g class="ticks">
				{#each cells as c (c)}
					<text x={mid(c)} y={EDGE_Y} class:on={c < step}>{c + 1}</text>
				{/each}
			</g>

			<!-- Rising-edge guides + latch dots. -->
			<g class="edges" shape-rendering="crispEdges">
				{#each cells as c (c)}
					<line
						class="guide"
						class:on={c < step}
						x1={mid(c)}
						y1={CLK_HI}
						x2={mid(c)}
						y2={LBL_Y - 14}
					/>
					<circle class="dot" class:on={c < step} cx={mid(c)} cy={CLK_HI} r="2.6" />
				{/each}
			</g>

			<!-- Signals. -->
			<path class="sig cs" d={csPath} shape-rendering="geometricPrecision" />
			<path class="sig clk" d={clk} shape-rendering="geometricPrecision" />
			<path class="sig mosi" d={mosi} shape-rendering="geometricPrecision" />

			<!-- Row labels. -->
			<text class="rowlbl" x="8" y={(CLK_HI + CLK_LO) / 2 + 4}>CLK</text>
			<text class="rowlbl" x="8" y={(MOSI_HI + MOSI_LO) / 2 + 4}>DAT</text>
			<text class="rowlbl" x="8" y={(CS_HI + CS_LO) / 2 + 4}>CS</text>

			<!-- Per-bit values under each pulse; latched ones light phosphor. -->
			<g class="bitrow">
				{#each cells as c (c)}
					<text x={mid(c)} y={LBL_Y} class:on={c < step}>{bits[c]}</text>
				{/each}
			</g>

			<!-- The stepping cursor. -->
			{#if cursorX !== null}
				<line
					class="cursor"
					x1={cursorX}
					y1={EDGE_Y + 4}
					x2={cursorX}
					y2={LBL_Y + 2}
					shape-rendering="crispEdges"
				/>
			{/if}
		</svg>
	</div>

	<!-- Readout + transport -->
	<div class="readbar">
		<div class="reads" aria-live="polite">
			<span class="rd">
				<span class="rk label">Byte</span>
				<span class="rv mono tnum">{toHex(byte)} · {groupBin(toBin(byte))} · {byte}</span>
			</span>
			<span class="rd">
				<span class="rk label">Latched</span>
				<span class="rv mono tnum">
					{#each bits as b, i (i)}<span class="lb" class:on={i < step}>{i < step ? b : '·'}</span
						>{/each}
					<span class="eq">=</span>
					{latched}
					<span class="cnt">({step}/8)</span>
				</span>
			</span>
		</div>
		<div class="transport" role="group" aria-label="clock transport">
			<button class="tb mono" onclick={stepOnce} disabled={step >= N}>STEP</button>
			{#if !reducedMotion}
				<button class="tb mono" class:on={running} onclick={run} aria-pressed={running}>
					{running ? 'STOP' : 'RUN'}
				</button>
			{/if}
			<button class="tb mono" onclick={reset} disabled={step === 0 && !running}>RESET</button>
		</div>
	</div>

	<a class="benchlink mono" href="/bench">this is what the bench speaks &rarr;</a>
</div>

<style>
	.scope {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 1.1rem 1.2rem 1rem;
	}

	/* ---- Controls ---------------------------------------------------------- */
	.controls {
		display: flex;
		align-items: center;
		gap: clamp(0.75rem, 3vw, 1.5rem);
		flex-wrap: wrap;
	}
	.ck {
		color: var(--faint);
	}
	.slider-ctl {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex: 1 1 220px;
		min-width: 180px;
	}
	.slider {
		flex: 1;
		appearance: none;
		-webkit-appearance: none;
		height: 3px;
		border-radius: 2px;
		background: var(--s3);
		outline-offset: 4px;
	}
	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 22px;
		border-radius: 2px;
		background: linear-gradient(#3df0a8, #1f9e6c);
		border: 1px solid color-mix(in srgb, var(--phosphor) 60%, #0a0e13);
		box-shadow: 0 0 8px var(--phosphor-dim);
		cursor: grab;
	}
	.slider::-webkit-slider-thumb:active {
		cursor: grabbing;
	}
	.slider::-moz-range-thumb {
		width: 14px;
		height: 22px;
		border-radius: 2px;
		background: linear-gradient(#3df0a8, #1f9e6c);
		border: 1px solid color-mix(in srgb, var(--phosphor) 60%, #0a0e13);
		box-shadow: 0 0 8px var(--phosphor-dim);
		cursor: grab;
	}

	.entries {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.ent {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.hexwrap {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		padding: 0.3rem 0.5rem;
	}
	.hexwrap:focus-within {
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.hx0 {
		color: var(--faint);
		font-size: 0.8125rem;
	}
	.hexin {
		width: 2ch;
		background: none;
		border: none;
		outline: none;
		color: var(--phosphor);
		font-size: 0.875rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.decin {
		width: 3.6rem;
		background: var(--s2);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.3rem 0.5rem;
		color: var(--text);
		font-size: 0.875rem;
		outline: none;
	}
	.decin:focus {
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.steppers {
		display: inline-flex;
		gap: 0.3rem;
	}
	.stp {
		width: 1.9rem;
		height: 1.9rem;
		display: grid;
		place-items: center;
		font-size: 1rem;
		color: var(--muted);
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.stp:hover {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}

	/* ---- The screen -------------------------------------------------------- */
	.screen {
		border: 1px solid var(--line);
		border-radius: 3px;
		background: radial-gradient(120% 120% at 50% 0%, #0e1620 0%, #080b10 85%);
		padding: 0.4rem 0.5rem;
		box-shadow: inset 0 0 30px #05070b;
	}
	.wave {
		display: block;
		width: 100%;
		height: auto;
	}
	.grid line {
		stroke: var(--line-soft);
		stroke-width: 1;
	}
	.ticks text,
	.bitrow text {
		font-family: var(--font-mono);
		font-size: 11px;
		text-anchor: middle;
		fill: var(--faint);
	}
	.ticks text {
		font-size: 9px;
		letter-spacing: 0.04em;
	}
	.ticks text.on,
	.bitrow text.on {
		fill: var(--phosphor);
	}
	.bitrow text {
		font-size: 13px;
		font-weight: 600;
	}
	.rowlbl {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		fill: var(--muted);
	}
	.guide {
		stroke: var(--line);
		stroke-width: 1;
		stroke-dasharray: 2 3;
		opacity: 0.6;
	}
	.guide.on {
		stroke: color-mix(in srgb, var(--phosphor) 45%, transparent);
		opacity: 1;
	}
	.dot {
		fill: var(--s3);
		stroke: var(--line);
		stroke-width: 1;
	}
	.dot.on {
		fill: var(--phosphor);
		stroke: none;
	}
	.sig {
		fill: none;
		stroke-width: 1.6;
		stroke-linejoin: round;
	}
	.sig.clk {
		stroke: var(--cyan);
	}
	.sig.mosi {
		stroke: var(--phosphor);
	}
	.sig.cs {
		stroke: var(--muted);
		stroke-width: 1.4;
	}
	.cursor {
		stroke: var(--phosphor);
		stroke-width: 1.4;
		opacity: 0.85;
		transition: x1 220ms var(--ease-out), x2 220ms var(--ease-out);
	}

	/* ---- Readout + transport ---------------------------------------------- */
	.readbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.reads {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}
	.rd {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.rk {
		color: var(--faint);
		min-width: 3.6rem;
	}
	.rv {
		font-size: 0.8125rem;
		color: var(--text);
		letter-spacing: 0.02em;
	}
	.lb {
		color: var(--faint);
	}
	.lb.on {
		color: var(--phosphor);
	}
	.eq {
		color: var(--faint);
		margin-inline: 0.15rem;
	}
	.cnt {
		color: var(--muted);
		margin-left: 0.3rem;
	}
	.transport {
		display: inline-flex;
		gap: 0.4rem;
	}
	.tb {
		font-size: 0.6875rem;
		letter-spacing: 0.12em;
		color: var(--muted);
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.tb:hover:not(:disabled) {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
	}
	.tb:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.tb.on {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
	}
	.benchlink {
		align-self: flex-start;
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
		color: var(--muted);
		border-bottom: 1px solid var(--line);
		padding-bottom: 1px;
		transition: color 140ms var(--ease-out);
	}
	.benchlink:hover {
		color: var(--phosphor);
	}
</style>
