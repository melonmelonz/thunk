<svelte:head>
	<title>THE BENCH &middot; thunk</title>
	<meta name="description" content="The simulated panel and the live bus trace that drew it." />
</svelte:head>

<nav class="crumbs label" aria-label="breadcrumb">
	<a href="/">thunk</a>
	<span class="sl" aria-hidden="true">/</span>
	<span class="here">Bench</span>
</nav>

<section class="stage">
	<div class="panel" aria-hidden="true">
		<div class="bezel">
			<div class="glass">
				<span class="scan s1"></span>
				<span class="scan s2"></span>
				<span class="dot"></span>
			</div>
		</div>
		<span class="plabel label">240 &times; 320 &middot; ILI9341</span>
	</div>

	<div class="copy">
		<p class="eyebrow label">The instrument</p>
		<h1>The Bench</h1>
		<p class="lede">
			The corridor finale, drawn on a simulated panel by the real driver - boot traffic first
			(<span class="mono">SWRESET</span>, <span class="mono">SLPOUT</span>,
			<span class="mono">CASET</span>/<span class="mono">PASET</span>), then frames - with the bus
			trace live underneath.
		</p>
		<p class="status">
			<span class="tick" aria-hidden="true"></span>
			<span class="stext"
				>The instrument arrives in <span class="mono">S-B</span>: the WASM sim, transport controls, and
				the scrubbing trace readout.</span
			>
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
	.crumbs {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 2.5rem;
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

	.stage {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: clamp(2rem, 6vw, 4.5rem);
		align-items: center;
		padding-block: clamp(1rem, 5vw, 3rem);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		align-items: center;
	}
	.bezel {
		width: 240px;
		height: 320px;
		padding: 12px;
		background: linear-gradient(#0c1119, #090d12);
		border: 1px solid var(--line);
		border-radius: 4px;
	}
	.glass {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 2px;
		background:
			repeating-linear-gradient(var(--bg) 0, var(--bg) 2px, #0b1017 2px, #0b1017 3px),
			radial-gradient(120% 90% at 50% 40%, #0e1620 0%, #080b10 80%);
		overflow: hidden;
		box-shadow: inset 0 0 40px #05070b;
	}
	.scan {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--phosphor);
		box-shadow: 0 0 8px var(--phosphor-dim);
	}
	.scan.s1 {
		top: 34%;
		opacity: 0.6;
	}
	.scan.s2 {
		top: 62%;
		opacity: 0.25;
	}
	.dot {
		position: absolute;
		left: 50%;
		top: 48%;
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--phosphor);
		box-shadow: 0 0 10px var(--phosphor);
	}
	.plabel {
		color: var(--faint);
	}

	.copy {
		max-width: 34rem;
	}
	.eyebrow {
		color: var(--phosphor);
		margin-bottom: 1rem;
	}
	h1 {
		font-size: clamp(2rem, 5vw, 3rem);
		color: #fff;
		letter-spacing: -0.02em;
	}
	.lede {
		margin-top: 1.3rem;
		font-size: 1.0625rem;
		line-height: 1.7;
		color: var(--muted);
	}
	.lede .mono {
		font-size: 0.875em;
		color: var(--text);
	}
	.status {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		margin-top: 1.6rem;
		padding: 0.9rem 1.1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		font-size: 0.9375rem;
		color: var(--text);
	}
	.status .mono {
		color: var(--phosphor);
	}
	.status .tick {
		width: 8px;
		height: 8px;
		margin-top: 0.35rem;
		border-radius: 1px;
		background: var(--phosphor);
		flex: none;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1.9rem;
		color: var(--muted);
		font-size: 0.9375rem;
		transition: color 140ms var(--ease-out);
	}
	.back:hover {
		color: var(--text);
	}

	@media (max-width: 720px) {
		.stage {
			grid-template-columns: 1fr;
		}
		.bezel {
			width: 200px;
			height: 267px;
		}
	}
</style>
