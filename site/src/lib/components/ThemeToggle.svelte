<script lang="ts">
	// A quiet sun/moon switch. Flips the palette and persists it. Mirrors the
	// keyhint/collapse buttons in the shell chrome - hairline square, faint until
	// hover. The icon shows the state you are IN (moon = dark, sun = light).
	import { theme } from '$lib/theme.svelte';

	let dark = $derived(theme.current === 'dark');
</script>

<button
	class="theme-toggle"
	onclick={() => theme.toggle()}
	aria-label={dark ? 'switch to light mode' : 'switch to dark mode'}
	title={dark ? 'Light mode' : 'Dark mode'}
	aria-pressed={!dark}
>
	{#if dark}
		<!-- moon -->
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
			<path
				d="M11.5 8.3A4.6 4.6 0 0 1 5.7 2.5 4.6 4.6 0 1 0 11.5 8.3Z"
				stroke="currentColor"
				stroke-width="1.2"
				stroke-linejoin="round"
			/>
		</svg>
	{:else}
		<!-- sun -->
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
			<circle cx="7" cy="7" r="2.6" stroke="currentColor" stroke-width="1.2" />
			<g stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
				<path d="M7 1v1.4M7 11.6V13M1 7h1.4M11.6 7H13M2.8 2.8l1 1M10.2 10.2l1 1M11.2 2.8l-1 1M3.8 10.2l-1 1" />
			</g>
		</svg>
	{/if}
</button>

<style>
	.theme-toggle {
		width: 22px;
		height: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.theme-toggle:hover {
		color: var(--phosphor);
		border-color: var(--line-strong);
	}
</style>
