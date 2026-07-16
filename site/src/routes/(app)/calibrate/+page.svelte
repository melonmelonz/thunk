<script lang="ts">
	// The calibration instrument: test out of what you already know. Three checks
	// per module; pass all three and that module is placed out (mastered-by-
	// placement, +50). One check at a time, no backtracking, stop anytime. The
	// register is calibration - quiet, plain, zero exam-anxiety. It reuses the same
	// CheckCard instrument in `placement` mode (no per-card GRADE); a single
	// CONTINUE flow drives grading.
	import { placement, checkById, moduleById, modules } from '$lib/content';
	import { grade, type Response } from '$lib/grade';
	import { moduleResults, passedModuleIds } from '$lib/placement';
	import { xp } from '$lib/xp.svelte';
	import CheckCard from '$lib/components/CheckCard.svelte';
	import Meta from '$lib/components/Meta.svelte';

	// Resolve the placement refs to real checks once (skip any that went missing).
	const items = placement
		.map((p) => ({ moduleId: p.module, check: checkById(p.check) }))
		.filter((it): it is { moduleId: string; check: NonNullable<typeof it.check> } => !!it.check);

	type Phase = 'intro' | 'run' | 'report';
	let phase = $state<Phase>('intro');
	let index = $state(0);
	let current = $state<Response | null>(null);
	// checkId -> correct? (absent = not reached).
	let answered = $state<Record<string, boolean>>({});
	// Modules already done before this run, so the report can phosphor only the
	// ones THIS run newly placed.
	let newlyPlaced = $state<Set<string>>(new Set());

	const total = items.length;
	// Placement covers M0-M6 only - you cannot test out of your first contribution
	// (M7). Report against the number of PLACEABLE modules, not the whole ladder,
	// so "of N" never promises a module the calibration can't reach.
	const placeable = new Set(placement.map((p) => p.module)).size;
	const item = $derived(items[index]);
	const done = $derived(xp.hasAchievement('calibrated'));

	const results = $derived(moduleResults(placement, answered));
	const placedCount = $derived(results.filter((r) => r.verdict === 'pass').length);

	function start() {
		index = 0;
		current = null;
		answered = {};
		phase = 'run';
	}

	function advance() {
		if (!current || !item) return;
		// Grade this item and record it; CONTINUE is disabled until answerable, so
		// grade() never returns null here.
		answered = { ...answered, [item.check.id]: grade(item.check, current) === true };
		current = null;
		if (index + 1 >= total) finish();
		else index += 1;
	}

	function finish() {
		const before = new Set(modules.filter((m) => xp.isModuleDone(m.id)).map((m) => m.id));
		const passed = passedModuleIds(placement, answered);
		newlyPlaced = new Set(passed.filter((id) => !before.has(id)));
		xp.completePlacement(passed);
		phase = 'report';
	}

	function chCode(moduleId: string): string {
		const m = moduleById(moduleId);
		return 'CH-' + String(Number((m?.tag ?? '').replace(/\D/g, ''))).padStart(2, '0');
	}
	function title(moduleId: string): string {
		return moduleById(moduleId)?.title ?? moduleId;
	}
</script>

<Meta
	title="CALIBRATION · thunk"
	description="Test out of what you already know. Pass all three placement checks in a module to place out of it. Local only, nothing sent anywhere."
	ogTitle="Calibration - thunk"
	ogDescription="Test out of what you already know, module by module."
/>

{#if phase === 'intro'}
	<section class="intro">
		<p class="eyebrow label">Calibration</p>
		<h1>Test out of what you already know</h1>
		<p class="lede">
			A short calibration across the whole ladder. Three checks per module - pass all three and
			that module is marked mastered, placed out without grading its lessons.
		</p>

		<ul class="rules">
			<li><span class="rk mono" aria-hidden="true">01</span> One check at a time, in order. No going back once you continue.</li>
			<li><span class="rk mono" aria-hidden="true">02</span> Pass all three of a module to place out of it. Miss one and that module just stays where it was.</li>
			<li><span class="rk mono" aria-hidden="true">03</span> Stop whenever you like. The modules you finished still count.</li>
			<li><span class="rk mono" aria-hidden="true">04</span> Take it once, or run it again later. A retake can only add mastery, never take it away.</li>
		</ul>

		<div class="cta">
			<button class="btn primary mono" onclick={start}>{done ? 'RUN AGAIN' : 'START CALIBRATION'}</button>
			<a class="btn mono" href="/progress/">BACK TO OPERATOR</a>
		</div>
		<p class="foot mono">{total} items &middot; {placeable} modules &middot; graded in this browser, nothing sent anywhere.</p>
	</section>
{:else if phase === 'run'}
	<section class="run" aria-label="calibration">
		<div class="run-head">
			<p class="eyebrow label">Calibration</p>
			<p class="counter mono tnum" aria-live="polite">
				ITEM {String(index + 1).padStart(2, '0')} <span class="of">/</span> {String(total).padStart(2, '0')}
			</p>
		</div>
		<div class="progress" aria-hidden="true">
			<span class="pfill" style={`width:${((index) / total) * 100}%`}></span>
		</div>

		{#if item}
			{#key index}
				<div class="item">
					<CheckCard check={item.check} n={index + 1} placement onrespond={(r) => (current = r)} />
				</div>
			{/key}
		{/if}

		<div class="run-cta">
			<button class="btn primary mono" disabled={!current} onclick={advance}>
				{index + 1 >= total ? 'FINISH' : 'CONTINUE'}
			</button>
			<button class="btn ghost mono" onclick={finish}>STOP HERE</button>
		</div>
		<p class="foot mono">No backtracking. Continue records this answer and moves on.</p>
	</section>
{:else}
	<section class="report" aria-label="calibration report">
		<p class="eyebrow label">Calibration report</p>
		<h1>{placedCount === 0 ? 'Nothing placed out' : `Placed out of ${placedCount} of ${placeable}`}</h1>
		<p class="lede">
			{#if placedCount === 0}
				No module cleared all three this run. Nothing changed - the ladder is exactly where you
				left it. You can run the calibration again anytime.
			{:else}
				The modules below are marked mastered by placement. You can start anywhere above them, or
				grade their lessons later to earn the badge the long way.
			{/if}
		</p>

		<ul class="rows">
			{#each results as r (r.moduleId)}
				<li class="rrow" class:pass={r.verdict === 'pass'} class:fresh={newlyPlaced.has(r.moduleId)}>
					<span class="rtag mono tnum">{chCode(r.moduleId)}</span>
					<span class="rtitle">{title(r.moduleId)}</span>
					<span class="rscore mono tnum">{r.correct}<span class="rslash">/</span>{r.checks.length}</span>
					<span class="rverdict mono">{r.verdict === 'pass' ? 'PLACED' : 'SKIP'}</span>
				</li>
			{/each}
		</ul>

		<div class="cta">
			<a class="btn primary mono" href="/progress/">OPEN THE OPERATOR CARD</a>
			<a class="btn mono" href="/">BACK TO THE LADDER</a>
			<button class="btn ghost mono" onclick={start}>RUN AGAIN</button>
		</div>
	</section>
{/if}

<style>
	section {
		max-width: 44rem;
	}
	.eyebrow {
		color: var(--phosphor);
		margin-bottom: 0.9rem;
	}
	h1 {
		font-size: clamp(1.8rem, 4.5vw, 2.5rem);
		color: #fff;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.lede {
		margin-top: 1rem;
		font-size: 1rem;
		line-height: 1.65;
		color: var(--muted);
		max-width: 38rem;
	}

	/* ---- Intro rules -------------------------------------------------- */
	.rules {
		list-style: none;
		margin-top: 1.8rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.rules li {
		display: grid;
		grid-template-columns: 2rem 1fr;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.85rem 1rem;
		border-top: 1px solid var(--line-soft);
		font-size: 0.9375rem;
		color: var(--muted);
		line-height: 1.55;
	}
	.rules li:first-child {
		border-top: none;
	}
	.rk {
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		color: var(--faint);
	}

	.cta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		margin-top: 1.8rem;
	}
	.btn {
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--muted);
		padding: 0.6rem 1.1rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
		display: inline-flex;
		align-items: center;
	}
	.btn:hover:not(:disabled) {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
	}
	.btn.primary {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.btn.primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--phosphor) 8%, var(--s2));
	}
	.btn.ghost {
		background: none;
		color: var(--faint);
	}
	.btn.ghost:hover {
		color: var(--muted);
		border-color: var(--line);
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.foot {
		margin-top: 1.4rem;
		font-size: 0.625rem;
		letter-spacing: 0.1em;
		color: var(--faint);
	}

	/* ---- Run --------------------------------------------------------- */
	.run-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	.run-head .eyebrow {
		margin-bottom: 0;
	}
	.counter {
		font-size: 0.8125rem;
		letter-spacing: 0.1em;
		color: var(--muted);
	}
	.counter .of {
		color: var(--faint);
		margin-inline: 0.15em;
	}
	.progress {
		position: relative;
		height: 3px;
		margin-top: 0.85rem;
		background: var(--s3);
		border-radius: 2px;
		overflow: hidden;
	}
	.pfill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
		transition: width 240ms var(--ease-out);
	}
	.item {
		margin-top: 1.6rem;
	}
	.run-cta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		margin-top: 1.4rem;
	}

	/* ---- Report ------------------------------------------------------ */
	.rows {
		list-style: none;
		margin-top: 1.8rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.rrow {
		display: grid;
		grid-template-columns: 4rem 1fr auto 4.5rem;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem 1rem;
		border-top: 1px solid var(--line-soft);
	}
	.rrow:first-child {
		border-top: none;
	}
	.rtag {
		font-size: 0.6875rem;
		letter-spacing: 0.08em;
		color: var(--faint);
	}
	.rrow.pass .rtag {
		color: var(--phosphor);
	}
	.rtitle {
		font-size: 0.9375rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rrow.pass .rtitle {
		color: var(--text);
	}
	.rscore {
		font-size: 0.75rem;
		color: var(--muted);
		text-align: right;
	}
	.rslash {
		color: var(--faint);
		margin-inline: 0.1em;
	}
	.rverdict {
		font-size: 0.625rem;
		letter-spacing: 0.14em;
		color: var(--faint);
		text-align: right;
	}
	.rrow.pass .rverdict {
		color: var(--phosphor);
	}
	/* Newly placed this run get the phosphor edge; already-done stay quiet. */
	.rrow.fresh {
		background: color-mix(in srgb, var(--phosphor) 5%, transparent);
		box-shadow: inset 2px 0 0 var(--phosphor);
	}

	@media (max-width: 520px) {
		.rrow {
			grid-template-columns: 3.25rem 1fr auto;
		}
		.rverdict {
			display: none;
		}
	}
</style>
