<!-- The site mark: a small phosphor tick beside the wordmark. The tick is the
     same glyph as the favicon - a lit segment on a dark bezel. -->
<a class="mark" href="/" aria-label="thunk - home">
	<span class="tick" aria-hidden="true"></span>
	<span class="word">THUNK</span>
</a>

<style>
	.mark {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
	}
	.tick {
		width: 9px;
		height: 15px;
		border-radius: 1px;
		background: var(--phosphor);
		box-shadow: 0 0 0 1px #0a0e13 inset;
		flex: none;
	}
	.word {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.9rem;
		letter-spacing: 0.22em;
		color: var(--text);
	}
	.mark:hover .word {
		color: #fff;
	}
</style>
