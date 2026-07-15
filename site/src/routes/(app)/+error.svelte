<script lang="ts">
	// A bad lesson/module id (or any load error inside the shell) renders here, in
	// the workspace pane - the dead channel, not a blank. Same SMPTE-bar language
	// as the top-level 404, sized to sit inside the instrument rather than take
	// the whole screen.
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>NO SIGNAL &middot; thunk</title>
</svelte:head>

<section class="dead">
	<div class="bars" aria-hidden="true">
		<span style="--c:#3a3f45"></span>
		<span style="--c:#3a3b30"></span>
		<span style="--c:#2f3a3a"></span>
		<span style="--c:#2b3330"></span>
		<span style="--c:#352d38"></span>
		<span style="--c:#33262a"></span>
		<span style="--c:#26303a"></span>
	</div>

	<div class="readout">
		<p class="code mono tnum">{page.status ?? 404}</p>
		<h1>No signal</h1>
		<p class="msg">
			{page.error?.message ?? 'That channel is not part of the course.'} Pick one from the rail, or
			head back to the ladder.
		</p>
		<a class="back" href="/">
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none"
				><path d="M9 3L5 7l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg
			>
			Back to the ladder
		</a>
	</div>
</section>

<style>
	.dead {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		max-width: 34rem;
	}
	.bars {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		height: 108px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
		filter: saturate(0.7);
	}
	.bars span {
		background: var(--c);
	}
	.code {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		letter-spacing: 0.2em;
		color: var(--phosphor);
		margin-bottom: 0.9rem;
	}
	h1 {
		font-size: clamp(1.9rem, 5vw, 2.6rem);
		color: #fff;
		letter-spacing: -0.02em;
	}
	.msg {
		margin-top: 1rem;
		color: var(--muted);
		line-height: 1.65;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1.6rem;
		color: var(--muted);
		font-size: 0.9375rem;
		transition: color 140ms var(--ease-out);
	}
	.back:hover {
		color: var(--text);
	}
</style>
