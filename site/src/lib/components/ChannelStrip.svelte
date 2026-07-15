<script lang="ts">
	import type { Module } from '$lib/content';
	import ModuleGlyph from '$lib/components/ModuleGlyph.svelte';
	import { xp } from '$lib/xp.svelte';
	let { module, index }: { module: Module; index: number } = $props();
	// Real progress from the store: 0% keeps NO SIGNAL, >0 shows the percentage,
	// full mastery lights the channel. LOCKED is a VISUAL gate only - the link
	// still works, because the site never blocks a reader; the ladder rule is the
	// facility binary's to enforce.
	const stat = $derived(xp.moduleStat(module, index));
</script>

<a
	class="strip reveal"
	class:locked={!stat.unlocked && stat.pct === 0}
	href={`/m/${module.id}/`}
	style={`--i:${index}`}
	data-sveltekit-preload-data="hover"
>
	<span class="idx" aria-hidden="true">
		<ModuleGlyph tag={module.tag} />
		<span class="tag tnum">{module.tag}</span>
	</span>
	<span class="body">
		<span class="title">{module.title}</span>
		<span class="counts label">
			{String(module.lessonCount).padStart(2, '0')} lessons
			<span class="mid">·</span>
			{String(module.checkCount).padStart(2, '0')} checks
		</span>
	</span>
	<span class="sig label" class:live={stat.pct > 0} class:lock={!stat.unlocked && stat.pct === 0} aria-hidden="true">
		{#if stat.mastered}MASTERED{:else if stat.pct > 0}{stat.pct}%{:else if !stat.unlocked}LOCKED{:else}NO SIGNAL{/if}
	</span>
	<span class="meter" aria-hidden="true">
		<span class="rail"></span>
		<span class="fill" class:done={stat.mastered} style={`width:${stat.pct}%`}></span>
		<span class="origin"></span>
	</span>
	<span class="chev" aria-hidden="true">
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
			<path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
		</svg>
	</span>
</a>

<style>
	.strip {
		display: grid;
		grid-template-columns: 3.25rem 1fr auto 5.5rem 1.25rem;
		align-items: center;
		gap: 1.25rem;
		padding: 1.15rem 1rem 1.15rem 0.5rem;
		border-top: 1px solid var(--line);
		transition:
			background 140ms var(--ease-out),
			padding-left 140ms var(--ease-out);
	}
	.strip:last-child {
		border-bottom: 1px solid var(--line);
	}
	.strip:hover {
		background: var(--s1);
		padding-left: 1rem;
	}

	.idx {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		color: var(--faint);
		transition: color 140ms var(--ease-out);
	}
	.idx .tag {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		letter-spacing: 0.08em;
	}
	.strip:hover .idx {
		color: var(--phosphor);
	}

	.sig {
		font-size: 0.5625rem;
		letter-spacing: 0.14em;
		color: var(--faint);
		text-align: right;
		white-space: nowrap;
		opacity: 0.75;
		transition: opacity 140ms var(--ease-out);
	}
	.strip:hover .sig {
		opacity: 1;
	}
	.sig.live {
		color: var(--phosphor);
		opacity: 1;
	}
	.sig.lock {
		color: var(--faint);
	}
	.strip.locked .title {
		color: var(--muted);
	}
	.strip.locked .idx {
		color: var(--line);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
		min-width: 0;
	}
	.title {
		font-size: 1.0625rem;
		font-weight: 500;
		color: var(--text);
		letter-spacing: -0.01em;
	}
	.counts {
		color: var(--muted);
	}
	.counts .mid {
		color: var(--faint);
		margin-inline: 0.15em;
	}

	.meter {
		position: relative;
		width: 5.5rem;
		height: 3px;
		align-self: center;
	}
	.rail {
		position: absolute;
		inset: 0;
		background: var(--s3);
		border-radius: 2px;
	}
	.fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: color-mix(in srgb, var(--phosphor) 65%, transparent);
		border-radius: 2px;
		transition: width 200ms var(--ease-out);
	}
	.fill.done {
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
	}
	/* 0% progress: a lit origin tick, so the rail reads as calibrated-to-zero
	   rather than broken. */
	.origin {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--phosphor);
		opacity: 0.55;
		transition: opacity 140ms var(--ease-out);
	}
	.strip:hover .origin {
		opacity: 1;
		box-shadow: 0 0 6px var(--phosphor-dim);
	}

	.chev {
		color: var(--faint);
		display: inline-flex;
		transition:
			color 140ms var(--ease-out),
			transform 140ms var(--ease-out);
	}
	.strip:hover .chev {
		color: var(--muted);
		transform: translateX(2px);
	}

	@media (max-width: 640px) {
		.strip {
			grid-template-columns: 2.5rem 1fr 1rem;
			gap: 0.9rem;
			padding-block: 1rem;
		}
		.counts {
			display: none;
		}
		.meter {
			display: none;
		}
		.sig {
			display: none;
		}
	}

	/* Staggered entrance: 120-200ms ease-out, one pass, reduced-motion off. */
	.reveal {
		animation: rise 420ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 45ms + 80ms);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
