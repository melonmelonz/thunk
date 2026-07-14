<script lang="ts">
	import type { Check } from '$lib/content';
	let { check, n }: { check: Check; n: number } = $props();
	const label = $derived(check.kind === 'choice' ? 'Multiple choice' : 'Short answer');
</script>

<article class="check">
	<div class="chead">
		<span class="cn tnum" aria-hidden="true">{String(n).padStart(2, '0')}</span>
		<span class="ck label">{label}</span>
		<span class="cid mono" aria-hidden="true">{check.id}</span>
	</div>
	<p class="prompt">{check.prompt}</p>

	{#if check.kind === 'choice'}
		<ul class="options">
			{#each check.options as option, i (i)}
				<li class="opt">
					<span class="bullet" aria-hidden="true"></span>
					<span class="otext">{option}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="field" aria-hidden="true">
			<span class="caret">_</span>
			<span class="fhint label">type your answer</span>
		</div>
	{/if}
</article>

<style>
	.check {
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--s1);
		padding: 1.15rem 1.25rem 1.3rem;
	}
	.chead {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.7rem;
	}
	.cn {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--phosphor);
	}
	.ck {
		color: var(--faint);
	}
	.cid {
		margin-left: auto;
		font-size: 0.625rem;
		letter-spacing: 0.04em;
		color: var(--faint);
		opacity: 0.7;
	}
	.prompt {
		font-size: 1rem;
		color: var(--text);
		line-height: 1.5;
		margin-bottom: 1rem;
	}

	.options {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-size: 0.9375rem;
		color: var(--muted);
	}
	.bullet {
		width: 13px;
		height: 13px;
		border: 1px solid var(--line);
		border-radius: 50%;
		flex: none;
		background: var(--s2);
	}

	.field {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		height: 2.4rem;
		padding-inline: 0.85rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--s2);
	}
	.caret {
		font-family: var(--font-mono);
		color: var(--faint);
	}
	.fhint {
		color: var(--faint);
	}
</style>
