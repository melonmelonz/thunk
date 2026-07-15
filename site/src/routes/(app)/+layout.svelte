<script lang="ts">
	// The app shell: past the front door, every route lives inside this persistent
	// instrument - a channel rail (left), a slim status bar (top, context + live XP
	// meter), and a workspace pane that owns its own scroll. The shell itself never
	// scrolls. Keyboard-first: j/k lesson nav, [ toggles the rail, g then 0-6 jumps
	// to a channel, ? shows the keymap. Mobile folds the rail into a bottom sheet
	// summoned by the status-bar channel chip.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { modules, moduleById, lessonNeighbours } from '$lib/content';
	import SiteMark from '$lib/components/SiteMark.svelte';
	import XpMeter from '$lib/components/XpMeter.svelte';
	import RailNav from '$lib/components/RailNav.svelte';

	let { children } = $props();

	let collapsed = $state(false);
	let sheetOpen = $state(false);
	let keymapOpen = $state(false);
	let gPending = false;
	let gTimer = 0;

	// Flat course order for j/k, with each lesson's module index for the unlock
	// rule at boundaries.
	const order = modules.flatMap((m, mi) =>
		m.lessons.map((l) => ({ moduleId: m.id, lessonId: l.id, moduleIndex: mi }))
	);

	// Current context eyebrow: CH-NN.LL / lesson, CH-NN / module, or the foot
	// entries. `chip` is the compact form the mobile summon button wears.
	const ctx = $derived.by(() => {
		const p = page.url.pathname;
		const mid = page.params.module;
		const lid = page.params.lesson;
		if (mid) {
			const m = moduleById(mid);
			if (m) {
				const code = 'CH-' + String(Number(m.tag.replace(/\D/g, ''))).padStart(2, '0');
				if (lid) {
					const { index } = lessonNeighbours(m, lid);
					const lesson = m.lessons[index];
					return {
						code: `${code}.${String(index + 1).padStart(2, '0')}`,
						title: (lesson?.title ?? '').toUpperCase(),
						chip: code
					};
				}
				return { code, title: m.title.toUpperCase(), chip: code };
			}
		}
		if (p.startsWith('/bench')) return { code: 'BENCH', title: 'THE BENCH', chip: 'BENCH' };
		if (p.startsWith('/progress')) return { code: 'OPERATOR', title: 'PROGRESS', chip: 'OPER' };
		return { code: '', title: '', chip: 'CH' };
	});

	function toggleRail() {
		collapsed = !collapsed;
		try {
			localStorage.setItem('thunk.rail', collapsed ? '1' : '0');
		} catch {
			// storage denied: the rail just won't remember across reloads
		}
	}

	// j/k step through the flat lesson order. Same-module moves are always free;
	// crossing a module boundary needs the target module unlocked (the ladder
	// rule), mirroring the visual gate. URL nav stays free elsewhere.
	function step(dir: 1 | -1) {
		const mid = page.params.module;
		const lid = page.params.lesson;
		if (!mid || !lid) return;
		const here = order.findIndex((o) => o.moduleId === mid && o.lessonId === lid);
		if (here < 0) return;
		const target = order[here + dir];
		if (!target) return;
		if (target.moduleIndex !== order[here].moduleIndex) {
			const tm = modules[target.moduleIndex];
			const prev = modules[target.moduleIndex - 1];
			const unlocked = target.moduleIndex === 0 || !!prev; // prev mastery is visual-only; allow back-nav
			// Forward across a boundary requires the target module unlocked.
			if (dir === 1 && target.moduleIndex > 0) {
				// unlocked when the preceding module is mastered
				const key = 'thunk.xp.v1';
				let done = false;
				try {
					const s = JSON.parse(localStorage.getItem(key) ?? '{}');
					const id = prev?.id ?? '';
					// Done either way: mastered by checks OR placed out (mastered_or_placed).
					done = !!(s?.modulesMastered?.[id] || s?.modulesPlaced?.[id]);
				} catch {
					done = false;
				}
				if (!done) return;
			}
			void unlocked;
			void tm;
		}
		goto(`/m/${target.moduleId}/${target.lessonId}/`);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			// Close one layer at a time, top-down. (The palette, a higher layer, owns
			// Escape itself and stops it propagating here, so this is never reached
			// while the palette is open.)
			if (keymapOpen) keymapOpen = false;
			else if (sheetOpen) sheetOpen = false;
			return;
		}
		const t = e.target as HTMLElement | null;
		const tag = t?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
		if (e.metaKey || e.ctrlKey || e.altKey) return;

		if (gPending) {
			gPending = false;
			clearTimeout(gTimer);
			if (/^[0-6]$/.test(e.key)) {
				const m = modules[Number(e.key)];
				if (m) {
					e.preventDefault();
					goto(`/m/${m.id}/`);
				}
			}
			return;
		}

		switch (e.key) {
			case 'j':
				e.preventDefault();
				step(1);
				break;
			case 'k':
				e.preventDefault();
				step(-1);
				break;
			case '[':
			case ']':
				e.preventDefault();
				toggleRail();
				break;
			case 'g':
				gPending = true;
				gTimer = window.setTimeout(() => (gPending = false), 900);
				break;
			case '?':
				e.preventDefault();
				keymapOpen = true;
				break;
		}
	}

	// The command palette dispatches shell actions as a window CustomEvent, so it
	// stays decoupled (it never reaches into this component's state directly).
	function onCmd(e: Event) {
		const action = (e as CustomEvent<string>).detail;
		if (action === 'toggle-rail') toggleRail();
	}

	onMount(() => {
		try {
			collapsed = localStorage.getItem('thunk.rail') === '1';
		} catch {
			collapsed = false;
		}
		window.addEventListener('keydown', onKey);
		window.addEventListener('thunk:cmd', onCmd);
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('thunk:cmd', onCmd);
		};
	});
</script>

<div class="shell" class:collapsed>
	<aside class="rail">
		<div class="rail-head">
			<SiteMark />
			<button
				class="collapse"
				onclick={toggleRail}
				aria-label={collapsed ? 'expand rail' : 'collapse rail'}
				title={collapsed ? 'Expand rail  [' : 'Collapse rail  ['}
			>
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
					<path
						d={collapsed ? 'M5 3l4 4-4 4' : 'M9 3L5 7l4 4'}
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		</div>
		<RailNav {collapsed} />
	</aside>

	<div class="stage">
		<div class="statusbar">
			<div class="ctx">
				<button
					class="chchip mono tnum"
					onclick={() => (sheetOpen = true)}
					aria-label="open channel rail"
					aria-expanded={sheetOpen}
				>
					{ctx.chip}
				</button>
				{#if ctx.code}
					<span class="eyebrow mono tnum">
						<span class="code">{ctx.code}</span>
						{#if ctx.title}
							<span class="mid" aria-hidden="true">&middot;</span>
							<span class="title">{ctx.title}</span>
						{/if}
					</span>
				{/if}
			</div>
			<div class="right">
				<button
					class="keyhint mono"
					onclick={() => (keymapOpen = true)}
					aria-label="keyboard shortcuts"
					title="Keyboard shortcuts  ?"
				>
					?
				</button>
				<XpMeter />
			</div>
		</div>

		<main class="workspace">
			<div class="pane">
				{@render children?.()}
			</div>
		</main>
	</div>

	<!-- Mobile: the rail folds into a bottom sheet summoned by the CH chip. -->
	{#if sheetOpen}
		<div
			class="sheet-back"
			role="presentation"
			onclick={() => (sheetOpen = false)}
		></div>
		<div class="sheet" role="dialog" aria-label="channels">
			<div class="sheet-grip" aria-hidden="true"></div>
			<RailNav collapsed={false} onnav={() => (sheetOpen = false)} />
		</div>
	{/if}

	<!-- The keymap: mono, hairline, quiet. Dismiss on esc or click. -->
	{#if keymapOpen}
		<div class="keymap-back" role="presentation" onclick={() => (keymapOpen = false)}></div>
		<div class="keymap" role="dialog" aria-label="keyboard shortcuts">
			<p class="km-head label">Keys</p>
			<dl class="km-list mono">
				<div><dt>j</dt><dd>next lesson</dd></div>
				<div><dt>k</dt><dd>previous lesson</dd></div>
				<div><dt>[</dt><dd>toggle rail</dd></div>
				<div><dt>g 0-6</dt><dd>jump to channel</dd></div>
				<div><dt>?</dt><dd>this keymap</dd></div>
				<div><dt>esc</dt><dd>dismiss</dd></div>
			</dl>
		</div>
	{/if}
</div>

<style>
	.shell {
		--rail-w: 264px;
		display: grid;
		grid-template-columns: var(--rail-w) minmax(0, 1fr);
		height: 100dvh;
		overflow: hidden;
	}
	.shell.collapsed {
		--rail-w: 48px;
	}

	/* ---- Rail --------------------------------------------------------- */
	.rail {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-right: 1px solid var(--line);
		background: var(--s1);
	}
	.rail-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56px;
		padding-inline: 0.85rem;
		border-bottom: 1px solid var(--line);
		flex: none;
	}
	.collapse {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.collapse:hover {
		color: var(--muted);
		border-color: #24303e;
	}
	/* Collapsed: the head stacks the home tick over the expand toggle, so there is
	   always a visible way back out of the 48px state (the `[` key also works). */
	.shell.collapsed .rail-head {
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: auto;
		gap: 0.5rem;
		padding: 0.7rem 0;
	}
	.shell.collapsed .rail-head :global(.word) {
		display: none;
	}

	/* ---- Stage (status bar + workspace) ------------------------------- */
	.stage {
		display: grid;
		grid-template-rows: 48px minmax(0, 1fr);
		min-width: 0;
		min-height: 0;
	}
	.statusbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-inline: clamp(1rem, 3vw, 1.75rem);
		border-bottom: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		backdrop-filter: blur(10px);
	}
	.ctx {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.chchip {
		display: none; /* desktop: rail is always present */
		align-items: center;
		font-size: 0.625rem;
		letter-spacing: 0.12em;
		color: var(--phosphor);
		border: 1px solid color-mix(in srgb, var(--phosphor) 40%, var(--line));
		border-radius: 2px;
		padding: 0.28rem 0.5rem;
	}
	.eyebrow {
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.eyebrow .code {
		color: var(--phosphor);
	}
	.eyebrow .mid {
		color: var(--faint);
		margin-inline: 0.4em;
	}
	.eyebrow .title {
		color: var(--muted);
	}
	.right {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex: none;
	}
	.keyhint {
		width: 22px;
		height: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		transition: color 140ms var(--ease-out);
	}
	.keyhint:hover {
		color: var(--muted);
		border-color: #24303e;
	}

	.workspace {
		overflow-y: auto;
		min-height: 0;
	}
	/* The reading measure stays centered in the pane; bench/progress use the full
	   width via their own layout. */
	.pane {
		padding: clamp(1.75rem, 4vw, 3rem) clamp(1.25rem, 4vw, 3rem) 5rem;
		max-width: 74rem;
		margin-inline: auto;
	}

	/* ---- Mobile bottom sheet ------------------------------------------ */
	.sheet-back {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: color-mix(in srgb, var(--bg) 60%, transparent);
		backdrop-filter: blur(2px);
	}
	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 91;
		max-height: 72dvh;
		display: flex;
		flex-direction: column;
		background: var(--s1);
		border-top: 1px solid var(--line);
		border-radius: 10px 10px 0 0;
		animation: sheet-up 200ms var(--ease-out) both;
	}
	.sheet-grip {
		width: 34px;
		height: 3px;
		border-radius: 2px;
		background: var(--s3);
		margin: 0.6rem auto 0.35rem;
		flex: none;
	}
	@keyframes sheet-up {
		from {
			transform: translateY(12px);
			opacity: 0;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}

	/* ---- Keymap overlay ----------------------------------------------- */
	.keymap-back {
		position: fixed;
		inset: 0;
		z-index: 150;
	}
	.keymap {
		position: fixed;
		z-index: 151;
		right: clamp(1rem, 4vw, 2rem);
		top: 56px;
		background: var(--s2);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
		box-shadow: 0 12px 40px -16px #000;
		animation: km-in 140ms var(--ease-out) both;
	}
	@keyframes km-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.km-head {
		color: var(--muted);
		margin-bottom: 0.6rem;
	}
	.km-list {
		display: grid;
		gap: 0.35rem;
		font-size: 0.75rem;
	}
	.km-list div {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		align-items: baseline;
		gap: 0.75rem;
	}
	.km-list dt {
		color: var(--phosphor);
		letter-spacing: 0.08em;
	}
	.km-list dd {
		color: var(--muted);
	}

	/* ---- Mobile: rail out, sheet in ----------------------------------- */
	@media (max-width: 720px) {
		.shell,
		.shell.collapsed {
			grid-template-columns: minmax(0, 1fr);
		}
		.rail {
			display: none;
		}
		.chchip {
			display: inline-flex;
		}
		/* The chip already names the channel and the keymap is a desktop affordance;
		   drop both from the bar so the XP meter never clips at 390px. */
		.eyebrow,
		.keyhint {
			display: none;
		}
	}
</style>
