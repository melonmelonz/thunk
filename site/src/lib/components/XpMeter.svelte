<!-- The XP meter: a thin VU-style track, phosphor origin, tabular readout.
     Non-functional this phase (fill at 0%) - the register arrives in S-C.
     Rendered now so the header's final geometry is locked. -->
<script lang="ts">
	let { level = 1, xp = 0, fill = 0 }: { level?: number; xp?: number; fill?: number } = $props();
	const lvl = $derived(String(level).padStart(2, '0'));
	const xpText = $derived(xp.toLocaleString('en-US'));
</script>

<div class="xp" aria-label={`level ${lvl}, ${xpText} experience`}>
	<span class="track" aria-hidden="true">
		<span class="fill" style={`width:${fill}%`}></span>
		<span class="cap"></span>
	</span>
	<span class="read tnum">LVL {lvl} <span class="sep">/</span> {xpText} XP</span>
</div>

<style>
	.xp {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
	}
	.track {
		position: relative;
		width: 92px;
		height: 4px;
		background: var(--s3);
		border-radius: 2px;
		overflow: hidden;
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--phosphor);
	}
	/* At 0% the meter still reads as live: a lit origin segment. */
	.cap {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--phosphor);
		box-shadow: 0 0 6px var(--phosphor-dim);
	}
	.read {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		letter-spacing: 0.08em;
		color: var(--muted);
		white-space: nowrap;
	}
	.sep {
		color: var(--faint);
	}
	@media (max-width: 560px) {
		.track {
			display: none;
		}
	}
</style>
