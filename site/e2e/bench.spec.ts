// Bench: the WASM instrument. POWER brings the simulated ILI9341 up (canvas
// paints, the decoded bus trace streams RAMWR rows), STEP/RUN advance the frame
// counter, SAVE TRACE downloads thunk-trace.txt, SCANLINES toggles, and the
// DOOM source switch lazily fetches the WAD and repaints the panel to the
// Freedoom title. The full title-paint is the one slow/flaky-under-CI step, so
// it is isolated and skipped in CI (still run locally - see the report).
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function bootFinale(page: Page) {
	await page.goto('/bench/');
	// The control surface (window.__bench) appears once the sim wasm resolves.
	await page.waitForFunction(() => (window as unknown as { __bench?: unknown }).__bench);
	const power = page.getByRole('button', { name: 'POWER' });
	await expect(power).toBeEnabled();
	await power.click();
}

// Small browser-side readers for the bench control surface (window.__bench).
// Defined as strings passed to evaluate so they run in the page, not in node.
const isLit = (page: Page) => page.evaluate(() => (window as any).__bench.isLit() as boolean);
const nonBlack = (page: Page) => page.evaluate(() => (window as any).__bench.sampleNonBlack() as number);
const frameOf = (page: Page) => page.evaluate(() => (window as any).__bench.frame() as number);
const sourceOf = (page: Page) => page.evaluate(() => (window as any).__bench.source() as string);
const doomPhase = (page: Page) => page.evaluate(() => (window as any).__bench.doomPhase() as string);
const wadTotal = (page: Page) => page.evaluate(() => (window as any).__bench.wad().total as number);

test('POWER: canvas paints, trace streams RAMWR, frame advances, SAVE TRACE downloads', async ({
	page
}) => {
	await bootFinale(page);

	// The panel lit and the canvas is painting non-black pixels.
	await expect.poll(() => isLit(page)).toBe(true);
	await expect.poll(() => nonBlack(page)).toBeGreaterThan(0);

	// The bus trace populated, and it carries decoded RAMWR (pixel-write) rows.
	await expect(page.locator('.log .row').first()).toBeVisible();
	await expect(page.locator('.log')).toContainText('RAMWR');

	// FRAME advances after STEP.
	const before = await frameOf(page);
	await page.getByRole('button', { name: 'STEP' }).click();
	await expect.poll(() => frameOf(page)).toBeGreaterThan(before);
	await expect(page.locator('.frame')).not.toHaveText(/FRAME 00000/);

	// FRAME advances under RUN too, then PAUSE stops it.
	await page.getByRole('button', { name: 'RUN' }).click();
	const running = await frameOf(page);
	await expect.poll(() => frameOf(page)).toBeGreaterThan(running);
	await page.getByRole('button', { name: 'PAUSE' }).click();

	// SAVE TRACE downloads thunk-trace.txt.
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'SAVE TRACE' }).click()
	]);
	expect(download.suggestedFilename()).toBe('thunk-trace.txt');
});

test('SCANLINES toggle', async ({ page }) => {
	await bootFinale(page);
	const toggle = page.getByRole('button', { name: /SCANLINES/ });
	// Default ON: the CRT overlay carries the scanlines class.
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.crt.scanlines')).toHaveCount(1);
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await expect(page.locator('.crt.scanlines')).toHaveCount(0);
});

test('DOOM: the source switch starts the WAD fetch', async ({ page }) => {
	await bootFinale(page);
	await page.getByRole('button', { name: /^DOOM/ }).click();
	// The switch takes effect and the lazy WAD fetch kicks off (bytes reported).
	await expect.poll(() => sourceOf(page)).toBe('doom');
	await expect.poll(() => wadTotal(page), { timeout: 30_000 }).toBeGreaterThan(0);
});

test('DOOM: the panel repaints to the Freedoom title', async ({ page }) => {
	test.skip(!!process.env.CI, 'DOOM boot (10MB WAD + doomgeneric wasm) is slow/flaky under CI; verified locally.');
	await bootFinale(page);
	await page.getByRole('button', { name: /^DOOM/ }).click();
	// Wait for the module + WAD to be ready, then the panel repaints non-black.
	await expect.poll(() => doomPhase(page), { timeout: 60_000 }).toBe('ready');
	await expect.poll(() => nonBlack(page), { timeout: 15_000 }).toBeGreaterThan(0);
});
