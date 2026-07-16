// Journey: the reader's first real loop. Land on the front door, open the
// palette with '/', Enter into a lesson, grade a Choice and a Short correctly,
// watch the XP meter tick and the first-blood toast fire, reload and prove the
// pass + XP persisted, then j/k between lessons.
import {
	test,
	expect,
	answerCheckCorrect,
	passLessonCheck,
	checkArticle,
	readXpState,
	openPalette
} from './fixtures';
import { modules, checkById } from './content-data';

const m0 = modules[0];
const l0 = m0.lessons[0];
const firstChoice = l0.checks.find((c) => c.kind === 'choice')!;
const firstShort = l0.checks.find((c) => c.kind === 'short');

test('front door -> palette -> lesson -> grade -> persist -> j/k', async ({ page }) => {
	await page.goto('/');

	// Open the command palette with '/', type the lesson title, Enter into it.
	const palette = await openPalette(page);
	const input = palette.getByRole('combobox');
	await input.fill(l0.title);
	// The top result is the lesson; Enter navigates.
	await expect(palette.getByRole('option').first()).toBeVisible();
	await input.press('Enter');

	await expect(page).toHaveURL(new RegExp(`/m/${m0.id}/${l0.id}/`));
	await expect(page).toHaveTitle(/CH-00\.01/);

	// XP starts at zero.
	const meter = page.locator('.statusbar .xp .read');
	await expect(meter).toContainText('0 XP');

	// Grade the first Choice correctly: +15 first-try, PASS verdict, and because
	// it is the very first check ever, the POWER ON achievement toast fires.
	const choiceArticle = checkArticle(page, firstChoice.id);
	await answerCheckCorrect(choiceArticle, checkById(firstChoice.id));
	await choiceArticle.getByRole('button', { name: 'GRADE' }).click();
	await expect(choiceArticle.locator('.verdict.pass')).toHaveText('PASS');
	await expect(choiceArticle).toHaveClass(/passed/);

	// The meter reads 15 XP now.
	await expect(meter).toContainText('15 XP');

	// First-blood toast: POWER ON.
	await expect(page.getByRole('status').getByText('POWER ON')).toBeVisible();

	// Grade a Short answer correctly too (if the lesson has one).
	if (firstShort) {
		await passLessonCheck(page, firstShort.id);
		await expect(meter).toContainText('30 XP');
	}

	// Reload: the pass tick and XP survive (localStorage).
	await page.reload();
	await expect(page.locator('.statusbar .xp .read')).toContainText(firstShort ? '30 XP' : '15 XP');
	await expect(checkArticle(page, firstChoice.id)).toHaveClass(/passed/);

	const state = await readXpState(page);
	expect(state?.passedChecks).toHaveProperty(firstChoice.id);
	expect((state?.achievements as Record<string, number>)['power-on']).toBeTruthy();

	// j/k lesson navigation moves within the module. Wrap each hop in toPass so
	// the keypress isn't swallowed by the tail of the previous client nav.
	await expect(async () => {
		await page.keyboard.press('j');
		await expect(page).toHaveURL(new RegExp(`/m/${m0.id}/${m0.lessons[1].id}/`), { timeout: 1000 });
	}).toPass({ timeout: 5000 });
	await expect(async () => {
		await page.keyboard.press('k');
		await expect(page).toHaveURL(new RegExp(`/m/${m0.id}/${l0.id}/`), { timeout: 1000 });
	}).toPass({ timeout: 5000 });
});
