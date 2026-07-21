// Easter eggs: the three hidden delights, driven exactly as a curious visitor
// would find them. The Konami degauss and the console signature run under the
// default reduced-motion project (the overlay still MOUNTS reduced, it just
// doesn't wobble); the body-shudder itself is asserted in motion.spec. The DOOM
// cheat needs the full WAD + doomgeneric wasm, so - like the bench title paint -
// it is verified locally and skipped under CI.
import { test, expect, type Page } from './fixtures';

// The Konami sequence, by KeyboardEvent.key, as page.keyboard.press wants them.
const KONAMI = [
	'ArrowUp',
	'ArrowUp',
	'ArrowDown',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'ArrowLeft',
	'ArrowRight',
	'b',
	'a'
];

async function pressKonami(page: Page) {
	for (const k of KONAMI) await page.keyboard.press(k);
}

test('Konami code degausses the face, then clears', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	const degauss = page.locator('.degauss');
	await expect(degauss).toHaveCount(0); // hidden until summoned

	await pressKonami(page);

	// The overlay mounts (its DEGAUSS tag renders even under reduced motion)...
	await expect(degauss).toBeVisible();
	await expect(degauss.locator('.tag')).toHaveText('DEGAUSS');
	// ...and then unmounts itself when the sweep is done.
	await expect(degauss).toHaveCount(0, { timeout: 3000 });
});

test('a wrong key aborts the Konami run', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	await page.keyboard.press('ArrowUp');
	await page.keyboard.press('ArrowUp');
	await page.keyboard.press('x'); // breaks the sequence
	for (const k of KONAMI.slice(2)) await page.keyboard.press(k);

	// The truncated run must NOT have fired.
	await expect(page.locator('.degauss')).toHaveCount(0);
});

test('the console carries a signature for anyone who looks', async ({ page }) => {
	const logs: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'log') logs.push(msg.text());
	});

	await page.goto('/');
	await page.waitForLoadState('networkidle');

	const banner = logs.find((l) => l.includes('systems course'));
	expect(banner, 'a greeting is logged on first load').toBeTruthy();
	expect(banner).toContain('thunk');
	expect(banner).toContain('B A'); // the door left ajar to the Konami egg
});

test('DOOM cheat codes flash the authentic HUD message', async ({ page }) => {
	test.skip(
		!!process.env.CI,
		'DOOM boot (10MB WAD + doomgeneric wasm) is slow/flaky under CI; verified locally.'
	);
	await page.goto('/bench');

	// Flip the source to DOOM and wait for the module + WAD to boot the panel.
	await page.getByRole('button', { name: /^DOOM/ }).click();
	await expect
		.poll(() => page.evaluate(() => (window as { __bench?: { doomPhase(): string } }).__bench?.doomPhase()), {
			timeout: 60_000
		})
		.toBe('ready');

	// Capture the keyboard, then type the cheat. The keystrokes still reach the
	// engine; the HUD is the pure wink on top.
	const bezel = page.locator('.bezel');
	await bezel.click();
	for (const ch of 'iddqd') await page.keyboard.press(ch);

	const hud = page.locator('.cheat');
	await expect(hud).toHaveText('DEGREELESSNESS MODE ON');
	// It clears itself after the beat.
	await expect(hud).toHaveCount(0, { timeout: 4000 });
});
