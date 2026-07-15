<script lang="ts">
	import type { Check } from '$lib/content';
	import { grade } from '$lib/grade';
	import { xp } from '$lib/xp.svelte';

	let { check, n }: { check: Check; n: number } = $props();
	const label = $derived(check.kind === 'choice' ? 'Multiple choice' : 'Short answer');

	let picked = $state(-1);
	let text = $state('');
	let verdict = $state<'idle' | 'pass' | 'fail' | 'empty'>('idle');

	// Passed state is the store's, so it survives reload and a passed check keeps
	// its tick. A previously-passed check shows PASS even before the reader grades.
	const passed = $derived(xp.isPassed(check.id));
	const shown = $derived(verdict === 'idle' && passed ? 'pass' : verdict);

	function onGrade() {
		const res = check.kind === 'choice' ? { picked } : { text };
		const r = grade(check, res);
		if (r === null) {
			verdict = 'empty';
			return;
		}
		verdict = r ? 'pass' : 'fail';
		// The store records the attempt (for first-try credit) and, on a pass,
		// awards XP idempotently + settles lesson/module/achievements.
		xp.gradeCheck(check, r);
	}

	const emptyMsg = $derived(
		check.kind === 'choice' ? 'PICK AN ANSWER FIRST' : 'TYPE AN ANSWER FIRST'
	);
</script>

<article class="check" class:passed>
	<div class="chead">
		<span class="cn tnum" aria-hidden="true">{String(n).padStart(2, '0')}</span>
		<span class="ck label">{label}</span>
		<span class="cid mono">
			{#if passed}<span class="tick" aria-hidden="true"></span>{/if}{check.id}
		</span>
	</div>
	<p class="prompt">{check.prompt}</p>

	{#if check.kind === 'choice'}
		<fieldset class="options">
			<legend class="sr-only">{check.prompt}</legend>
			{#each check.options as option, i (i)}
				<label class="opt" class:on={picked === i}>
					<input type="radio" name={check.id} value={i} bind:group={picked} />
					<span class="bullet" aria-hidden="true"></span>
					<span class="otext">{option}</span>
				</label>
			{/each}
		</fieldset>
	{:else}
		<div class="field" class:on={text.length > 0}>
			<span class="caret" aria-hidden="true">&gt;</span>
			<input
				class="input mono"
				type="text"
				bind:value={text}
				placeholder="type your answer"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				onkeydown={(e) => e.key === 'Enter' && onGrade()}
				aria-label="your answer"
			/>
		</div>
	{/if}

	<div class="actions">
		<button class="grade mono" onclick={onGrade}>GRADE</button>
		<p class="verdict mono" class:pass={shown === 'pass'} class:fail={shown === 'fail'} aria-live="polite">
			{#if shown === 'pass'}PASS{:else if shown === 'fail'}NOT YET - REREAD AND TRY AGAIN{:else if shown === 'empty'}{emptyMsg}{/if}
		</p>
	</div>
</article>

<style>
	.check {
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 1.15rem 1.25rem 1.3rem;
		transition: border-color 200ms var(--ease-out);
	}
	.check.passed {
		border-color: color-mix(in srgb, var(--phosphor) 30%, var(--line));
	}
	.chead {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.7rem;
	}
	.cn {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--phosphor);
	}
	.ck {
		color: var(--faint);
	}
	.cid {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.625rem;
		letter-spacing: 0.04em;
		color: var(--faint);
		opacity: 0.7;
	}
	.check.passed .cid {
		color: var(--phosphor);
		opacity: 1;
	}
	.tick {
		width: 5px;
		height: 9px;
		border-radius: 1px;
		background: var(--phosphor);
		box-shadow: 0 0 5px var(--phosphor-dim);
	}
	.prompt {
		font-size: 1rem;
		color: var(--text);
		line-height: 1.5;
		margin-bottom: 1rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.options {
		border: none;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-size: 0.9375rem;
		color: var(--muted);
		padding: 0.4rem 0.5rem;
		border: 1px solid transparent;
		border-radius: 2px;
		cursor: pointer;
		transition:
			background 120ms var(--ease-out),
			color 120ms var(--ease-out);
	}
	.opt:hover {
		background: var(--s2);
		color: var(--text);
	}
	.opt.on {
		color: var(--text);
		border-color: color-mix(in srgb, var(--phosphor) 25%, var(--line));
	}
	.opt input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.bullet {
		width: 13px;
		height: 13px;
		border: 1px solid var(--line);
		border-radius: 50%;
		flex: none;
		background: var(--s2);
		transition:
			border-color 120ms var(--ease-out),
			box-shadow 120ms var(--ease-out);
	}
	.opt.on .bullet {
		border-color: var(--phosphor);
		box-shadow: inset 0 0 0 3px var(--phosphor);
	}
	.opt input:focus-visible + .bullet {
		outline: 1px solid var(--phosphor);
		outline-offset: 2px;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		height: 2.5rem;
		padding-inline: 0.85rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		transition: border-color 140ms var(--ease-out);
	}
	.field:focus-within,
	.field.on {
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.caret {
		font-family: var(--font-mono);
		color: var(--phosphor);
		font-size: 0.8125rem;
	}
	.input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--text);
		font-size: 0.9375rem;
	}
	.input::placeholder {
		color: var(--faint);
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1.1rem;
	}
	.grade {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--muted);
		padding: 0.45rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.grade:hover {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
	}
	.verdict {
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		color: var(--faint);
		min-height: 1em;
	}
	.verdict.pass {
		color: var(--phosphor);
	}
	.verdict.fail {
		color: var(--muted);
	}
</style>
