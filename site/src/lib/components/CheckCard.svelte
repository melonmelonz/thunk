<script lang="ts">
	import { tick, untrack } from 'svelte';
	import type { Check } from '$lib/content';
	import { grade, type Response } from '$lib/grade';
	import { xp } from '$lib/xp.svelte';

	// `placement` mode makes this a calibration instrument: no GRADE button, no
	// pass tick, no store writes. It just collects a response and reports it to
	// the parent (via `onrespond`), which grades on CONTINUE. Default mode is the
	// self-graded lesson check, unchanged.
	let {
		check,
		n,
		placement = false,
		onrespond
	}: {
		check: Check;
		n: number;
		placement?: boolean;
		onrespond?: (r: Response | null) => void;
	} = $props();
	const label = $derived(
		check.kind === 'choice'
			? 'Multiple choice'
			: check.kind === 'short'
				? 'Short answer'
				: check.kind === 'order'
					? 'Put in order'
					: 'Predict the output'
	);

	let picked = $state(-1);
	let text = $state('');
	// The working order for an Order check: item indices in the learner's current
	// arrangement. Seeded once from a deterministic, id-keyed shuffle so the
	// display is stable across renders (not random each mount) and starts as a
	// real task rather than pre-solved.
	// Seeded once. A CheckCard is keyed by check.id in the reader (one instance
	// per check), so `check` never changes under it - capturing the initial value
	// is exactly right, and `untrack` says so to the compiler.
	let order = $state<number[]>(
		untrack(() => (check.kind === 'order' ? shuffleOrder(check.id, check.items.length) : []))
	);
	let listEl = $state<HTMLOListElement>();
	let verdict = $state<'idle' | 'pass' | 'fail' | 'empty'>('idle');

	// A deterministic id-keyed permutation of 0..n (FNV-1a seed -> mulberry32 ->
	// Fisher-Yates), forced off the identity so the answer is never the starting
	// state. Mirrors the offline bundle's `display_order` in spirit; the two need
	// not match byte-for-byte, only both be stable and non-leaking.
	function shuffleOrder(id: string, len: number): number[] {
		let h = 2166136261 >>> 0;
		for (let i = 0; i < id.length; i++) {
			h ^= id.charCodeAt(i);
			h = Math.imul(h, 16777619) >>> 0;
		}
		const rand = () => {
			h += 0x6d2b79f5;
			let t = h;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
		const idx = Array.from({ length: len }, (_, i) => i);
		for (let i = len - 1; i > 0; i--) {
			const j = Math.floor(rand() * (i + 1));
			[idx[i], idx[j]] = [idx[j], idx[i]];
		}
		if (len > 1 && idx.every((v, i) => v === i)) idx.push(idx.shift()!); // never start solved
		return idx;
	}

	// Move the item at `pos` by `delta` (-1 up, +1 down). Reassigns for
	// reactivity and refocuses the moved control so repeated presses keep going -
	// keyboard-first, no drag required.
	async function move(pos: number, delta: number) {
		const j = pos + delta;
		if (j < 0 || j >= order.length) return;
		const next = order.slice();
		[next[pos], next[j]] = [next[j], next[pos]];
		order = next;
		await tick();
		listEl?.querySelector<HTMLButtonElement>(`[data-move="${j}:${delta}"]`)?.focus();
	}

	// Arrow keys on a move control nudge the item along that axis too, so the list
	// reads as a listbox and not just a pair of buttons.
	function onOrderKey(e: KeyboardEvent, pos: number) {
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			move(pos, -1);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			move(pos, 1);
		}
	}

	// Passed state is the store's, so it survives reload and a passed check keeps
	// its tick. A previously-passed check shows PASS even before the reader grades.
	// In placement mode there is no pass surface at all - calibration stays quiet.
	const passed = $derived(placement ? false : xp.isPassed(check.id));
	const shown = $derived(verdict === 'idle' && passed ? 'pass' : verdict);

	// The live response for the current inputs, or null when there is nothing to
	// grade yet. Shared by placement reporting and the GRADE button.
	function liveResponse(): Response | null {
		if (check.kind === 'choice') return picked >= 0 ? { picked } : null;
		if (check.kind === 'order') return { order }; // always a full ordering
		return text.trim().length > 0 ? { text } : null; // short + predict
	}

	// Placement: report the live response upward (null when nothing answered yet)
	// so the parent can enable CONTINUE and grade at its own pace.
	$effect(() => {
		if (!placement) return;
		// Touch the reactive inputs so the effect re-runs on every edit.
		void picked;
		void text;
		void order;
		onrespond?.(liveResponse());
	});

	function onGrade() {
		const res = liveResponse();
		if (res === null) {
			verdict = 'empty';
			return;
		}
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
		check.kind === 'choice'
			? 'PICK AN ANSWER FIRST'
			: check.kind === 'order'
				? 'ARRANGE THE STEPS FIRST'
				: 'TYPE AN ANSWER FIRST'
	);
	const placeholder = $derived(
		check.kind === 'predict' ? check.hint || 'predict the value' : 'type your answer'
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
	{:else if check.kind === 'order'}
		<ol class="order" bind:this={listEl} aria-label={check.prompt}>
			{#each order as idx, pos (idx)}
				<li class="oitem">
					<span class="opos tnum" aria-hidden="true">{String(pos + 1).padStart(2, '0')}</span>
					<span class="olabel">{check.items[idx]}</span>
					<span class="omoves">
						<button
							type="button"
							class="omove"
							data-move={`${pos}:-1`}
							disabled={pos === 0}
							aria-label={`Move "${check.items[idx]}" up`}
							onclick={() => move(pos, -1)}
							onkeydown={(e) => onOrderKey(e, pos)}>&#9650;</button
						>
						<button
							type="button"
							class="omove"
							data-move={`${pos}:1`}
							disabled={pos === order.length - 1}
							aria-label={`Move "${check.items[idx]}" down`}
							onclick={() => move(pos, 1)}
							onkeydown={(e) => onOrderKey(e, pos)}>&#9660;</button
						>
					</span>
				</li>
			{/each}
		</ol>
	{:else}
		<div class="field" class:on={text.length > 0} class:predict={check.kind === 'predict'}>
			<span class="caret" aria-hidden="true">&gt;</span>
			<input
				class="input mono"
				type="text"
				bind:value={text}
				{placeholder}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				onkeydown={(e) => e.key === 'Enter' && !placement && onGrade()}
				aria-label="your answer"
			/>
		</div>
	{/if}

	{#if !placement}
		<div class="actions">
			<button class="grade mono" onclick={onGrade}>GRADE</button>
			<p class="verdict mono" class:pass={shown === 'pass'} class:fail={shown === 'fail'} aria-live="polite">
				{#if shown === 'pass'}PASS{:else if shown === 'fail'}NOT YET - REREAD AND TRY AGAIN{:else if shown === 'empty'}{emptyMsg}{/if}
			</p>
		</div>
	{/if}
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

	/* Order: a reorderable list read as an instrument. Hairline-boxed rows,
	   tabular position numerals, quiet phosphor move controls. Keyboard-first -
	   every row carries up/down controls; no drag surface at all. */
	.order {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		overflow: hidden;
	}
	.oitem {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0.6rem 0.55rem 0.7rem;
		border-top: 1px solid var(--line-soft, var(--line));
		font-size: 0.9375rem;
		color: var(--text);
	}
	.oitem:first-child {
		border-top: none;
	}
	.opos {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--phosphor);
		opacity: 0.8;
		flex: none;
		width: 1.4rem;
	}
	.olabel {
		flex: 1;
		line-height: 1.4;
		min-width: 0;
	}
	.omoves {
		display: inline-flex;
		gap: 0.3rem;
		flex: none;
	}
	.omove {
		font-size: 0.7rem;
		line-height: 1;
		width: 1.65rem;
		height: 1.65rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s1);
		transition:
			color 120ms var(--ease-out),
			border-color 120ms var(--ease-out);
	}
	.omove:hover:not(:disabled),
	.omove:focus-visible {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
	}
	.omove:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 1px;
	}
	.omove:disabled {
		opacity: 0.3;
		cursor: default;
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
