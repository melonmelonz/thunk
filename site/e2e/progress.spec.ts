// Progress: the operator card's transfer + reset round-trip. Build some real
// progress, EXPORT it (capture the download), RESET behind the type-YES gate,
// then IMPORT the captured record and prove the state came back. Also assert the
// achievements grid renders both earned and unearned states.
import { readFileSync } from 'node:fs';
import { test, expect, passLessonCheck, readXpState } from './fixtures';
import { modules } from './content-data';

const l0 = modules[0].lessons[0];

test('export -> reset -> import round-trips the record', async ({ page }) => {
	// Seed real progress: pass the first check (POWER ON, +15 XP).
	await page.goto(`/m/${modules[0].id}/${l0.id}/`);
	await passLessonCheck(page, l0.checks[0].id);

	await page.goto('/progress/');
	const meter = page.locator('.statusbar .xp .read');
	await expect(meter).toContainText('15 XP');
	const seeded = await readXpState(page);
	expect(seeded?.xp).toBe(15);

	// EXPORT: capture the downloaded JSON.
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'EXPORT' }).click()
	]);
	expect(download.suggestedFilename()).toBe('thunk-progress.json');
	const exported = readFileSync(await download.path(), 'utf8');
	const parsed = JSON.parse(exported);
	expect(parsed.xp).toBe(15);
	expect(parsed.achievements['power-on']).toBeTruthy();

	// RESET behind the type-YES confirm.
	await page.getByRole('button', { name: 'RESET' }).click();
	await page.getByLabel('type YES to confirm reset').fill('YES');
	await page.getByRole('button', { name: 'CONFIRM' }).click();
	await expect(meter).toContainText('0 XP');
	await expect(page.locator('.standby')).toBeVisible(); // fresh-card standby line
	expect((await readXpState(page))?.xp).toBe(0);

	// IMPORT the captured record via the hidden file input.
	await page.locator('input[type="file"]').setInputFiles({
		name: 'thunk-progress.json',
		mimeType: 'application/json',
		buffer: Buffer.from(exported)
	});
	await expect(page.locator('.tline.ok')).toHaveText('IMPORT OK');

	// State restored: XP back to 15 and the POWER ON achievement earned again.
	await expect(meter).toContainText('15 XP');
	const restored = await readXpState(page);
	expect(restored?.xp).toBe(15);
	expect((restored?.achievements as Record<string, number>)['power-on']).toBeTruthy();
});

test('achievements grid renders earned and unearned states', async ({ page }) => {
	// One achievement earned (POWER ON), the rest unearned.
	await page.goto(`/m/${modules[0].id}/${l0.id}/`);
	await passLessonCheck(page, l0.checks[0].id);
	await page.goto('/progress/');

	await expect(page.locator('.acard.earned').first()).toBeVisible();
	await expect(page.locator('.acard:not(.earned)').first()).toBeVisible();
	// POWER ON specifically is earned; IDDQD specifically is not.
	await expect(page.locator('.acard', { hasText: 'POWER ON' })).toHaveClass(/earned/);
	await expect(page.locator('.acard', { hasText: 'IDDQD' })).not.toHaveClass(/earned/);
});
