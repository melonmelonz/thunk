import { defineConfig } from 'vitest/config';

// A standalone vitest config, deliberately NOT the SvelteKit vite config: the
// unit suites (grader + XP curve) import only plain .ts, so we skip the svelte
// plugin and run in a fast node environment. Runes-store integration is exercised
// by Playwright against the built site, not here.
export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	}
});
