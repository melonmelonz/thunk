// Drive the live bench with Playwright: capture the three canonical states
// (pre-boot, mid-run, waveform open) and assert the panel actually paints
// non-black pixels after boot. Usage: node scripts/bench-shots.mjs <baseUrl>
// Screenshots land in docs/screenshots/site/. Reduced-motion + fonts.ready so
// shots are deterministic.

// Playwright is not a site dependency (it would bloat `npm ci`); resolve it
// from wherever it exists (a PLAYWRIGHT_PKG override, else a local install).
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const pwSpecifier = process.env.PLAYWRIGHT_PKG || 'playwright';
const pw = await import(pwSpecifier);
const chromium = pw.chromium || pw.default?.chromium;

const here = dirname(fileURLToPath(import.meta.url));
const shotDir = resolve(here, '..', '..', 'docs', 'screenshots', 'site');
const base = process.argv[2] || 'http://localhost:4173';

const browser = await chromium.launch();
const ctx = await browser.newContext({
	// Tall enough to frame the whole left instrument (panel + source switch +
	// scanlines toggle + the BOOT EVENTS stat) alongside the scope.
	viewport: { width: 1320, height: 1440 },
	deviceScaleFactor: 1.5,
	reducedMotion: 'reduce'
});
const page = await ctx.newPage();
page.on('console', (m) => {
	if (m.type() === 'error') console.error('  [console.error]', m.text());
});

const fail = (msg) => {
	console.error('FAIL:', msg);
	process.exitCode = 1;
};

await page.goto(`${base}/bench/`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
// Wait for the sim to load (POWER enabled).
await page.waitForFunction(() => !!window.__bench, null, { timeout: 15000 });

// 1. Pre-boot: NO SIGNAL.
await page.waitForTimeout(200);
await page.screenshot({ path: resolve(shotDir, 'site-bench.png') });
console.log('shot: pre-boot');

// 2. Boot + a few ticks -> mid-run.
await page.evaluate(() => window.__bench.power());
await page.waitForFunction(() => window.__bench.isLit(), null, { timeout: 5000 });
await page.evaluate(() => window.__bench.step(24));
await page.waitForTimeout(120);
const frame = await page.evaluate(() => window.__bench.frame());
const nonBlack = await page.evaluate(() => window.__bench.sampleNonBlack());
console.log(`  frame=${frame} nonBlackPixels=${nonBlack}`);
if (nonBlack < 1000) fail(`panel did not paint (only ${nonBlack} non-black px)`);
await page.screenshot({ path: resolve(shotDir, 'site-bench-run.png') });
console.log('shot: mid-run');

// 3. Waveform: click the first byte-bearing row, capture the detail well.
const row = page.locator('button.row').first();
await row.click();
await page.waitForTimeout(120);
const hasWave = await page.evaluate(() => !!document.querySelector('.wave'));
if (!hasWave) fail('waveform well did not render after selecting a row');
await page.screenshot({ path: resolve(shotDir, 'site-bench-waveform.png') });
console.log('shot: waveform');

// 4. fps: run ~140 frames, read the rolling avg (tick+paint ms).
await page.evaluate(() => window.__bench.run());
await page.waitForTimeout(5000);
const avgMs = await page.evaluate(() => window.__bench.perf());
const endFrame = await page.evaluate(() => window.__bench.frame());
await page.evaluate(() => window.__bench.pause());
console.log(`  ran to frame ${endFrame}; avg tick+paint = ${avgMs.toFixed(3)} ms/frame`);

await browser.close();
console.log(process.exitCode ? 'DONE (with failures)' : 'DONE: all live checks passed');
