import { defineConfig, devices } from '@playwright/test';

// The end-to-end suite drives the built static site exactly as a facility or a
// reader would: `npm run build` then `vite preview`, one chromium, no network
// past localhost. The bundled chromium (revision 1228) is pinned by the exact
// @playwright/test version so the cache primed in CI (and at ~/.cache) matches.
//
// Two projects on purpose:
//   - `chromium`   runs the bulk of the suite under prefers-reduced-motion so
//                  transitions never race an assertion. Skips motion.spec.
//   - `motion`     runs motion.spec.ts ONLY, WITHOUT reduced motion, so the boot
//                  ritual + view transitions are actually exercised.
const PORT = 4173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: 'e2e',
	// Deterministic order within a file; files still parallelize across workers.
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	// A couple of workers keeps the WAD-heavy bench spec from starving the others
	// while staying comfortably under the ~20min CI budget.
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

	use: {
		baseURL,
		trace: 'on-first-retry',
		// A stable desktop viewport; specs that care about 390px resize themselves.
		viewport: { width: 1440, height: 900 }
	},

	projects: [
		{
			name: 'chromium',
			testIgnore: /motion\.spec\.ts/,
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 900 },
				// The whole product is motion-decorated (boot ritual, toasts, view
				// transitions, the ~1s bench boot stream). Reduced motion collapses all
				// of it to instant, which is what makes the flows deterministic.
				reducedMotion: 'reduce'
			}
		},
		{
			name: 'motion',
			testMatch: /motion\.spec\.ts/,
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 900 },
				// Explicitly NOT reduced: this project exists to run the animated boot
				// ritual and the crossfade view transitions for real.
				reducedMotion: 'no-preference'
			}
		}
	],

	webServer: {
		command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		stdout: 'ignore',
		stderr: 'pipe'
	}
});
