<script lang="ts">
	// Bit Lab (M0): eight instrument toggles, MSB..LSB. The same byte, read out
	// four ways - binary, decimal, hex, ASCII - and a target to build. The lesson
	// says "65 stands for A"; the target proves it. Keyboard-first: each switch is
	// a real <button> (space/enter toggles), tab order runs MSB -> LSB.
	import { toBin, groupBin, toHex, asciiInfo } from './format';

	// Target: 65 = 'A', the byte the lesson names. Lights MATCH when built.
	const TARGET = 0x41;

	// bits[0] is the most significant bit (place value 128); bits[7] is bit 0.
	let bits = $state<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);

	const value = $derived(bits.reduce((acc, b) => (acc << 1) | b, 0));
	const bin = $derived(toBin(value));
	const ascii = $derived(asciiInfo(value));
	const matched = $derived(value === TARGET);

	// Place value of each column, MSB first: 128, 64, ... 1.
	const places = [128, 64, 32, 16, 8, 4, 2, 1];

	function toggle(i: number) {
		bits[i] = bits[i] ? 0 : 1;
	}
	function clear() {
		bits = [0, 0, 0, 0, 0, 0, 0, 0];
	}
</script>

<div class="bitlab" role="group" aria-label="Bit Lab: an eight-bit byte you can toggle">
	<div class="switches" role="group" aria-label="eight bit switches, most significant first">
		{#each bits as bit, i (i)}
			<div class="col">
				<span class="place mono tnum" aria-hidden="true">{places[i]}</span>
				<button
					class="sw"
					class:on={bit === 1}
					role="switch"
					aria-checked={bit === 1}
					aria-label={`bit ${7 - i}, place value ${places[i]}`}
					onclick={() => toggle(i)}
				>
					<span class="track" aria-hidden="true"><span class="thumb"></span></span>
					<span class="digit mono tnum" aria-hidden="true">{bit}</span>
				</button>
				<span class="ix mono tnum" aria-hidden="true">b{7 - i}</span>
			</div>
		{/each}
	</div>

	<div class="readout" aria-live="polite">
		<div class="row">
			<span class="rk label">BIN</span>
			<span class="rv mono tnum">{groupBin(bin)}</span>
		</div>
		<div class="row">
			<span class="rk label">DEC</span>
			<span class="rv mono tnum">{value}</span>
		</div>
		<div class="row">
			<span class="rk label">HEX</span>
			<span class="rv mono tnum">{toHex(value)}</span>
		</div>
		<div class="row">
			<span class="rk label">CHR</span>
			<span class="rv mono char" class:np={!ascii.printable}>{ascii.label}</span>
		</div>
	</div>

	<div class="target">
		<div class="tinfo">
			<span class="tk label">Target</span>
			<span class="tv mono tnum">{toHex(TARGET)} · {TARGET} · &lsquo;A&rsquo;</span>
		</div>
		<span class="match mono" class:on={matched} aria-live="polite">
			{matched ? 'MATCH' : '— — —'}
		</span>
		<button class="clr mono" onclick={clear} aria-label="clear all bits to zero">CLEAR</button>
	</div>
</div>

<style>
	.bitlab {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 1.1rem 1.2rem 1.2rem;
	}

	/* ---- The eight switches ------------------------------------------------ */
	.switches {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: clamp(0.25rem, 1.5vw, 0.6rem);
	}
	.col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}
	.place {
		font-size: 0.5625rem;
		letter-spacing: 0.02em;
		color: var(--faint);
	}
	.ix {
		font-size: 0.5625rem;
		letter-spacing: 0.06em;
		color: var(--faint);
	}
	.sw {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 0;
		width: 100%;
	}
	.track {
		position: relative;
		width: clamp(1.4rem, 4.5vw, 1.9rem);
		height: clamp(2.4rem, 8vw, 3.1rem);
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--s2);
		box-shadow: inset 0 1px 2px #05070b;
		transition:
			border-color 160ms var(--ease-out),
			background 160ms var(--ease-out);
	}
	.thumb {
		position: absolute;
		left: 3px;
		right: 3px;
		height: 44%;
		border-radius: 2px;
		background: linear-gradient(#232f3c, #172029);
		border: 1px solid #2a3746;
		/* Off: thumb rests at the bottom of the track (44% tall + 3px inset). */
		top: calc(56% - 3px);
		transition:
			top 200ms var(--ease-out),
			background 200ms var(--ease-out),
			border-color 200ms var(--ease-out),
			box-shadow 200ms var(--ease-out);
	}
	.sw.on .thumb {
		/* On: thumb throws to the top and lights phosphor. */
		top: 3px;
		background: linear-gradient(#3df0a8, #1f9e6c);
		border-color: color-mix(in srgb, var(--phosphor) 70%, #0a0e13);
		box-shadow: 0 0 10px var(--phosphor-dim);
	}
	.sw.on .track {
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
		background: color-mix(in srgb, var(--phosphor) 8%, var(--s2));
	}
	.sw:hover .track {
		border-color: var(--line-strong);
	}
	.sw:focus-visible {
		outline: none;
	}
	.sw:focus-visible .track {
		outline: 1px solid var(--phosphor);
		outline-offset: 2px;
	}
	.digit {
		font-size: 0.8125rem;
		color: var(--faint);
		transition: color 160ms var(--ease-out);
	}
	.sw.on .digit {
		color: var(--phosphor);
	}

	/* ---- Readout ----------------------------------------------------------- */
	.readout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.15rem 1rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--s2);
		padding: 0.7rem 0.85rem;
	}
	.row {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.rk {
		color: var(--faint);
		min-width: 2.2rem;
	}
	.rv {
		font-size: 0.9375rem;
		color: var(--text);
		letter-spacing: 0.02em;
	}
	.rv.char {
		color: var(--phosphor);
		font-size: 1.0625rem;
	}
	.rv.char.np {
		color: var(--muted);
		font-size: 0.8125rem;
	}

	/* ---- Target + match ---------------------------------------------------- */
	.target {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}
	.tinfo {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex: 1;
		min-width: 0;
	}
	.tk {
		color: var(--faint);
	}
	.tv {
		font-size: 0.8125rem;
		color: var(--muted);
		letter-spacing: 0.02em;
	}
	.match {
		font-size: 0.6875rem;
		letter-spacing: 0.18em;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.3rem 0.7rem;
		transition:
			color 160ms var(--ease-out),
			border-color 160ms var(--ease-out),
			background 160ms var(--ease-out);
	}
	.match.on {
		color: var(--bg);
		background: var(--phosphor);
		border-color: var(--phosphor);
		box-shadow: 0 0 12px var(--phosphor-dim);
	}
	.clr {
		font-size: 0.625rem;
		letter-spacing: 0.12em;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.3rem 0.6rem;
		background: var(--s2);
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.clr:hover {
		color: var(--muted);
		border-color: var(--line-strong);
	}
</style>
