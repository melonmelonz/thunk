// Screenshots of the five D-B lesson widgets, for Penn. Drives each live lesson,
// waits for hydration + fonts, poses the widget in a teaching state, and shoots
// it desktop + mobile. Reduced-motion + fonts.ready so the frames are stable.
//
// Playwright is not a site dependency; resolve it from PLAYWRIGHT_PKG (the
// doom-proto install), else a local `playwright`. Usage:
//   PLAYWRIGHT_PKG=/var/home/goolz/dev/doom-proto/node_modules/playwright \
//     node scripts/widget-shots-db.mjs [baseUrl]
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

// Each widget: the lesson URL, the data-widget id, a selector proving hydration,
// and a `pose` that drives it into the state worth capturing.
const WIDGETS = [
	{
		id: 'byte-decoder',
		url: '/m/m0-power-on/03-what-is-a-program/',
		ready: '.bitstrip',
		async pose(fig) {
			await fig.getByRole('radio', { name: 'enter in hex' }).click();
			await fig.locator('.entry').fill('2C');
		}
	},
	{
		id: 'volatile-memory',
		url: '/m/m1-kernel/04-memory-and-mmap/',
		ready: '.rows',
		async pose() {
			// Default state: both rows loaded - phosphor memory over cyan storage.
		}
	},
	{
		id: 'ownership-move',
		url: '/m/m2-rust/03-borrowing/',
		ready: '.bindings',
		async pose(fig) {
			// Take a shared borrow, then attempt a &mut: the checker refuses with
			// the real E0502 - the money shot for "a toy you can't break".
			await fig.getByRole('button', { name: 'take a shared borrow' }).click();
			await fig.getByRole('button', { name: 'take a mutable borrow' }).click();
		}
	},
	{
		id: 'pixel-forge',
		url: '/m/m4-panel/02-color-in-sixteen-bits/',
		ready: '.sliders',
		async pose(fig) {
			// A rich mix so all three fields show set bits, then paint a few pixels.
			await fig.getByRole('slider', { name: /red/ }).fill('20');
			await fig.getByRole('slider', { name: /green/ }).fill('45');
			await fig.getByRole('slider', { name: /blue/ }).fill('10');
			for (let i = 1; i <= 4; i++)
				await fig.getByRole('button', { name: `paint pixel ${i}` }).click();
		}
	},
	{
		id: 'diff-reader',
		url: '/m/m6-open-source/04-reading-a-diff/',
		ready: '.patch',
		async pose(fig) {
			await fig.getByRole('button', { name: 'What this changes' }).click();
		}
	}
];

const browser = await chromium.launch();

async function shoot(page, w, path) {
	await page.goto(`${base}${w.url}`, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	const fig = page.locator(`figure.widget[data-widget="${w.id}"]`);
	await fig.locator(w.ready).waitFor({ timeout: 10000 });
	await w.pose(fig);
	await page.waitForTimeout(140);
	const caption = await fig.locator('figcaption').count();
	if (caption) fail(`${w.id} did not hydrate (caption still present)`);
	await fig.scrollIntoViewIfNeeded();
	await fig.screenshot({ path });
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
	for (const w of WIDGETS) await shoot(dp, w, resolve(shotDir, `site-widget-${w.id}.png`));
	await desk.close();

	const mob = await browser.newContext({
		viewport: { width: 390, height: 1700 },
		deviceScaleFactor: 3,
		reducedMotion: 'reduce'
	});
	const mp = await mob.newPage();
	for (const w of WIDGETS) await shoot(mp, w, resolve(shotDir, `site-widget-${w.id}-mobile.png`));
	await mob.close();
} catch (e) {
	fail(`driver threw: ${e.message}`);
} finally {
	await browser.close();
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nDONE: all D-B widget shots captured');
process.exit(failures ? 1 : 0);
