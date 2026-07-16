// Interactive widgets, driven end to end on the lessons that embed them. The
// `:::widget` directive rendered a placeholder figure at build time; here we
// prove the lesson page hydrates it and the instrument actually computes.
//
// Runs under the reduced-motion chromium project, so RUN is hidden and STEP is
// the deterministic path - exactly what these assertions use.
import { test, expect } from './fixtures';

const SPI_LESSON = '/m/m3-bus/02-clock-and-data/';
const BIT_LESSON = '/m/m0-power-on/02-bits-and-bytes/';

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
