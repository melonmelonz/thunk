<script lang="ts">
	import type { PageData } from './$types';
	import { mount, unmount } from 'svelte';
	import CheckCard from '$lib/components/CheckCard.svelte';
	import Meta from '$lib/components/Meta.svelte';
	import { xp } from '$lib/xp.svelte';
	import { widgetLoader } from '$lib/widgets/registry';
	let { data }: { data: PageData } = $props();
	// Derived, not destructured: client-side nav between lessons reuses this
	// component and updates `data` reactively.
	const module = $derived(data.module);
	const lesson = $derived(data.lesson);

	// Remember the furthest lesson opened, so the front door + palette can offer
	// CONTINUE. Runs on every lesson mount/nav; the store no-ops on a repeat.
	$effect(() => {
		xp.recordVisit(module.id, lesson.id);
	});

	// The prose column holds the rendered lesson HTML, including any
	// `<figure class="widget" data-widget="...">` placeholder the constrained
	// renderer emitted for a `:::widget <id>` directive.
	let proseEl = $state<HTMLDivElement>();

	// Hydrate every widget placeholder after the lesson renders: dynamic-import
	// its component (code-split, so it never touches the first-route JS budget)
	// and mount it into the figure, replacing the static fallback caption. Re-runs
	// on lesson nav (depends on lesson.id). Handles: reduced motion (passed to the
	// widget), a failed import (the caption stays, no crash), and unmount on
	// navigation (the cleanup tears every mounted instance down).
	$effect(() => {
		void lesson.id; // re-hydrate when the lesson changes
		const host = proseEl;
		if (!host) return;
		const reducedMotion =
			typeof window !== 'undefined' &&
			!!window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let cancelled = false;
		const mounted: Record<string, unknown>[] = [];
		const figures = host.querySelectorAll<HTMLElement>('figure.widget[data-widget]');
		for (const fig of figures) {
			const id = fig.dataset.widget;
			const load = id ? widgetLoader(id) : undefined;
			if (!load) continue; // unknown id: leave the caption in place
			load()
				.then((mod) => {
					if (cancelled || !fig.isConnected) return;
					fig.replaceChildren(); // drop the fallback caption
					mounted.push(mount(mod.default, { target: fig, props: { reducedMotion } }));
				})
				.catch((err) => {
					// A failed chunk fetch leaves the readable caption; never crash.
					console.error(`widget "${id}" failed to load`, err);
				});
		}
		return () => {
			cancelled = true;
			for (const inst of mounted) {
				try {
					unmount(inst);
				} catch {
					/* already detached by an {@html} swap on nav */
				}
			}
		};
	});
	const prev = $derived(data.prev);
	const next = $derived(data.next);
	const index = $derived(data.index);
	// Channel language: M0 -> CH-00, lesson 1 -> .01
	const ch = $derived(String(Number(module.tag.replace(/\D/g, ''))).padStart(2, '0'));
	const chLesson = $derived(`CH-${ch}.${String(index + 1).padStart(2, '0')}`);

	// The course's true ending: the last lesson of M7 (First Patch) hands off to
	// the launchpad, where the reader tries their own real contribution. Kept in
	// the site layer so M7's authored content stays pure.
	const isCapstoneEnd = $derived(module.id === 'm7-first-patch' && !next);
</script>

<Meta
	title={`${chLesson} · ${lesson.title} · thunk`}
	description={`${module.title}, lesson ${index + 1} of ${module.lessonCount}: ${lesson.title}.`}
	ogTitle={`${chLesson} ${lesson.title} - thunk`}
	ogDescription={`${module.title}, lesson ${index + 1} of ${module.lessonCount}.`}
/>

<article class="reading">
	<header class="lhead">
		<p class="eyebrow label tnum">
			{module.tag} {module.title}
			<span class="mid">·</span>
			Lesson {String(index + 1).padStart(2, '0')} of {String(module.lessonCount).padStart(2, '0')}
		</p>
		<h1>{lesson.title}</h1>
	</header>

	<!-- Body rendered by the pinned constrained-dialect renderer in thunk-web
	     and carried through the export. No client-side markdown parser. Any
	     :::widget placeholder figures inside are hydrated by the $effect above. -->
	<div class="prose" bind:this={proseEl}>
		{@html lesson.bodyHtml}
	</div>
</article>

<section class="checks" aria-label="checks">
	<header class="checks-head">
		<h2 class="label">Checks</h2>
		<p class="ch-note">
			Answer these to prove the lesson landed. Graded here in the browser by the same rules as the facility binary - nothing is ever
			sent anywhere.
		</p>
	</header>
	<div class="check-grid">
		{#each lesson.checks as check, i (check.id)}
			<CheckCard {check} n={i + 1} />
		{/each}
	</div>
</section>

{#if isCapstoneEnd}
	<!-- The handoff: from the last lesson into the real thing. -->
	<aside class="launchpad-cta" aria-label="the launchpad">
		<div class="lc-body">
			<p class="lc-eyebrow label">You have read it. Now do it.</p>
			<h2 class="lc-title">Try your own first patch</h2>
			<p class="lc-sub">
				A launchpad, not a certificate: curated on-ramps to a first real issue, a change-description
				template, a pre-submit checklist, and a private tracker for the one patch that is yours.
			</p>
		</div>
		<a class="lc-go" href="/first-patch/">
			<span class="lc-word mono">OPEN THE LAUNCHPAD</span>
			<span class="lc-chev" aria-hidden="true">
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
			</span>
		</a>
	</aside>
{/if}

<!-- Print-only running footer: thunk · CH-NN.LL · <title>. Hidden on screen
     (app.css), repeated on each printed page. -->
<div class="lesson-print-footer" aria-hidden="true">thunk &middot; {chLesson} &middot; {lesson.title}</div>

<nav class="pager" aria-label="lesson">
	{#if prev}
		<a class="pg prev" href={`/m/${module.id}/${prev.id}/`}>
			<span class="label">Previous</span>
			<span class="pt">{prev.title}</span>
		</a>
	{:else}
		<span></span>
	{/if}
	{#if next}
		<a class="pg next" href={`/m/${module.id}/${next.id}/`}>
			<span class="label">Next</span>
			<span class="pt">{next.title}</span>
		</a>
	{/if}
</nav>

<style>
	.reading {
		max-width: var(--measure);
	}
	.lhead {
		margin-bottom: 2.5rem;
	}
	.eyebrow {
		color: var(--muted);
		margin-bottom: 0.9rem;
	}
	.eyebrow .mid {
		color: var(--faint);
		margin-inline: 0.35em;
	}
	.lhead h1 {
		font-size: clamp(1.9rem, 4.5vw, 2.6rem);
		color: var(--text-strong);
		letter-spacing: -0.02em;
		line-height: 1.08;
	}

	/* The prose column - the reading instrument. Injected HTML from the
	   validated renderer, styled here in one place. */
	.prose {
		font-size: 1.0625rem;
		line-height: 1.75;
		color: var(--text);
	}
	.prose :global(h1) {
		display: none; /* title already shown in the header */
	}
	.prose :global(h2) {
		font-size: 1.15rem;
		font-weight: 500;
		color: var(--text-strong);
		letter-spacing: -0.01em;
		margin: 2.6rem 0 0.9rem;
		padding-top: 1.6rem;
		border-top: 1px solid var(--line);
	}
	.prose :global(h3) {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		margin: 1.8rem 0 0.6rem;
	}
	.prose :global(p) {
		margin: 0 0 1.15rem;
	}
	.prose :global(strong) {
		color: var(--text-strong);
		font-weight: 600;
	}
	.prose :global(a) {
		color: var(--cyan);
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-color: color-mix(in srgb, var(--cyan) 40%, transparent);
	}
	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 1.15rem;
		padding-left: 1.35rem;
	}
	.prose :global(li) {
		margin-bottom: 0.5rem;
	}
	.prose :global(li::marker) {
		color: var(--faint);
	}
	.prose :global(code) {
		font-family: var(--font-mono);
		font-size: 0.875em;
		background: var(--s2);
		border: 1px solid var(--line);
		border-radius: 3px;
		padding: 0.08em 0.36em;
		color: var(--text);
	}
	.prose :global(pre) {
		font-family: var(--font-mono);
		background: var(--s1);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 1rem 1.15rem;
		overflow-x: auto;
		margin: 0 0 1.4rem;
		font-size: 0.8125rem;
		line-height: 1.7;
	}
	.prose :global(pre code) {
		background: none;
		border: none;
		padding: 0;
		font-size: inherit;
		color: var(--muted);
	}

	/* A widget placeholder. Before hydration (and in the JS-free offline bundle)
	   it shows only its <figcaption> as a quiet, hairline-boxed note; once the
	   lesson page mounts the Svelte instrument, the caption is replaced and the
	   figure just frames it with the reading rhythm's vertical space. */
	.prose :global(figure.widget) {
		margin: 1.8rem 0;
	}
	.prose :global(figure.widget:has(figcaption:only-child)) {
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 0.9rem 1.1rem;
	}
	.prose :global(figure.widget > figcaption:only-child) {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1.6;
		letter-spacing: 0.02em;
		color: var(--muted);
	}
	.prose :global(figure.widget > figcaption:only-child)::before {
		content: '▚ ';
		color: var(--faint);
	}

	/* Key terms as a datasheet. Every lesson closes with an <h2>Key terms</h2>
	   immediately followed by a <ul> - the only h2 in the corpus directly
	   adjacent to a list - so `h2:has(+ ul)` targets it precisely without
	   parsing the injected HTML. The header becomes a small caption and the
	   list a hairline-boxed table with mono terms. */
	.prose :global(h2:has(+ ul)) {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		font-weight: 400;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--faint);
		margin-bottom: 0.85rem;
	}
	.prose :global(h2:has(+ ul) + ul) {
		list-style: none;
		padding: 0;
		margin: 0 0 1.15rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		overflow: hidden;
	}
	.prose :global(h2:has(+ ul) + ul li) {
		margin: 0;
		padding: 0.65rem 1rem;
		border-top: 1px solid var(--line-soft);
		font-size: 0.9375rem;
		color: var(--muted);
		line-height: 1.5;
	}
	.prose :global(h2:has(+ ul) + ul li:first-child) {
		border-top: none;
	}
	.prose :global(h2:has(+ ul) + ul strong) {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 400;
		color: var(--text);
		letter-spacing: 0.01em;
	}

	.checks {
		max-width: var(--measure);
		margin-top: 3.5rem;
		padding-top: 2rem;
		border-top: 1px solid var(--line);
	}
	.checks-head {
		margin-bottom: 1.4rem;
	}
	.checks-head h2 {
		color: var(--phosphor);
		margin-bottom: 0.6rem;
	}
	.ch-note {
		font-size: 0.8125rem;
		color: var(--muted);
		max-width: 40rem;
	}
	.check-grid {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	/* The capstone handoff card: the course's one deliberately warm moment, still
	   PVM-quiet - a phosphor-edged panel, no gradient, no glow beyond the hairline. */
	.launchpad-cta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem;
		margin-top: 3.5rem;
		padding: 1.4rem 1.5rem;
		max-width: var(--measure);
		border: 1px solid color-mix(in srgb, var(--phosphor) 30%, var(--line));
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--phosphor) 5%, var(--s1));
	}
	.lc-body {
		min-width: 0;
		flex: 1 1 20rem;
	}
	.lc-eyebrow {
		color: var(--phosphor);
	}
	.lc-title {
		margin-top: 0.5rem;
		font-size: 1.35rem;
		font-weight: 500;
		color: var(--text-strong);
		letter-spacing: -0.01em;
	}
	.lc-sub {
		margin-top: 0.6rem;
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--muted);
	}
	.lc-go {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 1.1rem;
		flex: none;
		border: 1px solid color-mix(in srgb, var(--phosphor) 45%, var(--line));
		border-radius: 2px;
		background: color-mix(in srgb, var(--phosphor) 10%, transparent);
		transition:
			background 160ms var(--ease-out),
			border-color 160ms var(--ease-out);
	}
	.lc-go:hover {
		background: color-mix(in srgb, var(--phosphor) 18%, transparent);
		border-color: var(--phosphor);
	}
	.lc-word {
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--phosphor);
	}
	.lc-chev {
		display: inline-flex;
		color: var(--phosphor);
		transition: transform 140ms var(--ease-out);
	}
	.lc-go:hover .lc-chev {
		transform: translateX(2px);
	}

	.pager {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 3rem;
		max-width: var(--measure);
	}
	.pg {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1rem 1.15rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		transition: border-color 160ms var(--ease-out);
		min-width: 0;
	}
	.pg:hover {
		border-color: var(--line-strong);
	}
	.pg.next {
		text-align: right;
	}
	.pg .label {
		color: var(--faint);
	}
	.pt {
		color: var(--text);
		font-size: 0.9375rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
