<!-- The one toast: a surface-2 chip, phosphor tick, name (+N XP), bottom-right.
     Slides in 200ms, the store holds it 3s then retires it (out plays here).
     Reduced motion collapses the transition to an instant appear/disappear.
     Never a modal - level-ups ride the same chip as `LVL 05`. -->
<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { xp } from '$lib/xp.svelte';
	import type { TransitionConfig } from 'svelte/transition';

	function chip(_node: Element): TransitionConfig {
		const rm =
			typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
		return {
			duration: rm ? 0 : 200,
			easing: cubicOut,
			css: (t, u) => `opacity:${t}; transform: translateX(${u * 14}px)`
		};
	}
</script>

<div class="toasts" role="status" aria-live="polite" aria-atomic="false">
	{#each xp.toasts as t (t.id)}
		<div class="toast" class:level={t.kind === 'level'} transition:chip>
			<span class="tick" aria-hidden="true"></span>
			<span class="name mono">{t.label}</span>
			{#if t.xp}<span class="pts mono tnum">+{t.xp} XP</span>{/if}
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		right: clamp(0.9rem, 3vw, 1.5rem);
		bottom: clamp(0.9rem, 3vw, 1.5rem);
		z-index: 200;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5rem;
		pointer-events: none;
	}
	.toast {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.8rem;
		background: var(--s2);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: 0 8px 30px -12px #000;
	}
	.toast.level {
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
	}
	.tick {
		width: 7px;
		height: 12px;
		border-radius: 1px;
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
		flex: none;
	}
	.name {
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--text);
		white-space: nowrap;
	}
	.pts {
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
		color: var(--phosphor);
		white-space: nowrap;
	}
</style>
