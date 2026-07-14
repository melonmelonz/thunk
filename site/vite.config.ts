import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Runes mode everywhere except node_modules libraries.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// The site is fully static: content baked at build, the sim (S-B)
			// runs client-side in WASM. No server runtime. Every content route
			// is prerendered at build time; the one fallback (404.html) is how
			// CF Pages serves our custom dead-channel page for any unknown URL.
			adapter: adapter({ fallback: '404.html' })
		})
	]
});
