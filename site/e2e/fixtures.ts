// Extended test: every test gets an automatic console-error guard, so "NO
// console errors across the flow" is enforced suite-wide, not per-assertion.
// A test that legitimately expects an error (none today) can opt out with
// test.info().annotations.push({ type: 'allow-console' }).
import { test as base, expect, type Page, type Locator } from '@playwright/test';
import { checkById, type Check } from './content-data';

export interface Fixtures {
	/** Console errors + uncaught page errors collected over the whole test. */
	consoleErrors: string[];
}

export const test = base.extend<Fixtures>({
	consoleErrors: [
		async ({ page }, use, testInfo) => {
			const errors: string[] = [];
			page.on('console', (msg) => {
				if (msg.type() === 'error') errors.push(msg.text());
			});
			page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

			await use(errors);

			const optedOut = testInfo.annotations.some((a) => a.type === 'allow-console');
			if (!optedOut) {
				expect(errors, `unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
			}
		},
		{ auto: true }
	]
});

export { expect };

// ---- Grading helpers --------------------------------------------------------

/**
 * Answer a single CheckCard correctly, reading the right answer from
 * content.json. `scope` is the <article.check> (or the page, for the lone
 * calibration card). Radios are visually hidden (opacity:0) so we force the
 * check; the short field is a plain text input.
 */
export async function answerCheckCorrect(scope: Locator, check: Check): Promise<void> {
	if (check.kind === 'choice') {
		// The radio itself is opacity:0 / pointer-events:none; click its label.
		await scope.locator('label.opt').nth(check.answer).click();
	} else if (check.kind === 'order') {
		await solveOrder(scope, check);
	} else {
		// short + predict: a plain text field graded against the accepted list.
		await scope.locator('input[type="text"]').first().fill(check.answers[0]);
	}
}

/**
 * Drive an Order check to its correct sequence through the keyboard-first move
 * controls (selection sort: for each target slot, click the up control of the
 * row that belongs there until it lands). n is tiny, so O(n^2) clicks is fine.
 */
export async function solveOrder(scope: Locator, check: { items: string[] }): Promise<void> {
	const rows = () => scope.locator('ol.order > li.oitem');
	for (let target = 0; target < check.items.length; target++) {
		for (let guard = 0; guard <= check.items.length; guard++) {
			const labels = await rows().locator('.olabel').allInnerTexts();
			const cur = labels.findIndex((t) => t.trim() === check.items[target].trim());
			if (cur === target) break;
			await rows().nth(cur).locator('.omove[data-move$=":-1"]').click();
		}
	}
}

/** Answer a CheckCard WRONG (used to prove a fail verdict / non-mastery). */
export async function answerCheckWrong(scope: Locator, check: Check): Promise<void> {
	if (check.kind === 'choice') {
		const wrong = (check.answer + 1) % check.options.length;
		await scope.locator('label.opt').nth(wrong).click();
	} else if (check.kind === 'order') {
		// The seeded order is always non-identity, so an untouched Order card is
		// already a wrong answer - nothing to do.
	} else {
		await scope.locator('input[type="text"]').first().fill('definitely-not-the-answer-xyzzy');
	}
}

/** Locate a lesson's CheckCard <article> by the check id printed in its header. */
export function checkArticle(page: Page, checkId: string): Locator {
	return page.locator('article.check').filter({ hasText: checkId });
}

/** Answer + GRADE one lesson check and wait for its PASS verdict. */
export async function passLessonCheck(page: Page, checkId: string): Promise<void> {
	const check = checkById(checkId);
	const article = checkArticle(page, checkId);
	await answerCheckCorrect(article, check);
	await article.getByRole('button', { name: 'GRADE' }).click();
	await expect(article.locator('.verdict.pass')).toHaveText('PASS');
}

/** Read the persisted XP record straight from localStorage. */
export async function readXpState(page: Page): Promise<Record<string, unknown> | null> {
	return page.evaluate(() => {
		const raw = localStorage.getItem('thunk.xp.v1');
		return raw ? JSON.parse(raw) : null;
	});
}

/**
 * Open the command palette with '/'. The trigger is wired in the root layout's
 * onMount and the component is dynamic-imported on first open, so wait for the
 * page to settle, then re-press until the dialog appears (robust against the
 * hydration race and the lazy chunk fetch).
 */
export async function openPalette(page: Page): Promise<Locator> {
	await page.waitForLoadState('networkidle');
	const dialog = page.getByRole('dialog', { name: 'Command palette' });
	await expect(async () => {
		await page.keyboard.press('/');
		await expect(dialog).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 10_000 });
	return dialog;
}

/** Seed a persisted XP record BEFORE the app boots (via an init script). */
export async function seedXpState(page: Page, state: Record<string, unknown>): Promise<void> {
	await page.addInitScript((s) => {
		localStorage.setItem('thunk.xp.v1', JSON.stringify(s));
	}, state);
}
