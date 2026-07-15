// Drive the app shell with Playwright: capture the canonical states and assert
// the XP engine actually ticks on a real graded check. Usage:
//   node scripts/shell-shots.mjs <baseUrl>
// Screenshots land in docs/screenshots/site/. Reduced-motion + fonts.ready so
// shots are deterministic. Playwright is resolved from PLAYWRIGHT_PKG (or a local
// install) - it is NOT a site dependency.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const pwSpecifier = process.env.PLAYWRIGHT_PKG || 'playwright';
const pw = await import(pwSpecifier);
const chromium = pw.chromium || pw.default?.chromium;

const here = dirname(fileURLToPath(import.meta.url));
const shotDir = resolve(here, '..', '..', 'docs', 'screenshots', 'site');
const base = process.argv[2] || 'http://localhost:4173';

const content = JSON.parse(readFileSync(resolve(here, '..', 'src', 'lib', 'content.json'), 'utf8'));
const modIds = content.modules.map((m) => m.id);
const checksOf = (id) =>
	content.modules.find((m) => m.id === id).lessons.flatMap((l) => l.checks.map((c) => c.id));

const fail = (msg) => {
	console.error('FAIL:', msg);
	process.exitCode = 1;
};

const browser = await chromium.launch();

// ---- Desktop shell ----------------------------------------------------------
const ctx = await browser.newContext({
	viewport: { width: 1360, height: 900 },
	deviceScaleFactor: 1.5,
	reducedMotion: 'reduce'
});
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && console.error('  [console.error]', m.text()));

const lessonUrl = `${base}/m/m0-power-on/01-the-machine/`;

// Fresh: clear any record so the run starts at LVL 01.
await page.goto(base, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(lessonUrl, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
await page.screenshot({ path: resolve(shotDir, 'site-shell-lesson.png') });
console.log('shot: shell lesson (rail open)');

// Grade the first check correctly (m0-01-processor, answer index 1) -> verdict
// PASS + the POWER ON achievement toast + a meter tick.
const xpBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('thunk.xp.v1') || '{"xp":0}').xp || 0);
// The radio itself is visually hidden; click its label (index 1 = the answer).
await page.locator('article.check:has(input[name="m0-01-processor"]) label.opt').nth(1).click();
await page.locator('article.check:has(input[name="m0-01-processor"]) .grade').click();
await page.waitForTimeout(150);
const xpAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('thunk.xp.v1')).xp);
console.log(`  xp ${xpBefore} -> ${xpAfter}`);
if (!(xpAfter > xpBefore)) fail('grading a correct check did not raise XP');
const verdict = await page.locator('article.check:has(input[name="m0-01-processor"]) .verdict').textContent();
if (!/PASS/.test(verdict)) fail(`verdict was not PASS: "${verdict}"`);
const toastVisible = await page.locator('.toasts .toast').count();
if (toastVisible < 1) fail('no toast after first pass');
await page.screenshot({ path: resolve(shotDir, 'site-shell-check-toast.png') });
console.log('shot: passed check + toast');

// Collapse the rail with the `[` key. Scroll the workspace to the top so the
// shot frames the rail head (tick + expand toggle - the way back out).
await page.evaluate(() => {
	const w = document.querySelector('.workspace');
	if (w) w.scrollTop = 0;
});
await page.keyboard.press('[');
await page.waitForTimeout(150);
const railW = await page.evaluate(
	() => getComputedStyle(document.querySelector('.shell')).getPropertyValue('--rail-w').trim()
);
if (railW !== '48px') fail(`rail did not collapse (--rail-w=${railW})`);
await page.screenshot({ path: resolve(shotDir, 'site-shell-collapsed.png') });
console.log('shot: rail collapsed');
await ctx.close();

// ---- /progress with a seeded, partly-complete record ------------------------
const now = Date.now();
const seed = {
	schema: 1,
	xp: 0,
	level: 1,
	passedChecks: {},
	attempts: {},
	lessonsCompleted: {},
	modulesMastered: {},
	achievements: {},
	benchEvents: { firstBoot: now, firstScope: now }
};
// Master M0 and M1 fully, M2 at ~60%.
for (const id of checksOf('m0-power-on')) seed.passedChecks[id] = { firstTry: true, at: now };
for (const id of checksOf('m1-kernel')) seed.passedChecks[id] = { firstTry: true, at: now };
const m2 = checksOf('m2-rust');
for (const id of m2.slice(0, Math.round(m2.length * 0.6)))
	seed.passedChecks[id] = { firstTry: false, at: now };
seed.modulesMastered = { 'm0-power-on': now, 'm1-kernel': now };
seed.achievements = {
	'power-on': now,
	'first-boot': now,
	'clean-pass': now,
	syscall: now,
	'scope-jockey': now
};
seed.xp = 15 * 30 + 25 * 10 + 100 * 2; // ~ passes + lessons + modules, illustrative
seed.level = 20;

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
const earned = await ppage.locator('.acard.earned').count();
console.log(`  achievements earned on card: ${earned}`);
if (earned < 4) fail(`expected several earned achievements, saw ${earned}`);
await ppage.screenshot({ path: resolve(shotDir, 'site-progress.png'), fullPage: true });
console.log('shot: /progress operator card');
await pctx.close();

// ---- Mobile 390px shell -----------------------------------------------------
const mctx = await browser.newContext({
	viewport: { width: 390, height: 844 },
	deviceScaleFactor: 2,
	reducedMotion: 'reduce',
	isMobile: true
});
const mpage = await mctx.newPage();
await mpage.goto(lessonUrl, { waitUntil: 'networkidle' });
await mpage.evaluate(() => document.fonts.ready);
await mpage.waitForTimeout(200);
await mpage.screenshot({ path: resolve(shotDir, 'site-shell-mobile.png') });
console.log('shot: mobile shell (CH chip affordance)');
// The CH chip summons the bottom sheet.
await mpage.locator('.chchip').click();
await mpage.waitForTimeout(200);
const sheet = await mpage.locator('.sheet').count();
if (sheet < 1) fail('mobile channel chip did not open the sheet');
await mpage.screenshot({ path: resolve(shotDir, 'site-shell-mobile-sheet.png') });
console.log('shot: mobile channel sheet');
await mctx.close();

await browser.close();
console.log(process.exitCode ? 'DONE (with failures)' : 'DONE: all shell checks passed');
