<script lang="ts">
	import { modules } from '$lib/content';
	import { xp } from '$lib/xp.svelte';
	import { ACHIEVEMENTS, levelProgress, xpForLevel, MAX_LEVEL } from '$lib/xp-curve';
	import Meta from '$lib/components/Meta.svelte';

	const prog = $derived(levelProgress(xp.xp));
	const lvl = $derived(String(xp.level).padStart(2, '0'));
	const xpText = $derived(xp.xp.toLocaleString('en-US'));
	const nextAt = $derived(xp.level >= MAX_LEVEL ? null : xpForLevel(xp.level + 1));
	// A fresh card is not a sad empty page: it is a calibrated instrument at rest,
	// waiting for signal. The standby line says so in the same register as the rail.
	const fresh = $derived(xp.xp === 0);
	// Earned tally for the achievements header (EARNED NN / total).
	const earnedCount = $derived(ACHIEVEMENTS.filter((a) => xp.hasAchievement(a.id)).length);

	function fmtDate(at: number): string {
		try {
			return new Date(at).toISOString().slice(0, 10);
		} catch {
			return '';
		}
	}

	// Export: the whole record as a downloaded JSON, no network.
	function exportProgress() {
		const blob = new Blob([xp.exportJson()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'thunk-progress.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	let importError = $state('');
	let importOk = $state(false);
	let fileEl: HTMLInputElement;

	async function onImport(e: Event) {
		importError = '';
		importOk = false;
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const text = await file.text();
		const res = xp.importJson(text);
		if (res.ok) importOk = true;
		else importError = res.error ?? 'could not import';
		input.value = '';
	}

	// Reset: two-step, no browser confirm(). Type YES to arm CONFIRM.
	let resetArmed = $state(false);
	let resetWord = $state('');
	function doReset() {
		if (resetWord !== 'YES') return;
		xp.reset();
		resetArmed = false;
		resetWord = '';
	}
</script>

<Meta
	title="OPERATOR · thunk"
	description="Your operator card: level, XP, per-module progress, and achievements. Local only, never sent anywhere."
	ogTitle="Operator - thunk"
/>

<header class="ohead">
	<p class="eyebrow label">The operator card</p>
	<h1>Operator</h1>
	<p class="lede">
		Everything the course knows about your run, kept in this browser and nowhere else. No account,
		no identity - just the instrument reading.
	</p>
	{#if fresh}
		<p class="standby mono">
			<span class="sb-tick" aria-hidden="true"></span>NO SIGNAL &middot; grade your first check to bring
			the card up.
		</p>
	{/if}
</header>

<!-- Big level + XP meter. -->
<section class="level" aria-label="level and experience">
	<div class="lvl-read">
		<span class="lvl mono tnum">LVL {lvl}</span>
		<span class="xp-read mono tnum">{xpText} XP</span>
	</div>
	<div class="big-meter" aria-hidden="true">
		<span class="bm-fill" style={`width:${prog.fill * 100}%`}></span>
		<span class="bm-origin"></span>
	</div>
	<p class="lvl-note mono tnum">
		{#if nextAt}NEXT LVL {String(xp.level + 1).padStart(2, '0')} AT {nextAt.toLocaleString('en-US')} XP{:else}MAX LEVEL{/if}
	</p>
</section>

<!-- Calibration: test out of prior knowledge. -->
<section class="calibrate" aria-label="calibration">
	<a class="cal-link" href="/calibrate/">
		<span class="cal-mark" aria-hidden="true">
			<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
				<path d="M2 13h14M9 13V3M4 13V8m10 5V6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
			</svg>
		</span>
		<span class="cal-body">
			<span class="cal-title mono">CALIBRATION</span>
			<span class="cal-sub">Test out of what you already know</span>
		</span>
		<span class="cal-chev" aria-hidden="true">
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
		</span>
	</a>
</section>

<!-- Per-module channel meters. -->
<section class="channels" aria-label="module progress">
	<h2 class="label">Channels</h2>
	<ul class="clist">
		{#each modules as m, i (m.id)}
			{@const s = xp.moduleStat(m, i)}
			<li class="chrow" class:mastered={s.mastered}>
				<span class="ctag mono tnum">CH-{String(Number(m.tag.replace(/\D/g, ''))).padStart(2, '0')}</span>
				<span class="ctitle">{m.title}</span>
				<span class="cmeter" aria-hidden="true">
					<span class="cfill" class:done={s.mastered} style={`width:${s.pct}%`}></span>
				</span>
				{#if s.placed && s.passed < s.total}
					<span class="ccount placed mono">PLACED</span>
				{:else}
					<span class="ccount mono tnum">
						{String(s.passed).padStart(2, '0')}<span class="cslash">/</span>{String(s.total).padStart(2, '0')}
					</span>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<!-- Achievements grid. -->
<section class="ach" aria-label="achievements">
	<div class="ach-head">
		<h2 class="label">Achievements</h2>
		<span class="earned mono tnum" aria-label={`${earnedCount} of ${ACHIEVEMENTS.length} achievements earned`}>
			EARNED {String(earnedCount).padStart(2, '0')} <span class="eslash" aria-hidden="true">/</span>
			{String(ACHIEVEMENTS.length).padStart(2, '0')}
		</span>
	</div>
	<ul class="agrid">
		{#each ACHIEVEMENTS as a (a.id)}
			{@const earned = xp.hasAchievement(a.id)}
			<li class="acard" class:earned>
				<div class=" atop">
					<span class="atick" class:on={earned} aria-hidden="true"></span>
					<span class="aname mono">{a.name}</span>
				</div>
				{#if earned}
					<span class="adate mono tnum">{fmtDate(xp.achievements[a.id])}</span>
				{:else if a.note}
					<span class="anote mono">{a.note}</span>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<!-- Transfer + reset. -->
<section class="transfer" aria-label="export, import, reset">
	<h2 class="label">Record</h2>
	<div class="tbtns">
		<button class="tbtn mono" onclick={exportProgress}>EXPORT</button>
		<button class="tbtn mono" onclick={() => fileEl.click()}>IMPORT</button>
		<input
			bind:this={fileEl}
			class="sr-file"
			type="file"
			accept="application/json,.json"
			onchange={onImport}
			aria-hidden="true"
			tabindex="-1"
		/>
		{#if !resetArmed}
			<button class="tbtn danger mono" onclick={() => (resetArmed = true)}>RESET</button>
		{/if}
	</div>

	{#if importError}
		<p class="tline err mono" aria-live="polite">IMPORT REJECTED - {importError}</p>
	{:else if importOk}
		<p class="tline ok mono" aria-live="polite">IMPORT OK</p>
	{/if}

	{#if resetArmed}
		<div class="reset-row" role="group" aria-label="confirm reset">
			<span class="rlabel mono">Type <span class="yes">YES</span> to wipe this browser's record.</span>
			<input
				class="rinput mono"
				type="text"
				bind:value={resetWord}
				placeholder="YES"
				autocomplete="off"
				spellcheck="false"
				aria-label="type YES to confirm reset"
			/>
			<button class="tbtn danger mono" disabled={resetWord !== 'YES'} onclick={doReset}>CONFIRM</button>
			<button class="tbtn mono" onclick={() => { resetArmed = false; resetWord = ''; }}>CANCEL</button>
		</div>
	{/if}
	<p class="tfoot mono">
		Local only. Nothing here is ever sent anywhere.
		<a class="colophon-link" href="/colophon/">How this runs, and what it stores</a>
	</p>
</section>

<style>
	.ohead {
		max-width: 44rem;
		margin-bottom: 2.5rem;
	}
	.eyebrow {
		color: var(--phosphor);
		margin-bottom: 0.9rem;
	}
	.ohead h1 {
		font-size: clamp(1.9rem, 4.5vw, 2.6rem);
		color: #fff;
		letter-spacing: -0.02em;
	}
	.lede {
		margin-top: 1rem;
		font-size: 1rem;
		line-height: 1.65;
		color: var(--muted);
		max-width: 40rem;
	}
	.standby {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: 1.25rem;
		font-size: 0.6875rem;
		letter-spacing: 0.12em;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.4rem 0.65rem;
	}
	.sb-tick {
		width: 5px;
		height: 11px;
		border-radius: 1px;
		background: var(--s3);
		flex: none;
	}

	section {
		max-width: 52rem;
		margin-top: 2.75rem;
	}
	h2.label {
		color: var(--muted);
		margin-bottom: 1rem;
	}

	/* ---- Big level meter ---------------------------------------------- */
	.lvl-read {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	.lvl {
		font-size: clamp(1.75rem, 5vw, 2.5rem);
		font-weight: 400;
		color: #fff;
		letter-spacing: 0.02em;
	}
	.xp-read {
		font-size: 1rem;
		color: var(--phosphor);
		letter-spacing: 0.04em;
	}
	.big-meter {
		position: relative;
		height: 6px;
		margin-top: 0.85rem;
		background: var(--s3);
		border-radius: 3px;
		overflow: hidden;
	}
	.bm-fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--phosphor);
		box-shadow: 0 0 8px var(--phosphor-dim);
		transition: width 200ms var(--ease-out);
	}
	.bm-origin {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--phosphor);
	}
	.lvl-note {
		margin-top: 0.65rem;
		font-size: 0.625rem;
		letter-spacing: 0.14em;
		color: var(--faint);
	}

	/* ---- Calibration link ---------------------------------------------- */
	.cal-link {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.9rem 1.1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		transition:
			border-color 160ms var(--ease-out),
			background 160ms var(--ease-out);
	}
	.cal-link:hover {
		border-color: color-mix(in srgb, var(--phosphor) 35%, var(--line));
		background: var(--s2);
	}
	.cal-mark {
		display: inline-flex;
		color: var(--faint);
		transition: color 160ms var(--ease-out);
	}
	.cal-link:hover .cal-mark {
		color: var(--phosphor);
	}
	.cal-body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.cal-title {
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--phosphor);
	}
	.cal-sub {
		font-size: 0.875rem;
		color: var(--muted);
	}
	.cal-chev {
		color: var(--faint);
		display: inline-flex;
		transition: transform 140ms var(--ease-out);
	}
	.cal-link:hover .cal-chev {
		transform: translateX(2px);
		color: var(--muted);
	}

	/* ---- Channels ------------------------------------------------------ */
	.clist {
		list-style: none;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.chrow {
		display: grid;
		grid-template-columns: 4rem 1fr 8rem auto;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem 1rem;
		border-top: 1px solid var(--line-soft);
	}
	.chrow:first-child {
		border-top: none;
	}
	.ctag {
		font-size: 0.6875rem;
		letter-spacing: 0.08em;
		color: var(--faint);
	}
	.chrow.mastered .ctag {
		color: var(--phosphor);
	}
	.ctitle {
		font-size: 0.9375rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chrow.mastered .ctitle {
		color: var(--text);
	}
	.cmeter {
		position: relative;
		height: 3px;
		background: var(--s3);
		border-radius: 2px;
		overflow: hidden;
	}
	.cfill {
		position: absolute;
		inset: 0 auto 0 0;
		background: color-mix(in srgb, var(--phosphor) 65%, transparent);
		transition: width 200ms var(--ease-out);
	}
	.cfill.done {
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
	}
	.ccount {
		font-size: 0.75rem;
		color: var(--muted);
		text-align: right;
	}
	.ccount.placed {
		font-size: 0.625rem;
		letter-spacing: 0.14em;
		color: var(--phosphor);
	}
	.cslash {
		color: var(--faint);
		margin-inline: 0.1em;
	}

	/* ---- Achievements -------------------------------------------------- */
	.ach-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.ach-head h2.label {
		margin-bottom: 0;
	}
	.earned {
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--faint);
		white-space: nowrap;
	}
	.earned .eslash {
		color: var(--line);
		margin-inline: 0.15em;
	}
	.agrid {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: 0.6rem;
	}
	.acard {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.8rem 0.85rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		min-height: 4rem;
	}
	.acard.earned {
		border-color: color-mix(in srgb, var(--phosphor) 28%, var(--line));
	}
	.acard:not(.earned) {
		opacity: 0.55;
		border-style: dashed;
	}
	.atop {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}
	.atick {
		width: 6px;
		height: 11px;
		border-radius: 1px;
		background: var(--s3);
		flex: none;
	}
	.atick.on {
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
	}
	.aname {
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		color: var(--muted);
	}
	.acard.earned .aname {
		color: var(--text);
	}
	.adate {
		font-size: 0.625rem;
		letter-spacing: 0.08em;
		color: var(--faint);
		margin-left: 1.1rem;
	}
	.anote {
		font-size: 0.5625rem;
		letter-spacing: 0.14em;
		color: var(--faint);
		margin-left: 1.1rem;
	}

	/* ---- Transfer + reset ---------------------------------------------- */
	.tbtns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.tbtn {
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--muted);
		padding: 0.5rem 0.95rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.tbtn:hover:not(:disabled) {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
	}
	.tbtn.danger:hover:not(:disabled) {
		color: var(--err);
		border-color: color-mix(in srgb, var(--err) 45%, var(--line));
	}
	.tbtn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.sr-file {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}
	.tline {
		margin-top: 0.8rem;
		font-size: 0.6875rem;
		letter-spacing: 0.08em;
	}
	.tline.ok {
		color: var(--phosphor);
	}
	.tline.err {
		color: var(--err);
	}
	.reset-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1rem;
		padding: 0.9rem;
		border: 1px solid color-mix(in srgb, var(--err) 25%, var(--line));
		border-radius: var(--radius);
		background: var(--s1);
	}
	.rlabel {
		font-size: 0.75rem;
		color: var(--muted);
	}
	.rlabel .yes {
		color: var(--err);
		letter-spacing: 0.1em;
	}
	.rinput {
		width: 6rem;
		background: var(--s2);
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.8125rem;
		padding: 0.35rem 0.6rem;
		letter-spacing: 0.1em;
	}
	.rinput:focus-visible {
		border-color: var(--err);
		outline: none;
	}
	.tfoot {
		margin-top: 1rem;
		font-size: 0.625rem;
		letter-spacing: 0.1em;
		color: var(--faint);
	}
	.colophon-link {
		color: var(--muted);
		border-bottom: 1px solid var(--line);
		transition: color 140ms var(--ease-out);
	}
	.colophon-link:hover {
		color: var(--phosphor);
	}

	@media (max-width: 560px) {
		.chrow {
			grid-template-columns: 3.25rem 1fr auto;
		}
		.cmeter {
			display: none;
		}
	}
</style>
