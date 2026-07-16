// Smoke: every route comes up clean. No error boundary, correct <title>, the
// build plate on the front door, no horizontal overflow at 1440 or 390, and -
// the regression guard for the shell-scroll bug - the app shell never scrolls
// the document past the viewport.
import { test, expect } from './fixtures';
import { lessonRefs, moduleUrls, staticRoutes } from './content-data';

// A representative slice keeps the smoke matrix quick: the front door + the four
// app routes, every module index, and a lesson from each module.
const oneLessonPerModule = Object.values(
	Object.fromEntries(lessonRefs.map((l) => [l.moduleId, l]))
);

async function expectNoErrorBoundary(page: import('@playwright/test').Page) {
	// The (app) error boundary sets <title> "NO SIGNAL · thunk" and renders .dead;
	// the top-level 404 renders .deadzone. Neither may appear on a real route.
	await expect(page.locator('section.dead')).toHaveCount(0);
	await expect(page).not.toHaveTitle(/NO SIGNAL/);
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page, width: number) {
	const overflow = await page.evaluate(() => {
		const d = document.documentElement;
		return { scrollW: d.scrollWidth, clientW: d.clientWidth };
	});
	// 1px of subpixel slack.
	expect(overflow.scrollW, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
		overflow.clientW + 1
	);
}

test.describe('smoke: routes load clean', () => {
	for (const route of staticRoutes) {
		test(`route ${route.url}`, async ({ page }) => {
			const res = await page.goto(route.url);
			expect(res?.status(), `${route.url} status`).toBeLessThan(400);
			await expectNoErrorBoundary(page);
			await expect(page).toHaveTitle(/thunk/);
		});
	}

	for (const m of moduleUrls) {
		test(`module index ${m.url}`, async ({ page }) => {
			await page.goto(m.url);
			await expectNoErrorBoundary(page);
			await expect(page).toHaveTitle(new RegExp(`${m.code} `));
		});
	}

	for (const l of oneLessonPerModule) {
		test(`lesson ${l.url} title + plate + shell`, async ({ page }) => {
			await page.goto(l.url);
			await expectNoErrorBoundary(page);
			// Title carries the CH-NN.LL channel code.
			await expect(page).toHaveTitle(/CH-\d\d\.\d\d/);
			await expect(page).toHaveTitle(new RegExp(l.code.replace('.', '\\.')));
			// The reading column + its checks rendered.
			await expect(page.locator('article.reading .lhead h1')).toBeVisible();
			await expect(page.locator('article.check').first()).toBeVisible();
		});
	}
});

test('front door renders the build plate', async ({ page }) => {
	await page.goto('/');
	const plate = page.locator('[aria-label="build provenance"]');
	await expect(plate).toBeVisible();
	await expect(plate).toContainText('BUILD');
	await expect(plate).toContainText('AIR-GAPPED');
});

test.describe('no horizontal overflow', () => {
	const widths = [1440, 390];
	for (const width of widths) {
		test(`front door @ ${width}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/');
			await expectNoHorizontalOverflow(page, width);
		});
		test(`lesson @ ${width}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.goto(lessonRefs[0].url);
			await expectNoHorizontalOverflow(page, width);
		});
		test(`bench @ ${width}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/bench/');
			await expectNoHorizontalOverflow(page, width);
		});
	}
});

test.describe('shell never scrolls the document (regression)', () => {
	// The (app) shell is position:fixed inset:0; the pane scrolls inside
	// .workspace, never the document. Before the fix the tall pane leaked past
	// the shell and scrolled the whole page. Assert the document is not taller
	// than the viewport on the shell routes.
	const shellRoutes = ['/bench/', '/progress/', lessonRefs[0].url];
	for (const url of shellRoutes) {
		test(`document height <= viewport @ ${url}`, async ({ page }) => {
			await page.setViewportSize({ width: 1440, height: 900 });
			await page.goto(url);
			// Let layout settle (fonts, wasm-free routes are instant; give a tick).
			await expect(page.locator('.shell')).toBeVisible();
			const { scrollHeight, innerHeight } = await page.evaluate(() => ({
				scrollHeight: document.scrollingElement!.scrollHeight,
				innerHeight: window.innerHeight
			}));
			expect(scrollHeight, `document scrolls past viewport at ${url}`).toBeLessThanOrEqual(
				innerHeight + 2
			);
		});
	}
});
