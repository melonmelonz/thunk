<script lang="ts">
	// Volatile Memory (M1): the desk-versus-shelf lesson, made physical. Two rows
	// of cells - MEMORY (RAM) and STORAGE (disk) - both holding the bytes of the
	// word DOOM. Cut power and the memory row goes dark and empty while storage
	// keeps every byte; restore power and memory stays blank until you write it
	// again. What survives a power loss is the whole point, and here you feel it.
	import { initial, setPower, loadFromStorage, memoryFull, type VState } from './volatile';
	import { asciiInfo } from './format';

	// "DOOM" - the course's finale, spelled in four bytes so the character row
	// reads as a word and the loss is legible.
	const WORD = [0x44, 0x4f, 0x4f, 0x4d];
	let s = $state<VState>(loadFromStorage(initial(WORD)));

	const powered = $derived(s.power);
	const full = $derived(memoryFull(s));
	const status = $derived(
		!powered
			? 'Power lost. The memory row cleared; storage kept every byte.'
			: full
				? 'Powered. Memory holds the word, copied up from storage.'
				: 'Powered, but memory is empty. Load it from storage to fill the desk.'
	);

	function hex(b: number): string {
		return b.toString(16).toUpperCase().padStart(2, '0');
	}
	function chr(b: number): string {
		const a = asciiInfo(b);
		return a.printable ? a.label : '·';
	}

	function togglePower() {
		s = setPower(s, !s.power);
	}
	function load() {
		s = loadFromStorage(s);
	}
</script>

<div class="volatile" role="group" aria-label="Volatile Memory: what survives a power loss">
	<div class="rows">
		<!-- MEMORY: volatile. Cells blank the instant power drops. -->
		<div class="rowblock">
			<div class="rowhead">
				<span class="rlabel mono">MEMORY</span>
				<span class="rsub label">RAM · the desk</span>
			</div>
			<div class="cells" class:dark={!powered}>
				{#each s.memory as cell, i (i)}
					<div class="cell" class:filled={cell !== null} class:empty={cell === null}>
						<span class="hex mono tnum">{cell === null ? '——' : hex(cell)}</span>
						<span class="char mono">{cell === null ? '' : chr(cell)}</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- STORAGE: persistent. Untouched by power. -->
		<div class="rowblock">
			<div class="rowhead">
				<span class="rlabel mono">STORAGE</span>
				<span class="rsub label">disk · the shelf</span>
			</div>
			<div class="cells persist">
				{#each s.storage as byte, i (i)}
					<div class="cell filled">
						<span class="hex mono tnum">{hex(byte)}</span>
						<span class="char mono">{chr(byte)}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="controls">
		<button
			class="power"
			class:on={powered}
			role="switch"
			aria-checked={powered}
			aria-label="power"
			onclick={togglePower}
		>
			<span class="led" aria-hidden="true"></span>
			<span class="ptext mono">{powered ? 'POWER ON' : 'POWER OFF'}</span>
		</button>
		<button
			class="load mono"
			onclick={load}
			disabled={!powered || full}
			aria-label="load the word from storage into memory"
		>
			LOAD FROM STORAGE
		</button>
	</div>

	<p class="status" aria-live="polite">{status}</p>
</div>

<style>
	.volatile {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 1.1rem 1.2rem 1.2rem;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.rowhead {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 0.45rem;
	}
	.rlabel {
		font-size: 0.6875rem;
		letter-spacing: 0.16em;
		color: var(--muted);
	}
	.rsub {
		color: var(--faint);
	}

	.cells {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}
	.cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--s2);
		padding: 0.55rem 0.4rem 0.45rem;
		box-shadow: inset 0 1px 2px #05070b;
		transition:
			color 260ms var(--ease-out),
			border-color 260ms var(--ease-out),
			background 260ms var(--ease-out),
			opacity 260ms var(--ease-out);
	}
	.cell .hex {
		font-size: 0.9375rem;
		letter-spacing: 0.06em;
	}
	.cell .char {
		font-size: 0.75rem;
		min-height: 0.9rem;
	}
	.cell.filled .hex {
		color: var(--phosphor);
	}
	.cell.filled .char {
		color: var(--muted);
	}
	.cell.filled {
		border-color: color-mix(in srgb, var(--phosphor) 30%, var(--line));
		background: color-mix(in srgb, var(--phosphor) 7%, var(--s2));
	}
	.cell.empty .hex {
		color: var(--faint);
	}
	/* The persistent row reads in cyan, not phosphor - a different substance. */
	.cells.persist .cell.filled {
		border-color: color-mix(in srgb, var(--cyan) 26%, var(--line));
		background: color-mix(in srgb, var(--cyan) 6%, var(--s2));
	}
	.cells.persist .cell.filled .hex {
		color: var(--cyan);
	}
	/* Power lost: the whole memory row dims, underscoring that it went dark. */
	.cells.dark .cell {
		opacity: 0.55;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.power {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--s2);
		padding: 0.5rem 0.85rem;
		transition:
			border-color 160ms var(--ease-out),
			background 160ms var(--ease-out);
	}
	.led {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--s3);
		border: 1px solid var(--line);
		transition:
			background 160ms var(--ease-out),
			box-shadow 160ms var(--ease-out);
	}
	.power.on .led {
		background: var(--phosphor);
		border-color: var(--phosphor);
		box-shadow: 0 0 8px var(--phosphor-dim);
	}
	.ptext {
		font-size: 0.6875rem;
		letter-spacing: 0.12em;
		color: var(--muted);
	}
	.power.on .ptext {
		color: var(--phosphor);
	}
	.power.on {
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.power:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 2px;
	}
	.load {
		font-size: 0.625rem;
		letter-spacing: 0.12em;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.45rem 0.7rem;
		background: var(--s2);
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.load:hover:not(:disabled) {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.load:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.load:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 2px;
	}

	.status {
		font-size: 0.75rem;
		line-height: 1.55;
		color: var(--muted);
		margin: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.cell,
		.led,
		.power,
		.load {
			transition: none;
		}
	}
</style>
