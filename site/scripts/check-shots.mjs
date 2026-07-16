// Screenshots of the two D-B2 check types, for Penn: an Order check posed
// mid-reorder and a Predict check with a byte typed in. Drives the live lessons,
// waits for hydration + fonts, and shoots each card desktop + mobile. Reduced
// motion + fonts.ready so the frames are stable.
//
// Playwright is not a site dependency; resolve it from PLAYWRIGHT_PKG, else a
// local `playwright`. Usage (with a preview already serving):
//   node scripts/check-shots.mjs [baseUrl]
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const pwSpecifier = process.env.PLAYWRIGHT_PKG || 'playwright';
const pw = await import(pwSpecifier);
const chromium = pw.chromium || pw.default?.chromium;

const here = dirname(fileURLToPath(import.meta.url));
const shotDir = resolve(here, '..', '..', 'docs', 'screenshots', 'site');
const base = process.argv[2] || 'http://localhost:4173';

let failures = 0;
const fail = (m) => {
	console.error('FAIL:', m);
	failures++;
};

// Each check: the lesson URL, the check id (its card is filtered by it), a
// selector proving hydration, and a `pose` that drives it into a teaching state.
const CHECKS = [
	{
		name: 'order',
		url: '/m/m4-panel/04-commands-and-data/',
		id: 'm4-04-draw',
		ready: 'ol.order',
		async pose(card) {
			// Mid-reorder: nudge the top item down one so the list reads as a task
			// in progress, not solved and not untouched.
			await card.locator('.oitem').first().locator('.omove[data-move$=":1"]').click();
		}
	},
	{
		name: 'predict',
		url: '/m/m4-panel/02-color-in-sixteen-bits/',
		id: 'm4-02-redbyte',
		ready: 'input[type="text"]',
		async pose(card) {
			await card.locator('input[type="text"]').fill('0xF8');
		}
	}
];

const browser = await chromium.launch();

async function shoot(page, c, path) {
	await page.goto(`${base}${c.url}`, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	const card = page.locator('article.check').filter({ hasText: c.id });
	await card.locator(c.ready).waitFor({ timeout: 10000 });
	await c.pose(card);
	await page.waitForTimeout(140);
	await card.scrollIntoViewIfNeeded();
	await card.screenshot({ path });
	console.log(`  wrote ${path}`);
}

try {
	const desk = await browser.newContext({
		viewport: { width: 900, height: 1600 },
		deviceScaleFactor: 2,
		reducedMotion: 'reduce'
	});
	const dp = await desk.newPage();
	dp.on('console', (m) => m.type() === 'error' && console.error('  [console.error]', m.text()));
	for (const c of CHECKS) await shoot(dp, c, resolve(shotDir, `site-check-${c.name}.png`));
	await desk.close();

	const mob = await browser.newContext({
		viewport: { width: 390, height: 1700 },
		deviceScaleFactor: 3,
		reducedMotion: 'reduce'
	});
	const mp = await mob.newPage();
	for (const c of CHECKS) await shoot(mp, c, resolve(shotDir, `site-check-${c.name}-mobile.png`));
	await mob.close();
} catch (e) {
	fail(`driver threw: ${e.message}`);
} finally {
	await browser.close();
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nDONE: order + predict check shots captured');
process.exit(failures ? 1 : 0);
