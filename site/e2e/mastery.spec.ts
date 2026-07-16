// Mastery: the money path. Drive every check of the smallest module (M5 DOOM,
// 3 lessons x 3 checks = 9) to a correct answer through the UI, then prove the
// whole reward chain fired: MODULE MASTERED, the IDDQD achievement, the rail /
// operator / progress meters all reading mastered, and the XP total exact.
import { test, expect, passLessonCheck, readXpState } from './fixtures';
import { moduleByTag, chCode } from './content-data';

const m5 = moduleByTag('M5');

test('master M5 (DOOM) end to end via the UI', async ({ page }) => {
	// Grade all nine checks correct, lesson by lesson, first try.
	for (const lesson of m5.lessons) {
		await page.goto(`/m/${m5.id}/${lesson.id}/`);
		for (const check of lesson.checks) {
			await passLessonCheck(page, check.id);
		}
		// Every lesson should read complete (all its checks ticked).
		for (const check of lesson.checks) {
			await expect(
				page.locator('article.check').filter({ hasText: check.id })
			).toHaveClass(/passed/);
		}
	}

	// On the last lesson the module settles: MODULE MASTERED + IDDQD toasts fire.
	const toasts = page.getByRole('status');
	await expect(toasts.getByText('MODULE MASTERED')).toBeVisible();
	await expect(toasts.getByText('IDDQD', { exact: true })).toBeVisible();

	// The rail (present in the shell) shows M5 MASTERED.
	const railM5 = page.locator('.rail-nav a.chan', { hasText: chCode(m5.tag) });
	await expect(railM5.getByText('MASTERED')).toBeVisible();

	// Persisted state: module mastered, IDDQD earned, exact XP.
	// 9 checks x 15 (all first-try) + 3 lessons x 25 + 100 module = 310.
	const state = await readXpState(page);
	expect(state?.modulesMastered).toHaveProperty(m5.id);
	expect((state?.achievements as Record<string, number>)['iddqd']).toBeTruthy();
	expect(state?.xp).toBe(310);

	// The operator card reflects it: the CH-05 channel row reads mastered and its
	// IDDQD achievement card is earned; the earned counter is off zero.
	await page.goto('/progress/');
	const ch05 = page.locator('.chrow', { hasText: chCode(m5.tag) });
	await expect(ch05).toHaveClass(/mastered/);
	await expect(ch05.locator('.ccount')).toContainText('09/09');

	const iddqdCard = page.locator('.acard', { hasText: 'IDDQD' });
	await expect(iddqdCard).toHaveClass(/earned/);

	await expect(page.locator('.statusbar .xp .read')).toContainText('310 XP');
});
