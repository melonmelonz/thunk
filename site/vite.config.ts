import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
	plugins: [
		// The bench crate (site/wasm/pkg, wasm-pack --target bundler) imports its
		// .wasm as an ES module; vite-plugin-wasm instantiates it. The generated
		// glue uses top-level await, which the esnext build target below supports
		// natively (no companion plugin - and Vite 8's Rolldown has no rollup dep
		// for vite-plugin-top-level-await to hook anyway). Inert off /bench: the
		// wasm is dynamically imported only there.
		wasm(),
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
	],

	// Modern audience (per the tech research): esnext output lets the wasm
	// module's top-level await stand without a legacy polyfill path.
	build: {
		target: 'esnext'
	}
});
