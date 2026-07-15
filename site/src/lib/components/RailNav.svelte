<!-- The channel rail: the ladder as compact strips (glyph, CH-NN, title, hairline
     meter with real progress), the current channel phosphor-lit. THE BENCH and
     OPERATOR sit at the foot. Reused verbatim for the desktop aside and the
     mobile bottom sheet; `collapsed` drops everything but the glyphs (48px). -->
<script lang="ts">
	import { page } from '$app/state';
	import { modules } from '$lib/content';
	import { xp } from '$lib/xp.svelte';
	import ModuleGlyph from './ModuleGlyph.svelte';

	let { collapsed = false, onnav }: { collapsed?: boolean; onnav?: () => void } = $props();

	const path = $derived(page.url.pathname);
	const currentModule = $derived(page.params.module);

	function chCode(tag: string): string {
		return 'CH-' + String(Number(tag.replace(/\D/g, ''))).padStart(2, '0');
	}
</script>

<nav class="rail-nav" class:collapsed aria-label="channels">
	<ul class="chans">
		{#each modules as m, i (m.id)}
			{@const stat = xp.moduleStat(m, i)}
			<li>
				<a
					class="chan"
					class:active={currentModule === m.id}
					class:locked={!stat.unlocked && stat.pct === 0}
					href={`/m/${m.id}/`}
					onclick={onnav}
					data-sveltekit-preload-data="hover"
					title={`${chCode(m.tag)} ${m.title}`}
					aria-current={currentModule === m.id ? 'page' : undefined}
				>
					<span class="edge" aria-hidden="true"></span>
					<span class="glyph"><ModuleGlyph tag={m.tag} /></span>
					{#if !collapsed}
						<span class="meta">
							<span class="code mono tnum">{chCode(m.tag)}</span>
							<span class="title">{m.title}</span>
						</span>
						<span class="sig">
							{#if stat.mastered}
								<span class="mstr mono">MASTERED</span>
							{:else if stat.pct > 0}
								<span class="pct mono tnum">{stat.pct}%</span>
							{:else if !stat.unlocked}
								<span class="lock mono">LOCKED</span>
							{:else}
								<span class="ns mono">NO SIGNAL</span>
							{/if}
						</span>
						<span class="meter" aria-hidden="true">
							<span class="rail-line"></span>
							<span class="fill" class:done={stat.mastered} style={`width:${stat.pct}%`}></span>
							<span class="origin"></span>
						</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>

	<div class="foot-entries">
		<a
			class="chan foot"
			class:active={path.startsWith('/bench')}
			href="/bench/"
			onclick={onnav}
			title="The Bench"
			aria-current={path.startsWith('/bench') ? 'page' : undefined}
		>
			<span class="edge" aria-hidden="true"></span>
			<span class="glyph" aria-hidden="true">
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<path d="M2 12h2l2-6 2 9 2-11 2 8 2-3h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</span>
			{#if !collapsed}
				<span class="meta">
					<span class="code mono">BENCH</span>
					<span class="title">The Bench</span>
				</span>
			{/if}
		</a>
		<a
			class="chan foot"
			class:active={path.startsWith('/progress')}
			href="/progress/"
			onclick={onnav}
			title="Operator card"
			aria-current={path.startsWith('/progress') ? 'page' : undefined}
		>
			<span class="edge" aria-hidden="true"></span>
			<span class="glyph" aria-hidden="true">
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<circle cx="9" cy="9" r="6.2" stroke="currentColor" stroke-width="1.3" />
					<circle cx="9" cy="9" r="1.6" fill="currentColor" />
				</svg>
			</span>
			{#if !collapsed}
				<span class="meta">
					<span class="code mono">OPERATOR</span>
					<span class="title">Progress</span>
				</span>
			{/if}
		</a>
	</div>
</nav>

<style>
	.rail-nav {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.chans {
		list-style: none;
		flex: 1 1 auto;
		overflow-y: auto;
		min-height: 0;
	}
	.foot-entries {
		border-top: 1px solid var(--line);
		flex: none;
	}

	.chan {
		position: relative;
		display: grid;
		grid-template-columns: 1.75rem 1fr auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.85rem 0.7rem 0.75rem;
		border-bottom: 1px solid var(--line-soft);
		transition: background 140ms var(--ease-out);
	}
	.foot-entries .chan {
		border-bottom: none;
	}
	.foot-entries .chan + .chan {
		border-top: 1px solid var(--line-soft);
	}
	.chan:hover {
		background: var(--s1);
	}
	.chan.active {
		background: color-mix(in srgb, var(--phosphor) 6%, transparent);
	}

	/* The lit edge: phosphor bar down the active channel's left. */
	.edge {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: transparent;
	}
	.chan.active .edge {
		background: var(--phosphor);
		box-shadow: 0 0 8px var(--phosphor-dim);
	}

	.glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--faint);
		transition: color 140ms var(--ease-out);
	}
	.chan:hover .glyph,
	.chan.active .glyph {
		color: var(--phosphor);
	}
	.chan.locked .glyph {
		color: var(--line);
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.code {
		font-size: 0.5625rem;
		letter-spacing: 0.14em;
		color: var(--faint);
	}
	.chan.active .code {
		color: var(--muted);
	}
	.title {
		font-size: 0.8125rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chan.active .title,
	.chan:hover .title {
		color: var(--text);
	}
	.chan.locked .title {
		color: var(--faint);
	}

	.sig {
		grid-column: 3;
		text-align: right;
	}
	.sig .mono {
		font-size: 0.5625rem;
		letter-spacing: 0.1em;
	}
	.ns,
	.lock {
		color: var(--faint);
		opacity: 0.7;
	}
	.pct {
		color: var(--phosphor);
	}
	.mstr {
		color: var(--phosphor);
	}

	/* Hairline meter under the row's meta, spanning glyph->title columns. */
	.meter {
		position: relative;
		grid-column: 2 / 4;
		grid-row: 2;
		height: 2px;
		margin-top: 0.35rem;
	}
	.rail-line {
		position: absolute;
		inset: 0;
		background: var(--s3);
		border-radius: 1px;
	}
	.fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: color-mix(in srgb, var(--phosphor) 65%, transparent);
		border-radius: 1px;
		transition: width 200ms var(--ease-out);
	}
	.fill.done {
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
	}
	.origin {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--phosphor);
		opacity: 0.5;
	}

	/* Collapsed: glyphs only, centered, 48px column. */
	.collapsed .chan {
		grid-template-columns: 1fr;
		justify-items: center;
		padding-inline: 0;
	}
	.collapsed .meta,
	.collapsed .sig,
	.collapsed .meter {
		display: none;
	}
</style>
