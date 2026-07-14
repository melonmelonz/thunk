<!--
  Hand-authored module glyphs. One 12x12 pixel-grid mark per module, drawn in
  currentColor rects with crisp edges - instrument marks, not cartoons. Muted by
  default; the parent lifts currentColor to phosphor on hover. Rendered at 24px.

  M0 IEC power symbol      M1 dot inside two square rings
  M2 gear missing a tooth  M3 clock wave over data bits
  M4 3x3 grid, one lit     M5 one-point corridor
  M6 branch merging
-->
<script lang="ts">
	let { tag, size = 24 }: { tag: string; size?: number } = $props();

	// Each glyph: a list of [x, y, w, h] cells on a 12x12 field (w/h default 1).
	type Cell = [number, number, number?, number?];
	const glyphs: Record<string, Cell[]> = {
		// Power: a stem entering the gap at the top of an open ring.
		M0: [
			[5, 0, 2, 4], // stem
			[3, 3], [4, 3], [7, 3], [8, 3], // top arc (gap under stem)
			[2, 4], [9, 4],
			[1, 5, 1, 3], [10, 5, 1, 3], // sides
			[2, 8], [9, 8],
			[3, 9], [8, 9],
			[4, 10], [5, 10], [6, 10], [7, 10] // bottom arc
		],
		// Two concentric square rings around a lit core: ring boundaries.
		M1: [
			[1, 1, 10, 1], [1, 10, 10, 1], [1, 1, 1, 10], [10, 1, 1, 10], // outer ring
			[3, 3, 6, 1], [3, 8, 6, 1], [3, 3, 1, 6], [8, 3, 1, 6], // inner ring
			[5, 5, 2, 2] // core
		],
		// A gear: hub, ring, four teeth - the top tooth is missing (wry).
		M2: [
			[3, 3, 6, 1], [3, 8, 6, 1], [3, 3, 1, 6], [8, 3, 1, 6], // body ring
			[5, 5, 2, 2], // hub
			[1, 5, 2, 2], // W tooth
			[9, 5, 2, 2], // E tooth
			[5, 9, 2, 2] // S tooth (N tooth intentionally absent)
		],
		// A clock: square wave on top, data bits beneath it.
		M3: [
			[0, 4], [1, 4], // low
			[2, 1, 1, 4], // rising edge
			[3, 1], [4, 1], // high
			[5, 1, 1, 4], // falling edge
			[6, 4], [7, 4], // low
			[8, 1, 1, 4], // rising edge
			[9, 1], [10, 1], // high
			[11, 1, 1, 4], // edge
			[0, 8, 2, 2], [3, 8, 2, 2], [6, 8, 2, 2], [9, 8, 2, 2] // data bits
		],
		// A 3x3 pixel field, one pixel lit.
		M4: [
			[1, 1, 10, 1], [1, 10, 10, 1], [1, 1, 1, 10], [10, 1, 1, 10], // frame
			[4, 1, 1, 9], [7, 1, 1, 9], // vertical dividers
			[1, 4, 9, 1], [1, 7, 9, 1], // horizontal dividers
			[5, 1, 3, 3] // the one lit pixel (top-middle cell)
		],
		// A corridor in one-point perspective: nested squares toward a vanishing
		// point up and to the right.
		M5: [
			[0, 0, 12, 1], [0, 11, 12, 1], [0, 0, 1, 12], [11, 0, 1, 12], // mouth
			[3, 1, 6, 1], [3, 8, 6, 1], [3, 1, 1, 8], [9, 1, 1, 7], // mid
			[5, 2, 3, 1], [5, 6, 3, 1], [5, 2, 1, 5], [7, 2, 1, 4], // near end
			[1, 1], [2, 1], [1, 10], [2, 9] // corridor edges hinting the pull
		],
		// Two lines joining into one: a branch merge.
		M6: [
			[3, 1], [3, 2], [3, 3], [3, 4], [4, 5], // left line converging
			[8, 1], [8, 2], [8, 3], [8, 4], [7, 5], // right line converging
			[5, 6, 2, 2], // merge node
			[5, 8], [5, 9], [5, 10], [5, 11] // the single trunk
		]
	};

	const cells = $derived(glyphs[tag] ?? glyphs.M0);
</script>

<svg
	class="glyph"
	width={size}
	height={size}
	viewBox="0 0 12 12"
	fill="currentColor"
	shape-rendering="crispEdges"
	aria-hidden="true"
	focusable="false"
>
	{#each cells as [x, y, w = 1, h = 1] (`${x}-${y}-${w}-${h}`)}
		<rect {x} {y} width={w} height={h} />
	{/each}
</svg>

<style>
	.glyph {
		display: block;
	}
</style>
