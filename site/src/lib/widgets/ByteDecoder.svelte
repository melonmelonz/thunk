<script lang="ts">
	// Byte Decoder (M0): entry-first, the mirror image of the Bit Lab's
	// switch-first. Type a value in binary, decimal, or hex - or scrub the dial -
	// and watch the SAME byte land in all four readings plus the character it
	// stands for. Where the Bit Lab proves "a byte is eight switches," this proves
	// "a byte is one number wearing four faces, and the letter is just agreement."
	import { toBin, groupBin, toHex, asciiInfo } from './format';
	import { parseInBase, inBase, baseName, type Base } from './byte-decode';

	// No props: like the Bit Lab, this widget has no motion to gate, so it reads
	// `prefers-reduced-motion` through CSS only. Extra props passed by the lesson
	// hydrator (reducedMotion) are harmlessly ignored.

	// 65 = 'A': the byte the M0 lessons keep returning to. Start here so the
	// character readout shows something meaningful on arrival.
	let value = $state(65);
	let base = $state<Base>(10);
	// The text in the entry field, kept in sync with `value` except while the
	// learner is mid-type with an invalid/partial entry.
	let entry = $state(inBase(65, 10));
	let note = $state<string | null>(null);

	const bin = $derived(toBin(value));
	const ascii = $derived(asciiInfo(value));
	const bits = $derived(bin.split('').map(Number));
	const places = [128, 64, 32, 16, 8, 4, 2, 1];

	function resync() {
		entry = inBase(value, base);
		note = null;
	}
	function setBase(b: Base) {
		base = b;
		resync();
	}
	function onEntry(e: Event) {
		const text = (e.target as HTMLInputElement).value;
		entry = text;
		const r = parseInBase(text, base);
		if (r.value !== null) {
			value = r.value;
			note = null;
		} else {
			note =
				r.reason === 'empty'
					? null
					: r.reason === 'range'
						? 'a byte only holds 0 to 255'
						: `not a ${baseName(base)} digit`;
		}
	}
	function onScrub(e: Event) {
		value = Number((e.target as HTMLInputElement).value);
		resync();
	}
	const bases: Base[] = [2, 10, 16];
	const baseLabel: Record<Base, string> = { 2: 'BIN', 10: 'DEC', 16: 'HEX' };
	const prefix: Record<Base, string> = { 2: '0b', 10: '', 16: '0x' };
</script>

<div class="decoder" role="group" aria-label="Byte Decoder: enter a value and read it four ways">
	<!-- Entry: a base toggle, a typed field interpreted in that base, and a dial. -->
	<div class="entrybar">
		<div class="basetoggle" role="group" aria-label="entry base">
			{#each bases as b (b)}
				<button
					class="bt mono"
					class:on={base === b}
					role="radio"
					aria-checked={base === b}
					aria-label={`enter in ${baseName(b)}`}
					onclick={() => setBase(b)}>{baseLabel[b]}</button
				>
			{/each}
		</div>
		<label class="field mono">
			{#if prefix[base]}<span class="pfx" aria-hidden="true">{prefix[base]}</span>{/if}
			<input
				class="entry mono tnum"
				type="text"
				value={entry}
				oninput={onEntry}
				onblur={resync}
				inputmode={base === 10 ? 'numeric' : 'text'}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				aria-label={`value in ${baseName(base)}`}
			/>
		</label>
	</div>

	<label class="dial-ctl">
		<span class="ck label">Dial</span>
		<input
			class="dial"
			type="range"
			min="0"
			max="255"
			value={value}
			oninput={onScrub}
			aria-label="scrub byte value 0 to 255"
		/>
	</label>

	<p class="note mono" aria-live="polite">{note ?? ''}</p>

	<!-- Read-only bit strip: the byte as eight lamps, MSB first. Non-interactive
	     on purpose - the Bit Lab is where you flip; here you watch. -->
	<div class="bitstrip" aria-hidden="true">
		{#each bits as bit, i (i)}
			<div class="lamp-col">
				<span class="place mono tnum">{places[i]}</span>
				<span class="lamp mono" class:on={bit === 1}>{bit}</span>
			</div>
		{/each}
	</div>

	<!-- The four faces of the byte. -->
	<div class="readout" aria-live="polite">
		<div class="row" class:active={base === 2}>
			<span class="rk label">BIN</span>
			<span class="rv mono tnum">{groupBin(bin)}</span>
		</div>
		<div class="row" class:active={base === 10}>
			<span class="rk label">DEC</span>
			<span class="rv mono tnum">{value}</span>
		</div>
		<div class="row" class:active={base === 16}>
			<span class="rk label">HEX</span>
			<span class="rv mono tnum">{toHex(value)}</span>
		</div>
		<div class="row">
			<span class="rk label">CHR</span>
			<span class="rv mono char" class:np={!ascii.printable}>{ascii.label}</span>
		</div>
	</div>
</div>

<style>
	.decoder {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 1.1rem 1.2rem 1.2rem;
	}

	/* ---- Entry ------------------------------------------------------------- */
	.entrybar {
		display: flex;
		align-items: stretch;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.basetoggle {
		display: inline-flex;
		border: 1px solid var(--line);
		border-radius: 3px;
		overflow: hidden;
		background: var(--s2);
	}
	.bt {
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		color: var(--faint);
		padding: 0.4rem 0.7rem;
		border: none;
		border-right: 1px solid var(--line);
		background: none;
		transition:
			color 140ms var(--ease-out),
			background 140ms var(--ease-out);
	}
	.bt:last-child {
		border-right: none;
	}
	.bt:hover {
		color: var(--muted);
	}
	.bt.on {
		color: var(--phosphor);
		background: color-mix(in srgb, var(--phosphor) 10%, var(--s2));
	}
	.bt:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: -1px;
	}
	.field {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		flex: 1 1 8rem;
		min-width: 6rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--s2);
		padding: 0.35rem 0.6rem;
	}
	.field:focus-within {
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.pfx {
		color: var(--faint);
		font-size: 0.8125rem;
	}
	.entry {
		flex: 1;
		width: 100%;
		min-width: 0;
		background: none;
		border: none;
		outline: none;
		color: var(--phosphor);
		font-size: 0.9375rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.dial-ctl {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.ck {
		color: var(--faint);
	}
	.dial {
		flex: 1;
		appearance: none;
		-webkit-appearance: none;
		height: 3px;
		border-radius: 2px;
		background: var(--s3);
		outline-offset: 4px;
	}
	.dial::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 22px;
		border-radius: 2px;
		background: linear-gradient(#3df0a8, #1f9e6c);
		border: 1px solid color-mix(in srgb, var(--phosphor) 60%, #0a0e13);
		box-shadow: 0 0 8px var(--phosphor-dim);
		cursor: grab;
	}
	.dial::-moz-range-thumb {
		width: 14px;
		height: 22px;
		border-radius: 2px;
		background: linear-gradient(#3df0a8, #1f9e6c);
		border: 1px solid color-mix(in srgb, var(--phosphor) 60%, #0a0e13);
		box-shadow: 0 0 8px var(--phosphor-dim);
		cursor: grab;
	}

	.note {
		font-size: 0.6875rem;
		letter-spacing: 0.02em;
		color: var(--err);
		min-height: 0.9rem;
		margin: -0.3rem 0 0;
	}

	/* ---- Bit strip --------------------------------------------------------- */
	.bitstrip {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: clamp(0.2rem, 1.4vw, 0.5rem);
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--s2);
		padding: 0.6rem 0.7rem;
	}
	.lamp-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		min-width: 0;
	}
	.place {
		font-size: 0.5625rem;
		color: var(--faint);
	}
	.lamp {
		width: 100%;
		text-align: center;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.2rem 0;
		background: var(--s1);
		transition:
			color 160ms var(--ease-out),
			border-color 160ms var(--ease-out),
			background 160ms var(--ease-out);
	}
	.lamp.on {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
		background: color-mix(in srgb, var(--phosphor) 10%, var(--s1));
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
		border-radius: 2px;
		padding: 0.12rem 0.3rem;
		margin: 0 -0.3rem;
	}
	.row.active {
		background: color-mix(in srgb, var(--phosphor) 8%, transparent);
	}
	.rk {
		color: var(--faint);
		min-width: 2.2rem;
	}
	.row.active .rk {
		color: var(--phosphor);
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
</style>
