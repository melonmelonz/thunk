// The sitemap route-list, pure and DOM-free so it is unit-testable and shared by
// the one thing that emits the file: the prerendered /sitemap.xml endpoint
// (src/routes/sitemap.xml/+server.ts), which runs this at build time and writes
// the result into the build output. Nothing here fetches anything - the origin
// is the site's own canonical address (metadata only), same as Meta.svelte.
//
// The list is derived from the curriculum so it can never drift from the real
// routes: the fixed pages, then every module channel, then every lesson. All
// paths carry the trailing slash the router emits (trailingSlash: 'always'),
// except the root `/`.

import type { Module } from './content';
import { SITE_ORIGIN } from './meta';

/** The fixed top-level routes, in nav order. */
export const FIXED_PATHS = [
	'/',
	'/bench/',
	'/calibrate/',
	'/first-patch/',
	'/progress/',
	'/colophon/'
];

/**
 * Every real route path, in a stable order: the fixed pages, then each module
 * channel followed by its lessons. Trailing-slashed to match the emitted URLs.
 */
export function sitemapPaths(modules: Module[]): string[] {
	const paths = [...FIXED_PATHS];
	for (const m of modules) {
		paths.push(`/m/${m.id}/`);
		for (const l of m.lessons) paths.push(`/m/${m.id}/${l.id}/`);
	}
	return paths;
}

/** Absolute URLs for every route, against the canonical origin. */
export function sitemapUrls(modules: Module[], origin: string = SITE_ORIGIN): string[] {
	return sitemapPaths(modules).map((p) => origin + p);
}

/** A complete, minimal urlset sitemap document (loc only - no lastmod invented). */
export function sitemapXml(modules: Module[], origin: string = SITE_ORIGIN): string {
	const urls = sitemapUrls(modules, origin)
		.map((u) => `\t<url><loc>${u}</loc></url>`)
		.join('\n');
	return (
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		urls +
		'\n</urlset>\n'
	);
}
