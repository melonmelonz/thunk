#!/usr/bin/env node
// thunk - autonomous narration film, SEGMENTED build. Records each of the six
// views as its OWN clip, then cross-dissolves them together (ffmpeg xfade) and
// lays the full narration WAV over the top, with the video fit to the audio so
// every second of voice plays and there is zero dead space. Transitions land in
// the silence gaps between the audio sections.
//
//   node narrate.mjs                       # records against http://localhost:4173
//   node narrate.mjs --url=https://thunk.goolz.org
//   node narrate.mjs --audio=~/winbox/thunk.wav
//
// Writes: demo/out/thunk-final.mp4 (with audio) + the silent master too.

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = Object.fromEntries(
	process.argv.slice(2).map((a) => {
		const m = a.match(/^--([^=]+)=(.*)$/);
		return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
	})
);
const URL = (argv.url || 'http://localhost:4173').replace(/\/$/, '');
const OUT = join(HERE, 'out');
const RAW = join(OUT, 'raw');
const CARD = pathToFileURL(resolve(HERE, 'cards.html')).href;
const SILENT = join(OUT, 'thunk-narration.mp4');
const FINAL = join(OUT, 'thunk-final.mp4');
const AUDIO = (argv.audio || join(homedir(), 'winbox', 'thunk.wav')).replace(/^~/, homedir());

// doomgeneric key codes (mirrors site/.../doom.ts).
const DK = { enter: 13 };
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);
const XFADE = 0.5; // crossfade dissolve length

// ---- The six views, sized to the audio sections (seconds). The crossfade eats
// XFADE from each seam, so each clip carries its section length + a share, and
// the total after N-1 dissolves lands on the audio length (~87s). ----
const VIEWS = [
	{ name: 'story', dur: 22.5 }, // 0-22    "three people apply ... a merged contribution is proof"
	{ name: 'front', dur: 9.5 }, //  22-31   "thunk is for people ... anyone starting from zero"
	{ name: 'course', dur: 11.5 }, // 31-42  "it teaches ... so it sticks the first time"
	{ name: 'doom', dur: 8.9, zoom: ['.bezel'] }, // 42-50.4 zoomed into the CRT screen; DOOM lingers,
	//                                        dissolving at the 50.4s gap while the ENDING voice comes in
	{ name: 'launch', dur: 23.85, zoom: ['.stepper', '.track-cta', '.merged-line'] }, // 50.4-73.75 zoomed on the tracker; "thunk walks you through ... anyone can check" AND
	//                                            "that's the difference ... handing them proof" - the
	//                                            MERGED tracker holds while section 8 is spoken (proof
	//                                            on screen), dissolving in the 73.69-74.43 gap
	{ name: 'payoff', dur: 15.2 } //  73.75-88.95 "you start at zero, finish with a contribution ...
	//                                            a collaborator ... thunk.goolz.org" - wordmark lands
	//                                            exactly on the tagline line; collapse at 13.7s, video
	//                                            ends as the blackout completes (no TV-off hang), ~1:29
];

const result = { cheat: false, doomLoaded: false, merged: false, fallbacks: [] };

function seedScript() {
	try {
		const now = Date.now();
		const ago = (s) => now - s * 1000;
		const state = {
			schema: 1, xp: 48, level: 3,
			passedChecks: {
				'm0-01-processor': { firstTry: true, at: ago(900) }, 'm0-01-switch': { firstTry: true, at: ago(890) },
				'm0-02-bit': { firstTry: true, at: ago(800) }, 'm0-02-byte': { firstTry: true, at: ago(790) },
				'm0-02-range': { firstTry: false, at: ago(780) }, 'm0-03-program': { firstTry: true, at: ago(700) },
				'm0-03-step': { firstTry: true, at: ago(690) }, 'm1-01-privilege': { firstTry: true, at: ago(600) }, 'm1-01-syscall': { firstTry: false, at: ago(590) }
			},
			attempts: {}, lessonsCompleted: { '02-bits-and-bytes': ago(780) }, modulesMastered: {}, modulesPlaced: {},
			achievements: { 'power-on': ago(900), 'first-boot': ago(500), 'scope-jockey': ago(400) },
			benchEvents: { firstBoot: ago(500), firstScope: ago(400) }, lastLesson: { module: 'm0-power-on', lesson: '01-the-machine' }
		};
		if (!localStorage.getItem('thunk.xp.v1')) localStorage.setItem('thunk.xp.v1', JSON.stringify(state));
		if (!localStorage.getItem('thunk.rail')) localStorage.setItem('thunk.rail', '0');
		// Film the whole run in light mode; the app.html boot script reads this
		// before first paint so there is no dark flash on any navigation.
		localStorage.setItem('thunk.theme', 'light');
	} catch { /* file:// card origin: no storage */ }
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
async function sweep(page, loc, presses, step = 70) {
	await loc.focus();
	for (let i = 0; i < presses; i++) { await page.keyboard.press('ArrowRight'); await sleep(step); }
}

// ---- Scene definitions. Each returns the timestamp (nowMs) at which its KEY
// content is on screen ("ready"); the recorder trims each clip from there for the
// view's duration, so the load lead-in never appears and the dissolve blends
// settled frames only. ----
const scenes = {
	async story(page) {
		await page.goto(`${CARD}?p=story&theme=light#story`, { waitUntil: 'load' });
		await page.locator('.dev').first().waitFor({ state: 'visible' }).catch(() => {});
		return nowMs(); // the reveal plays on its own over the hold
	},
	async front(page) {
		await page.goto(`${URL}/`, { waitUntil: 'domcontentloaded' });
		await page.evaluate(() => { try { sessionStorage.removeItem('thunk.booted'); } catch {} });
		await page.goto(`${URL}/`, { waitUntil: 'domcontentloaded' }); // boot ritual
		await page.locator('.hero h1').first().waitFor({ state: 'visible' }).catch(() => {});
		const ready = nowMs();
		await sleep(3200);
		// pan down to the module ladder - the progress rungs from zero upward
		await page.locator('.ladder, .rack').first().scrollIntoViewIfNeeded().catch(() => {});
		return ready;
	},
	async course(page) {
		await page.goto(`${URL}/m/m5-doom/02-frames-to-the-panel/`, { waitUntil: 'domcontentloaded' });
		await page.locator('.reading h1').first().waitFor({ state: 'visible' }).catch(() => {});
		// Open on the Rust budget constants - "it teaches programming ... through Rust"
		const code = page.locator('.prose pre, .reading pre').first();
		await code.scrollIntoViewIfNeeded().catch(() => {});
		await code.waitFor({ state: 'visible' }).catch(() => {});
		const ready = nowMs();
		await sleep(2600); // hold on the real Rust code
		// Smooth-pan down to the interactive budget widget - "you work the machine yourself"
		const fig = page.locator('figure.widget[data-widget="frame-budget"]');
		await page.evaluate(() => new Promise((res) => {
			const el = document.querySelector('figure.widget[data-widget="frame-budget"]');
			if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			setTimeout(res, 950);
		})).catch(() => {});
		await fig.locator('.dial').waitFor({ state: 'visible' }).catch(() => {});
		await sleep(500);
		const range = fig.locator('input.range');
		if (await range.count()) {
			await sweep(page, range, 18);
			await sleep(900);
			await fig.getByRole('radio', { name: /Aim every pixel/ }).click().catch(() => {});
			await sleep(1200);
			await fig.getByRole('radio', { name: /Window once/ }).click().catch(() => {});
		} else result.fallbacks.push('widget: range not found');
		return ready;
	},
	async doom(page) {
		await page.goto(`${URL}/bench/`, { waitUntil: 'domcontentloaded' });
		if (!(await benchReady(page))) result.fallbacks.push('bench: not ready');
		await page.locator('button.tbtn.primary', { hasText: 'POWER' }).click().catch(async () => { await page.evaluate(() => window.__bench.power()); });
		await waitBench(page, () => window.__bench?.isLit?.() === true, { timeout: 12000 });
		await page.evaluate(() => window.__bench.run());
		await sleep(1000); // let the corridor build on the panel and the bus trace fill
		await page.evaluate(() => window.__bench.pause()); // FREEZE: the log is a rolling
		// buffer streaming ~8 rows/frame, so a running trace scroll-jitters. Hold it still -
		// a readable instrument face: the corridor drawn by the real driver, the decoded bus
		// trace steady beneath it = "all the way down to a real driver, a real bus"
		const ready = nowMs();
		await sleep(1400); // hold on the frozen finale + bus before DOOM
		await page.evaluate(() => window.__bench.selectSource('doom')); // "and even DOOM"
		await waitBench(page, () => { const w = window.__bench?.wad?.() ?? { loaded: 0, total: 0 }; return w.total > 0 && w.loaded >= w.total; }, { timeout: 60000 });
		result.doomLoaded = !!(await waitBench(page, () => window.__bench?.isLit?.() === true && window.__bench?.source?.() === 'doom', { timeout: 25000 }));
		await page.locator('.bezel.focusable').click().catch(() => {});
		await page.evaluate(() => window.__bench.run());
		await page.evaluate((k) => window.__bench.pressDoomKey(k, 90), DK.enter);
		await sleep(1000); // let the title paint and its pixel-write trace stream in
		await page.evaluate(() => window.__bench.pause()); // FREEZE DOOM too: title held, no jitter
		return ready;
	},
	async launch(page) {
		await page.goto(`${URL}/first-patch/`, { waitUntil: 'domcontentloaded' });
		await page.locator('.stepper').first().scrollIntoViewIfNeeded().catch(() => {});
		await page.locator('.stepper').first().waitFor({ state: 'visible' }).catch(() => {});
		const ready = nowMs();
		await sleep(2600);
		for (let i = 0; i < 5; i++) {
			const adv = page.getByRole('button', { name: 'ADVANCE' });
			if (!(await adv.count())) break;
			await adv.scrollIntoViewIfNeeded().catch(() => {});
			await adv.click().catch(() => {});
			await sleep(2900);
		}
		result.merged = await page.getByRole('button', { name: 'MERGED' }).count().then((n) => n > 0).catch(() => false);
		await page.locator('.merged-line').first().scrollIntoViewIfNeeded().catch(() => {});
		return ready;
	},
	async payoff(page) {
		await page.goto(`${CARD}?p=payoff&theme=light#payoff`, { waitUntil: 'load' });
		await page.locator('.finale').first().waitFor({ state: 'attached' }).catch(() => {});
		return nowMs(); // three-dev recall -> wordmark -> address -> CRT collapse, all on the hold
	}
};

// A 16:9 crop rectangle framing the union of some on-screen feature boxes, so a
// clip can punch in on its feature. Pads for breathing room, expands to 16:9,
// clamps to the 1920x1080 frame, and caps the upscale (MAX_ZOOM) so nothing gets
// soft. Returns null if nothing measurable. Boxes are viewport px == video px
// (deviceScaleFactor 1), so they map straight through.
function cropFromRects(rects, { pad = 0.1, W = 1920, H = 1080, ar = 16 / 9, maxZoom = 1.5 } = {}) {
	rects = rects.filter(Boolean);
	if (!rects.length) return null;
	let x1 = Math.max(0, Math.min(...rects.map((r) => r.x)));
	let y1 = Math.max(0, Math.min(...rects.map((r) => r.y)));
	let x2 = Math.min(W, Math.max(...rects.map((r) => r.x + r.width)));
	let y2 = Math.min(H, Math.max(...rects.map((r) => r.y + r.height)));
	let w = x2 - x1, h = y2 - y1;
	if (w <= 0 || h <= 0) return null;
	const cx = x1 - w * pad + (w + 2 * w * pad) / 2;
	const cy = y1 - h * pad + (h + 2 * h * pad) / 2;
	w += 2 * w * pad; h += 2 * h * pad;
	if (w / h < ar) w = h * ar; else h = w / ar; // to 16:9
	if (w > W) { w = W; h = W / ar; }
	if (h > H) { h = H; w = H * ar; }
	if (W / w > maxZoom) { w = W / maxZoom; h = w / ar; } // cap the upscale
	let nx = Math.max(0, Math.min(W - w, cx - w / 2));
	let ny = Math.max(0, Math.min(H - h, cy - h / 2));
	const even = (n) => Math.max(2, Math.round(n / 2) * 2);
	return { w: even(w), h: even(h), x: even(nx), y: even(ny) };
}

async function recordView(context, view) {
	const page = await context.newPage();
	const t0 = nowMs();
	let ready = t0;
	try { ready = (await scenes[view.name](page)) ?? t0; } catch (e) { result.fallbacks.push(`${view.name}: ${e.message}`); }
	// Measure the feature box(es) now that the scene has settled, for a punch-in.
	let crop = null;
	if (view.zoom) {
		const rects = [];
		for (const sel of view.zoom) {
			const bb = await page.locator(sel).first().boundingBox().catch(() => null);
			if (bb) rects.push(bb);
		}
		crop = cropFromRects(rects);
		if (!crop) result.fallbacks.push(`${view.name}: zoom box not found`);
	}
	// keep recording until the clip holds >= view.dur + tail past the ready mark
	const need = (view.dur + 1.0) * 1000 - (nowMs() - ready);
	if (need > 0) await sleep(need);
	const lead = (ready - t0) / 1000;
	const v = page.video();
	await page.close(); // finalizes this page's webm
	const path = await v.path();
	console.log(`  ${view.name.padEnd(7)} lead=${lead.toFixed(2)}s dur=${view.dur}s${crop ? ` zoom=${(1920 / crop.w).toFixed(2)}x` : ''} -> ${path.split('/').pop()}`);
	return { ...view, path, lead: Math.max(0, lead), crop };
}

function buildFilm(clips) {
	// per-clip: trim from its ready lead for its duration, then the xfade-safe
	// normalize chain (fps/format/scale/sar/tb + reset PTS), per the researched
	// recipe - VFR webm otherwise desyncs the dissolves.
	const parts = [];
	clips.forEach((c, i) => {
		parts.push(
			`[${i}:v]trim=start=${c.lead.toFixed(3)}:duration=${c.dur},` +
			// Feature punch-in: crop to the measured feature box, then the scale below
			// blows it back to full frame - a static zoom on the DOOM screen / tracker.
			(c.crop ? `crop=${c.crop.w}:${c.crop.h}:${c.crop.x}:${c.crop.y},` : '') +
			// gradfun debands the dark blue gradients: 8-bit banding in those flats is
			// what the encoder quantizes differently each GOP, reading as a subtle pulse.
			// Smooth the bands (edges/text exceed its threshold, untouched) so nothing breathes.
			`fps=30,format=yuv420p,scale=1920:1080,gradfun=0.6:16,setsar=1,settb=AVTB,setpts=PTS-STARTPTS[v${i}]`
		);
	});
	// chain xfades; offset_k = offset_{k-1} + dur_k - XFADE (recursive, exact)
	let prev = `[v0]`;
	let off = clips[0].dur - XFADE;
	for (let i = 1; i < clips.length; i++) {
		const out = i === clips.length - 1 ? '[vx]' : `[x${i}]`;
		parts.push(`${prev}[v${i}]xfade=transition=fade:duration=${XFADE}:offset=${off.toFixed(3)}${out}`);
		prev = out;
		if (i < clips.length - 1) off += clips[i].dur - XFADE;
	}
	// gentle fade up from black at the very top; the payoff collapse ends on black.
	parts.push(`[vx]fade=t=in:st=0:d=0.4[vout]`);

	const inputs = clips.flatMap((c) => ['-i', c.path]);
	const hasAudio = existsSync(AUDIO);
	if (hasAudio) {
		// Brighten + energize the voice without touching its length (a tempo change
		// would desync every crossfade, which is placed in the audio's own silence
		// gaps): trim rumble, lift presence (~3.4k) and air (~8k) for a livelier read,
		// even the dynamics with gentle compression for punch, and run a touch hotter
		// (-15 LUFS) so it lands more upbeat.
		parts.push(
			`[${clips.length}:a]highpass=f=80,` +
			`equalizer=f=3400:t=q:w=1.3:g=2.6,equalizer=f=8000:t=q:w=1.5:g=1.6,` +
			`acompressor=threshold=-20dB:ratio=2.6:attack=8:release=140:makeup=2.2,` +
			`loudnorm=I=-15:TP=-1.5:LRA=11[aout]`
		);
	}
	const fc = parts.join(';');

	const args = ['-y', ...inputs];
	if (hasAudio) args.push('-i', AUDIO);
	args.push('-filter_complex', fc, '-map', '[vout]');
	if (hasAudio) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
	args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
		// Kill the keyframe/GOP pulse on the flat UI: near-transparent quality (crf 14) so
		// all frame types look identical, ipratio/pbratio flattened to ~1 so I-frames don't
		// pop brighter than the P/B-frames around them, aq-mode=3 biases bits into the dark
		// gradients (less banding on top of the gradfun deband).
		'-x264-params', 'aq-mode=3:aq-strength=1.0:ipratio=1.10:pbratio=1.10',
		'-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart',
		hasAudio ? FINAL : SILENT);
	console.log(`\nassembling (${hasAudio ? 'with audio' : 'silent'})...`);
	const ff = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
	if (ff.status === 0) console.log(`DONE -> ${hasAudio ? FINAL : SILENT}`);
	else console.error('ffmpeg assembly failed');
}

async function run() {
	mkdirSync(RAW, { recursive: true });
	for (const f of readdirSync(RAW)) rmSync(join(RAW, f), { force: true });

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
		reducedMotion: 'no-preference', recordVideo: { dir: RAW, size: { width: 1920, height: 1080 } }
	});
	await context.addInitScript(seedScript);

	// prewarm DOOM so the doom view boots fast (throwaway page, closed first)
	try {
		const warm = await context.newPage();
		await warm.goto(`${URL}/bench/`, { waitUntil: 'domcontentloaded' });
		await benchReady(warm);
		await warm.evaluate(() => window.__bench?.selectSource?.('doom'));
		await waitBench(warm, () => { const w = window.__bench?.wad?.() ?? { loaded: 0, total: 0 }; return window.__bench?.doomPhase?.() === 'ready' && w.total > 0 && w.loaded >= w.total; }, { timeout: 60000 });
		await warm.close();
	} catch { /* best effort */ }

	console.log('recording views:');
	const clips = [];
	for (const view of VIEWS) clips.push(await recordView(context, view));
	await context.close();
	await browser.close();

	console.log('\n=== VERIFY ===');
	for (const [k, v] of Object.entries(result)) console.log(`  ${k}: ${Array.isArray(v) ? (v.length ? v.join('; ') : 'none') : v}`);
	if (clips.every((c) => c.path)) buildFilm(clips);
	else console.error('a clip failed to record; not assembling');
}

run();
