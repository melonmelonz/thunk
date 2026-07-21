// Interactive widgets, driven end to end on the lessons that embed them. The
// `:::widget` directive rendered a placeholder figure at build time; here we
// prove the lesson page hydrates it and the instrument actually computes.
//
// Runs under the reduced-motion chromium project, so RUN is hidden and STEP is
// the deterministic path - exactly what these assertions use.
import { test, expect } from './fixtures';

const SPI_LESSON = '/m/m3-bus/02-clock-and-data/';
const BIT_LESSON = '/m/m0-power-on/02-bits-and-bytes/';
const DECODER_LESSON = '/m/m0-power-on/03-what-is-a-program/';
const VOLATILE_LESSON = '/m/m1-kernel/04-memory-and-mmap/';
const OWNERSHIP_LESSON = '/m/m2-rust/03-borrowing/';
const PIXEL_LESSON = '/m/m4-panel/02-color-in-sixteen-bits/';
const DIFF_LESSON = '/m/m6-open-source/04-reading-a-diff/';
const FRAME_LESSON = '/m/m5-doom/02-frames-to-the-panel/';

test.describe('SPI Scope (m3-bus/02)', () => {
	test('hydrates, redraws on a new byte, and latches MSB-first', async ({ page }) => {
		await page.goto(SPI_LESSON);
		const fig = page.locator('figure.widget[data-widget="spi-scope"]');
		// The fallback caption is replaced by the mounted SVG scope.
		const svg = fig.locator('svg.wave');
		await expect(svg).toBeVisible();
		await expect(fig.locator('figcaption')).toHaveCount(0);

		// Default is 0x2C (RAMWR), fully latched.
		await expect(svg).toHaveAttribute('aria-label', /0x2C: MSB-first bits 0 0 1 0 1 1 0 0/);
		await expect(fig.locator('.reads .rv').first()).toContainText('0x2C');
		await expect(fig.locator('.reads .rv').first()).toContainText('44');

		// Change the byte via the hex entry -> the waveform + readout redraw.
		await fig.locator('.hexin').fill('FF');
		await expect(svg).toHaveAttribute('aria-label', /0xFF: MSB-first bits 1 1 1 1 1 1 1 1/);
		await expect(fig.locator('.reads .rv').first()).toContainText('0xFF');
		await expect(fig.locator('.reads .rv').first()).toContainText('255');

		// Rewind and step one edge: the running value latches the first bit only.
		await fig.getByRole('button', { name: 'RESET' }).click();
		await expect(fig.locator('.reads .rd').nth(1)).toContainText('(0/8)');
		await fig.getByRole('button', { name: 'STEP' }).click();
		const latched = fig.locator('.reads .rd').nth(1);
		await expect(latched).toContainText('(1/8)');
		await expect(latched).toContainText('= 1'); // 0xFF, one bit latched MSB-first
	});

	test('steppers and decimal entry agree', async ({ page }) => {
		await page.goto(SPI_LESSON);
		const fig = page.locator('figure.widget[data-widget="spi-scope"]');
		await expect(fig.locator('svg.wave')).toBeVisible();
		await fig.locator('.decin').fill('0');
		await fig.getByRole('button', { name: 'increment byte' }).click();
		await expect(fig.locator('.hexin')).toHaveValue('01');
		await expect(fig.locator('svg.wave')).toHaveAttribute('aria-label', /0x01/);
	});
});

test.describe('Bit Lab (m0-power-on/02)', () => {
	test('toggles switches and lights MATCH at the target', async ({ page }) => {
		await page.goto(BIT_LESSON);
		const fig = page.locator('figure.widget[data-widget="bit-lab"]');
		await expect(fig.locator('.switches')).toBeVisible();
		await expect(fig.locator('figcaption')).toHaveCount(0);

		const match = fig.locator('.match');
		await expect(match).not.toHaveClass(/\bon\b/);

		// Target is 0x41 = 65 = 'A' = place values 64 + 1.
		await fig.getByRole('switch', { name: 'bit 6, place value 64' }).click();
		const decRow = fig.locator('.row', { hasText: 'DEC' });
		await expect(decRow).toContainText('64');
		await expect(match).not.toHaveClass(/\bon\b/);

		await fig.getByRole('switch', { name: 'bit 0, place value 1' }).click();
		await expect(decRow).toContainText('65');
		await expect(fig.locator('.rv.char')).toHaveText('A');
		await expect(fig.locator('.row', { hasText: 'HEX' })).toContainText('0x41');
		await expect(match).toHaveClass(/\bon\b/);
		await expect(match).toHaveText('MATCH');

		// CLEAR resets the readout and drops MATCH.
		await fig.getByRole('button', { name: 'clear all bits to zero' }).click();
		await expect(decRow).toContainText('0');
		await expect(match).not.toHaveClass(/\bon\b/);
	});
});

test.describe('Byte Decoder (m0-power-on/03)', () => {
	test('hydrates and decodes a typed hex value four ways', async ({ page }) => {
		await page.goto(DECODER_LESSON);
		const fig = page.locator('figure.widget[data-widget="byte-decoder"]');
		await expect(fig.locator('.bitstrip')).toBeVisible();
		await expect(fig.locator('figcaption')).toHaveCount(0);

		// Switch to hex entry and type 2C: readout shows all four faces + char.
		await fig.getByRole('radio', { name: 'enter in hex' }).click();
		await fig.locator('.entry').fill('2C');
		await expect(fig.locator('.row', { hasText: 'DEC' })).toContainText('44');
		await expect(fig.locator('.row', { hasText: 'BIN' })).toContainText('0010 1100');
		await expect(fig.locator('.row', { hasText: 'CHR' }).locator('.char')).toHaveText(',');
	});
});

test.describe('Volatile Memory (m1-kernel/04)', () => {
	test('hydrates; cutting power clears memory but keeps storage', async ({ page }) => {
		await page.goto(VOLATILE_LESSON);
		const fig = page.locator('figure.widget[data-widget="volatile-memory"]');
		await expect(fig.locator('.rows')).toBeVisible();
		await expect(fig.locator('figcaption')).toHaveCount(0);

		// Memory boots loaded with DOOM (0x44 ...). Cut power -> memory blanks.
		const memCells = fig.locator('.rowblock', { hasText: 'MEMORY' }).locator('.cell');
		await expect(memCells.first().locator('.hex')).toHaveText('44');
		await fig.getByRole('switch', { name: 'power' }).click();
		await expect(memCells.first().locator('.hex')).toHaveText('——');
		// Storage is untouched by the power cut.
		const storeCells = fig.locator('.rowblock', { hasText: 'STORAGE' }).locator('.cell');
		await expect(storeCells.first().locator('.hex')).toHaveText('44');
	});
});

test.describe('Ownership / Borrow (m2-rust/03)', () => {
	test('hydrates; using a moved-out binding is the real E0382', async ({ page }) => {
		await page.goto(OWNERSHIP_LESSON);
		const fig = page.locator('figure.widget[data-widget="ownership-move"]');
		await expect(fig.locator('.bindings')).toBeVisible();
		await expect(fig.locator('figcaption')).toHaveCount(0);

		// Move a -> b, then read a: the borrow checker refuses with rustc's message.
		await fig.getByRole('button', { name: /MOVE/ }).click();
		await fig.getByRole('button', { name: 'read a' }).click();
		const err = fig.locator('.rustc');
		await expect(err).toContainText('error[E0382]');
		await expect(err).toContainText('use of moved value: `a`');
	});

	test('blocks a mutable borrow while shared borrows are held (E0502)', async ({ page }) => {
		await page.goto(OWNERSHIP_LESSON);
		const fig = page.locator('figure.widget[data-widget="ownership-move"]');
		await expect(fig.locator('.bindings')).toBeVisible();
		await fig.getByRole('button', { name: 'take a shared borrow' }).click();
		await fig.getByRole('button', { name: 'take a mutable borrow' }).click();
		await expect(fig.locator('.rustc')).toContainText('E0502');
		await expect(fig.locator('.rustc')).toContainText('also borrowed as immutable');
	});
});

test.describe('Pixel Forge (m4-panel/02)', () => {
	test('hydrates; full red packs to 0xF800 with high byte 0xF8', async ({ page }) => {
		await page.goto(PIXEL_LESSON);
		const fig = page.locator('figure.widget[data-widget="pixel-forge"]');
		await expect(fig.locator('.sliders')).toBeVisible();
		await expect(fig.locator('figcaption')).toHaveCount(0);

		// Default is pure red: word + byte split match the M4 lesson.
		await expect(fig.locator('.wv')).toHaveText('0xF800');
		const bytes = fig.locator('.byte .byv');
		await expect(bytes.first()).toHaveText('0xF8');
		await expect(bytes.nth(1)).toHaveText('0x00');

		// Painting a pixel advances the streamed byte count by two.
		await fig.getByRole('button', { name: 'paint pixel 1' }).click();
		await expect(fig.locator('.sm')).toContainText('1 px · 2 bytes');
	});
});

test.describe('Diff Reader (m6-open-source/04)', () => {
	test('hydrates; renders the patch and reveals the explanation', async ({ page }) => {
		await page.goto(DIFF_LESSON);
		const fig = page.locator('figure.widget[data-widget="diff-reader"]');
		await expect(fig.locator('.patch')).toBeVisible();
		await expect(fig.locator('figcaption')).toHaveCount(0);

		// The change: one removed signature, its replacement with -> bool.
		await expect(fig.locator('.drow.del')).toHaveCount(1);
		await expect(fig.locator('.stat')).toContainText('+5');
		await expect(fig.locator('.stat')).toContainText('1');

		// The explanation is hidden until revealed.
		const reveal = fig.getByRole('button', { name: 'What this changes' });
		await expect(reveal).toHaveAttribute('aria-expanded', 'false');
		await expect(fig.locator('#diff-explain')).toHaveCount(0);
		await reveal.click();
		await expect(reveal).toHaveAttribute('aria-expanded', 'true');
		await expect(fig.locator('#diff-explain')).toContainText('out-of-range writes are refused');
	});
});

test.describe('Frame Budget (m5-doom/02)', () => {
	test('hydrates; the clock crosses the 30 fps deadline at ~37 MHz', async ({ page }) => {
		await page.goto(FRAME_LESSON);
		const fig = page.locator('figure.widget[data-widget="frame-budget"]');
		await expect(fig.locator('.dial')).toBeVisible();
		await expect(fig.locator('figcaption')).toHaveCount(0);

		// Default 30 MHz misses: 30 MHz does not buy 30 fps (the lesson's aha).
		const clock = fig.locator('input.range');
		await expect(clock).toHaveValue('30');
		await expect(fig.locator('.verdict')).toHaveText('MISSES 30 FPS');
		await expect(fig.locator('.verdict')).not.toHaveClass(/\bon\b/);

		// Windowed frame is the lesson figure, and it names the crossing clock.
		await expect(fig.locator('.readout')).toContainText('153,600');
		await expect(fig.locator('.readout')).toContainText('36.9 MHz');

		// Push the clock past the crossing: the loop closes, the verdict lights.
		await clock.fill('37');
		await expect(fig.locator('.verdict')).toHaveText('MEETS 30 FPS');
		await expect(fig.locator('.verdict')).toHaveClass(/\bon\b/);
		await expect(fig.locator('.hval')).toContainText('30');

		// Aiming every pixel needs five times the bytes and blows the budget again.
		await fig.getByRole('radio', { name: /Aim every pixel/ }).click();
		await expect(fig.locator('.readout')).toContainText('768,000');
		await expect(fig.locator('.verdict')).toHaveText('MISSES 30 FPS');
	});
});
