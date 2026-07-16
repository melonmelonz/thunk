// The sitemap, generated at build time from the live curriculum and written into
// the build output as /sitemap.xml. Prerendered (no server runtime): the route
// list comes from src/lib/sitemap.ts, the single tested source of truth, so it
// can never drift from the real routes. The URLs are the site's own canonical
// address - metadata, never fetched - so this stays hermetic (and .xml is exempt
// from the markup/JS URL grep regardless).

import { modules } from '$lib/content';
import { sitemapXml } from '$lib/sitemap';

export const prerender = true;

export function GET() {
	return new Response(sitemapXml(modules), {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
}
