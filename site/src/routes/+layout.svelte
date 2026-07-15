<script lang="ts">
	// The global layout carries only cross-cutting concerns: the stylesheet, the
	// view-transition wiring, the once-per-session boot ritual, and the toast
	// surface. Visible chrome lives in the two route groups - (marketing) for the
	// front door `/`, (app) for the instrument shell everywhere past it.
	import '../app.css';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import XpToast from '$lib/components/XpToast.svelte';
	import { xp } from '$lib/xp.svelte';

	let { children } = $props();

	// Load the persisted XP record after hydration, so the first client render
	// still matches the prerendered (empty) markup, then meters tick up.
	onMount(() => xp.hydrate());

	// View transitions: pure progressive enhancement. Browsers without
	// startViewTransition just navigate. Entering the app from `/` crossfades
	// into the shell; the CSS lift is defined per-group.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	// Boot ritual: once per session, the header tick warms and the hero eyebrow
	// fades up behind it. Never on later navigations, never under reduced motion.
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

{@render children?.()}

<XpToast />

<style>
	/* Same-document crossfade + a short lift. Firefox is Level-1; key off the
	   route, never off transition types. */
	:global(::view-transition-old(root)),
	:global(::view-transition-new(root)) {
		animation-duration: 180ms;
		animation-timing-function: var(--ease-out);
	}
</style>
