// Live verification + screenshots of the DOOM finale on the bench.
//
// Flips the bench source switch to DOOM, waits for the Freedoom title to boot
// on the simulated panel, asserts a non-black panel + RAMWR streaming in the
// trace, screenshots the title; then starts a game and screenshots in-game,
// asserting frames advance and the pixels changed. Runs against any URL (local
// preview or live prod).
//
//   URL=https://thunk-course.pages.dev node site/scripts/doom-shots.mjs
//
// Uses the doom-proto's Playwright install (chromium) + the shared ms-playwright
// browser cache, so no separate install is needed.
import { chromium } from 'playwright';

const BASE = process.env.URL || 'http://localhost:4319';
const OUT = process.env.OUT || '/var/home/goolz/dev/thunk/docs/screenshots/site';
const TITLE_PNG = `${OUT}/site-bench-doom-title.png`;
const INGAME_PNG = `${OUT}/site-bench-doom-ingame.png`;

let failures = 0;
function check(cond, msg) {
	console.log(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`);
	if (!cond) failures++;
}

// Read the panel canvas and return {nonBlack, hash} so we can assert content +
// that the frame changed between title and gameplay.
async function panelSig(page) {
	return page.evaluate(() => {
		const c = document.querySelector('canvas[aria-label="simulated display panel"]');
		const ctx = c.getContext('2d');
		const d = ctx.getImageData(0, 0, c.width, c.height).data;
		let nonBlack = 0;
		let h = 2166136261 >>> 0;
		for (let i = 0; i < d.length; i += 4) {
			if (d[i] | d[i + 1] | d[i + 2]) nonBlack++;
			if (i % 37 === 0) {
				h ^= d[i];
				h = Math.imul(h, 16777619) >>> 0;
			}
		}
		return { nonBlack, hash: h >>> 0 };
	});
}

function ramwrRows(trace) {
	return trace.split('\n').filter((l) => l.includes('RAMWR')).length;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
page.on('console', (m) => {
	if (m.type() === 'error') console.log('[page error]', m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

try {
	await page.goto(`${BASE}/bench`, { waitUntil: 'load' });
	// Function form (not a string): the live CSP forbids eval, and a string
	// predicate is eval'd in-page. A function is injected via CDP, CSP-safe.
	await page.waitForFunction(() => window.__bench !== undefined, null, { timeout: 30000 });

	// Flip to DOOM: fetches the WAD, boots the module, brings up the title.
	await page.evaluate(() => window.__bench.selectSource('doom'));
	await page.waitForFunction(
		() => window.__bench.doomPhase() === 'ready' && window.__bench.isLit(),
		null,
		{ timeout: 90000 }
	);

	// --- Title assertions ---------------------------------------------------
	const title = await panelSig(page);
	const titleTrace = await page.evaluate(() => window.__bench.traceText());
	check(title.nonBlack > 5000, `title panel is non-black (${title.nonBlack} px lit)`);
	check(ramwrRows(titleTrace) > 0, `title trace carries RAMWR rows (${ramwrRows(titleTrace)})`);
	await page.locator('section.bench').screenshot({ path: TITLE_PNG });
	console.log(`  wrote ${TITLE_PNG}`);

	// --- Start a game -------------------------------------------------------
	const frameBefore = await page.evaluate(() => window.__bench.frame());
	await page.evaluate(() => window.__bench.run());
	// Open the menu and walk New Game -> episode -> skill. Enter answers each.
	await page.evaluate(() => window.__bench.pressDoomKey(27)); // menu
	await page.waitForTimeout(400);
	for (let i = 0; i < 4; i++) {
		await page.evaluate(() => window.__bench.pressDoomKey(13)); // confirm
		await page.waitForTimeout(400);
	}
	// Let the level render and the demo/gameplay animate.
	await page.waitForTimeout(2500);

	const game = await panelSig(page);
	const gameTrace = await page.evaluate(() => window.__bench.traceText());
	const frameAfter = await page.evaluate(() => window.__bench.frame());
	const avgMs = await page.evaluate(() => window.__bench.perf());
	await page.evaluate(() => window.__bench.pause());

	check(game.nonBlack > 5000, `in-game panel is non-black (${game.nonBlack} px lit)`);
	check(game.hash !== title.hash, `pixels changed from title to gameplay`);
	check(ramwrRows(gameTrace) > 0, `trace still streams RAMWR during play (${ramwrRows(gameTrace)})`);
	check(frameAfter > frameBefore, `frame counter advanced ${frameBefore} -> ${frameAfter}`);
	console.log(`  measured avg tick+blit ${avgMs.toFixed(2)} ms  (35Hz budget = 28.6 ms)`);
	await page.locator('section.bench').screenshot({ path: INGAME_PNG });
	console.log(`  wrote ${INGAME_PNG}`);
} catch (e) {
	console.error('driver threw:', e.message);
	failures++;
} finally {
	await browser.close();
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
