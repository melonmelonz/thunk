<script lang="ts">
	// Diff Reader (M6): a real unified diff you read the way a maintainer reads
	// yours - `-` removed, `+` added, space unchanged, `@@` telling you where in
	// the file you are. It renders the exact patch the lesson walks (a set_pixel
	// gaining a bounds check), with both line-number gutters, and a quiet reveal
	// that explains what the change actually does. Content only: no live git.
	import { parseDiff, diffStat, SAMPLE_DIFF, type DiffLine } from './diff';

	const lines: DiffLine[] = parseDiff(SAMPLE_DIFF);
	const stat = diffStat(lines);
	let explained = $state(false);

	function gutter(n: number | null): string {
		return n === null ? '' : String(n);
	}
	function marker(kind: DiffLine['kind']): string {
		return kind === 'add' ? '+' : kind === 'del' ? '-' : kind === 'context' ? ' ' : '';
	}
</script>

<div class="diff" role="group" aria-label="Diff Reader: a unified diff, read line by line">
	<div class="filebar mono">
		<span class="fname">src/framebuffer.rs</span>
		<span class="stat">
			<span class="plus">+{stat.added}</span>
			<span class="minus">&minus;{stat.removed}</span>
		</span>
	</div>

	<div class="patch mono" aria-label="unified diff of src/framebuffer.rs">
		{#each lines as line, i (i)}
			{#if line.kind === 'file-old' || line.kind === 'file-new'}
				<div class="drow fileln">
					<span class="gut old" aria-hidden="true"></span>
					<span class="gut new" aria-hidden="true"></span>
					<span class="mk" aria-hidden="true"></span>
					<code class="code">{line.text}</code>
				</div>
			{:else if line.kind === 'hunk'}
				<div class="drow hunkln">
					<span class="gut old" aria-hidden="true">&hellip;</span>
					<span class="gut new" aria-hidden="true">&hellip;</span>
					<span class="mk" aria-hidden="true"></span>
					<code class="code">{line.text}</code>
				</div>
			{:else}
				<div
					class="drow {line.kind}"
					class:emph={explained && (line.kind === 'add' || line.kind === 'del')}
				>
					<span class="gut old mono tnum">{gutter(line.oldNo)}</span>
					<span class="gut new mono tnum">{gutter(line.newNo)}</span>
					<span class="mk" aria-hidden="true">{marker(line.kind)}</span>
					<code class="code">{line.text || ' '}</code>
				</div>
			{/if}
		{/each}
	</div>

	<div class="revealbar">
		<button
			class="reveal mono"
			aria-expanded={explained}
			aria-controls="diff-explain"
			onclick={() => (explained = !explained)}
		>
			{explained ? '▾' : '▸'} What this changes
		</button>
	</div>

	{#if explained}
		<div class="explain" id="diff-explain">
			<p>
				The one removed line and the line under it are the <strong>same function</strong> with one difference:
				a <code>-&gt; bool</code> return type, so <code>set_pixel</code> can now report whether it wrote.
			</p>
			<p>
				The three added lines below it are the fix: if <code>x</code> or <code>y</code> falls off
				the frame, return <code>false</code> and write nothing. The index arithmetic and the write
				are unchanged context. A final <code>true</code> reports the write that did happen.
			</p>
			<p class="net">
				Net: out-of-range writes are refused, in-range behaviour is identical, and callers can now
				tell which happened.
			</p>
		</div>
	{/if}
</div>

<style>
	.diff {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 0.9rem 1rem 1rem;
	}

	.filebar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		font-size: 0.75rem;
	}
	.fname {
		color: var(--text);
		letter-spacing: 0.02em;
	}
	.stat {
		display: inline-flex;
		gap: 0.5rem;
		font-size: 0.6875rem;
	}
	.plus {
		color: var(--phosphor);
	}
	.minus {
		color: var(--err);
	}

	/* ---- The patch --------------------------------------------------------- */
	.patch {
		border: 1px solid var(--line);
		border-radius: 3px;
		background: #080b10;
		overflow-x: auto;
		padding: 0.4rem 0;
		font-size: 0.75rem;
		line-height: 1.7;
	}
	.drow {
		display: grid;
		grid-template-columns: 2.4rem 2.4rem 1rem 1fr;
		align-items: baseline;
		white-space: pre;
	}
	.gut {
		text-align: right;
		padding-right: 0.5rem;
		font-size: 0.625rem;
		color: var(--faint);
		user-select: none;
	}
	.gut.new {
		border-right: 1px solid var(--line-soft);
		padding-right: 0.55rem;
	}
	.mk {
		text-align: center;
		color: var(--faint);
	}
	.code {
		color: var(--muted);
		padding-right: 0.8rem;
	}

	.drow.add {
		background: color-mix(in srgb, var(--phosphor) 8%, transparent);
	}
	.drow.add .mk {
		color: var(--phosphor);
	}
	.drow.add .code {
		color: color-mix(in srgb, var(--phosphor) 55%, var(--text));
	}
	.drow.del {
		background: color-mix(in srgb, var(--err) 9%, transparent);
	}
	.drow.del .mk {
		color: var(--err);
	}
	.drow.del .code {
		color: color-mix(in srgb, var(--err) 45%, var(--text));
	}
	.drow.emph {
		box-shadow: inset 2px 0 0 currentColor;
	}
	.drow.add.emph {
		color: var(--phosphor);
	}
	.drow.del.emph {
		color: var(--err);
	}
	.fileln .code {
		color: var(--faint);
	}
	.hunkln {
		background: color-mix(in srgb, var(--cyan) 7%, transparent);
	}
	.hunkln .code,
	.hunkln .gut {
		color: var(--cyan);
	}

	/* ---- Reveal ------------------------------------------------------------ */
	.revealbar {
		display: flex;
	}
	.reveal {
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
		color: var(--muted);
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		padding: 0.4rem 0.7rem;
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.reveal:hover {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.reveal:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 1px;
	}
	.explain {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		border: 1px solid var(--line);
		border-left: 2px solid color-mix(in srgb, var(--phosphor) 45%, var(--line));
		border-radius: 3px;
		background: var(--s2);
		padding: 0.75rem 0.9rem;
		font-size: 0.8125rem;
		line-height: 1.6;
		color: var(--muted);
	}
	.explain :global(strong) {
		color: var(--text);
		font-weight: 600;
	}
	.explain :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
		color: var(--text);
		background: var(--s1);
		border: 1px solid var(--line);
		border-radius: 3px;
		padding: 0.02em 0.3em;
	}
	.explain .net {
		color: var(--text);
	}
</style>
