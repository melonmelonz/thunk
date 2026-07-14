<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import SiteMark from '$lib/components/SiteMark.svelte';
	import XpMeter from '$lib/components/XpMeter.svelte';
	import build from '$lib/build.json';

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

	// Boot ritual: once per session, on the first load, the header tick warms up
	// and the hero eyebrow fades up just behind it. Never on later navigations
	// (SPA nav does not remount this layout, and the flag is set immediately),
	// never under reduced motion. No typing effects, no blinking cursors.
	onMount(() => {
		try {
			if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
			if (sessionStorage.getItem('thunk.booted')) return;
			sessionStorage.setItem('thunk.booted', '1');
			const root = document.documentElement;
			root.classList.add('boot');
			setTimeout(() => root.classList.remove('boot'), 900);
		} catch {
			// no sessionStorage (private mode edge cases): skip the ritual quietly
		}
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
		<!-- Build plate: real provenance stamped at build time by build-info.mjs. -->
		<p class="plate mono tnum" aria-label="build provenance">
			BUILD {build.sha}{#if build.tests}
				<span class="pd" aria-hidden="true">&middot;</span> {build.tests} TESTS GREEN{/if}
			<span class="pd" aria-hidden="true">&middot;</span> AIR-GAPPED
		</p>
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

	.plate {
		margin-top: 0.85rem;
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--faint);
	}
	.plate .pd {
		color: var(--line);
		margin-inline: 0.15em;
	}

	/* Same-document crossfade + a short lift. Firefox is Level-1; key off the
	   route, never off transition types. */
	:global(::view-transition-old(root)),
	:global(::view-transition-new(root)) {
		animation-duration: 180ms;
		animation-timing-function: var(--ease-out);
	}
</style>
