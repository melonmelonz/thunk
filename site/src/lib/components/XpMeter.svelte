<!-- The XP meter: a thin VU-style track, phosphor fill, tabular readout. Live off
     the store; the fill animates its width 200ms on every award. Sits in the
     marketing header (`/`) and in the app status bar. -->
<script lang="ts">
	import { xp } from '$lib/xp.svelte';

	const lvl = $derived(String(xp.level).padStart(2, '0'));
	const xpText = $derived(xp.xp.toLocaleString('en-US'));
	const fill = $derived(xp.fill);
</script>

<a class="xp" href="/progress/" aria-label={`level ${lvl}, ${xpText} experience - open the operator card`}>
	<span class="track" aria-hidden="true">
		<span class="fill" style={`width:${fill}%`}></span>
		<span class="cap"></span>
	</span>
	<span class="read tnum">LVL {lvl} <span class="sep">/</span> {xpText} XP</span>
</a>

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
		transition: width 200ms var(--ease-out);
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
	.xp:hover .read {
		color: var(--text);
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
