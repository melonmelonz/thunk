<script lang="ts">
	import { curriculum, modules, moduleById, lessonNeighbours } from '$lib/content';
	import ChannelStrip from '$lib/components/ChannelStrip.svelte';
	import { xp } from '$lib/xp.svelte';
	import Meta from '$lib/components/Meta.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	// CONTINUE: resume the furthest in-progress lesson. Null (hidden) at the zero
	// state; empty on the prerendered HTML, appears after the store hydrates.
	const resume = $derived.by(() => {
		const r = xp.resume;
		if (!r) return null;
		const m = moduleById(r.moduleId);
		if (!m) return null;
		const { index } = lessonNeighbours(m, r.lessonId);
		const lesson = m.lessons[index];
		if (!lesson) return null;
		const code =
			'CH-' +
			String(Number(m.tag.replace(/\D/g, ''))).padStart(2, '0') +
			'.' +
			String(index + 1).padStart(2, '0');
		return { href: `/m/${m.id}/${lesson.id}/`, code, title: lesson.title };
	});
</script>

<Meta
	title="thunk - a systems course, from the ground up"
	description="An offline systems course. From true zero to DOOM on a panel, built and run on your own machine."
	ogDescription="From true zero to DOOM on a panel. An offline systems course."
/>

<div class="theme-corner">
	<ThemeToggle />
</div>

<section class="hero">
	<p class="eyebrow label">Offline systems course</p>
	<h1>thunk<sup class="fn" aria-hidden="true">1</sup></h1>
	<p class="tagline">
		From true zero to DOOM on a panel. You build the kernel, the driver, and the bus, then watch
		real hardware come up. Nothing leaves this machine.
	</p>

	<!-- The soul line: Penn's own definition, set as a datasheet footnote tied
	     to the wordmark. Small, quiet, undecorated. -->
	<p class="def">
		<span class="fn-mark mono" aria-hidden="true">1</span>
		<span class="def-text mono"
			>thunk <span class="pos">(n.)</span> - a piece of code set aside to run later, not thrown
			away.</span
		>
	</p>

	{#if resume}
		<a class="resume" href={resume.href}>
			<span class="rs-tick" aria-hidden="true"></span>
			<span class="rs-word mono">CONTINUE</span>
			<span class="rs-sep" aria-hidden="true">&middot;</span>
			<span class="rs-code mono tnum">{resume.code}</span>
			<span class="rs-title">{resume.title}</span>
		</a>
	{/if}

	<!-- Truth badges: all three are true of this build. Hairlines, no fill. -->
	<ul class="badges" aria-label="guarantees">
		<li class="badge mono">AIR-GAPPED</li>
		<li class="badge mono">NO ACCOUNTS</li>
		<li class="badge mono">NO TELEMETRY</li>
	</ul>

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

	<!-- The real ILI9341 bring-up the course teaches, as a quiet ornament:
	     command bytes carry weight, the one data byte (55, RGB565) sits dimmer.
	     SWRESET, SLPOUT, COLMOD=55, DISPON | CASET, PASET, RAMWR. -->
	<div class="initseq" aria-label="ILI9341 init and draw sequence">
		<span class="iseq-label label">INIT SEQ</span>
		<span class="bytes mono tnum">
			<span class="cmd">01</span> <span class="cmd">11</span> <span class="cmd">3A</span>
			<span class="data">55</span> <span class="cmd">29</span>
			<span class="mid" aria-hidden="true">&middot;</span>
			<span class="cmd">2A</span> <span class="cmd">2B</span> <span class="cmd">2C</span>
		</span>
	</div>
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
			<span class="smpte">
				<i style="--c:#38443b"></i><i style="--c:#2c3730"></i><i style="--c:#3d463f"></i><i
					style="--c:#2f3a34"></i><i style="--c:#434b44"></i><i style="--c:#28312b"></i><i
					style="--c:#353d37"></i>
			</span>
			<span class="standby label">STANDBY</span>
		</span>
		<span class="bench-body">
			<span class="bench-title">The Bench</span>
			<span class="bench-sub">The simulated panel and the live bus trace that drew it.</span>
		</span>
		<span class="bench-state label">Live</span>
	</a>
</section>

<style>
	/* Floating theme switch, top-right - the front door has no status bar to
	   carry it, so it sits quietly in the corner. */
	.theme-corner {
		position: fixed;
		top: clamp(0.75rem, 2vw, 1.25rem);
		right: clamp(0.75rem, 2vw, 1.25rem);
		z-index: 50;
	}
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
		color: var(--text-strong);
	}
	.fn {
		font-family: var(--font-mono);
		font-weight: 400;
		font-size: 0.9rem;
		line-height: 1;
		vertical-align: super;
		color: var(--faint);
		margin-left: 0.15em;
	}
	.tagline {
		margin-top: 1.4rem;
		font-size: 1.0625rem;
		line-height: 1.65;
		color: var(--muted);
		max-width: 34rem;
	}

	/* The definition, typeset: a footnote, not a banner. */
	.def {
		display: flex;
		gap: 0.55rem;
		margin-top: 1.6rem;
		max-width: 36rem;
	}
	.fn-mark {
		font-size: 0.625rem;
		line-height: 1.5;
		color: var(--faint);
		vertical-align: super;
		flex: none;
	}
	.def-text {
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--muted);
		letter-spacing: 0.01em;
	}
	.def-text .pos {
		color: var(--faint);
	}

	/* CONTINUE: resume the furthest lesson. Phosphor-edged, quiet, one line. */
	.resume {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1.6rem;
		padding: 0.5rem 0.85rem;
		max-width: 100%;
		border: 1px solid color-mix(in srgb, var(--phosphor) 32%, var(--line));
		border-radius: 2px;
		background: color-mix(in srgb, var(--phosphor) 6%, var(--s1));
		transition:
			border-color 160ms var(--ease-out),
			background 160ms var(--ease-out);
	}
	.resume:hover {
		border-color: color-mix(in srgb, var(--phosphor) 55%, var(--line));
		background: color-mix(in srgb, var(--phosphor) 10%, var(--s1));
	}
	.rs-tick {
		width: 5px;
		height: 12px;
		border-radius: 1px;
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
		flex: none;
	}
	.rs-word {
		font-size: 0.625rem;
		letter-spacing: 0.16em;
		color: var(--phosphor);
		flex: none;
	}
	.rs-sep {
		color: var(--faint);
	}
	.rs-code {
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
		color: var(--muted);
		flex: none;
	}
	.rs-title {
		font-size: 0.8125rem;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.badges {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}
	.badge {
		font-size: 0.625rem;
		letter-spacing: 0.14em;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.32rem 0.55rem;
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

	/* INIT SEQ: a single hairline-ruled line of the real bring-up bytes. */
	.initseq {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		margin-top: 2.25rem;
		padding: 0.6rem 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		max-width: 30rem;
	}
	.iseq-label {
		color: var(--faint);
		flex: none;
	}
	.initseq .bytes {
		font-size: 0.8125rem;
		letter-spacing: 0.12em;
	}
	.initseq .cmd {
		color: var(--muted);
	}
	.initseq .data {
		color: var(--faint);
	}
	.initseq .mid {
		color: var(--line);
		margin-inline: 0.2em;
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
		border-color: var(--line-strong);
		background: var(--s2);
	}
	/* The teaser screen: static SMPTE mini-bars in PVM phosphor tones (muted
	   greens and greys, never rainbow), captioned STANDBY. */
	.bench-mark {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}
	.smpte {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		width: 46px;
		height: 30px;
		border: 1px solid var(--line);
		border-radius: 2px;
		overflow: hidden;
		filter: saturate(0.75);
	}
	.smpte i {
		background: var(--c);
	}
	.standby {
		font-size: 0.5rem;
		letter-spacing: 0.16em;
		color: var(--faint);
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
