// The site's canonical origin. thunk.goolz.org is the address going forward;
// the pages.dev alias stays live as a fallback. Social cards and canonical tags
// need an ABSOLUTE URL, so per-page <link rel="canonical"> + og:url are built
// from this origin (see Meta.svelte). Nothing is FETCHED from this origin at
// runtime - the site is self-contained; these are metadata strings only, which
// is why the hermetic CI check allowlists exactly this one origin.
export const SITE_ORIGIN = 'https://thunk.goolz.org';

/** Absolute canonical URL for a path (leading slash optional). */
export function canonical(path: string): string {
	const p = path.startsWith('/') ? path : '/' + path;
	return SITE_ORIGIN + p;
}
