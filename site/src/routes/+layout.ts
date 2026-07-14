// The whole site is prerendered - every route is known at build time.
export const prerender = true;

// Directory-style URLs: every page emits as <route>/index.html, so the links
// (which all carry a trailing slash) resolve on CF Pages without redirects.
export const trailingSlash = 'always';
