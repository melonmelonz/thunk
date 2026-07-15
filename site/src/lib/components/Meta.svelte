<!-- One place for per-page head metadata: <title>, description, the absolute
     canonical + og:url (built from the site's own origin), and og/twitter
     title+description. The constant social wiring (og:image, site_name, card
     type) lives in app.html. og:image is absolute there; canonical/og:url are
     absolute here - crawlers need absolute URLs, and thunk.goolz.org is the
     canonical origin. -->
<script lang="ts">
	import { page } from '$app/state';
	import { canonical } from '$lib/meta';

	let {
		title,
		description,
		ogTitle,
		ogDescription
	}: {
		title: string;
		description: string;
		/** Defaults to `title` when omitted. */
		ogTitle?: string;
		/** Defaults to `description` when omitted. */
		ogDescription?: string;
	} = $props();

	// Canonical + og:url track the current route path against the fixed origin.
	const url = $derived(canonical(page.url.pathname));
	const ogT = $derived(ogTitle ?? title);
	const ogD = $derived(ogDescription ?? description);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta property="og:url" content={url} />
	<meta property="og:title" content={ogT} />
	<meta property="og:description" content={ogD} />
	<meta name="twitter:title" content={ogT} />
	<meta name="twitter:description" content={ogD} />
</svelte:head>
