// Rasterize the static social card + the PNG icon set, in the design language.
//
// REGENERATION (run manually, then COMMIT the PNG outputs - CI never runs this,
// so there is no headless-browser or native dep in the build):
//
//   SHARP_PKG=/path/to/node_modules/sharp/lib/index.js node scripts/og.mjs
//
// sharp is not a site dependency (it would bloat `npm ci` with a native binary);
// point SHARP_PKG at a local install's entry file, or drop `sharp` into the
// site's deps and omit the env var (then a bare `import('sharp')` resolves).
// Inputs:  scripts/og.svg (the card source), static/favicon.svg (the tick).
// Outputs: static/og.png (1200x630), static/favicon-32.png, static/favicon-16.png,
//          static/apple-touch-icon.png (180). Fonts resolve from the system mono
//          at render time; the committed PNGs are the artifacts.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const sharpSpecifier = process.env.SHARP_PKG || 'sharp';
const mod = await import(sharpSpecifier);
const sharp = mod.default || mod;

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(here, '..', 'static');

const ogSvg = readFileSync(resolve(here, 'og.svg'));
const iconSvg = readFileSync(resolve(staticDir, 'favicon.svg'));

async function png(svg, out, width, height) {
	// density high enough that the vector rasterizes crisply at the target size.
	await sharp(svg, { density: 384 })
		.resize(width, height, { fit: 'contain', background: '#0A0E13' })
		.png()
		.toFile(resolve(staticDir, out));
	console.log(`wrote static/${out} (${width}x${height})`);
}

await png(ogSvg, 'og.png', 1200, 630);
await png(iconSvg, 'apple-touch-icon.png', 180, 180);
await png(iconSvg, 'favicon-32.png', 32, 32);
await png(iconSvg, 'favicon-16.png', 16, 16);

console.log('DONE: og + icons');
