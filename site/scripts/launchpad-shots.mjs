// Drive the capstone surfaces with Playwright: the front door now reading eight
// modules, an M7 (First Patch) lesson, and the /first-patch launchpad - fresh,
// mobile, and driven all the way to MERGED (stepper full, the earned line, the
// quiet toast). Usage:  node scripts/launchpad-shots.mjs <baseUrl>
// Screenshots land in docs/screenshots/site/. Reduced-motion + fonts.ready so the
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

const fail = (msg) => {
	console.error('FAIL:', msg);
	process.exitCode = 1;
};

const browser = await chromium.launch();

// ---- Front door: eight modules ---------------------------------------------
{
	const ctx = await browser.newContext({
		viewport: { width: 1360, height: 1200 },
		deviceScaleFactor: 1.5,
		reducedMotion: 'reduce'
	});
	const page = await ctx.newPage();
	page.on('console', (m) => m.type() === 'error' && console.error('  [console.error]', m.text()));
	await page.goto(base, { waitUntil: 'networkidle' });
	await page.evaluate(() => localStorage.clear());
	await page.reload({ waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(250);
	const strips = await page.locator('.strips > li').count();
	console.log(`  front-door ladder strips: ${strips}`);
	if (strips !== content.moduleCount || strips !== 8) fail(`expected 8 module strips, saw ${strips}`);
	const mods = await page.locator('.readout dd').first().textContent();
	if (mods?.trim() !== '08') fail(`front-door module readout was "${mods}", expected 08`);
	await page.screenshot({ path: resolve(shotDir, 'site-front-door-8modules.png'), fullPage: true });
	console.log('shot: front door (8 modules)');
	await ctx.close();
}

// ---- An M7 (First Patch) lesson --------------------------------------------
{
	const ctx = await browser.newContext({
		viewport: { width: 1360, height: 1000 },
		deviceScaleFactor: 1.5,
		reducedMotion: 'reduce'
	});
	const page = await ctx.newPage();
	await page.goto(`${base}/m/m7-first-patch/03-review-and-merge/`, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(250);
	const title = await page.title();
	if (!/CH-07\.03/.test(title)) fail(`M7 lesson title was "${title}"`);
	const cta = await page.locator('.launchpad-cta').count();
	if (cta < 1) fail('the capstone launchpad CTA is missing on M7 review-and-merge');
	await page.screenshot({ path: resolve(shotDir, 'site-m7-lesson.png'), fullPage: true });
	console.log('shot: M7 lesson (review and merge + launchpad CTA)');
	await ctx.close();
}

// ---- The launchpad, fresh (desktop) ----------------------------------------
{
	const ctx = await browser.newContext({
		viewport: { width: 1360, height: 1400 },
		deviceScaleFactor: 1.5,
		reducedMotion: 'reduce'
	});
	const page = await ctx.newPage();
	await page.goto(`${base}/first-patch/`, { waitUntil: 'networkidle' });
	await page.evaluate(() => localStorage.clear());
	await page.reload({ waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	// Fill the template so the preview reads as a real change description.
	await page.getByLabel('WHAT WAS WRONG').fill('The README still said `make run`, a target removed two releases ago.');
	await page.getByLabel('WHAT IS RIGHT NOW').fill('It now says `cargo run`, matching the current build.');
	await page.getByLabel('HOW YOU VERIFIED IT').fill('Ran `cargo run` on a clean checkout; the app came up.');
	await page.waitForTimeout(200);
	await page.screenshot({ path: resolve(shotDir, 'site-first-patch.png'), fullPage: true });
	console.log('shot: launchpad (desktop, template filled)');
	await ctx.close();
}

// ---- The launchpad, mobile --------------------------------------------------
{
	const ctx = await browser.newContext({
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 2,
		reducedMotion: 'reduce',
		isMobile: true
	});
	const page = await ctx.newPage();
	await page.goto(`${base}/first-patch/`, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(200);
	await page.screenshot({ path: resolve(shotDir, 'site-first-patch-mobile.png'), fullPage: true });
	console.log('shot: launchpad (mobile)');
	await ctx.close();
}

// ---- The launchpad driven to MERGED: stepper full, earned line, quiet toast -
{
	const ctx = await browser.newContext({
		viewport: { width: 1360, height: 1200 },
		deviceScaleFactor: 1.5,
		reducedMotion: 'reduce'
	});
	const page = await ctx.newPage();
	await page.goto(`${base}/first-patch/`, { waitUntil: 'networkidle' });
	await page.evaluate(() => localStorage.clear());
	await page.reload({ waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	await page.getByLabel('PROJECT', { exact: true }).fill('ripgrep');
	await page.getByLabel('ISSUE OR PR LINK').fill('github.com/BurntSushi/ripgrep/issues/1');
	// Jump to MERGED via its stepper dot: fires the quiet MERGED achievement.
	await page.getByRole('button', { name: 'set stage MERGED' }).click();
	await page.waitForTimeout(200);
	const mergedAch = await page.evaluate(
		() => !!JSON.parse(localStorage.getItem('thunk.xp.v1') || '{}')?.achievements?.merged
	);
	if (!mergedAch) fail('MERGED achievement did not persist after reaching the last stage');
	const toast = await page.getByRole('status').getByText('MERGED', { exact: true }).count();
	if (toast < 1) console.warn('  (toast may have already retired; capturing the stepper state)');
	// Scroll the tracker into frame so the shot centers the MERGED moment.
	await page.locator('.merged-line').scrollIntoViewIfNeeded();
	await page.waitForTimeout(150);
	await page.screenshot({ path: resolve(shotDir, 'site-first-patch-merged.png') });
	console.log('shot: launchpad at MERGED (stepper full + earned line)');
	await ctx.close();
}

await browser.close();
console.log(process.exitCode ? 'DONE (with failures)' : 'DONE: all launchpad shots captured');
