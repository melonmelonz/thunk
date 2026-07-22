<script lang="ts">
	// Frame Budget (M5): the lesson's arithmetic as a dial. Turn the bus clock and
	// read whether the loop closes inside its 1/30-second deadline; flip the window
	// trick off to watch per-pixel aim blow the budget. Keyboard-first: the clock is
	// a native range (arrows step it), the addressing is a two-button radiogroup.
	import {
		bytesPerFrame,
		bitsPerFrame,
		achievableFps,
		meetsDeadline,
		minClockHz,
		toMHz,
		commas,
		fpsLabel,
		TARGET_FPS,
		type Addressing
	} from './frame-budget';

	let { reducedMotion = false }: { reducedMotion?: boolean } = $props();

	// The clock in MHz (the knob). Default 30 MHz - which pointedly does NOT buy
	// 30 fps, the lesson's aha; the learner pushes past ~37 to cross.
	let clockMHz = $state(30);
	let addressing = $state<Addressing>('window');

	const clockHz = $derived(clockMHz * 1_000_000);
	const bpf = $derived(bytesPerFrame(addressing));
	const bitsF = $derived(bitsPerFrame(addressing));
	const fps = $derived(achievableFps(clockHz, addressing));
	const meets = $derived(meetsDeadline(clockHz, addressing));
	const needMHz = $derived(toMHz(minClockHz(addressing)));
	// The bar fills toward the 30 fps target; full + phosphor means the loop closes.
	const fill = $derived(Math.min(fps / TARGET_FPS, 1) * 100);
</script>

<div class="fb" role="group" aria-label="Frame budget: turn the bus clock and see if the loop closes">
	<div class="dial">
		<div class="hero">
			<span class="hlabel label">Achievable</span>
			<span class="hval mono tnum" class:miss={!meets}>{fpsLabel(fps)}<span class="unit">FPS</span></span>
		</div>
		<span class="verdict mono" class:on={meets} aria-live="polite">
			{meets ? 'MEETS 30 FPS' : 'MISSES 30 FPS'}
		</span>
	</div>

	<!-- The budget bar: fps toward the 30 fps deadline. Full + lit = in time. -->
	<div
		class="bar"
		class:instant={reducedMotion}
		role="meter"
		aria-valuemin={0}
		aria-valuemax={TARGET_FPS}
		aria-valuenow={Math.min(Math.floor(fps), TARGET_FPS)}
		aria-label="frames per second toward the 30 fps deadline"
	>
		<span class="fill" class:miss={!meets} style="width:{fill}%"></span>
		<span class="deadline" aria-hidden="true"></span>
	</div>

	<div class="clock">
		<label class="clabel label" for="fb-clock">Bus clock</label>
		<input
			id="fb-clock"
			class="range"
			type="range"
			min="4"
			max="80"
			step="1"
			bind:value={clockMHz}
			aria-valuetext={`${clockMHz} megahertz`}
		/>
		<output class="cval mono tnum" for="fb-clock">{clockMHz} MHz</output>
	</div>

	<div class="readout" aria-live="polite">
		<div class="rrow">
			<span class="rk label">Bytes / frame</span>
			<span class="rv mono tnum">{commas(bpf)}</span>
		</div>
		<div class="rrow">
			<span class="rk label">Bits / frame</span>
			<span class="rv mono tnum">{commas(bitsF)}</span>
		</div>
		<div class="rrow">
			<span class="rk label">Needs</span>
			<span class="rv mono tnum">&ge; {needMHz} MHz</span>
		</div>
	</div>

	<div class="addr" role="radiogroup" aria-label="how the driver aims each pixel">
		<button
			class="opt"
			class:on={addressing === 'window'}
			role="radio"
			aria-checked={addressing === 'window'}
			onclick={() => (addressing = 'window')}
		>
			<span class="omark" aria-hidden="true"></span>
			<span class="otext">Window once <span class="ohint">153,600 B</span></span>
		</button>
		<button
			class="opt"
			class:on={addressing === 'per-pixel'}
			role="radio"
			aria-checked={addressing === 'per-pixel'}
			onclick={() => (addressing = 'per-pixel')}
		>
			<span class="omark" aria-hidden="true"></span>
			<span class="otext">Aim every pixel <span class="ohint">768,000 B</span></span>
		</button>
	</div>
</div>

<style>
	.fb {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 1.1rem 1.2rem 1.2rem;
	}

	/* ---- Hero + verdict ---------------------------------------------------- */
	.dial {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}
	.hero {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}
	.hlabel {
		color: var(--faint);
	}
	.hval {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-size: 2.4rem;
		line-height: 1;
		color: var(--phosphor);
		letter-spacing: -0.01em;
		transition: color 200ms var(--ease-out);
	}
	.hval.miss {
		color: var(--text);
	}
	.hval .unit {
		font-size: 0.75rem;
		letter-spacing: 0.14em;
		color: var(--faint);
	}
	.verdict {
		flex: none;
		font-size: 0.6875rem;
		letter-spacing: 0.16em;
		color: var(--muted);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.34rem 0.7rem;
		transition:
			color 180ms var(--ease-out),
			border-color 180ms var(--ease-out),
			background 180ms var(--ease-out);
	}
	.verdict.on {
		color: var(--bg);
		background: var(--phosphor);
		border-color: var(--phosphor);
		box-shadow: 0 0 12px var(--phosphor-dim);
	}

	/* ---- The budget bar ---------------------------------------------------- */
	.bar {
		position: relative;
		height: 12px;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		box-shadow: inset 0 1px 2px #05070b;
		overflow: hidden;
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: linear-gradient(90deg, color-mix(in srgb, var(--phosphor) 55%, #0a0e13), var(--phosphor));
		box-shadow: 0 0 10px var(--phosphor-dim);
		transition: width 220ms var(--ease-out);
	}
	.fill.miss {
		background: linear-gradient(90deg, #6b3a3a, var(--err));
		box-shadow: none;
	}
	.bar.instant .fill {
		transition: none;
	}
	/* The deadline sits at the right edge - a full bar is a closed loop. */
	.deadline {
		position: absolute;
		top: 0;
		bottom: 0;
		right: 0;
		width: 2px;
		background: color-mix(in srgb, var(--phosphor) 40%, transparent);
	}

	/* ---- Clock control ----------------------------------------------------- */
	.clock {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.85rem;
	}
	.clabel {
		color: var(--faint);
	}
	.range {
		width: 100%;
		accent-color: var(--phosphor);
		cursor: pointer;
	}
	.range:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 3px;
		border-radius: 2px;
	}
	.cval {
		font-size: 0.9375rem;
		color: var(--text);
		letter-spacing: 0.02em;
		min-width: 4.5rem;
		text-align: right;
	}

	/* ---- Readout ----------------------------------------------------------- */
	.readout {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.15rem 1rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--s2);
		padding: 0.7rem 0.85rem;
	}
	.rrow {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.rk {
		color: var(--faint);
	}
	.rv {
		font-size: 0.875rem;
		color: var(--text);
		letter-spacing: 0.02em;
	}

	/* ---- Addressing toggle ------------------------------------------------- */
	.addr {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		text-align: left;
		transition:
			border-color 140ms var(--ease-out),
			background 140ms var(--ease-out);
	}
	.opt:hover {
		border-color: var(--line-strong);
	}
	.opt:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 2px;
	}
	.opt.on {
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
		background: color-mix(in srgb, var(--phosphor) 8%, var(--s2));
	}
	.omark {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1px solid var(--faint);
		transition:
			border-color 140ms var(--ease-out),
			background 140ms var(--ease-out),
			box-shadow 140ms var(--ease-out);
	}
	.opt.on .omark {
		border-color: var(--phosphor);
		background: var(--phosphor);
		box-shadow: 0 0 8px var(--phosphor-dim);
	}
	.otext {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--muted);
		line-height: 1.3;
	}
	.opt.on .otext {
		color: var(--text);
	}
	.ohint {
		font-size: 0.625rem;
		letter-spacing: 0.04em;
		color: var(--faint);
	}
</style>
