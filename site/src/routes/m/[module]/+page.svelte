<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	// Derived, not destructured: client-side nav between modules reuses this
	// component and updates `data` reactively.
	const module = $derived(data.module);
	const prevModule = $derived(data.prevModule);
	const nextModule = $derived(data.nextModule);
</script>

<svelte:head>
	<title>{module.tag} {module.title} - thunk</title>
	<meta name="description" content={`${module.title}: ${module.lessonCount} lessons, ${module.checkCount} checks.`} />
</svelte:head>

<nav class="crumbs label" aria-label="breadcrumb">
	<a href="/">thunk</a>
	<span class="sl" aria-hidden="true">/</span>
	<span class="here">{module.tag}</span>
</nav>

<header class="mhead">
	<p class="eyebrow label">Module {module.tag}</p>
	<h1>{module.title}</h1>
	<p class="counts label tnum">
		{String(module.lessonCount).padStart(2, '0')} lessons
		<span class="mid">·</span>
		{String(module.checkCount).padStart(2, '0')} checks
	</p>
</header>

<ol class="lessons">
	{#each module.lessons as lesson, i (lesson.id)}
		<li>
			<a class="row reveal" href={`/m/${module.id}/${lesson.id}/`} style={`--i:${i}`}>
				<span class="n tnum" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
				<span class="t">{lesson.title}</span>
				<span class="c label tnum">{String(lesson.checks.length).padStart(2, '0')} checks</span>
				<span class="chev" aria-hidden="true">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none"
						><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg
					>
				</span>
			</a>
		</li>
	{/each}
</ol>

<nav class="pager" aria-label="modules">
	{#if prevModule}
		<a class="pg prev" href={`/m/${prevModule.id}/`}>
			<span class="label">Previous module</span>
			<span class="pt">{prevModule.tag} {prevModule.title}</span>
		</a>
	{:else}
		<span></span>
	{/if}
	{#if nextModule}
		<a class="pg next" href={`/m/${nextModule.id}/`}>
			<span class="label">Next module</span>
			<span class="pt">{nextModule.tag} {nextModule.title}</span>
		</a>
	{/if}
</nav>

<style>
	.crumbs {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 2rem;
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

	.mhead {
		max-width: 44rem;
		margin-bottom: 2.5rem;
	}
	.eyebrow {
		color: var(--phosphor);
		margin-bottom: 0.9rem;
	}
	h1 {
		font-size: clamp(1.9rem, 4.5vw, 2.75rem);
		color: #fff;
		letter-spacing: -0.02em;
	}
	.counts {
		margin-top: 1rem;
		color: var(--muted);
	}
	.counts .mid {
		color: var(--faint);
		margin-inline: 0.2em;
	}

	.lessons {
		list-style: none;
	}
	.row {
		display: grid;
		grid-template-columns: 2.75rem 1fr auto 1.25rem;
		align-items: center;
		gap: 1.25rem;
		padding: 1.1rem 1rem 1.1rem 0.5rem;
		border-top: 1px solid var(--line);
		transition:
			background 140ms var(--ease-out),
			padding-left 140ms var(--ease-out);
	}
	.lessons li:last-child .row {
		border-bottom: 1px solid var(--line);
	}
	.row:hover {
		background: var(--s1);
		padding-left: 1rem;
	}
	.n {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--faint);
		transition: color 140ms var(--ease-out);
	}
	.row:hover .n {
		color: var(--phosphor);
	}
	.t {
		font-size: 1.0625rem;
		color: var(--text);
	}
	.c {
		color: var(--muted);
	}
	.chev {
		color: var(--faint);
		display: inline-flex;
		transition:
			color 140ms var(--ease-out),
			transform 140ms var(--ease-out);
	}
	.row:hover .chev {
		color: var(--muted);
		transform: translateX(2px);
	}

	.pager {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 3rem;
	}
	.pg {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1rem 1.15rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		transition: border-color 160ms var(--ease-out);
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
	}

	@media (max-width: 640px) {
		.c {
			display: none;
		}
		.row {
			grid-template-columns: 2.25rem 1fr 1rem;
		}
	}

	.reveal {
		animation: rise 380ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 40ms + 60ms);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
