<script lang="ts">
	// Pixel Forge (M4): build a colour the way the panel stores it. Three sliders -
	// red 5 bits, green 6, blue 5 - pack into one 16-bit word; the word splits into
	// the two bytes RAMWR streams, high byte first; and the swatch shows the pixel
	// that lights. Paint the strip and watch the byte count climb: this is exactly
	// the stream the bench pushes, two bytes per pixel.
	import {
		packRgb565,
		hiByte,
		loByte,
		toCss,
		hex2,
		hex4,
		wordBits,
		R_MAX,
		G_MAX,
		B_MAX
	} from './rgb565';

	// Default pure red: 0xF800, whose high byte 0xF8 is the very byte M4 tells you
	// was already in flight toward the panel back in M3.
	let r = $state(31);
	let g = $state(0);
	let b = $state(0);

	const word = $derived(packRgb565(r, g, b));
	const hi = $derived(hiByte(word));
	const lo = $derived(loByte(word));
	const css = $derived(toCss(word));
	const bits = $derived(wordBits(word));

	// Which colour field each of the 16 bits belongs to, MSB first: 5 R, 6 G, 5 B.
	const fields: ('r' | 'g' | 'b')[] = [
		'r',
		'r',
		'r',
		'r',
		'r',
		'g',
		'g',
		'g',
		'g',
		'g',
		'g',
		'b',
		'b',
		'b',
		'b',
		'b'
	];

	// A tiny framebuffer strip you paint with the current colour.
	const STRIP = 8;
	let strip = $state<(number | null)[]>(Array.from({ length: STRIP }, () => null));
	const painted = $derived(strip.filter((p) => p !== null).length);

	function paint(i: number) {
		const next = strip.slice();
		next[i] = word;
		strip = next;
	}
	function clearStrip() {
		strip = Array.from({ length: STRIP }, () => null);
	}
</script>

<div class="forge" role="group" aria-label="Pixel Forge: build an RGB565 colour">
	<div class="top">
		<!-- The sliders. Each field's own range: 0..31, 0..63, 0..31. -->
		<div class="sliders">
			<label class="sl r">
				<span class="sk mono">R</span>
				<input
					type="range"
					min="0"
					max={R_MAX}
					bind:value={r}
					aria-label={`red, 0 to ${R_MAX}`}
				/>
				<span class="sv mono tnum">{r}</span>
			</label>
			<label class="sl g">
				<span class="sk mono">G</span>
				<input
					type="range"
					min="0"
					max={G_MAX}
					bind:value={g}
					aria-label={`green, 0 to ${G_MAX}`}
				/>
				<span class="sv mono tnum">{g}</span>
			</label>
			<label class="sl b">
				<span class="sk mono">B</span>
				<input
					type="range"
					min="0"
					max={B_MAX}
					bind:value={b}
					aria-label={`blue, 0 to ${B_MAX}`}
				/>
				<span class="sv mono tnum">{b}</span>
			</label>
		</div>

		<!-- The pixel that lights. -->
		<div class="swatch" style={`background:${css}`} aria-label={`resulting colour ${hex4(word)}`}>
		</div>
	</div>

	<!-- The 16-bit word, and the two bytes over the bus. -->
	<div class="wordbar" aria-live="polite">
		<span class="wl label">WORD</span>
		<span class="wv mono tnum">{hex4(word)}</span>
		<span class="split">
			<span class="byte">
				<span class="byk mono">byte 1 · high</span>
				<span class="byv mono tnum">0x{hex2(hi)}</span>
			</span>
			<span class="byte">
				<span class="byk mono">byte 2 · low</span>
				<span class="byv mono tnum">0x{hex2(lo)}</span>
			</span>
		</span>
	</div>

	<!-- The bit layout: RRRRR GGGGGG BBBBB, tinted by field. -->
	<div class="bitlayout" aria-hidden="true">
		{#each bits as bit, i (i)}
			<span
				class="bcell {fields[i]}"
				class:on={bit === 1}
				class:gap={i === 5 || i === 11}
			>
				{bit}
			</span>
		{/each}
	</div>
	<div class="fieldkey mono" aria-hidden="true">
		<span class="r">RRRRR</span>
		<span class="g">GGGGGG</span>
		<span class="b">BBBBB</span>
	</div>

	<!-- Paint a few pixels; each one is two bytes RAMWR streams. -->
	<div class="stripwrap">
		<div class="strip" role="group" aria-label="paint the pixel strip with the current colour">
			{#each strip as px, i (i)}
				<button
					class="px"
					class:empty={px === null}
					style={px !== null ? `background:${toCss(px)}` : ''}
					onclick={() => paint(i)}
					aria-label={`paint pixel ${i + 1}`}
				></button>
			{/each}
		</div>
		<div class="stripmeta">
			<span class="sm mono" aria-live="polite">{painted} px · {painted * 2} bytes streamed</span>
			<button class="clr mono" onclick={clearStrip} aria-label="clear the strip">CLEAR</button>
		</div>
	</div>

	<p class="tie mono">These are the two bytes RAMWR streams per pixel &mdash; high byte first.</p>
</div>

<style>
	.forge {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 1.1rem 1.2rem 1.2rem;
		/* channel accents, used only where the subject IS colour */
		--rc: #ff8a8a;
		--gc: #74e08a;
		--bc: #7cc0ff;
	}

	.top {
		display: flex;
		gap: 1rem;
		align-items: stretch;
		flex-wrap: wrap;
	}
	.sliders {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		flex: 1 1 16rem;
		min-width: 12rem;
		justify-content: center;
	}
	.sl {
		display: grid;
		grid-template-columns: 1.2rem 1fr 2.2rem;
		align-items: center;
		gap: 0.6rem;
	}
	.sk {
		font-size: 0.8125rem;
		font-weight: 600;
		text-align: center;
	}
	.sl.r .sk {
		color: var(--rc);
	}
	.sl.g .sk {
		color: var(--gc);
	}
	.sl.b .sk {
		color: var(--bc);
	}
	.sv {
		font-size: 0.8125rem;
		color: var(--muted);
		text-align: right;
	}
	.sl input[type='range'] {
		appearance: none;
		-webkit-appearance: none;
		width: 100%;
		height: 3px;
		border-radius: 2px;
		background: var(--s3);
		outline-offset: 4px;
	}
	.sl input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 20px;
		border-radius: 2px;
		border: 1px solid #0a0e13;
		cursor: grab;
	}
	.sl input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 20px;
		border-radius: 2px;
		border: 1px solid #0a0e13;
		cursor: grab;
	}
	.sl.r input::-webkit-slider-thumb {
		background: var(--rc);
	}
	.sl.g input::-webkit-slider-thumb {
		background: var(--gc);
	}
	.sl.b input::-webkit-slider-thumb {
		background: var(--bc);
	}
	.sl.r input::-moz-range-thumb {
		background: var(--rc);
	}
	.sl.g input::-moz-range-thumb {
		background: var(--gc);
	}
	.sl.b input::-moz-range-thumb {
		background: var(--bc);
	}

	.swatch {
		flex: 0 0 auto;
		width: clamp(5rem, 22vw, 7rem);
		min-height: 5rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px #05070b66;
	}

	/* ---- Word + bytes ------------------------------------------------------ */
	.wordbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--s2);
		padding: 0.55rem 0.75rem;
	}
	.wl {
		color: var(--faint);
	}
	.wv {
		font-size: 1.0625rem;
		color: var(--phosphor);
		letter-spacing: 0.04em;
	}
	.split {
		display: inline-flex;
		gap: 0.75rem;
		margin-left: auto;
	}
	.byte {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		align-items: flex-end;
	}
	.byk {
		font-size: 0.5625rem;
		letter-spacing: 0.04em;
		color: var(--faint);
	}
	.byv {
		font-size: 0.875rem;
		color: var(--text);
	}

	/* ---- Bit layout -------------------------------------------------------- */
	.bitlayout {
		display: flex;
		gap: 2px;
		justify-content: center;
		flex-wrap: nowrap;
	}
	.bcell {
		flex: 1 1 0;
		min-width: 0;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.28rem 0;
		background: var(--s2);
	}
	.bcell.gap {
		margin-left: 0.4rem;
	}
	.bcell.r.on {
		color: #0a0e13;
		background: var(--rc);
		border-color: var(--rc);
	}
	.bcell.g.on {
		color: #0a0e13;
		background: var(--gc);
		border-color: var(--gc);
	}
	.bcell.b.on {
		color: #0a0e13;
		background: var(--bc);
		border-color: var(--bc);
	}
	.fieldkey {
		display: flex;
		justify-content: center;
		gap: 0.4rem;
		font-size: 0.625rem;
		letter-spacing: 0.24em;
	}
	.fieldkey .r {
		color: var(--rc);
	}
	.fieldkey .g {
		color: var(--gc);
	}
	.fieldkey .b {
		color: var(--bc);
	}

	/* ---- Strip ------------------------------------------------------------- */
	.stripwrap {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.strip {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 4px;
	}
	.px {
		aspect-ratio: 1;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		padding: 0;
		transition: transform 120ms var(--ease-out);
	}
	.px.empty {
		background-image: linear-gradient(45deg, var(--s2) 46%, var(--line) 50%, var(--s2) 54%);
	}
	.px:hover {
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.px:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 1px;
	}
	.stripmeta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}
	.sm {
		font-size: 0.6875rem;
		color: var(--muted);
	}
	.clr {
		font-size: 0.625rem;
		letter-spacing: 0.12em;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.3rem 0.6rem;
		background: var(--s2);
	}
	.clr:hover {
		color: var(--muted);
		border-color: #24303e;
	}
	.clr:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 1px;
	}

	.tie {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--faint);
		margin: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.px {
			transition: none;
		}
	}
</style>
