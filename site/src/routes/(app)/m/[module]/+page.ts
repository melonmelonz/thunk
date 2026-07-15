import { error } from '@sveltejs/kit';
import { modules, moduleById } from '$lib/content';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => modules.map((m) => ({ module: m.id }));

export const load: PageLoad = ({ params }) => {
	const module = moduleById(params.module);
	if (!module) throw error(404, 'no such module');
	const index = modules.findIndex((m) => m.id === module.id);
	return {
		module,
		prevModule: index > 0 ? modules[index - 1] : undefined,
		nextModule: index < modules.length - 1 ? modules[index + 1] : undefined
	};
};
