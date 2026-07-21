<!-- The degauss: the Konami code's payoff. For ~900ms the whole face shudders and
     the phosphor sweeps its color fringe, the way an old CRT threw its picture
     when you hit the degauss button - then it snaps clean. A DEGAUSS tag flickers
     in the corner. Self-contained: it adds the body wobble class itself, renders
     its own sheen overlay, and calls ondone when the timer is up so the parent can
     unmount it. Reduced motion gets the tag for a beat and no wobble. -->
<script lang="ts">
	import { onMount } from 'svelte';

	let { ondone }: { ondone: () => void } = $props();

	function reduced(): boolean {
		return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	}

	onMount(() => {
		const body = document.body;
		const soft = reduced();
		if (!soft) body.classList.add('degaussing');
		const ms = soft ? 650 : 900;
		const t = window.setTimeout(() => {
			body.classList.remove('degaussing');
			ondone();
		}, ms);
		return () => {
			clearTimeout(t);
			body.classList.remove('degaussing');
		};
	});
</script>

<div class="degauss" aria-hidden="true">
	<div class="sheen"></div>
	<div class="ring"></div>
	<span class="tag mono">DEGAUSS</span>
</div>

<style>
	/* The overlay sits above everything, never takes a click. */
	.degauss {
		position: fixed;
		inset: 0;
		z-index: 400;
		pointer-events: none;
		overflow: hidden;
	}

	/* The color fringe: a wide phosphor-through-cyan band that sweeps across the
	   glass, brightening then gone. `screen` blend so it lifts the picture like a
	   magnetic wash rather than painting over it. */
	.sheen {
		position: absolute;
		inset: -20%;
		background: linear-gradient(
			105deg,
			transparent 30%,
			var(--phosphor-dim) 45%,
			color-mix(in srgb, var(--cyan) 35%, transparent) 52%,
			var(--phosphor-dim) 59%,
			transparent 74%
		);
		mix-blend-mode: screen;
		opacity: 0;
		transform: translateX(-30%);
		animation: sheen-sweep 900ms var(--ease-out) both;
	}

	/* A single ring blooming from the center: the coil's pulse. */
	.ring {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 8px;
		height: 8px;
		margin: -4px 0 0 -4px;
		border-radius: 50%;
		box-shadow: 0 0 0 2px var(--phosphor-dim);
		opacity: 0;
		animation: ring-bloom 900ms var(--ease-out) both;
	}

	.tag {
		position: absolute;
		right: clamp(0.75rem, 3vw, 1.5rem);
		bottom: clamp(0.75rem, 3vw, 1.5rem);
		font-size: 0.625rem;
		letter-spacing: 0.28em;
		color: var(--phosphor);
		text-shadow: 0 0 10px var(--phosphor);
		animation: tag-flicker 900ms steps(1, end) both;
	}

	@keyframes sheen-sweep {
		0% {
			opacity: 0;
			transform: translateX(-30%);
		}
		25% {
			opacity: 0.9;
		}
		100% {
			opacity: 0;
			transform: translateX(30%);
		}
	}
	@keyframes ring-bloom {
		0% {
			opacity: 0.8;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(160);
		}
	}
	@keyframes tag-flicker {
		0%,
		20%,
		34%,
		60% {
			opacity: 1;
		}
		12%,
		28%,
		48% {
			opacity: 0.25;
		}
		100% {
			opacity: 0;
		}
	}

	/* Reduced motion: no sweep, no bloom - just the tag, held briefly. */
	@media (prefers-reduced-motion: reduce) {
		.sheen,
		.ring {
			display: none;
		}
		.tag {
			animation: none;
			opacity: 1;
		}
	}
</style>
