<script lang="ts">
	// The colophon: the real thing, documented in a plain engineering voice. What
	// thunk is, the four ways to run it (mirrors docs/PATHS.md), the stack, what it
	// stores, and the build it was cut from. No marketing register, no invented
	// numbers - the sha + test count come from the same build plate the front door
	// shows. This is content; the only "logic" is reading build.json.
	import Meta from '$lib/components/Meta.svelte';
	import build from '$lib/build.json';
</script>

<Meta
	title="COLOPHON · thunk"
	description="How the thunk course site is built and run: the four ways to run the course, the stack, what it stores, and its provenance. No accounts, no telemetry."
	ogTitle="Colophon - thunk"
/>

<header class="chead">
	<p class="eyebrow label">The instrument, documented</p>
	<h1>Colophon</h1>
	<p class="lede">
		What this is, how it runs, and what it keeps. Plain facts, no register change - the same
		story the binary tells, written down.
	</p>
</header>

<!-- 1. What thunk is ------------------------------------------------------- -->
<section class="cx" aria-label="what thunk is">
	<h2 class="label">What thunk is</h2>
	<p class="prose">
		From true zero to DOOM on a panel. You build the kernel, the driver, and the bus, then watch
		real hardware come up. Nothing leaves this machine.
	</p>
	<p class="def mono">
		thunk <span class="pos">(n.)</span> - a piece of code set aside to run later, not thrown away.
	</p>
</section>

<!-- 2. The four ways to run it (mirrors docs/PATHS.md) --------------------- -->
<section class="cx" aria-label="the four ways to run it">
	<h2 class="label">The four ways to run it</h2>
	<p class="prose">
		The course has to work on whatever machine a learner actually has - which usually means no
		hardware, and sometimes no permission to install anything. Every rung runs the same course from
		the same binary. Nothing here is a demo build.
	</p>
	<ol class="rungs">
		<li class="rung">
			<span class="rtag mono">BROWSER</span>
			<div class="rbody">
				<p class="rtitle">This site. No install at all.</p>
				<p class="rtext">
					The whole curriculum runs here, and the bench runs the real simulator compiled to
					WebAssembly, driving a virtual panel from the same bus events the binary produces. The
					zero-friction way in. <a class="link" href="/bench/">Open the bench</a>.
				</p>
			</div>
		</li>
		<li class="rung">
			<span class="rtag mono">BINARY</span>
			<div class="rbody">
				<p class="rtitle">The simulator, in-process.</p>
				<p class="rtext">
					The <span class="mono">thunk</span> binary simulates the SPI bus, the panel, and the boot
					sequence deterministically - the terminal classroom, the checks, the annotated trace. The
					same binary emits the offline web build (<span class="mono">thunk web</span>): plain HTML,
					zero external URLs, for a machine that can install nothing and may phone nothing out.
				</p>
				<pre class="cmd mono">cargo run -p thunk-cli -- tui</pre>
			</div>
		</li>
		<li class="rung">
			<span class="rtag mono">QEMU</span>
			<div class="rbody">
				<p class="rtitle">Same binary, a real kernel, no hardware.</p>
				<p class="rtext">
					Boot a real Linux kernel in an emulated machine where the static <span class="mono"
						>thunk</span
					> binary is the only userspace. PID 1 is a five-line init; the course runs, prints its bus
					trace over the serial console, and powers the machine off. No KVM required, so it runs
					anywhere QEMU installs.
				</p>
				<pre class="cmd mono">./scripts/qemu-smoke.sh</pre>
			</div>
		</li>
		<li class="rung">
			<span class="rtag mono">HARDWARE</span>
			<div class="rbody">
				<p class="rtitle">A real panel, on the open build.</p>
				<p class="rtext">
					The open profile (<span class="mono">--features open</span>) adds <span class="mono"
						>thunk hw</span
					>, which drives the same finale on a physical ILI9341-class panel over <span class="mono"
						>/dev/spidev</span
					> and GPIO, with the same driver code the simulator runs. A BeaglePlay or similar board and
					about eight wires.
				</p>
				<pre class="cmd mono">cargo run -p thunk-cli --features open -- hw \
    --spidev /dev/spidev0.0 --dc-chip /dev/gpiochip2 --dc-line 10</pre>
			</div>
		</li>
	</ol>
</section>

<!-- 3. The stack ---------------------------------------------------------- -->
<section class="cx" aria-label="the stack">
	<h2 class="label">The stack</h2>
	<dl class="stack">
		<div class="srow">
			<dt class="mono">SITE</dt>
			<dd>
				SvelteKit, adapter-static: a fully prerendered SPA with no server runtime. Client-side
				navigation, view transitions, fonts self-hosted. Nothing is fetched from anywhere at
				runtime.
			</dd>
		</div>
		<div class="srow">
			<dt class="mono">CONTENT</dt>
			<dd>
				Every lesson and check is compiled from the Rust <span class="mono">thunk-content</span>
				crate and exported to JSON at build time - the same content the terminal classroom and the
				offline bundle render, only serialized. CI proves it never drifts from the curriculum.
			</dd>
		</div>
		<div class="srow">
			<dt class="mono">BENCH</dt>
			<dd>
				<a class="link" href="/bench/">The bench</a> is <span class="mono">thunk-sim</span> compiled
				to WebAssembly, driving a 240x320 canvas over the simulated SPI bus. The trace crosses into
				JavaScript as flat typed arrays; the panel is <span class="mono">putImageData</span> from
				RGB565 converted in Rust.
			</dd>
		</div>
		<div class="srow">
			<dt class="mono">DOOM</dt>
			<dd>
				The finale can hand the panel to DOOM: <span class="mono">doomgeneric</span> plus Freedoom,
				compiled into the same WASM harness and fed over the same bus, with the trace live
				underneath. The GPL-2.0 source and the licenses are served with the site:
				<a class="link" href="/doom/doomgeneric-src.tar.gz">doomgeneric source (tar.gz)</a>,
				<a class="link" href="/doom/gpl-2.0.txt">the GPL-2.0 text</a>, and
				<a class="link" href="/doom/COPYING.txt">Freedoom's BSD license</a>.
			</dd>
		</div>
	</dl>
</section>

<!-- 4. Privacy ------------------------------------------------------------ -->
<section class="cx" aria-label="privacy">
	<h2 class="label">Privacy</h2>
	<p class="prose">
		No accounts. No telemetry. No analytics. Nothing you do here is sent anywhere. Your progress -
		XP, levels, achievements, the furthest lesson you opened - lives in this browser's
		<span class="mono">localStorage</span> under the key <span class="mono">thunk.xp.v1</span>, and
		nowhere else. Clearing the browser clears it, so the
		<a class="link" href="/progress/">Operator card</a> can export the whole record to a JSON file and
		import it back. That is the only copy that ever leaves the browser, and only when you ask for it.
	</p>
</section>

<!-- 5. Provenance --------------------------------------------------------- -->
<section class="cx" aria-label="provenance">
	<h2 class="label">Provenance</h2>
	<p class="prose">This build was cut from a known commit and a green test suite:</p>
	<p class="plate mono tnum" aria-label="build provenance">
		BUILD {build.sha}{#if build.tests}
			<span class="pd" aria-hidden="true">&middot;</span> {build.tests} TESTS GREEN{/if}
		<span class="pd" aria-hidden="true">&middot;</span> AIR-GAPPED
	</p>
	<p class="prose fine">
		Licensed MIT / Apache-2.0. The course is the same three renderers over one content source: the
		terminal binary, the offline bundle, and this site.
		<a class="link" href="/">Back to the front door</a>.
	</p>
</section>

<style>
	.chead {
		max-width: 46rem;
		margin-bottom: 2.5rem;
	}
	.eyebrow {
		color: var(--phosphor);
		margin-bottom: 0.9rem;
	}
	.chead h1 {
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

	.cx {
		max-width: 52rem;
		margin-top: 2.75rem;
		padding-top: 2.25rem;
		border-top: 1px solid var(--line);
	}
	h2.label {
		color: var(--muted);
		margin-bottom: 1.1rem;
	}

	.prose {
		font-size: 0.9375rem;
		line-height: 1.7;
		color: var(--muted);
		max-width: 42rem;
	}
	.prose .mono {
		font-size: 0.875em;
		color: var(--text);
	}
	.prose.fine {
		margin-top: 1.1rem;
		font-size: 0.8125rem;
		color: var(--faint);
	}

	/* Inline links: the instrument style - muted with a hairline underline that
	   warms to phosphor on hover. No new hue. */
	.link {
		color: var(--text);
		border-bottom: 1px solid color-mix(in srgb, var(--phosphor) 32%, var(--line));
		transition:
			color 140ms var(--ease-out),
			border-color 140ms var(--ease-out);
	}
	.link:hover {
		color: var(--phosphor);
		border-bottom-color: var(--phosphor);
	}

	/* The definition, typeset as a quiet footnote line. */
	.def {
		margin-top: 1.2rem;
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--muted);
		letter-spacing: 0.01em;
	}
	.def .pos {
		color: var(--faint);
	}

	/* ---- The four rungs ------------------------------------------------- */
	.rungs {
		list-style: none;
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
	}
	.rung {
		display: grid;
		grid-template-columns: 6.5rem 1fr;
		gap: 1.25rem;
		padding: 1.25rem 0;
		border-top: 1px solid var(--line-soft);
	}
	.rung:first-child {
		border-top: none;
		padding-top: 0;
	}
	.rtag {
		font-size: 0.625rem;
		letter-spacing: 0.16em;
		color: var(--phosphor);
		padding-top: 0.15rem;
	}
	.rbody {
		min-width: 0;
	}
	.rtitle {
		font-size: 0.9375rem;
		color: var(--text);
		margin-bottom: 0.4rem;
	}
	.rtext {
		font-size: 0.875rem;
		line-height: 1.65;
		color: var(--muted);
	}
	.rtext .mono {
		font-size: 0.9em;
		color: var(--text);
	}
	.cmd {
		margin-top: 0.85rem;
		font-size: 0.75rem;
		line-height: 1.55;
		color: var(--phosphor);
		background: var(--s1);
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.6rem 0.75rem;
		overflow-x: auto;
		white-space: pre;
	}

	/* ---- The stack ------------------------------------------------------ */
	.stack {
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.srow {
		display: grid;
		grid-template-columns: 6.5rem 1fr;
		gap: 1.25rem;
		padding: 1rem 1.1rem;
		border-top: 1px solid var(--line-soft);
	}
	.srow:first-child {
		border-top: none;
	}
	.srow dt {
		font-size: 0.625rem;
		letter-spacing: 0.16em;
		color: var(--faint);
		padding-top: 0.15rem;
	}
	.srow dd {
		font-size: 0.875rem;
		line-height: 1.65;
		color: var(--muted);
		min-width: 0;
	}
	.srow dd .mono {
		font-size: 0.9em;
		color: var(--text);
	}

	/* ---- Provenance plate ----------------------------------------------- */
	.plate {
		margin-top: 1.1rem;
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		color: var(--faint);
	}
	.plate .pd {
		color: var(--line);
		margin-inline: 0.15em;
	}

	@media (max-width: 560px) {
		.rung,
		.srow {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}
	}
</style>
