// Capture the states added in the colophon + bench SAVE TRACE + achievements
// counter pass. Usage:
//   node scripts/colophon-shots.mjs <baseUrl>
// Reduced-motion + fonts.ready so shots are deterministic. Playwright resolves
// from PLAYWRIGHT_PKG (a local install), not a site dependency.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const pwSpecifier = process.env.PLAYWRIGHT_PKG || 'playwright';
const pw = await import(pwSpecifier);
const chromium = pw.chromium || pw.default?.chromium;

const here = dirname(fileURLToPath(import.meta.url));
const shotDir = resolve(here, '..', '..', 'docs', 'screenshots', 'site');
const base = process.argv[2] || 'http://localhost:4173';

const fail = (msg) => {
	console.error('FAIL:', msg);
	process.exitCode = 1;
};

const browser = await chromium.launch();

// ---- /colophon desktop ------------------------------------------------------
const ctx = await browser.newContext({
	viewport: { width: 1360, height: 900 },
	deviceScaleFactor: 1.5,
	reducedMotion: 'reduce'
});
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && console.error('  [console.error]', m.text()));
await page.goto(`${base}/colophon/`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
const rungs = await page.locator('.rung').count();
if (rungs !== 4) fail(`expected 4 run rungs, saw ${rungs}`);
await page.screenshot({ path: resolve(shotDir, 'site-colophon.png'), fullPage: true });
console.log('shot: /colophon (desktop, full page)');
await ctx.close();

// ---- /colophon mobile -------------------------------------------------------
const mctx = await browser.newContext({
	viewport: { width: 390, height: 844 },
	deviceScaleFactor: 2,
	reducedMotion: 'reduce',
	isMobile: true
});
const mpage = await mctx.newPage();
await mpage.goto(`${base}/colophon/`, { waitUntil: 'networkidle' });
await mpage.evaluate(() => document.fonts.ready);
await mpage.waitForTimeout(200);
await mpage.screenshot({ path: resolve(shotDir, 'site-colophon-mobile.png') });
console.log('shot: /colophon (mobile)');
await mctx.close();

// ---- bench with SAVE TRACE enabled (powered on) -----------------------------
const bctx = await browser.newContext({
	viewport: { width: 1360, height: 950 },
	deviceScaleFactor: 1.5,
	reducedMotion: 'reduce'
});
const bpage = await bctx.newPage();
bpage.on('console', (m) => m.type() === 'error' && console.error('  [console.error]', m.text()));
await bpage.goto(`${base}/bench/`, { waitUntil: 'networkidle' });
await bpage.evaluate(() => document.fonts.ready);
// Wait for the sim to expose its control surface, then power + step a few frames
// so the trace log has rows and SAVE TRACE is enabled.
await bpage.waitForFunction(() => !!window.__bench, null, { timeout: 10000 });
await bpage.evaluate(async () => {
	window.__bench.power();
	// reduced-motion boot is synchronous; give the panel a beat, then step frames.
	await new Promise((r) => setTimeout(r, 150));
	window.__bench.step(3);
});
await bpage.waitForTimeout(200);
const saveDisabled = await bpage.locator('.scope-tools .stool', { hasText: 'SAVE TRACE' }).isDisabled();
if (saveDisabled) fail('SAVE TRACE still disabled after power on');
const rowCount = await bpage.locator('.log .row').count();
if (rowCount < 1) fail('no trace rows after power + step');
await bpage.screenshot({ path: resolve(shotDir, 'site-bench-save-trace.png') });
console.log(`shot: bench SAVE TRACE enabled (${rowCount} rows)`);
await bctx.close();

// ---- /progress achievements counter (seeded partial record) -----------------
const now = Date.now();
const seed = {
	schema: 1,
	xp: 640,
	level: 8,
	passedChecks: {},
	attempts: {},
	lessonsCompleted: {},
	modulesMastered: { 'm0-power-on': now, 'm1-kernel': now },
	modulesPlaced: {},
	achievements: {
		'power-on': now,
		'first-boot': now,
		'clean-pass': now,
		syscall: now,
		'scope-jockey': now
	},
	benchEvents: { firstBoot: now, firstScope: now },
	lastLesson: null
};
const pctx = await browser.newContext({
	viewport: { width: 1360, height: 1000 },
	deviceScaleFactor: 1.5,
	reducedMotion: 'reduce'
});
await pctx.addInitScript(
	([state]) => localStorage.setItem('thunk.xp.v1', JSON.stringify(state)),
	[seed]
);
const ppage = await pctx.newPage();
await ppage.goto(`${base}/progress/`, { waitUntil: 'networkidle' });
await ppage.evaluate(() => document.fonts.ready);
await ppage.waitForTimeout(250);
const earnedText = (await ppage.locator('.ach-head .earned').textContent())?.replace(/\s+/g, ' ').trim();
console.log(`  achievements header: "${earnedText}"`);
if (!/EARNED 05 \/ 12/.test(earnedText || '')) fail(`counter wrong: "${earnedText}"`);
await ppage.locator('.ach').scrollIntoViewIfNeeded();
await ppage.waitForTimeout(150);
await ppage.screenshot({ path: resolve(shotDir, 'site-progress-achievements.png'), fullPage: true });
console.log('shot: /progress achievements counter');
await pctx.close();

await browser.close();
console.log(process.exitCode ? 'DONE (with failures)' : 'DONE: all colophon/bench/progress shots captured');
