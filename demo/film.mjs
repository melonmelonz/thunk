#!/usr/bin/env node
// thunk - deterministic film-driver for the 1:45 tech demo.
//
// Drives the LIVE site through the 12-beat shot list in docs/DEMO-VIDEO.md at
// on-camera pacing while OBS records the browser window. Emits timestamp markers
// (stdout + demo/markers.json) so the editor snaps cuts/captions to frames.
//
//   node film.mjs                 # slow, on-camera take (default)
//   node film.mjs --mode=smoke    # fast rehearsal, still hits every beat
//   node film.mjs --wad=warm      # pre-cache DOOM so scene 8 boots instant
//   node film.mjs --wad=show      # cold DOOM fetch, ~1.5s of FETCHING WAD (default)
//   node film.mjs --url=https://thunk.goolz.org
//
// Owns demo/** only. Reads nothing from the repo at runtime - it targets the
// deployed URL, so it films the real thing (wasm sim + DOOM WAD and all).

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- args -------------------------------------------------------------------
const argv = Object.fromEntries(
	process.argv.slice(2).map((a) => {
		const m = a.match(/^--([^=]+)=(.*)$/);
		if (m) return [m[1], m[2]];
		return [a.replace(/^--/, ''), true];
	})
);
const URL = argv.url || 'https://thunk-course.pages.dev';
const MODE = argv.mode === 'smoke' ? 'smoke' : 'slow';
// Default show a controlled ~1.5s of FETCHING WAD; smoke pre-warms for speed.
const WAD = argv.wad || (MODE === 'smoke' ? 'warm' : 'show');
const STILLS = join(HERE, 'stills');
const MARKERS_OUT = join(HERE, 'markers.json');

// ---- DOOM key codes (doomgeneric doomkeys.h, mirrored in site/.../doom.ts) --
const DK = { left: 0xac, right: 0xae, up: 0xad, down: 0xaf, fire: 0xa3, use: 0xa2, enter: 13 };

// ---- the plan: per-beat window durations (seconds) from DEMO-VIDEO.md -------
// slow = the recorded take; smoke = a fast rehearsal that still awaits every
// real condition (grade PASS, panel lit, WAD loaded, DOOM frames change).
const PLAN = [
	{ n: 1, label: 'front door + boot ritual', slow: 6, smoke: 1.2, caption: '// a systems course' },
	{ n: 2, label: 'stat readout + the ladder', slow: 6, smoke: 1.0, caption: 'from 1s and 0s, up through Rust' },
	{ n: 3, label: 'enter the app (view transition)', slow: 6, smoke: 1.2, caption: 'learn the machine itself' },
	{ n: 4, label: 'grade a check -> PASS + XP', slow: 9, smoke: 1.5, caption: 'graded here. nothing sent anywhere.' },
	{ n: 5, label: '/progress -> the bench', slow: 6, smoke: 1.2, caption: 'your run stays in this browser' },
	{ n: 6, label: 'bench POWER, boot trace, panel lights', slow: 13, smoke: 2.0, caption: 'the real simulator, in WebAssembly' },
	{ n: 7, label: 'RUN finale + SCANLINES', slow: 10, smoke: 2.0, caption: 'every frame travels a simulated SPI bus' },
	{ n: 8, label: 'the reveal: FINALE -> DOOM', slow: 14, smoke: 3.0, caption: 'DOOM. on the same bus.' },
	{ n: 9, label: 'DOOM gameplay + RUNGS MONTAGE cue', slow: 12, smoke: 2.5, caption: 'browser. binary. a booted kernel. real hardware.' },
	{ n: 10, label: 'colophon build plate', slow: 10, smoke: 1.5, caption: 'air-gapped. no accounts. no telemetry.' },
	{ n: 11, label: 'front door, clean', slow: 7, smoke: 1.2, caption: 'thunk (n.) - code set aside to run later' },
	{ n: 12, label: 'wordmark + tick', slow: 6, smoke: 1.2, caption: 'thunk.goolz.org' }
];
const dur = (p) => (MODE === 'smoke' ? p.smoke : p.slow) * 1000;

// ---- seed a believable prior run into thunk.xp.v1 ---------------------------
// M0 partly done (one whole lesson complete, "The Machine" one check short so
// the on-camera grade completes it -> a real LESSON COMPLETE toast + XP tick),
// a couple M1 checks, LVL 03, three achievements. Shape from xp-curve.ts.
function seedScript() {
	const now = Date.now();
	const ago = (s) => now - s * 1000;
	const state = {
		schema: 1,
		xp: 48, // LVL 03; grading "The Machine" on camera pushes it to LVL 04
		level: 3,
		passedChecks: {
			'm0-01-processor': { firstTry: true, at: ago(900) },
			'm0-01-switch': { firstTry: true, at: ago(890) }, // "The Machine": memory left for camera
			'm0-02-bit': { firstTry: true, at: ago(800) },
			'm0-02-byte': { firstTry: true, at: ago(790) },
			'm0-02-range': { firstTry: false, at: ago(780) }, // lesson 02 complete
			'm0-03-program': { firstTry: true, at: ago(700) },
			'm0-03-step': { firstTry: true, at: ago(690) }, // lesson 03 partial -> M0 not mastered
			'm1-01-privilege': { firstTry: true, at: ago(600) },
			'm1-01-syscall': { firstTry: false, at: ago(590) }
		},
		attempts: {
			'm0-01-processor': 1, 'm0-01-switch': 1, 'm0-02-bit': 1, 'm0-02-byte': 1,
			'm0-02-range': 2, 'm0-03-program': 1, 'm0-03-step': 1, 'm1-01-privilege': 1, 'm1-01-syscall': 2
		},
		lessonsCompleted: { '02-bits-and-bytes': ago(780) },
		modulesMastered: {},
		modulesPlaced: {},
		achievements: { 'power-on': ago(900), 'first-boot': ago(500), 'scope-jockey': ago(400) },
		benchEvents: { firstBoot: ago(500), firstScope: ago(400) },
		lastLesson: { module: 'm0-power-on', lesson: '01-the-machine' }
	};
	// Seed once, guarded: a later full-page load must not clobber the on-camera
	// grade back to the seed (client SPA navs don't re-run this anyway).
	const KEY = 'thunk.xp.v1';
	// eslint-disable-next-line no-undef
	if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(state));
	// eslint-disable-next-line no-undef
	if (!localStorage.getItem('thunk.rail')) localStorage.setItem('thunk.rail', '0'); // rail expanded
}

// ---- markers + pacing -------------------------------------------------------
const markers = [];
let takeStart = 0; // hrtime ms at beat 1; clock is monotonic from the take start
let cumMs = 0; // planned cumulative end of the current beat
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);
const tSince = () => nowMs() - takeStart;

function fmt(ms) {
	return (ms / 1000).toFixed(2).padStart(6, '0');
}

async function beat(p, page) {
	const tStartMs = takeStart ? tSince() : 0;
	markers.push({ beat: p.n, label: p.label, caption: p.caption, tStartMs: Math.round(tStartMs) });
	console.log(`[t=${fmt(tStartMs)}] BEAT ${p.n}: ${p.label}`);
	cumMs += dur(p);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
// Hold until the current beat's planned window elapses (so slow mode tracks the
// DEMO-VIDEO.md timings even when a real await finished early). Never negative.
async function holdBeat() {
	if (!takeStart) return;
	await sleep(takeStart + cumMs - nowMs());
}

async function waitBench(page, fn, { timeout = 30000, poll = 100 } = {}) {
	const deadline = nowMs() + timeout;
	for (;;) {
		const v = await page.evaluate(fn).catch(() => undefined);
		if (v) return v;
		if (nowMs() > deadline) return undefined;
		await sleep(poll);
	}
}

// A cheap perceptual checksum of the bench canvas, to prove frames changed.
async function panelHash(page) {
	return page.evaluate(() => {
		const c = document.querySelector('.glass canvas');
		if (!c) return 0;
		const cx = c.getContext('2d');
		if (!cx) return 0;
		const d = cx.getImageData(0, 0, c.width, c.height).data;
		let h = 2166136261 >>> 0;
		for (let i = 0; i < d.length; i += 41) {
			h ^= d[i];
			h = Math.imul(h, 16777619) >>> 0;
		}
		return h;
	});
}
const sampleNonBlack = (page) => page.evaluate(() => window.__bench?.sampleNonBlack?.() ?? -1);
const benchReady = (page) => waitBench(page, () => typeof window.__bench !== 'undefined', { timeout: 20000 });

async function shot(page, name) {
	try {
		mkdirSync(STILLS, { recursive: true });
		await page.screenshot({ path: join(STILLS, name) });
		console.log(`    still -> stills/${name}`);
	} catch (e) {
		console.log(`    still failed (${name}): ${e.message}`);
	}
}

// ---- pre-warm ---------------------------------------------------------------
// Prime the browser HTTP cache with the DOOM module + WAD so the take is
// reliable. In `warm` mode this makes scene 8 near-instant; in `show` mode we
// SKIP it so scene 8 does a genuine cold fetch and the FETCHING WAD line reads
// for real (~1.5s), which is the honest, teaching choice.
async function prewarm(page) {
	if (WAD === 'show') {
		console.log('pre-warm: skipped (--wad=show -> cold DOOM fetch on the reveal)');
		return { warmed: false };
	}
	console.log('pre-warm: loading /bench + DOOM WAD into cache...');
	await page.goto(`${URL}/bench/`, { waitUntil: 'domcontentloaded' });
	if (!(await benchReady(page))) {
		console.log('pre-warm: __bench never appeared; continuing (DOOM may cold-load)');
		return { warmed: false };
	}
	await page.evaluate(() => window.__bench.selectSource('doom'));
	const ready = await waitBench(
		page,
		() => {
			const w = window.__bench?.wad?.() ?? { loaded: 0, total: 0 };
			return window.__bench?.doomPhase?.() === 'ready' && w.total > 0 && w.loaded >= w.total;
		},
		{ timeout: 60000 }
	);
	console.log(`pre-warm: DOOM ${ready ? 'cached + ready' : 'did NOT finish (will retry live)'}`);
	return { warmed: !!ready };
}

// ---- the take ---------------------------------------------------------------
async function run() {
	const browser = await chromium.launch({
		headless: false,
		args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--start-fullscreen']
	});
	const context = await browser.newContext({
		viewport: { width: 1920, height: 1080 },
		deviceScaleFactor: 1,
		reducedMotion: 'no-preference' // we WANT the boot ritual + transitions
	});
	await context.addInitScript(seedScript);
	const page = await context.newPage();
	const result = { doomLoaded: false, doomPixelDelta: 0, gradePassed: false, litNonBlack: -1, fallbacks: [] };

	try {
		// Pre-warm off-camera (before t=0). This also seeds localStorage via the
		// init script; we clear the once-per-session boot flag so beat 1 plays it.
		await prewarm(page);
		await page.goto(`${URL}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
		await page.evaluate(() => {
			try { sessionStorage.removeItem('thunk.booted'); } catch {}
		});

		// A short neutral hold so the operator can confirm OBS is capturing, then
		// the take proper begins on a fresh front-door load (boot ritual fires).
		const countdown = MODE === 'smoke' ? 0 : Number(argv.countdown ?? 2);
		if (countdown > 0) {
			console.log(`READY. Recording countdown ${countdown}s... (take begins at BEAT 1 / t=0)`);
			await sleep(countdown * 1000);
		}

		// ===== BEAT 1 - front door + boot ritual =====
		takeStart = nowMs();
		await beat(PLAN[0], page);
		await page.goto(`${URL}/`, { waitUntil: 'domcontentloaded' });
		await page.locator('.hero h1', { hasText: 'thunk' }).first().waitFor({ state: 'visible' }).catch(() => {});
		await sleep(700); // let the phosphor tick warm + eyebrow rise
		await shot(page, '01-front-door.png');
		await holdBeat();

		// ===== BEAT 2 - stat readout + the ladder =====
		await beat(PLAN[1], page);
		await page.locator('.readout').first().scrollIntoViewIfNeeded().catch(() => {});
		await page.locator('.rack .strips').first().hover().catch(() => {});
		await holdBeat();

		// ===== BEAT 3 - enter the app (view transition) =====
		await beat(PLAN[2], page);
		// Client-side nav (real view transition): front door -> module -> lesson.
		const mStrip = page.locator('a.strip[href*="m0-power-on"]').first();
		if (await mStrip.count()) {
			await mStrip.click();
			const lesson = page.locator('a.row[href*="01-the-machine"]').first();
			const gotLesson = await lesson.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
			if (gotLesson) await lesson.click();
			else { result.fallbacks.push('beat3: lesson link missing, goto'); await page.goto(`${URL}/m/m0-power-on/01-the-machine/`); }
		} else {
			result.fallbacks.push('beat3: strip link missing, goto');
			await page.goto(`${URL}/m/m0-power-on/01-the-machine/`);
		}
		await page.waitForURL('**/01-the-machine/**', { timeout: 8000 }).catch(() => {});
		await page.locator('.reading h1').first().waitFor({ state: 'visible' }).catch(() => {});
		await holdBeat();

		// ===== BEAT 4 - grade a check -> PASS + XP + toast =====
		await beat(PLAN[3], page);
		// The "What is memory?" choice (m0-01-memory, answer index 2). With the
		// two sibling checks seeded, a correct grade completes "The Machine" ->
		// LESSON COMPLETE toast + XP tick (and a LVL 04 level-up toast).
		const card = page.locator('article.check', { has: page.locator('.cid', { hasText: 'm0-01-memory' }) }).first();
		await card.scrollIntoViewIfNeeded().catch(() => {});
		await sleep(500);
		// The radio is visually hidden (opacity:0, pointer-events:none); click the
		// wrapping label at answer index 2 to select it.
		await card.locator('label.opt').nth(2).click();
		await sleep(700); // read beat before grading
		await card.locator('button.grade').click();
		const pass = await card.locator('.verdict.pass').first().waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
		result.gradePassed = pass;
		// The milestone toast (LESSON COMPLETE / LVL 04) slides in bottom-right.
		await page.locator('.toasts .toast').first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
		await shot(page, '02-grade-pass.png');
		await holdBeat();

		// ===== BEAT 5 - /progress then the bench =====
		await beat(PLAN[4], page);
		const pNav = page.locator('a[href="/progress/"]').first();
		if (await pNav.count()) await pNav.click();
		else await page.goto(`${URL}/progress/`);
		await page.locator('h1', { hasText: 'Operator' }).first().waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
		await sleep(MODE === 'smoke' ? 300 : 2200); // a beat on the operator card
		const bNav = page.locator('a[href="/bench/"]').first();
		if (await bNav.count()) await bNav.click();
		else await page.goto(`${URL}/bench/`);
		await page.waitForURL('**/bench/**', { timeout: 8000 }).catch(() => {});
		await holdBeat();

		// ===== BEAT 6 - POWER, boot trace, panel lights =====
		await beat(PLAN[5], page);
		if (!(await benchReady(page))) result.fallbacks.push('beat6: __bench never ready');
		const preHash = await panelHash(page);
		// Press the real POWER button (on camera), then await the boot stream + lit.
		await page.locator('button.tbtn.primary', { hasText: 'POWER' }).click().catch(async () => {
			result.fallbacks.push('beat6: POWER button click failed, __bench.power()');
			await page.evaluate(() => window.__bench.power());
		});
		await waitBench(page, () => window.__bench?.isLit?.() === true, { timeout: 12000 });
		result.litNonBlack = await sampleNonBlack(page);
		const litHash = await panelHash(page);
		if (litHash === preHash) result.fallbacks.push('beat6: panel hash unchanged after boot');
		console.log(`    panel lit=${await page.evaluate(() => window.__bench?.isLit?.())} nonBlack=${result.litNonBlack} hashChanged=${litHash !== preHash}`);
		await holdBeat();

		// ===== BEAT 7 - RUN finale + SCANLINES =====
		await beat(PLAN[6], page);
		await page.evaluate(() => window.__bench.run());
		await sleep(MODE === 'smoke' ? 400 : 3500);
		// Toggle SCANLINES off then on so the action reads; end ON (the CRT bloom).
		const scan = page.locator('button.scan-toggle');
		await scan.click().catch(() => {});
		await sleep(MODE === 'smoke' ? 250 : 1200);
		await scan.click().catch(() => {});
		await sleep(MODE === 'smoke' ? 250 : 800);
		const finaleFrame = await page.evaluate(() => window.__bench?.frame?.() ?? 0);
		console.log(`    finale running, frame=${finaleFrame}`);
		await shot(page, '03-bench-finale.png');
		await holdBeat();

		// ===== BEAT 8 - the reveal: FINALE -> DOOM =====
		await beat(PLAN[7], page);
		await page.evaluate(() => window.__bench.pause());
		await page.evaluate(() => window.__bench.selectSource('doom'));
		// Show the FETCHING WAD line, then await the WAD + the booted title frame.
		const wadOk = await waitBench(
			page,
			() => {
				const w = window.__bench?.wad?.() ?? { loaded: 0, total: 0 };
				return w.total > 0 && w.loaded >= w.total;
			},
			{ timeout: 60000 }
		);
		if (!wadOk) result.fallbacks.push('beat8: WAD did not finish loading');
		const lit = await waitBench(page, () => window.__bench?.isLit?.() === true && window.__bench?.source?.() === 'doom', { timeout: 20000 });
		result.doomLoaded = !!lit;
		if (lit) {
			// Click the panel for the phosphor capture ring, then run so dg ticks.
			await page.locator('.bezel.focusable').click().catch(() => {});
			await page.evaluate(() => window.__bench.run());
			await sleep(MODE === 'smoke' ? 500 : 1500); // title/E1M1 settles
			await shot(page, '04-doom-boot.png');
		} else {
			console.error('!! DOOM failed to load/boot - skipping gameplay, finishing remaining beats');
			result.fallbacks.push('beat8: DOOM not lit, gameplay skipped');
		}
		await holdBeat();

		// ===== BEAT 9 - DOOM gameplay + RUNGS MONTAGE cue =====
		await beat(PLAN[8], page);
		if (result.doomLoaded) {
			// Walk the menu into a live level: title -> NEW GAME -> episode 1 ->
			// skill (default "Hurt me plenty") -> E1M1 loads with the HUD + pistol.
			for (let i = 0; i < 4; i++) {
				await page.evaluate((k) => window.__bench.pressDoomKey(k, 90), DK.enter);
				await sleep(MODE === 'smoke' ? 220 : 450);
			}
			await sleep(MODE === 'smoke' ? 400 : 900); // the map loads
			const before = await panelHash(page);
			// Forward first (biggest visible change), then measure the delta.
			await page.evaluate((k) => window.__bench.pressDoomKey(k, 700), DK.up);
			await sleep(150);
			const after = await panelHash(page);
			result.doomPixelDelta = before === after ? 0 : 1;
			const nb1 = await sampleNonBlack(page);
			// A couple of fires + a turn + more forward, on camera.
			await page.evaluate((k) => window.__bench.pressDoomKey(k, 120), DK.fire);
			await sleep(MODE === 'smoke' ? 150 : 400);
			await page.evaluate((k) => window.__bench.pressDoomKey(k, 120), DK.fire);
			await sleep(MODE === 'smoke' ? 150 : 400);
			await page.evaluate((k) => window.__bench.pressDoomKey(k, 450), DK.right);
			await sleep(150);
			await page.evaluate((k) => window.__bench.pressDoomKey(k, 600), DK.up);
			await sleep(150);
			const nb2 = await sampleNonBlack(page);
			const trace = await page.evaluate(() => window.__bench?.traceText?.() ?? '');
			const ramwr = (trace.match(/RAMWR/g) || []).length;
			console.log(`    DOOM movement: hashChanged=${before !== after} nonBlack ${nb1}->${nb2} RAMWR rows=${ramwr}`);
			await shot(page, '05-doom-gameplay.png');
		}
		console.log('CUE: RUNGS MONTAGE  (editor cuts to terminal / QEMU serial / hardware footage here)');
		await holdBeat();

		// ===== BEAT 10 - colophon build plate =====
		await beat(PLAN[9], page);
		const cNav = page.locator('a[href="/colophon/"]').first();
		if (await cNav.count()) await cNav.click();
		else await page.goto(`${URL}/colophon/`);
		await page.waitForURL('**/colophon/**', { timeout: 8000 }).catch(() => {});
		await page.locator('.plate', { hasText: 'BUILD' }).first().scrollIntoViewIfNeeded().catch(() => {});
		await holdBeat();

		// ===== BEAT 11 - front door, clean =====
		await beat(PLAN[10], page);
		await page.goto(`${URL}/`, { waitUntil: 'domcontentloaded' });
		await page.locator('.def-text').first().scrollIntoViewIfNeeded().catch(() => {});
		await holdBeat();

		// ===== BEAT 12 - wordmark + tick =====
		await beat(PLAN[11], page);
		await page.locator('.hero h1').first().scrollIntoViewIfNeeded().catch(() => {});
		await shot(page, '06-wordmark.png');
		await holdBeat();

		const total = tSince();
		console.log(`\nTAKE COMPLETE - ${fmt(total)}s (plan target 105.00s)`);
	} catch (err) {
		console.error('film-driver error:', err);
		result.fallbacks.push(`fatal: ${err.message}`);
	} finally {
		// Write markers for the editor before teardown.
		try {
			mkdirSync(HERE, { recursive: true });
			writeFileSync(
				MARKERS_OUT,
				JSON.stringify({ url: URL, mode: MODE, wad: WAD, generatedAt: new Date().toISOString(), beats: markers }, null, 2)
			);
			console.log(`markers -> demo/markers.json (${markers.length} beats)`);
		} catch (e) {
			console.error('failed to write markers.json:', e.message);
		}
		console.log('\n=== VERIFY SUMMARY ===');
		console.log(`  grade PASS:        ${result.gradePassed}`);
		console.log(`  panel nonBlack:    ${result.litNonBlack}`);
		console.log(`  DOOM loaded:       ${result.doomLoaded}`);
		console.log(`  DOOM pixel change: ${result.doomPixelDelta ? 'YES' : 'no'}`);
		console.log(`  fallbacks:         ${result.fallbacks.length ? result.fallbacks.join('; ') : 'none'}`);
		if (MODE !== 'smoke') {
			// Leave the window up briefly so a manual OBS stop is comfortable.
			await sleep(Number(argv.hold ?? 2) * 1000);
		}
		await browser.close();
	}
}

run();
