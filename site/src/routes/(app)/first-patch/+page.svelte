<script lang="ts">
	// The launchpad: the course's real ending. Not a certificate - a place that
	// scaffolds a first real open-source contribution and then gets out of the way.
	// Everything here is local: the tracker, the checklist, the template. The only
	// links that leave are out-links a human clicks to go find a first issue. The
	// site never phones home; the real action happens on the sites it points to.
	import { onMount } from 'svelte';
	import Meta from '$lib/components/Meta.svelte';
	import { xp } from '$lib/xp.svelte';
	import { patch } from '$lib/patch.svelte';
	import {
		STAGES,
		STAGE_LABELS,
		STAGE_NOTES,
		CHECKLIST_ITEMS,
		buildChangeDescription
	} from '$lib/patch';

	onMount(() => {
		xp.hydrate(); // idempotent; the app layout already did this
		patch.hydrate();
	});

	// ---- Find a first issue: curated, real out-links -----------------------
	// These are the on-ramps M7 names. Each opens in a new tab; the site never
	// fetches them. The last is guidance, not a link - the docs of a tool you use
	// have no single URL, and pretending otherwise would be dishonest.
	interface OnRamp {
		name: string;
		blurb: string;
		href?: string;
		tag: string;
	}
	const onramps: OnRamp[] = [
		{
			name: 'good first issue',
			tag: 'GITHUB',
			blurb: 'Open issues maintainers tagged as suitable for newcomers, across every public repo.',
			href: 'https://github.com/search?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22&type=issues'
		},
		{
			name: 'Your first kernel patch',
			tag: 'KERNELNEWBIES',
			blurb: 'A step-by-step walk through preparing and sending a first Linux kernel patch.',
			href: 'https://kernelnewbies.org/FirstKernelPatch'
		},
		{
			name: 'Kernel Mentorship',
			tag: 'LINUX FOUNDATION',
			blurb: 'A structured, mentored path into kernel contribution, with a free beginner course first.',
			href: 'https://wiki.linuxfoundation.org/lkmp'
		},
		{
			name: 'Outreachy',
			tag: 'INTERNSHIPS',
			blurb: 'Paid, remote internships in open source for people facing under-representation in tech.',
			href: 'https://www.outreachy.org/'
		},
		{
			name: 'A tool you already use',
			tag: 'ITS DOCS',
			blurb: 'Open its repo, read its docs, and fix the first line that tripped you. No link needed - you already know it.'
		}
	];

	// ---- Change-description template (local only) --------------------------
	let wrong = $state('');
	let right = $state('');
	let verified = $state('');
	const preview = $derived(buildChangeDescription({ wrong, right, verified }));

	let copied = $state(false);
	let copyErr = $state(false);
	let copyTimer = 0;
	function flashCopied() {
		copied = true;
		copyErr = false;
		clearTimeout(copyTimer);
		copyTimer = window.setTimeout(() => (copied = false), 2000);
	}
	async function copyTemplate() {
		const text = preview;
		try {
			await navigator.clipboard.writeText(text);
			flashCopied();
			return;
		} catch {
			// clipboard API denied or unavailable: fall back to a selection copy.
		}
		try {
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'absolute';
			ta.style.left = '-9999px';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
			flashCopied();
		} catch {
			copyErr = true;
		}
	}

	// ---- Tracker: export / import / clear ----------------------------------
	let importError = $state('');
	let importOk = $state(false);
	let fileEl: HTMLInputElement;
	let clearArmed = $state(false);

	function exportPatch() {
		try {
			const blob = new Blob([patch.exportJson()], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'thunk-first-patch.json';
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			// download denied (rare): nothing to do
		}
	}
	async function onImport(e: Event) {
		importError = '';
		importOk = false;
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const res = patch.importJson(await file.text());
		if (res.ok) importOk = true;
		else importError = res.error ?? 'could not import';
		input.value = '';
	}
	function doClear() {
		patch.reset();
		clearArmed = false;
	}

	const stageIdx = $derived(patch.index);
</script>

<Meta
	title="LAUNCHPAD · thunk"
	description="Try your own first open-source contribution. Curated on-ramps, a change-description template, a pre-submit checklist, and a private tracker - all local, nothing sent anywhere."
	ogTitle="The Launchpad - thunk"
	ogDescription="The real ending: scaffolding for your own first patch. Local only."
/>

<article class="lp">
	<header class="lhead">
		<p class="eyebrow label">The launchpad</p>
		<h1>Try your own</h1>
		<p class="lede">
			You have done the practice. This is the real thing - a first contribution to a project you
			did not write, out in the open where anyone can read it. It will not be fast, and it may be
			quiet for a while. That is normal. A merged change is public, permanent, and blind to your
			record; review judges the patch, not the person. Start small. Start real.
		</p>
		<p class="standby mono">
			<span class="sb-tick" aria-hidden="true"></span>LOCAL ONLY &middot; the notes below stay in this
			browser. Every real step happens on the sites you open from here.
		</p>
	</header>

	<!-- 1. Find a first issue --------------------------------------------- -->
	<section class="block" aria-labelledby="find-h">
		<div class="block-head">
			<span class="bk mono" aria-hidden="true">01</span>
			<h2 id="find-h">Find a first issue</h2>
		</div>
		<p class="block-lede">
			Pick something small and real - a typo in the docs, a stale command, one confusing sentence.
			The on-ramps below open in a new tab. thunk never follows them; you do.
		</p>
		<ul class="onramps">
			{#each onramps as o (o.name)}
				<li>
					{#if o.href}
						<a class="onramp" href={o.href} target="_blank" rel="noopener noreferrer">
							<span class="or-tag mono">{o.tag}</span>
							<span class="or-name">{o.name}<span class="or-out" aria-hidden="true">↗</span></span>
							<span class="or-blurb">{o.blurb}</span>
						</a>
					{:else}
						<div class="onramp static">
							<span class="or-tag mono">{o.tag}</span>
							<span class="or-name">{o.name}</span>
							<span class="or-blurb">{o.blurb}</span>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<!-- 2. Change-description template ------------------------------------ -->
	<section class="block" aria-labelledby="tmpl-h">
		<div class="block-head">
			<span class="bk mono" aria-hidden="true">02</span>
			<h2 id="tmpl-h">Write the change description</h2>
		</div>
		<p class="block-lede">
			A good change answers three questions. Fill them in, then copy. Plain words beat clever ones.
		</p>
		<div class="tmpl">
			<div class="fields">
				<label class="field">
					<span class="fl mono">WHAT WAS WRONG</span>
					<textarea
						bind:value={wrong}
						rows="2"
						placeholder="The README said `make run`, but that target was removed."
						spellcheck="true"
					></textarea>
				</label>
				<label class="field">
					<span class="fl mono">WHAT IS RIGHT NOW</span>
					<textarea
						bind:value={right}
						rows="2"
						placeholder="It now says `cargo run`, matching the current build."
						spellcheck="true"
					></textarea>
				</label>
				<label class="field">
					<span class="fl mono">HOW YOU VERIFIED IT</span>
					<textarea
						bind:value={verified}
						rows="2"
						placeholder="Ran it on a clean checkout; the app came up."
						spellcheck="true"
					></textarea>
				</label>
			</div>
			<div class="preview-wrap">
				<div class="preview-head">
					<span class="fl mono">PREVIEW</span>
					<button class="mini mono" onclick={copyTemplate} aria-live="polite">
						{copied ? 'COPIED' : copyErr ? 'COPY FAILED' : 'COPY'}
					</button>
				</div>
				<pre class="preview mono">{preview}</pre>
			</div>
		</div>
	</section>

	<!-- 3. Pre-submit checklist ------------------------------------------- -->
	<section class="block" aria-labelledby="check-h">
		<div class="block-head">
			<span class="bk mono" aria-hidden="true">03</span>
			<h2 id="check-h">Before you submit</h2>
		</div>
		<p class="block-lede">
			The quiet list a maintainer wishes every first-timer ran. Ticks stay in this browser.
		</p>
		<ul class="checklist">
			{#each CHECKLIST_ITEMS as item (item.id)}
				<li>
					<label class="chk">
						<input
							type="checkbox"
							checked={patch.isChecked(item.id)}
							onchange={() => patch.toggleCheck(item.id)}
						/>
						<span class="chk-box" aria-hidden="true"></span>
						<span class="chk-label">{item.label}</span>
					</label>
				</li>
			{/each}
		</ul>
	</section>

	<!-- 4. My First Patch tracker ----------------------------------------- -->
	<section class="block" aria-labelledby="track-h">
		<div class="block-head">
			<span class="bk mono" aria-hidden="true">04</span>
			<h2 id="track-h">My first patch</h2>
		</div>
		<p class="block-lede">
			One patch, your own. Note what it is and where it stands. This is the only record; it never
			leaves this browser.
		</p>

		<div class="track-fields">
			<label class="field">
				<span class="fl mono">PROJECT</span>
				<input
					class="tin"
					type="text"
					value={patch.state.project}
					oninput={(e) => patch.setProject(e.currentTarget.value)}
					placeholder="the project's name"
					autocomplete="off"
					spellcheck="false"
				/>
			</label>
			<label class="field">
				<span class="fl mono">ISSUE OR PR LINK</span>
				<input
					class="tin"
					type="url"
					value={patch.state.issueUrl}
					oninput={(e) => patch.setIssue(e.currentTarget.value)}
					placeholder="paste the issue or PR link"
					autocomplete="off"
					spellcheck="false"
				/>
			</label>
		</div>

		<!-- Stage stepper: CHOSE -> ... -> MERGED. Dots are buttons (keyboard). -->
		<div class="stepper" role="group" aria-label="patch stage">
			<ol class="steps">
				{#each STAGES as s, i (s)}
					<li class="step" class:done={i < stageIdx} class:current={i === stageIdx}>
						<button
							class="dot"
							onclick={() => patch.setStage(s)}
							aria-current={i === stageIdx ? 'step' : undefined}
							aria-label={`set stage ${STAGE_LABELS[s]}`}
						>
							<span class="dot-mark" aria-hidden="true"></span>
						</button>
						<span class="step-label mono">{STAGE_LABELS[s]}</span>
					</li>
				{/each}
			</ol>
			<p class="stage-note" aria-live="polite">{STAGE_NOTES[STAGES[stageIdx]]}</p>
		</div>

		<div class="track-cta">
			<button class="btn mono" onclick={() => patch.retreat()} disabled={stageIdx === 0}>BACK</button>
			<button
				class="btn primary mono"
				onclick={() => patch.advance()}
				disabled={patch.merged}
			>
				{patch.merged ? 'MERGED' : 'ADVANCE'}
			</button>
		</div>

		{#if patch.merged}
			<p class="merged-line mono" aria-live="polite">
				<span class="ml-tick" aria-hidden="true"></span>It landed. A real change, in the open, with
				your name on it. That is the whole course.
			</p>
		{/if}

		<div class="record">
			<div class="tbtns">
				<button class="btn ghost mono" onclick={exportPatch}>EXPORT</button>
				<button class="btn ghost mono" onclick={() => fileEl.click()}>IMPORT</button>
				<input
					bind:this={fileEl}
					class="sr-file"
					type="file"
					accept="application/json,.json"
					onchange={onImport}
					aria-hidden="true"
					tabindex="-1"
				/>
				{#if !clearArmed}
					<button class="btn ghost danger mono" onclick={() => (clearArmed = true)}>CLEAR</button>
				{:else}
					<button class="btn ghost danger mono" onclick={doClear}>CONFIRM CLEAR</button>
					<button class="btn ghost mono" onclick={() => (clearArmed = false)}>CANCEL</button>
				{/if}
			</div>
			{#if importError}
				<p class="tline err mono" aria-live="polite">IMPORT REJECTED - {importError}</p>
			{:else if importOk}
				<p class="tline ok mono" aria-live="polite">IMPORT OK</p>
			{/if}
			<p class="tfoot mono">
				No accounts, no telemetry, no server. The tracker holds your own notes and nothing else.
				<a class="colophon-link" href="/colophon/">How this runs, and what it stores</a>
			</p>
		</div>
	</section>
</article>

<style>
	.lp {
		max-width: 52rem;
	}
	.lhead {
		max-width: 44rem;
		margin-bottom: 2.75rem;
	}
	.eyebrow {
		color: var(--phosphor);
		margin-bottom: 0.9rem;
	}
	.lhead h1 {
		font-size: clamp(1.9rem, 4.5vw, 2.6rem);
		color: var(--text-strong);
		letter-spacing: -0.02em;
	}
	.lede {
		margin-top: 1rem;
		font-size: 1rem;
		line-height: 1.7;
		color: var(--muted);
		max-width: 40rem;
	}
	.standby {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: 1.35rem;
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.42rem 0.7rem;
	}
	.sb-tick {
		width: 5px;
		height: 11px;
		border-radius: 1px;
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
		flex: none;
	}

	/* ---- Blocks -------------------------------------------------------- */
	.block {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: 1px solid var(--line);
	}
	.block-head {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
	}
	.bk {
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--phosphor);
		flex: none;
	}
	.block h2 {
		font-size: 1.25rem;
		font-weight: 500;
		color: var(--text-strong);
		letter-spacing: -0.01em;
	}
	.block-lede {
		margin-top: 0.75rem;
		font-size: 0.9375rem;
		line-height: 1.65;
		color: var(--muted);
		max-width: 42rem;
	}

	/* ---- 1. On-ramps --------------------------------------------------- */
	.onramps {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.7rem;
		margin-top: 1.4rem;
	}
	.onramp {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		height: 100%;
		padding: 0.9rem 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		transition:
			border-color 160ms var(--ease-out),
			background 160ms var(--ease-out);
	}
	a.onramp:hover {
		border-color: color-mix(in srgb, var(--phosphor) 38%, var(--line));
		background: var(--s2);
	}
	.onramp.static {
		border-style: dashed;
		opacity: 0.82;
	}
	.or-tag {
		font-size: 0.5625rem;
		letter-spacing: 0.16em;
		color: var(--faint);
	}
	.or-name {
		font-size: 0.9375rem;
		color: var(--text);
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
	}
	a.onramp:hover .or-name {
		color: var(--text-strong);
	}
	.or-out {
		font-size: 0.75rem;
		color: var(--faint);
	}
	a.onramp:hover .or-out {
		color: var(--phosphor);
	}
	.or-blurb {
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--muted);
	}

	/* ---- 2. Template --------------------------------------------------- */
	.tmpl {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1.4rem;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.fl {
		font-size: 0.5625rem;
		letter-spacing: 0.16em;
		color: var(--faint);
	}
	textarea,
	.tin {
		width: 100%;
		background: var(--s1);
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--text);
		font-family: inherit;
		font-size: 0.875rem;
		line-height: 1.55;
		padding: 0.55rem 0.7rem;
		resize: vertical;
		transition: border-color 140ms var(--ease-out);
	}
	textarea::placeholder,
	.tin::placeholder {
		color: var(--faint);
	}
	textarea:focus-visible,
	.tin:focus-visible {
		outline: none;
		border-color: color-mix(in srgb, var(--phosphor) 50%, var(--line));
	}
	.preview-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.preview-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.mini {
		font-size: 0.5625rem;
		letter-spacing: 0.14em;
		color: var(--phosphor);
		border: 1px solid color-mix(in srgb, var(--phosphor) 40%, var(--line));
		border-radius: 2px;
		padding: 0.25rem 0.55rem;
		transition:
			background 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.mini:hover {
		background: color-mix(in srgb, var(--phosphor) 10%, transparent);
	}
	.preview {
		flex: 1;
		margin: 0;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 0.8rem 0.9rem;
		font-size: 0.75rem;
		line-height: 1.7;
		color: var(--muted);
		white-space: pre-wrap;
		word-break: break-word;
		overflow-x: auto;
	}

	/* ---- 3. Checklist -------------------------------------------------- */
	.checklist {
		list-style: none;
		margin-top: 1.4rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.checklist li {
		border-top: 1px solid var(--line-soft);
	}
	.checklist li:first-child {
		border-top: none;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.8rem 1rem;
		cursor: pointer;
	}
	.chk:hover {
		background: var(--s1);
	}
	.chk input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}
	.chk-box {
		width: 15px;
		height: 15px;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		flex: none;
		position: relative;
		transition:
			border-color 140ms var(--ease-out),
			background 140ms var(--ease-out);
	}
	.chk input:checked + .chk-box {
		background: var(--phosphor);
		border-color: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
	}
	.chk input:checked + .chk-box::after {
		content: '';
		position: absolute;
		left: 4px;
		top: 1px;
		width: 4px;
		height: 8px;
		border: solid var(--bg);
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}
	.chk input:focus-visible + .chk-box {
		outline: 2px solid var(--phosphor);
		outline-offset: 2px;
	}
	.chk-label {
		font-size: 0.9375rem;
		color: var(--muted);
	}
	.chk input:checked ~ .chk-label {
		color: var(--text);
	}

	/* ---- 4. Tracker ---------------------------------------------------- */
	.track-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1.4rem;
	}
	.tin {
		resize: none;
	}

	.stepper {
		margin-top: 1.8rem;
	}
	.steps {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0;
	}
	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.55rem;
		position: relative;
		min-width: 0;
	}
	/* The connecting rail between dots. */
	.step::before {
		content: '';
		position: absolute;
		top: 8px;
		left: -50%;
		width: 100%;
		height: 2px;
		background: var(--s3);
	}
	.step:first-child::before {
		display: none;
	}
	.step.done::before,
	.step.current::before {
		background: color-mix(in srgb, var(--phosphor) 55%, var(--s3));
	}
	.dot {
		position: relative;
		z-index: 1;
		width: 18px;
		height: 18px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1px solid var(--line);
		background: var(--bg);
		transition:
			border-color 160ms var(--ease-out),
			background 160ms var(--ease-out);
	}
	.dot:hover {
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
	}
	.dot:focus-visible {
		outline: 2px solid var(--phosphor);
		outline-offset: 2px;
	}
	.dot-mark {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--s3);
		transition: background 160ms var(--ease-out);
	}
	.step.done .dot {
		border-color: color-mix(in srgb, var(--phosphor) 45%, var(--line));
	}
	.step.done .dot-mark {
		background: color-mix(in srgb, var(--phosphor) 70%, transparent);
	}
	.step.current .dot {
		border-color: var(--phosphor);
		background: color-mix(in srgb, var(--phosphor) 10%, var(--bg));
	}
	.step.current .dot-mark {
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
	}
	.step-label {
		font-size: 0.5rem;
		letter-spacing: 0.08em;
		color: var(--faint);
		text-align: center;
		white-space: nowrap;
	}
	.step.current .step-label {
		color: var(--phosphor);
	}
	.step.done .step-label {
		color: var(--muted);
	}
	.stage-note {
		margin-top: 1.1rem;
		font-size: 0.8125rem;
		line-height: 1.6;
		color: var(--muted);
		text-align: center;
	}

	.track-cta {
		display: flex;
		gap: 0.7rem;
		margin-top: 1.4rem;
		justify-content: center;
	}
	.btn {
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--muted);
		padding: 0.55rem 1.1rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out),
			background 140ms var(--ease-out);
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
		background: color-mix(in srgb, var(--phosphor) 10%, var(--s2));
	}
	.btn.ghost {
		background: none;
		color: var(--faint);
	}
	.btn.ghost:hover:not(:disabled) {
		color: var(--muted);
		border-color: var(--line-strong);
	}
	.btn.ghost.danger:hover:not(:disabled) {
		color: var(--err);
		border-color: color-mix(in srgb, var(--err) 45%, var(--line));
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.merged-line {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1.4rem;
		padding: 0.7rem 0.9rem;
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--text);
		border: 1px solid color-mix(in srgb, var(--phosphor) 32%, var(--line));
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--phosphor) 6%, var(--s1));
	}
	.ml-tick {
		width: 5px;
		height: 13px;
		border-radius: 1px;
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
		flex: none;
	}

	.record {
		margin-top: 1.8rem;
	}
	.tbtns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
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
	.tfoot {
		margin-top: 1rem;
		font-size: 0.625rem;
		letter-spacing: 0.08em;
		line-height: 1.6;
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

	@media (max-width: 640px) {
		.tmpl,
		.track-fields {
			grid-template-columns: 1fr;
		}
		.step-label {
			font-size: 0.4375rem;
		}
	}
</style>
