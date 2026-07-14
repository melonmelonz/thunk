<script lang="ts">
	import type { PageData } from './$types';
	import CheckCard from '$lib/components/CheckCard.svelte';
	let { data }: { data: PageData } = $props();
	// Derived, not destructured: client-side nav between lessons reuses this
	// component and updates `data` reactively.
	const module = $derived(data.module);
	const lesson = $derived(data.lesson);
	const prev = $derived(data.prev);
	const next = $derived(data.next);
	const index = $derived(data.index);
	// Channel language: M0 -> CH-00, lesson 1 -> .01
	const ch = $derived(String(Number(module.tag.replace(/\D/g, ''))).padStart(2, '0'));
	const chLesson = $derived(`CH-${ch}.${String(index + 1).padStart(2, '0')}`);
</script>

<svelte:head>
	<title>{chLesson} &middot; {lesson.title} &middot; thunk</title>
	<meta name="description" content={`${module.title}, lesson ${index + 1} of ${module.lessonCount}: ${lesson.title}.`} />
</svelte:head>

<nav class="crumbs label" aria-label="breadcrumb">
	<a href="/">thunk</a>
	<span class="sl" aria-hidden="true">/</span>
	<a href={`/m/${module.id}/`}>{module.tag}</a>
	<span class="sl" aria-hidden="true">/</span>
	<span class="here tnum">L{String(index + 1).padStart(2, '0')}</span>
</nav>

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
	     and carried through the export. No client-side markdown parser. -->
	<div class="prose">
		{@html lesson.bodyHtml}
	</div>
</article>

<section class="checks" aria-label="checks">
	<header class="checks-head">
		<h2 class="label">Checks</h2>
		<p class="ch-note">
			Answer these to prove the lesson landed. Interactive grading arrives in S-C - nothing is ever
			sent anywhere.
		</p>
	</header>
	<div class="check-grid">
		{#each lesson.checks as check, i (check.id)}
			<CheckCard {check} n={i + 1} />
		{/each}
	</div>
</section>

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
	.crumbs {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 2.25rem;
	}
	.crumbs a {
		color: var(--muted);
	}
	.crumbs a:hover {
		color: var(--text);
	}
	.crumbs .sl {
		color: var(--faint);
	}
	.crumbs .here {
		color: var(--phosphor);
	}

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
		color: #fff;
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
		color: #fff;
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
		color: #fff;
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
		border-color: #24303e;
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
