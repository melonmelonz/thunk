// Motion: the one spec that runs WITHOUT prefers-reduced-motion (its own
// Playwright project), so the animated boot ritual and the crossfade view
// transitions are actually exercised - and still finish clean, no console
// errors. Everything else in the suite runs reduced for determinism.
import { test, expect, checkArticle, answerCheckCorrect } from './fixtures';
import { modules, checkById } from './content-data';

const m0 = modules[0];
const l0 = m0.lessons[0];
const firstChoice = l0.checks.find((c) => c.kind === 'choice')!;

test('boot ritual runs and a client-side transition lands clean (motion on)', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	// This project is explicitly NOT reduced-motion.
	const reduced = await page.evaluate(
		() => window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
	expect(reduced).toBe(false);

	// The once-per-session boot ritual only runs under motion; it stamps the flag.
	await expect
		.poll(() => page.evaluate(() => sessionStorage.getItem('thunk.booted')))
		.toBe('1');

	// A real SPA navigation (goto via the palette) drives the crossfade view
	// transition into the app shell. It must land on the lesson.
	await page.keyboard.press('/');
	const palette = page.getByRole('dialog', { name: 'Command palette' });
	await expect(palette).toBeVisible();
	await palette.getByRole('combobox').fill(l0.title);
	await expect(palette.getByRole('option').first()).toBeVisible();
	await palette.getByRole('combobox').press('Enter');

	await expect(page).toHaveURL(new RegExp(`/m/${m0.id}/${l0.id}/`));
	await expect(page.locator('.shell')).toBeVisible();

	// Grade a check under motion: the animated toast + meter tick still work.
	const article = checkArticle(page, firstChoice.id);
	await answerCheckCorrect(article, checkById(firstChoice.id));
	await article.getByRole('button', { name: 'GRADE' }).click();
	await expect(article.locator('.verdict.pass')).toHaveText('PASS');
	await expect(page.getByRole('status').getByText('POWER ON')).toBeVisible();
});
