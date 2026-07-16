// The two D-B2 check types, driven end to end on the lessons that author them:
// an Order check reordered to its correct sequence, and a Predict check answered
// by typing the byte. Both must grade PASS, tick the card, and award XP on the
// same economy as Choice/Short (+15 first try).
import { test, expect, answerCheckCorrect, checkArticle } from './fixtures';
import { checkById } from './content-data';

const ORDER_LESSON = '/m/m4-panel/04-commands-and-data/';
const PREDICT_LESSON = '/m/m4-panel/02-color-in-sixteen-bits/';

test.describe('Order check (m4-04-draw)', () => {
	test('reorders to the correct sequence and grades PASS + XP', async ({ page }) => {
		await page.goto(ORDER_LESSON);
		const check = checkById('m4-04-draw');
		const article = checkArticle(page, 'm4-04-draw');
		// The reorderable list hydrated (keyboard-first move controls, no drag).
		await expect(article.locator('ol.order')).toBeVisible();
		await expect(article.locator('.omove').first()).toBeVisible();

		// It does NOT start solved (the seed is forced off the identity), so a
		// blind GRADE would fail - prove the reorder is doing real work.
		const meter = page.locator('.statusbar .xp .read');
		await expect(meter).toContainText('0 XP');

		// Drive it to the authored order through the up/down controls, then grade.
		await answerCheckCorrect(article, check);
		await article.getByRole('button', { name: 'GRADE' }).click();
		await expect(article.locator('.verdict.pass')).toHaveText('PASS');
		await expect(article).toHaveClass(/passed/);

		// First-try economy: +15, exactly like a Choice/Short first pass.
		await expect(meter).toContainText('15 XP');

		// The pass persists across reload (localStorage).
		await page.reload();
		await expect(checkArticle(page, 'm4-04-draw')).toHaveClass(/passed/);
	});
});

test.describe('Predict check (m4-02-redbyte)', () => {
	test('typing the predicted byte grades PASS + XP', async ({ page }) => {
		await page.goto(PREDICT_LESSON);
		const check = checkById('m4-02-redbyte');
		const article = checkArticle(page, 'm4-02-redbyte');
		// A monospace predict field, framed by its hint placeholder.
		const field = article.locator('input[type="text"]');
		await expect(field).toBeVisible();
		await expect(field).toHaveAttribute('placeholder', /hex byte/);

		await answerCheckCorrect(article, check); // fills the canonical answer
		await article.getByRole('button', { name: 'GRADE' }).click();
		await expect(article.locator('.verdict.pass')).toHaveText('PASS');
		await expect(article).toHaveClass(/passed/);

		const meter = page.locator('.statusbar .xp .read');
		await expect(meter).toContainText('15 XP');
	});

	test('a wrong prediction fails, and the right one still passes after', async ({ page }) => {
		await page.goto(PREDICT_LESSON);
		const article = checkArticle(page, 'm4-02-redbyte');
		await article.locator('input[type="text"]').fill('0x00');
		await article.getByRole('button', { name: 'GRADE' }).click();
		await expect(article.locator('.verdict.fail')).toBeVisible();
		// Correct it: an alternate spelling (decimal) is honored too.
		await article.locator('input[type="text"]').fill('248');
		await article.getByRole('button', { name: 'GRADE' }).click();
		await expect(article.locator('.verdict.pass')).toHaveText('PASS');
	});
});
