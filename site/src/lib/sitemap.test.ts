import { describe, it, expect } from 'vitest';
import { modules } from './content';
import { FIXED_PATHS, sitemapPaths, sitemapUrls, sitemapXml } from './sitemap';

// The real curriculum: 7 modules, 31 lessons. The sitemap covers the 5 fixed
// pages (/, /bench, /calibrate, /progress, /colophon) plus each module channel
// and every lesson: 5 + 7 + 31 = 43 URLs.
const EXPECTED = 5 + 7 + 31;

describe('sitemap route list', () => {
	it('lists every real route once, in a stable order', () => {
		const paths = sitemapPaths(modules);
		expect(paths.length).toBe(EXPECTED);
		expect(new Set(paths).size).toBe(paths.length); // no duplicates
		// Fixed pages come first, in nav order.
		expect(paths.slice(0, FIXED_PATHS.length)).toEqual(FIXED_PATHS);
		// Each module contributes its channel + its lessons.
		for (const m of modules) {
			expect(paths).toContain(`/m/${m.id}/`);
			for (const l of m.lessons) expect(paths).toContain(`/m/${m.id}/${l.id}/`);
		}
		// The new colophon route is present.
		expect(paths).toContain('/colophon/');
	});

	it('every non-root path carries a trailing slash', () => {
		for (const p of sitemapPaths(modules)) {
			if (p === '/') continue;
			expect(p.endsWith('/')).toBe(true);
		}
	});

	it('emits absolute https URLs on the canonical origin', () => {
		const urls = sitemapUrls(modules);
		expect(urls.length).toBe(EXPECTED);
		for (const u of urls) expect(u).toMatch(/^https:\/\/thunk\.goolz\.org\//);
	});

	it('builds a valid urlset with one <loc> per route', () => {
		const xml = sitemapXml(modules);
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		const locs = xml.match(/<loc>/g) ?? [];
		expect(locs.length).toBe(EXPECTED);
		expect(xml).toContain('<loc>https://thunk.goolz.org/</loc>');
		expect(xml).toContain('<loc>https://thunk.goolz.org/colophon/</loc>');
	});
});
