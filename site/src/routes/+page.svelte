<script lang="ts">
	import { curriculum, modules } from '$lib/content';
	import ChannelStrip from '$lib/components/ChannelStrip.svelte';
</script>

<svelte:head>
	<title>thunk - a systems course, from the ground up</title>
	<meta
		name="description"
		content="An offline systems course. From true zero to DOOM on a panel, built and run on your own machine."
	/>
	<meta property="og:title" content="thunk" />
	<meta
		property="og:description"
		content="From true zero to DOOM on a panel. An offline systems course."
	/>
	<meta property="og:type" content="website" />
</svelte:head>

<section class="hero">
	<p class="eyebrow label">Offline systems course</p>
	<h1>thunk</h1>
	<p class="tagline">
		From true zero to DOOM on a panel. You build the kernel, the driver, and the bus, then watch
		real hardware come up. Nothing leaves this machine.
	</p>
	<dl class="readout tnum" aria-label="course size">
		<div>
			<dt class="label">Modules</dt>
			<dd>{String(curriculum.moduleCount).padStart(2, '0')}</dd>
		</div>
		<span class="v" aria-hidden="true"></span>
		<div>
			<dt class="label">Lessons</dt>
			<dd>{curriculum.lessonCount}</dd>
		</div>
		<span class="v" aria-hidden="true"></span>
		<div>
			<dt class="label">Checks</dt>
			<dd>{curriculum.checkCount}</dd>
		</div>
	</dl>
</section>

<section class="rack" aria-label="the ladder">
	<header class="rack-head">
		<h2 class="label">The ladder</h2>
		<p class="hint">Pass every check in a module to unlock the next.</p>
	</header>
	<ol class="strips">
		{#each modules as module, i (module.id)}
			<li><ChannelStrip {module} index={i} /></li>
		{/each}
	</ol>
</section>

<section class="bench-teaser reveal-late">
	<a class="bench" href="/bench/">
		<span class="bench-mark" aria-hidden="true">
			<span class="scan"></span>
		</span>
		<span class="bench-body">
			<span class="bench-title">The Bench</span>
			<span class="bench-sub">The simulated panel and the live bus trace that drew it.</span>
		</span>
		<span class="bench-state label">Arriving S-B</span>
	</a>
</section>

<style>
	.hero {
		padding-block: clamp(1rem, 4vw, 2.5rem) clamp(2.5rem, 6vw, 4rem);
		max-width: 46rem;
	}
	.eyebrow {
		color: var(--phosphor);
		margin-bottom: 1.1rem;
	}
	h1 {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: clamp(3rem, 9vw, 4.75rem);
		letter-spacing: -0.03em;
		line-height: 0.95;
		color: #fff;
	}
	.tagline {
		margin-top: 1.4rem;
		font-size: 1.0625rem;
		line-height: 1.65;
		color: var(--muted);
		max-width: 34rem;
	}

	.readout {
		display: flex;
		align-items: center;
		gap: 1.75rem;
		margin-top: 2.25rem;
	}
	.readout div {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.readout dt {
		color: var(--faint);
	}
	.readout dd {
		font-family: var(--font-mono);
		font-size: 1.5rem;
		font-weight: 400;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.readout .v {
		width: 1px;
		height: 2rem;
		background: var(--line);
	}

	.rack-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.25rem;
	}
	.rack-head h2 {
		color: var(--muted);
	}
	.hint {
		font-size: 0.8125rem;
		color: var(--faint);
	}
	.strips {
		list-style: none;
		margin-top: 0.75rem;
	}

	.bench-teaser {
		margin-top: 2.5rem;
	}
	.bench {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1.25rem;
		padding: 1.1rem 1.25rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		transition:
			border-color 160ms var(--ease-out),
			background 160ms var(--ease-out);
	}
	.bench:hover {
		border-color: #24303e;
		background: var(--s2);
	}
	.bench-mark {
		position: relative;
		width: 46px;
		height: 34px;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: repeating-linear-gradient(
			var(--bg) 0,
			var(--bg) 2px,
			#0c1219 2px,
			#0c1219 3px
		);
		overflow: hidden;
	}
	.bench-mark .scan {
		position: absolute;
		left: 0;
		right: 0;
		top: 30%;
		height: 1px;
		background: var(--phosphor);
		opacity: 0.7;
		box-shadow: 0 0 8px var(--phosphor-dim);
	}
	.bench-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.bench-title {
		font-weight: 500;
		font-size: 1rem;
		color: var(--text);
	}
	.bench-sub {
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.bench-state {
		color: var(--faint);
		white-space: nowrap;
	}
	@media (max-width: 640px) {
		.bench-sub {
			display: none;
		}
		.readout {
			gap: 1.1rem;
		}
		.rack-head {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.35rem;
		}
	}

	.reveal-late {
		animation: rise 420ms var(--ease-out) both;
		animation-delay: 480ms;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
