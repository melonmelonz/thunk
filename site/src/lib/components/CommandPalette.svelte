<!-- The command palette: an instrument, not Spotlight. A centered surface-2 card
     with a hairline border, mono throughout, dimming the pane behind it with
     pure alpha (no blur - cheap and crisp). Opens on / or Cmd/Ctrl-K (the root
     layout owns the trigger and dynamic-imports this file), closes on esc or a
     click outside. Up/down move the cursor, enter fires. Matched query chars
     light phosphor. ARIA: a combobox that owns a listbox, activedescendant on
     the input - the WAI-ARIA 1.2 pattern, kept minimal but correct. -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { xp } from '$lib/xp.svelte';
	import { buildItems, filterItems, type PaletteItem } from '$lib/palette';

	let { onclose }: { onclose: () => void } = $props();

	const onBench = $derived(page.url.pathname.startsWith('/bench'));
	const items = $derived(buildItems({ onBench }));

	let query = $state('');
	let active = $state(0);
	let inputEl = $state<HTMLInputElement>();
	let listEl = $state<HTMLElement>();

	const results = $derived(filterItems(items, query, 8));

	// Keep the cursor in range as the result set shrinks/grows.
	$effect(() => {
		void results;
		if (active > results.length - 1) active = Math.max(0, results.length - 1);
	});

	function optionId(i: number): string {
		return `cmdk-opt-${i}`;
	}

	// Split a label into lit / unlit spans from the matched indices.
	function segments(label: string, indices: number[]): { text: string; on: boolean }[] {
		if (indices.length === 0) return [{ text: label, on: false }];
		const set = new Set(indices);
		const segs: { text: string; on: boolean }[] = [];
		for (let i = 0; i < label.length; i++) {
			const on = set.has(i);
			const last = segs[segs.length - 1];
			if (last && last.on === on) last.text += label[i];
			else segs.push({ text: label[i], on });
		}
		return segs;
	}

	async function move(delta: number) {
		if (results.length === 0) return;
		active = (active + delta + results.length) % results.length;
		await tick();
		listEl?.querySelector(`#${optionId(active)}`)?.scrollIntoView({ block: 'nearest' });
	}

	function run(item: PaletteItem) {
		onclose();
		if (item.href) {
			goto(item.href);
			return;
		}
		switch (item.action) {
			case 'toggle-rail':
			case 'toggle-scanlines':
				window.dispatchEvent(new CustomEvent('thunk:cmd', { detail: item.action }));
				break;
			case 'export-progress':
				exportProgress();
				break;
		}
	}

	function exportProgress() {
		try {
			const blob = new Blob([xp.exportJson()], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'thunk-progress.json';
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			// download denied (rare): nothing to do, the palette just closed
		}
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			// aria-modal: keep focus on the field (options are arrow-driven, not
			// tab stops), so Tab never leaks to the dimmed page behind.
			e.preventDefault();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			void move(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			void move(-1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const hit = results[active];
			if (hit) run(hit.item);
		}
	}

	onMount(() => {
		inputEl?.focus();
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="cmdk-back" role="presentation" onclick={onclose}></div>
<div class="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
	<div class="cmdk-field">
		<span class="prompt mono" aria-hidden="true">&gt;</span>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:this={inputEl}
			bind:value={query}
			onkeydown={onKey}
			class="cmdk-input mono"
			type="text"
			role="combobox"
			aria-expanded="true"
			aria-controls="cmdk-list"
			aria-activedescendant={results.length ? optionId(active) : undefined}
			aria-autocomplete="list"
			aria-label="Search lessons, channels, and commands"
			placeholder="jump to a lesson, channel, or command"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
		/>
		<kbd class="hint-esc mono" aria-hidden="true">ESC</kbd>
	</div>

	<ul class="cmdk-list" id="cmdk-list" role="listbox" bind:this={listEl} aria-label="Results">
		{#each results as r, i (r.item.id)}
			<li
				id={optionId(i)}
				class="cmdk-opt"
				class:active={i === active}
				role="option"
				aria-selected={i === active}
			>
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
				<button
					class="opt-hit"
					tabindex="-1"
					onclick={() => run(r.item)}
					onmousemove={() => (active = i)}
				>
					<span class="opt-glyph {r.item.kind}" aria-hidden="true"></span>
					<span class="opt-label">
						{#each segments(r.item.label, r.indices) as seg}<span class:lit={seg.on}
								>{seg.text}</span
							>{/each}
					</span>
					{#if r.item.hint}<span class="opt-hint mono">{r.item.hint}</span>{/if}
				</button>
			</li>
		{:else}
			<li class="cmdk-empty mono" aria-live="polite">
				<span class="ns-tick" aria-hidden="true"></span>NO SIGNAL &middot; nothing matches "{query}"
			</li>
		{/each}
	</ul>
</div>

<style>
	.cmdk-back {
		position: fixed;
		inset: 0;
		z-index: 300;
		/* Pure alpha dim, no blur: cheap, crisp, keeps the instrument legible. */
		background: color-mix(in srgb, var(--bg) 70%, transparent);
	}
	.cmdk {
		position: fixed;
		z-index: 301;
		top: clamp(3rem, 14vh, 8rem);
		left: 50%;
		transform: translateX(-50%);
		width: min(560px, calc(100vw - 2rem));
		background: var(--s2);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: 0 24px 70px -24px #000;
		overflow: hidden;
		animation: cmdk-in 140ms var(--ease-out) both;
	}
	@keyframes cmdk-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.cmdk-field {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.85rem;
		border-bottom: 1px solid var(--line);
	}
	.prompt {
		color: var(--phosphor);
		font-size: 0.8125rem;
		flex: none;
	}
	.cmdk-input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--text);
		font-size: 0.875rem;
		letter-spacing: 0.01em;
		min-width: 0;
	}
	.cmdk-input::placeholder {
		color: var(--faint);
		font-size: 0.75rem;
		letter-spacing: 0.04em;
	}
	.hint-esc {
		flex: none;
		font-size: 0.5625rem;
		letter-spacing: 0.12em;
		/* muted, not faint: faint (#757F90) is only 4.44:1 on surface-2, just shy
		   of AA; muted clears it at 5.11:1. */
		color: var(--muted);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.15rem 0.35rem;
	}

	.cmdk-list {
		list-style: none;
		max-height: min(52vh, 24rem);
		overflow-y: auto;
		padding: 0.35rem;
	}
	.cmdk-opt {
		border-radius: 2px;
	}
	.opt-hit {
		display: grid;
		grid-template-columns: 0.9rem 1fr auto;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.6rem;
		border-radius: 2px;
	}
	.cmdk-opt.active {
		background: color-mix(in srgb, var(--phosphor) 9%, transparent);
	}
	.cmdk-opt.active .opt-hit {
		box-shadow: inset 2px 0 0 var(--phosphor);
	}
	.opt-glyph {
		width: 6px;
		height: 6px;
		border-radius: 1px;
		background: var(--s3);
		justify-self: center;
	}
	.opt-glyph.place,
	.opt-glyph.channel {
		background: var(--faint);
	}
	.opt-glyph.action {
		border-radius: 50%;
	}
	.cmdk-opt.active .opt-glyph {
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
	}
	.opt-label {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.cmdk-opt.active .opt-label {
		color: var(--text);
	}
	.opt-label .lit {
		color: var(--phosphor);
	}
	.opt-hint {
		font-size: 0.5625rem;
		letter-spacing: 0.12em;
		/* muted (5.11:1 on surface-2) clears AA; faint would sit at 4.44:1. */
		color: var(--muted);
		flex: none;
	}

	.cmdk-empty {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 0.75rem;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		color: var(--muted);
	}
	.ns-tick {
		width: 5px;
		height: 10px;
		border-radius: 1px;
		background: var(--s3);
		flex: none;
	}
</style>
