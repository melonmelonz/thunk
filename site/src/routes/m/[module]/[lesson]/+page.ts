import { error } from '@sveltejs/kit';
import { modules, moduleById, lessonNeighbours } from '$lib/content';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () =>
	modules.flatMap((m) => m.lessons.map((l) => ({ module: m.id, lesson: l.id })));

export const load: PageLoad = ({ params }) => {
	const module = moduleById(params.module);
	if (!module) throw error(404, 'no such module');
	const { prev, next, index } = lessonNeighbours(module, params.lesson);
	const lesson = module.lessons[index];
	if (!lesson) throw error(404, 'no such lesson');
	return { module, lesson, prev, next, index };
};
