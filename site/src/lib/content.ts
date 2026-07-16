// Typed access to the curriculum exported by `thunk export`. The JSON is the
// single source of truth - the same content the TUI and the offline bundle
// render, only serialized. Do not hand-edit content.json; regenerate it.

import data from './content.json';

export type Check =
	| { kind: 'choice'; id: string; prompt: string; options: string[]; answer: number }
	| { kind: 'short'; id: string; prompt: string; answers: string[] }
	| { kind: 'order'; id: string; prompt: string; items: string[] }
	| { kind: 'predict'; id: string; prompt: string; answers: string[]; hint: string };

export interface Lesson {
	id: string;
	title: string;
	body: string;
	bodyHtml: string;
	checks: Check[];
}

export interface Module {
	id: string;
	tag: string;
	title: string;
	lessonCount: number;
	checkCount: number;
	lessons: Lesson[];
}

export interface PlacementItem {
	module: string;
	check: string;
}

export interface Curriculum {
	modules: Module[];
	placement: PlacementItem[];
	moduleCount: number;
	lessonCount: number;
	checkCount: number;
}

export const curriculum = data as Curriculum;
export const modules = curriculum.modules;

/** The placement (test-out) items: 3 check refs per module, in module order. */
export const placement = curriculum.placement;

// Flat check index, built once, for the placement flow (which addresses checks
// by id across modules).
const CHECK_BY_ID = new Map<string, Check>();
for (const m of modules) {
	for (const l of m.lessons) {
		for (const c of l.checks) CHECK_BY_ID.set(c.id, c);
	}
}

/** The Check with this id, anywhere in the curriculum. */
export function checkById(id: string): Check | undefined {
	return CHECK_BY_ID.get(id);
}

export function moduleById(id: string): Module | undefined {
	return modules.find((m) => m.id === id);
}

export function lessonById(moduleId: string, lessonId: string): Lesson | undefined {
	return moduleById(moduleId)?.lessons.find((l) => l.id === lessonId);
}

/** Course-order neighbours of a lesson, within its module. */
export function lessonNeighbours(
	module: Module,
	lessonId: string
): { prev?: Lesson; next?: Lesson; index: number } {
	const index = module.lessons.findIndex((l) => l.id === lessonId);
	return {
		prev: index > 0 ? module.lessons[index - 1] : undefined,
		next: index < module.lessons.length - 1 ? module.lessons[index + 1] : undefined,
		index
	};
}
