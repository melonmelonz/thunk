// Screenshots of the two flagship lesson widgets, for Penn's D-A checkpoint.
// Drives the live lessons that embed them, waits for hydration, and captures the
// SPI Scope (default + mid-step) and the Bit Lab (a solved target), desktop and
// mobile. Reduced-motion + fonts.ready so the shots are deterministic.
//
// Playwright is not a site dependency; resolve it from a PLAYWRIGHT_PKG override
// (the doom-proto install), else a local `playwright`. Usage:
//   PLAYWRIGHT_PKG=/var/home/goolz/dev/doom-proto/node_modules/playwright \
//     node scripts/widget-shots.mjs [baseUrl]
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const pwSpecifier = process.env.PLAYWRIGHT_PKG || 'playwright';
const pw = await import(pwSpecifier);
const chromium = pw.chromium || pw.default?.chromium;

const here = dirname(fileURLToPath(import.meta.url));
const shotDir = resolve(here, '..', '..', 'docs', 'screenshots', 'site');
const base = process.argv[2] || 'http://localhost:4173';

const SPI = `${base}/m/m3-bus/02-clock-and-data/`;
const BIT = `${base}/m/m0-power-on/02-bits-and-bytes/`;

let failures = 0;
const fail = (m) => {
	console.error('FAIL:', m);
	failures++;
};

const browser = await chromium.launch();

async function shootSpi(page, path, midStep) {
	await page.goto(SPI, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	const fig = page.locator('figure.widget[data-widget="spi-scope"]');
	await fig.locator('svg.wave').waitFor({ timeout: 10000 });
	if (midStep) {
		await fig.getByRole('button', { name: 'RESET' }).click();
		for (let i = 0; i < 5; i++) await fig.getByRole('button', { name: 'STEP' }).click();
	}
	await page.waitForTimeout(120);
	const aria = await fig.locator('svg.wave').getAttribute('aria-label');
	if (!/0x2C/.test(aria || '')) fail(`spi scope not on 0x2C (${aria})`);
	await fig.screenshot({ path });
	console.log(`  wrote ${path}`);
}

async function shootBit(page, path) {
	await page.goto(BIT, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	const fig = page.locator('figure.widget[data-widget="bit-lab"]');
	await fig.locator('.switches').waitFor({ timeout: 10000 });
	// Build 0x41 = 65 = 'A' (place values 64 + 1) so MATCH lights.
	await fig.getByRole('switch', { name: 'bit 6, place value 64' }).click();
	await fig.getByRole('switch', { name: 'bit 0, place value 1' }).click();
	await page.waitForTimeout(120);
	const lit = await fig.locator('.match.on').count();
	if (!lit) fail('bit lab MATCH did not light at 0x41');
	await fig.screenshot({ path });
	console.log(`  wrote ${path}`);
}

try {
	// Desktop.
	const desk = await browser.newContext({
		viewport: { width: 900, height: 1500 },
		deviceScaleFactor: 2,
		reducedMotion: 'reduce'
	});
	const dp = await desk.newPage();
	dp.on('console', (m) => m.type() === 'error' && console.error('  [console.error]', m.text()));
	await shootSpi(dp, resolve(shotDir, 'site-widget-spi-scope.png'), true);
	await shootBit(dp, resolve(shotDir, 'site-widget-bit-lab.png'));
	await desk.close();

	// Mobile.
	const mob = await browser.newContext({
		viewport: { width: 390, height: 1600 },
		deviceScaleFactor: 3,
		reducedMotion: 'reduce'
	});
	const mp = await mob.newPage();
	await shootSpi(mp, resolve(shotDir, 'site-widget-spi-scope-mobile.png'), false);
	await shootBit(mp, resolve(shotDir, 'site-widget-bit-lab-mobile.png'));
	await mob.close();
} catch (e) {
	fail(`driver threw: ${e.message}`);
} finally {
	await browser.close();
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nDONE: all widget shots captured');
process.exit(failures ? 1 : 0);
