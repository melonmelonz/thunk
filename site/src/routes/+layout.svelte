<script lang="ts">
	import '../app.css';
	import { onNavigate } from '$app/navigation';
	import SiteMark from '$lib/components/SiteMark.svelte';
	import XpMeter from '$lib/components/XpMeter.svelte';

	let { children } = $props();

	// View transitions: pure progressive enhancement. A subtle crossfade is
	// defined in CSS; browsers without startViewTransition just navigate.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<div class="app">
	<header class="masthead">
		<div class="wrap bar">
			<SiteMark />
			<XpMeter />
		</div>
	</header>

	<main>
		<div class="wrap">
			{@render children?.()}
		</div>
	</main>

	<footer class="colophon">
		<div class="wrap foot">
			<span class="label">Offline systems course</span>
			<span class="dot" aria-hidden="true"></span>
			<span class="license mono">MIT / Apache-2.0</span>
			<span class="dot" aria-hidden="true"></span>
			<span class="note">Nothing leaves this machine.</span>
		</div>
	</footer>
</div>

<style>
	.masthead {
		position: sticky;
		top: 0;
		z-index: 20;
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--line);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56px;
	}

	.colophon {
		border-top: 1px solid var(--line);
		padding-block: 1.4rem;
		background: var(--bg);
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		flex-wrap: wrap;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.license {
		font-size: 0.75rem;
		color: var(--faint);
		letter-spacing: 0.02em;
	}
	.note {
		color: var(--faint);
	}
	.dot {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--line);
	}

	/* Same-document crossfade + a short lift. Firefox is Level-1; key off the
	   route, never off transition types. */
	:global(::view-transition-old(root)),
	:global(::view-transition-new(root)) {
		animation-duration: 180ms;
		animation-timing-function: var(--ease-out);
	}
</style>
