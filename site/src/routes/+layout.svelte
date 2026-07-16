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
	import type { Component } from 'svelte';

	let { children } = $props();

	// Load the persisted XP record after hydration, so the first client render
	// still matches the prerendered (empty) markup, then meters tick up.
	onMount(() => xp.hydrate());

	// The command palette. The component (and its filter code + the content it
	// searches) is dynamic-imported on first open, so it never weighs on the
	// first route's JS budget. The trigger lives here at the root so / and
	// Cmd/Ctrl-K work everywhere - the marketing front door included.
	let paletteOpen = $state(false);
	let Palette = $state<Component<{ onclose: () => void }> | null>(null);

	async function openPalette() {
		if (!Palette) {
			try {
				Palette = (await import('$lib/components/CommandPalette.svelte')).default;
			} catch {
				return; // chunk failed to load: leave the palette shut, no crash
			}
		}
		paletteOpen = true;
	}

	function onPaletteKey(e: KeyboardEvent) {
		// Cmd/Ctrl-K from anywhere; / only when not already typing somewhere.
		if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
			e.preventDefault();
			void openPalette();
			return;
		}
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.key !== '/') return;
		const t = e.target as HTMLElement | null;
		const tag = t?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
		e.preventDefault();
		void openPalette();
	}

	onMount(() => {
		window.addEventListener('keydown', onPaletteKey);
		return () => window.removeEventListener('keydown', onPaletteKey);
	});

	// View transitions: pure progressive enhancement. Browsers without
	// startViewTransition just navigate. Entering the app from `/` crossfades
	// into the shell; the CSS lift is defined per-group.
	//
	// Hardened against the two races that leave a page blank (the new root
	// snapshot stuck at opacity 0): (1) an overlapping navigation started while
	// a transition is still running interrupts it - so we skip the transition
	// for a nav that arrives mid-flight and just navigate; (2) navigation.complete
	// rejecting on an interrupted/redirected nav would reject the update callback
	// and can strand the pseudo-element - so we swallow it. Either way the DOM
	// always ends up visible; the worst case is a nav with no crossfade.
	let transitioning = false;
	onNavigate((navigation) => {
		if (!document.startViewTransition || transitioning) return;
		transitioning = true;
		return new Promise((resolve) => {
			const t = document.startViewTransition(async () => {
				resolve();
				try {
					await navigation.complete;
				} catch {
					// interrupted or redirected: let the DOM settle, never stall
				}
			});
			t.finished.finally(() => {
				transitioning = false;
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

{#if paletteOpen && Palette}
	<Palette onclose={() => (paletteOpen = false)} />
{/if}

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
