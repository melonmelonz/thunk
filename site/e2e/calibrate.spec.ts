// Calibrate: run the placement test-out, answering all 21 items correctly, and
// prove the whole ladder places out - the report lists every module PLACED, the
// CALIBRATED achievement lands, and /progress reflects the placement (every
// channel mastered, the earned counter off zero, XP at the placement rate).
import { test, expect, answerCheckCorrect, readXpState } from './fixtures';
import { placement, checkById, chCode } from './content-data';

// Placement covers M0-M6 only (you cannot test out of your first contribution,
// M7), so every count here is against the PLACEABLE modules, not the full ladder.
const placedModuleIds = [...new Set(placement.map((p) => p.module))];
const PLACEABLE = placedModuleIds.length; // 7

test('placement: answer all 21 correct -> full ladder placed out', async ({ page }) => {
	await page.goto('/calibrate/');
	await page.getByRole('button', { name: /START CALIBRATION|RUN AGAIN/ }).click();

	// One item at a time, in placement order. Answer correct, then CONTINUE/FINISH.
	for (let i = 0; i < placement.length; i++) {
		const check = checkById(placement[i].check);
		const card = page.locator('article.check');
		await expect(card).toBeVisible();
		await answerCheckCorrect(card, check);
		// The primary button reads CONTINUE, or FINISH on the last item.
		const cta = page.locator('.run-cta .btn.primary');
		await expect(cta).toBeEnabled();
		await cta.click();
	}

	// Report: every one of the 7 placeable modules placed out.
	await expect(page.getByRole('heading')).toContainText(`Placed out of ${PLACEABLE} of ${PLACEABLE}`);
	const placedRows = page.locator('.rrow.pass');
	await expect(placedRows).toHaveCount(PLACEABLE);
	await expect(page.locator('.rverdict', { hasText: 'PLACED' })).toHaveCount(PLACEABLE);

	// Persisted: every placeable module placed, M7 never placed, CALIBRATED earned,
	// XP = 7 x 50 (placement rate).
	const state = await readXpState(page);
	const placed = state?.modulesPlaced as Record<string, number>;
	for (const id of placedModuleIds) expect(placed).toHaveProperty(id);
	expect(placed).not.toHaveProperty('m7-first-patch');
	expect((state?.achievements as Record<string, number>)['calibrated']).toBeTruthy();
	expect(state?.xp).toBe(PLACEABLE * 50);

	// The operator card: every placed channel mastered (M7 stays open), CALIBRATED
	// card earned, and the earned counter incremented off zero.
	await page.goto('/progress/');
	await expect(page.locator('.chrow.mastered')).toHaveCount(PLACEABLE);
	// Placed-out (not check-graded) channels read PLACED.
	await expect(page.locator('.ccount.placed', { hasText: 'PLACED' }).first()).toBeVisible();

	const calibratedCard = page.locator('.acard', { hasText: 'CALIBRATED' });
	await expect(calibratedCard).toHaveClass(/earned/);
	await expect(page.locator('.ach-head .earned')).not.toContainText('EARNED 00');

	// Spot-check a channel code renders as expected on the placed rows.
	await expect(page.locator('.chrow', { hasText: chCode('M0') })).toHaveClass(/mastered/);
});
