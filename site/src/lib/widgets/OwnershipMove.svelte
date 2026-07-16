<script lang="ts">
	// Ownership / Borrow (M2): the borrow checker as a toy you cannot break. Two
	// bindings, one owned String, and the real rules - move it and the source goes
	// dead, borrow it shared as many times as you like, borrow it mutably and you
	// get exactly one, and every illegal move is refused with the EXACT diagnostic
	// rustc prints. The panel is a little compile session: each action is the Rust
	// line it stands for, and a refusal is the compiler's, verbatim.
	import {
		initial,
		moveTo,
		borrow,
		dropBorrow,
		use_,
		other,
		type BorrowState,
		type RustError
	} from './borrow';

	interface Entry {
		line: string;
		error: RustError | null;
	}

	let s = $state<BorrowState>(initial());
	let log = $state<Entry[]>([]);
	let lastError = $state<RustError | null>(null);

	const owner = $derived(s.owner);
	const shared = $derived(s.borrows.filter((b) => b.kind === 'shared'));
	const mut = $derived(s.borrows.find((b) => b.kind === 'mut') ?? null);

	function push(line: string, error: RustError | null) {
		log = [...log.slice(-5), { line, error }];
		lastError = error;
	}

	function doMove() {
		if (!owner) return;
		const to = other(owner);
		const out = moveTo(s, to);
		push(`let ${to} = ${owner};`, out.error);
		s = out.state;
	}
	function doBorrow(kind: 'shared' | 'mut') {
		if (!owner) return;
		const out = borrow(s, kind);
		const id = out.error ? s.nextId : out.state.borrows[out.state.borrows.length - 1].id;
		const op = kind === 'mut' ? '&mut ' : '&';
		push(`let r${id} = ${op}${owner};`, out.error);
		s = out.state;
	}
	function doDrop(id: number) {
		const out = dropBorrow(s, id);
		push(`drop(r${id});`, out.error);
		s = out.state;
	}
	function doRead(binding: 'a' | 'b') {
		const out = use_(s, binding);
		push(`println!("{${binding}}");`, out.error);
		s = out.state;
	}
	function reset() {
		s = initial();
		log = [];
		lastError = null;
	}

	function bindStatus(binding: 'a' | 'b'): string {
		if (s.moved[binding]) return 'moved';
		if (!s.init[binding]) return 'uninit';
		if (owner === binding) {
			if (mut) return 'borrowed &mut';
			if (shared.length) return `borrowed & ×${shared.length}`;
			return 'owns';
		}
		return 'empty';
	}
</script>

<div class="own" role="group" aria-label="Ownership and borrowing: the borrow checker as a toy">
	<!-- The two bindings. The owner holds the value token; a moved binding grays. -->
	<div class="bindings">
		{#each ['a', 'b'] as const as name (name)}
			<div
				class="bind"
				class:owns={owner === name}
				class:dead={s.moved[name]}
				class:uninit={!s.init[name] && owner !== name}
			>
				<div class="bindhead">
					<span class="bname mono">{name}</span>
					<span class="bstate mono">{bindStatus(name)}</span>
				</div>
				<div class="valwrap">
					{#if owner === name}
						<span class="token mono" class:locked={!!mut}>
							<span class="tq" aria-hidden="true">&ldquo;</span>{s.value}<span
								class="tq"
								aria-hidden="true">&rdquo;</span
							>
						</span>
					{:else if s.moved[name]}
						<span class="ghost mono">— moved —</span>
					{:else}
						<span class="ghost mono">—</span>
					{/if}
				</div>
				<div class="reads">
					<button class="mini mono" onclick={() => doRead(name)} aria-label={`read ${name}`}
						>read {name}</button
					>
				</div>
			</div>
		{/each}
	</div>

	<!-- Outstanding references. Shared are readers; the one mut is exclusive. -->
	<div class="refs" aria-label="outstanding references">
		{#if s.borrows.length === 0}
			<span class="norefs mono">no references held</span>
		{:else}
			{#each s.borrows as b (b.id)}
				<span class="ref" class:mutref={b.kind === 'mut'}>
					<span class="rname mono">r{b.id}</span>
					<span class="rkind mono">{b.kind === 'mut' ? '&mut' : '&'} {b.from}</span>
					<button class="drop" onclick={() => doDrop(b.id)} aria-label={`drop r${b.id}`}
						>&times;</button
					>
				</span>
			{/each}
		{/if}
	</div>

	<!-- Controls stay live on purpose: you CAN press an illegal one, and the
	     checker refuses it with the real error. That is the toy you can't break. -->
	<div class="ops" role="group" aria-label="operations">
		<button class="op mono" onclick={doMove} disabled={!owner}>
			MOVE {owner ? `${owner} → ${other(owner)}` : ''}
		</button>
		<button class="op mono" onclick={() => doBorrow('shared')} aria-label="take a shared borrow">
			&amp; SHARED
		</button>
		<button class="op mono" onclick={() => doBorrow('mut')} aria-label="take a mutable borrow">
			&amp;mut EXCLUSIVE
		</button>
		<button class="op reset mono" onclick={reset} aria-label="reset">RESET</button>
	</div>

	<!-- The compile session: each line and the compiler's answer. -->
	<div class="session" aria-live="polite">
		<div class="sessionhead label">rustc session</div>
		<div class="lines mono">
			{#if log.length === 0}
				<div class="hint">Try: MOVE, then read the binding you moved out of.</div>
			{:else}
				{#each log as e, i (i)}
					<div class="logline" class:bad={e.error}>
						<span class="prompt" aria-hidden="true">{e.error ? '✗' : '✓'}</span>
						<code>{e.line}</code>
					</div>
				{/each}
			{/if}
		</div>
		{#if lastError}
			<div class="rustc" role="alert">
				<span class="ecode mono">error[{lastError.code}]</span>
				<span class="emsg mono">{lastError.message}</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.own {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 1.1rem 1.2rem 1.2rem;
	}

	/* ---- Bindings ---------------------------------------------------------- */
	.bindings {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
	}
	.bind {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--s2);
		padding: 0.7rem 0.8rem;
		transition:
			border-color 200ms var(--ease-out),
			opacity 200ms var(--ease-out),
			background 200ms var(--ease-out);
	}
	.bind.owns {
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
		background: color-mix(in srgb, var(--phosphor) 6%, var(--s2));
	}
	.bind.dead {
		opacity: 0.45;
		border-style: dashed;
	}
	.bind.uninit {
		opacity: 0.6;
		border-style: dashed;
	}
	.bindhead {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.bname {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--text);
	}
	.bind.owns .bname {
		color: var(--phosphor);
	}
	.bstate {
		font-size: 0.625rem;
		letter-spacing: 0.06em;
		color: var(--faint);
		text-transform: uppercase;
	}
	.valwrap {
		min-height: 1.9rem;
		display: flex;
		align-items: center;
	}
	.token {
		display: inline-flex;
		align-items: center;
		font-size: 0.875rem;
		color: var(--phosphor);
		border: 1px solid color-mix(in srgb, var(--phosphor) 35%, var(--line));
		border-radius: 3px;
		background: color-mix(in srgb, var(--phosphor) 10%, var(--s1));
		padding: 0.2rem 0.5rem;
	}
	.token.locked {
		color: var(--cyan);
		border-color: color-mix(in srgb, var(--cyan) 40%, var(--line));
		background: color-mix(in srgb, var(--cyan) 10%, var(--s1));
	}
	.tq {
		color: var(--faint);
	}
	.ghost {
		font-size: 0.8125rem;
		color: var(--faint);
	}
	.reads {
		display: flex;
	}
	.mini {
		font-size: 0.5625rem;
		letter-spacing: 0.08em;
		color: var(--faint);
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s1);
		padding: 0.25rem 0.5rem;
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.mini:hover {
		color: var(--muted);
		border-color: #24303e;
	}
	.mini:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 1px;
	}

	/* ---- References -------------------------------------------------------- */
	.refs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		min-height: 1.9rem;
		border: 1px solid var(--line-soft);
		border-radius: 3px;
		background: var(--s1);
		padding: 0.4rem 0.5rem;
	}
	.norefs {
		font-size: 0.6875rem;
		color: var(--faint);
	}
	.ref {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid color-mix(in srgb, var(--phosphor) 30%, var(--line));
		border-radius: 2px;
		background: color-mix(in srgb, var(--phosphor) 8%, var(--s2));
		padding: 0.2rem 0.3rem 0.2rem 0.45rem;
	}
	.ref.mutref {
		border-color: color-mix(in srgb, var(--cyan) 35%, var(--line));
		background: color-mix(in srgb, var(--cyan) 8%, var(--s2));
	}
	.rname {
		font-size: 0.6875rem;
		color: var(--phosphor);
	}
	.ref.mutref .rname {
		color: var(--cyan);
	}
	.rkind {
		font-size: 0.625rem;
		color: var(--muted);
	}
	.drop {
		width: 1.1rem;
		height: 1.1rem;
		display: grid;
		place-items: center;
		font-size: 0.8rem;
		color: var(--faint);
		border: none;
		border-radius: 2px;
		background: none;
	}
	.drop:hover {
		color: var(--err);
	}
	.drop:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 1px;
	}

	/* ---- Operations -------------------------------------------------------- */
	.ops {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.op {
		font-size: 0.625rem;
		letter-spacing: 0.1em;
		color: var(--muted);
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
		padding: 0.45rem 0.7rem;
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.op:hover:not(:disabled) {
		color: var(--phosphor);
		border-color: color-mix(in srgb, var(--phosphor) 40%, var(--line));
	}
	.op:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.op:focus-visible {
		outline: 1px solid var(--phosphor);
		outline-offset: 1px;
	}
	.op.reset {
		margin-left: auto;
		color: var(--faint);
	}

	/* ---- The rustc session ------------------------------------------------- */
	.session {
		border: 1px solid var(--line);
		border-radius: 3px;
		background: radial-gradient(120% 120% at 50% 0%, #0e1620 0%, #080b10 90%);
		padding: 0.6rem 0.75rem;
	}
	.sessionhead {
		color: var(--faint);
		margin-bottom: 0.4rem;
	}
	.lines {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.75rem;
	}
	.hint {
		color: var(--faint);
		font-size: 0.6875rem;
	}
	.logline {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.logline .prompt {
		color: var(--phosphor);
		font-size: 0.6875rem;
	}
	.logline.bad .prompt {
		color: var(--err);
	}
	.logline code {
		color: var(--muted);
	}
	.logline.bad code {
		color: var(--text);
	}
	.rustc {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		margin-top: 0.55rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--line);
	}
	.ecode {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--err);
	}
	.emsg {
		font-size: 0.75rem;
		color: var(--text);
		line-height: 1.5;
	}

	@media (prefers-reduced-motion: reduce) {
		.bind,
		.mini,
		.op {
			transition: none;
		}
	}
</style>
