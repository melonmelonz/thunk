#!/usr/bin/env node
// thunk - autonomous narration film. Generates a finished MP4 you can talk over,
// no OBS, no screen capture: headless Playwright records the real site to a webm,
// then ffmpeg transcodes it to H.264. It realizes the DEMO-SCRIPT.md arc (the
// three-developers story, who it is for, the course, the ending, the payoff) and
// on the way shows every feature - a widget you drive, the command palette,
// grading with the XP toast, the WebAssembly bench, DOOM on the simulated bus and
// its cheat-code wink, the Konami degauss, and the first-patch tracker reaching
// MERGED. Bookended by the demo/cards.html title + payoff.
//
//   node narrate.mjs                       # records against http://localhost:4173
//   node narrate.mjs --url=https://thunk.goolz.org
//   node narrate.mjs --fast                # quicker pacing for a rehearsal render
//
// Writes: demo/out/thunk-narration.mp4, demo/out/markers.json (beat timestamps).

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = Object.fromEntries(
	process.argv.slice(2).map((a) => {
		const m = a.match(/^--([^=]+)=(.*)$/);
		return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
	})
);
const URL = (argv.url || 'http://localhost:4173').replace(/\/$/, '');
const FAST = !!argv.fast;
const OUT = join(HERE, 'out');
const RAW = join(OUT, 'raw');
const CARD = pathToFileURL(resolve(HERE, 'cards.html')).href;
const MP4 = join(OUT, 'thunk-narration.mp4');
const MARKERS = join(OUT, 'markers.json');

// doomgeneric key codes (mirrors site/.../doom.ts + film.mjs).
const DK = { left: 0xac, right: 0xae, up: 0xad, down: 0xaf, fire: 0xa3, use: 0xa2, enter: 13 };

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
// One global pace knob so a --fast rehearsal keeps every beat, just shorter.
const T = (ms) => sleep(FAST ? Math.round(ms * 0.4) : ms);

const nowMs = () => Number(process.hrtime.bigint() / 1000000n);
let takeStart = 0;
const markers = [];
function mark(label) {
	const t = takeStart ? nowMs() - takeStart : 0;
	markers.push({ label, tMs: Math.round(t) });
	console.log(`[t=${(t / 1000).toFixed(1).padStart(6)}] ${label}`);
}

// A believable prior run so the meters read alive and grading "The Machine"
// completes it (a real LESSON COMPLETE + level-up toast). Shape from film.mjs.
function seedScript() {
	try {
		const now = Date.now();
		const ago = (s) => now - s * 1000;
		const state = {
			schema: 1,
			xp: 48,
			level: 3,
			passedChecks: {
				'm0-01-processor': { firstTry: true, at: ago(900) },
				'm0-01-switch': { firstTry: true, at: ago(890) },
				'm0-02-bit': { firstTry: true, at: ago(800) },
				'm0-02-byte': { firstTry: true, at: ago(790) },
				'm0-02-range': { firstTry: false, at: ago(780) },
				'm0-03-program': { firstTry: true, at: ago(700) },
				'm0-03-step': { firstTry: true, at: ago(690) },
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
		const KEY = 'thunk.xp.v1';
		if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(state));
		if (!localStorage.getItem('thunk.rail')) localStorage.setItem('thunk.rail', '0');
	} catch {
		/* file:// card origin has no usable storage; the site pages seed fine */
	}
}

// ---- Cinematic transitions --------------------------------------------------
// A black veil injected on EVERY page load (opacity 1 by default), so a fresh
// navigation never flashes its first paint - the new scene starts black and the
// driver fades it in. Between scenes the driver fades the old page to black
// first, so every cut is a clean dip to black, not a hard jump.
function veilInit() {
	const add = () => {
		if (document.getElementById('__veil')) return;
		const o = document.createElement('div');
		o.id = '__veil';
		o.style.cssText =
			'position:fixed;inset:0;z-index:2147483647;background:#05070b;opacity:1;pointer-events:none';
		(document.body || document.documentElement).appendChild(o);
	};
	if (document.body) add();
	else document.addEventListener('DOMContentLoaded', add);
}
async function reveal(page, ms = 360) {
	await page.evaluate((ms) => {
		const o = document.getElementById('__veil');
		if (o) {
			o.style.transition = `opacity ${ms}ms cubic-bezier(0.22,1,0.36,1)`;
			requestAnimationFrame(() => (o.style.opacity = '0'));
		}
	}, ms);
	await sleep(ms + 30);
}
async function veil(page, ms = 260) {
	await page.evaluate((ms) => {
		let o = document.getElementById('__veil');
		if (!o) {
			o = document.createElement('div');
			o.id = '__veil';
			o.style.cssText =
				'position:fixed;inset:0;z-index:2147483647;background:#05070b;opacity:0;pointer-events:none';
			document.body.appendChild(o);
		}
		o.style.transition = `opacity ${ms}ms cubic-bezier(0.22,1,0.36,1)`;
		requestAnimationFrame(() => (o.style.opacity = '1'));
	}, ms);
	await sleep(ms + 30);
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
const benchReady = (page) => waitBench(page, () => typeof window.__bench !== 'undefined', { timeout: 20000 });

// Smoothly walk a range input by pressing Arrow keys, so the bar visibly sweeps.
async function sweepRange(page, locator, presses, key = 'ArrowRight', step = 70) {
	await locator.focus();
	for (let i = 0; i < presses; i++) {
		await page.keyboard.press(key);
		await sleep(FAST ? Math.round(step * 0.5) : step);
	}
}

async function run() {
	mkdirSync(RAW, { recursive: true });
	// A clean raw dir each run so we pick the right webm.
	for (const f of readdirSync(RAW)) rmSync(join(RAW, f), { force: true });

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1920, height: 1080 },
		deviceScaleFactor: 1,
		reducedMotion: 'no-preference', // we WANT the boot ritual, transitions, degauss
		recordVideo: { dir: RAW, size: { width: 1920, height: 1080 } }
	});
	await context.addInitScript(seedScript);
	await context.addInitScript(veilInit);
	const page = await context.newPage();
	const result = { gradePassed: false, litNonBlack: -1, doomLoaded: false, cheat: false, merged: false, fallbacks: [] };

	try {
		takeStart = nowMs();

		// ===== 1. THE STORY - three applicants, one Rust job =====
		mark('STORY: three developers');
		await page.goto(`${CARD}?p=story#story`, { waitUntil: 'load' });
		await reveal(page, 600); // fade up from black into the card
		await T(15000); // the reveal lands ~5s in; hold on "proof"

		// ===== 2. WHO IT'S FOR - the front door, boot ritual =====
		mark('WHO: front door + boot ritual');
		await veil(page);
		await page.goto(`${URL}/`, { waitUntil: 'domcontentloaded' });
		await page.evaluate(() => { try { sessionStorage.removeItem('thunk.booted'); } catch {} });
		await page.goto(`${URL}/`, { waitUntil: 'domcontentloaded' }); // fresh load -> boot ritual fires
		await page.locator('.hero h1').first().waitFor({ state: 'visible' }).catch(() => {});
		await reveal(page); // fade from black onto the warming boot ritual
		await T(4200);
		await page.locator('.def-text, .readout').first().scrollIntoViewIfNeeded().catch(() => {});
		await T(6300);

		// ===== 3. THE COURSE - work the machine yourself =====
		// 3a. the ladder + into a lesson
		mark('COURSE: the ladder');
		await page.locator('.rack, .ladder').first().scrollIntoViewIfNeeded().catch(() => {});
		await T(2500);
		await veil(page);
		await page.goto(`${URL}/m/m5-doom/02-frames-to-the-panel/`, { waitUntil: 'domcontentloaded' });
		await page.locator('.reading h1').first().waitFor({ state: 'visible' }).catch(() => {});
		await reveal(page);
		await T(2400);

		// 3b. DRIVE A WIDGET - the Frame Budget: sweep the clock across the deadline
		mark('COURSE: drive the Frame Budget widget');
		const fig = page.locator('figure.widget[data-widget="frame-budget"]');
		await fig.scrollIntoViewIfNeeded().catch(() => {});
		await T(1600);
		const range = fig.locator('input.range');
		if (await range.count()) {
			await sweepRange(page, range, 18); // 30 -> 48 MHz, crosses MEETS ~37
			await T(1600);
			await fig.getByRole('radio', { name: /Aim every pixel/ }).click().catch(() => {}); // blow the budget
			await T(2200);
			await fig.getByRole('radio', { name: /Window once/ }).click().catch(() => {});
			await T(1200);
		} else {
			result.fallbacks.push('widget: frame-budget range not found');
		}

		// 3c. the command palette
		mark('COURSE: command palette');
		await page.keyboard.press('/');
		await page.locator('.cmdk input').first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
		for (const ch of 'the bench') { await page.keyboard.press(ch === ' ' ? 'Space' : ch); await sleep(90); }
		await T(2400);
		await page.keyboard.press('Escape');
		await T(600);

		// 3d. grade a check -> PASS + XP toast (on "The Machine")
		mark('COURSE: grade a check, XP toast');
		await veil(page);
		await page.goto(`${URL}/m/m0-power-on/01-the-machine/`, { waitUntil: 'domcontentloaded' });
		const card = page.locator('article.check', { has: page.locator('.cid', { hasText: 'm0-01-memory' }) }).first();
		await card.scrollIntoViewIfNeeded().catch(() => {});
		await reveal(page);
		await T(1200);
		await card.locator('label.opt').nth(2).click().catch(() => {});
		await T(700);
		await card.locator('button.grade').click().catch(() => {});
		result.gradePassed = await card.locator('.verdict.pass').first().waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
		await page.locator('.toasts .toast').first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
		await T(3200);

		// 3e. the bench: POWER, the finale over the simulated bus, SCANLINES
		mark('COURSE: the WebAssembly bench powers up');
		await veil(page);
		await page.goto(`${URL}/bench/`, { waitUntil: 'domcontentloaded' });
		if (!(await benchReady(page))) result.fallbacks.push('bench: __bench never ready');
		await reveal(page);
		await T(800);
		await page.locator('button.tbtn.primary', { hasText: 'POWER' }).click().catch(async () => {
			await page.evaluate(() => window.__bench.power());
		});
		await waitBench(page, () => window.__bench?.isLit?.() === true, { timeout: 12000 });
		result.litNonBlack = await page.evaluate(() => window.__bench?.sampleNonBlack?.() ?? -1);
		await T(1500);
		await page.evaluate(() => window.__bench.run());
		await T(3200);
		const scan = page.locator('button.scan-toggle');
		await scan.click().catch(() => {}); await T(900); await scan.click().catch(() => {});
		await T(1200);

		// 3f. the reveal: DOOM on the same bus, then the cheat-code wink
		mark('COURSE: DOOM on the same bus');
		await page.evaluate(() => window.__bench.pause());
		await page.evaluate(() => window.__bench.selectSource('doom'));
		const wadOk = await waitBench(page, () => {
			const w = window.__bench?.wad?.() ?? { loaded: 0, total: 0 };
			return w.total > 0 && w.loaded >= w.total;
		}, { timeout: 60000 });
		if (!wadOk) result.fallbacks.push('doom: WAD did not finish');
		const lit = await waitBench(page, () => window.__bench?.isLit?.() === true && window.__bench?.source?.() === 'doom', { timeout: 25000 });
		result.doomLoaded = !!lit;
		if (lit) {
			await page.locator('.bezel.focusable').click().catch(() => {});
			await page.evaluate(() => window.__bench.run());
			await T(1600);
			// Walk the menu into E1M1 so the HUD + pistol read.
			for (let i = 0; i < 4; i++) { await page.evaluate((k) => window.__bench.pressDoomKey(k, 90), DK.enter); await T(500); }
			await T(900);
			await page.evaluate((k) => window.__bench.pressDoomKey(k, 700), DK.up);
			await T(500);
			await page.evaluate((k) => window.__bench.pressDoomKey(k, 120), DK.fire);
			await T(500);

			// The cheat: type iddqd on the focused panel -> authentic HUD flash.
			mark('COURSE: DOOM cheat code (iddqd)');
			await page.locator('.bezel').click().catch(() => {});
			for (const ch of 'iddqd') { await page.keyboard.press(ch); await sleep(120); }
			result.cheat = await page.locator('.cheat').first().waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
			await T(2600);
		} else {
			result.fallbacks.push('doom: not lit, gameplay skipped');
		}

		// ===== 4. THE ENDING - the first-patch tracker reaches MERGED =====
		mark('ENDING: the launchpad');
		await veil(page);
		await page.goto(`${URL}/first-patch/`, { waitUntil: 'domcontentloaded' });
		await page.locator('.stepper').first().scrollIntoViewIfNeeded().catch(() => {});
		await reveal(page);
		await T(3000);
		mark('ENDING: tracker steps to MERGED');
		// Walk chose -> merged (5 advances), pausing so each stage reads.
		for (let i = 0; i < 5; i++) {
			const adv = page.getByRole('button', { name: 'ADVANCE' });
			if (!(await adv.count())) break;
			await adv.scrollIntoViewIfNeeded().catch(() => {});
			await adv.click().catch(() => {});
			await T(1400);
		}
		result.merged = await page.getByRole('button', { name: 'MERGED' }).count().then((n) => n > 0).catch(() => false);
		await page.locator('.merged-line').first().scrollIntoViewIfNeeded().catch(() => {});
		await T(3200);

		// ===== 5. PAYOFF - the wordmark, the address, and a CRT power-off flourish =====
		// The only flicker in the film, saved for the very end: the payoff settles,
		// then flickers and collapses to a phosphor line into black (baked into the
		// card). No mid-film degauss.
		mark('PAYOFF: wordmark + address');
		await veil(page, 320);
		await page.goto(`${CARD}?p=payoff#payoff`, { waitUntil: 'load' });
		await reveal(page, 600);
		await T(7600); // wordmark ~2s, address ~3.3s, the CRT power-off ~4.4-5.4s
		await sleep(800); // hold on black

		mark('END');
	} catch (err) {
		console.error('narrate error:', err);
		result.fallbacks.push(`fatal: ${err.message}`);
	} finally {
		const total = takeStart ? nowMs() - takeStart : 0;
		console.log(`\nTAKE COMPLETE - ${(total / 1000).toFixed(1)}s`);
		const vpath = await page.video().path().catch(() => null);
		await context.close(); // flushes the webm
		await browser.close();

		writeFileSync(MARKERS, JSON.stringify({ url: URL, generatedAt: new Date().toISOString(), totalMs: Math.round(total), beats: markers }, null, 2));
		console.log('\n=== VERIFY ===');
		for (const [k, v] of Object.entries(result)) console.log(`  ${k}: ${Array.isArray(v) ? (v.length ? v.join('; ') : 'none') : v}`);

		if (vpath) {
			console.log(`\nraw webm -> ${vpath}\ntranscoding to H.264...`);
			// Probe the real duration so the tail fade lands exactly on the end.
			const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', vpath], { encoding: 'utf8' });
			const dur = parseFloat((probe.stdout || '').trim()) || total / 1000;
			const foStart = Math.max(0, dur - 0.9).toFixed(2);
			const vf = `fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,fade=t=in:st=0:d=0.6,fade=t=out:st=${foStart}:d=0.9`;
			const ff = spawnSync('ffmpeg', [
				'-y', '-i', vpath,
				'-vf', vf,
				'-c:v', 'libx264', '-preset', 'veryslow', '-crf', '16',
				'-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
				'-movflags', '+faststart', '-an',
				MP4
			], { stdio: 'inherit' });
			if (ff.status === 0) console.log(`\nDONE -> ${MP4}`);
			else console.error('ffmpeg failed; the raw webm is still at', vpath);
		} else {
			console.error('no video path; nothing to transcode');
		}
	}
}

run();
