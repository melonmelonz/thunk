// The launchpad: the course's real ending. Drive the tracker through the UI and
// prove the local-only machinery works end to end - a stage advances and
// persists, reaching MERGED fires the quiet achievement (toast + persisted +
// on the operator card), the pre-submit checklist persists, and the change-
// description template copies. Also prove an M7 lesson (First Patch) renders on
// the site, since activating M7 is what makes this ending reachable.
import { test, expect, readXpState } from './fixtures';
import { moduleByTag } from './content-data';

async function readPatchState(page: import('@playwright/test').Page) {
	return page.evaluate(() => {
		const raw = localStorage.getItem('thunk.patch.v1');
		return raw ? JSON.parse(raw) : null;
	});
}

test.describe('launchpad', () => {
	test('curated on-ramps open externally, never fetched', async ({ page }) => {
		await page.goto('/first-patch/');
		// Every real on-ramp is target=_blank rel=noopener noreferrer.
		const links = page.locator('a.onramp[target="_blank"]');
		await expect(links.first()).toBeVisible();
		const count = await links.count();
		expect(count).toBeGreaterThanOrEqual(4);
		for (let i = 0; i < count; i++) {
			const rel = await links.nth(i).getAttribute('rel');
			expect(rel).toContain('noopener');
			expect(rel).toContain('noreferrer');
		}
	});

	test('the tracker advances a stage and persists across reload', async ({ page }) => {
		await page.goto('/first-patch/');

		// Name the project, then advance CHOSE -> FORKED.
		await page.getByLabel('PROJECT', { exact: true }).fill('ripgrep');
		await page.getByRole('button', { name: 'ADVANCE' }).click();

		// The current step reads FORKED (the stage note updates).
		await expect(page.locator('.step.current .step-label')).toHaveText('FORKED');

		// Persisted to thunk.patch.v1.
		let state = await readPatchState(page);
		expect(state?.stage).toBe('forked');
		expect(state?.project).toBe('ripgrep');

		// Survives a reload.
		await page.reload();
		await expect(page.locator('.step.current .step-label')).toHaveText('FORKED');
		await expect(page.getByLabel('PROJECT', { exact: true })).toHaveValue('ripgrep');
		state = await readPatchState(page);
		expect(state?.stage).toBe('forked');
	});

	test('reaching MERGED fires the quiet achievement', async ({ page }) => {
		await page.goto('/first-patch/');

		// Jump straight to the last stage via its stepper dot.
		await page.getByRole('button', { name: 'set stage MERGED' }).click();

		// The MERGED achievement toast fires (existing ach toast style, no confetti).
		await expect(page.getByRole('status').getByText('MERGED', { exact: true })).toBeVisible();

		// The earned, honest line appears in the tracker.
		await expect(page.locator('.merged-line')).toBeVisible();

		// Persisted on the XP record.
		const xpState = await readXpState(page);
		expect((xpState?.achievements as Record<string, number>)?.['merged']).toBeTruthy();

		// The operator card shows MERGED earned.
		await page.goto('/progress/');
		const mergedCard = page.locator('.acard', { hasText: 'MERGED' });
		await expect(mergedCard).toHaveClass(/earned/);
	});

	test('the pre-submit checklist persists', async ({ page }) => {
		await page.goto('/first-patch/');
		const first = page.locator('.checklist .chk').first();
		await first.click();
		await expect(first.locator('input')).toBeChecked();

		await page.reload();
		await expect(page.locator('.checklist .chk').first().locator('input')).toBeChecked();
	});

	test('the change-description template copies', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto('/first-patch/');

		await page.getByLabel('WHAT WAS WRONG').fill('the README said make run');
		await page.getByLabel('WHAT IS RIGHT NOW').fill('it now says cargo run');
		await page.getByLabel('HOW YOU VERIFIED IT').fill('ran it on a clean checkout');

		// The live preview reflects the fields.
		await expect(page.locator('pre.preview')).toContainText('the README said make run');

		await page.getByRole('button', { name: 'COPY' }).click();
		await expect(page.getByRole('button', { name: 'COPIED' })).toBeVisible();

		const clip = await page.evaluate(() => navigator.clipboard.readText());
		expect(clip).toContain('### What was wrong');
		expect(clip).toContain('cargo run');
	});

	test('an M7 (First Patch) lesson renders on the site', async ({ page }) => {
		const m7 = moduleByTag('M7');
		const lesson = m7.lessons[0];
		await page.goto(`/m/${m7.id}/${lesson.id}/`);
		await expect(page).toHaveTitle(/CH-07\.01/);
		await expect(page.locator('article.reading .lhead h1')).toBeVisible();
		// Its checks render and are gradeable like any other module's.
		await expect(page.locator('article.check').first()).toBeVisible();
	});
});
