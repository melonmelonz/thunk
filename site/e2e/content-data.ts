// The single source of truth the specs read their "correct answers" from: the
// exact content.json the app ships, imported straight off disk. No answer is
// ever hand-copied into a test - drive the UI with what the curriculum says.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Read the curriculum off disk rather than importing the JSON module: node's
// native ESM (used by the Playwright runner) requires an import attribute for
// JSON, and reading avoids version-coupling to that syntax.
const content = JSON.parse(
	readFileSync(fileURLToPath(new URL('../src/lib/content.json', import.meta.url)), 'utf8')
);

export type ChoiceCheck = { kind: 'choice'; id: string; prompt: string; options: string[]; answer: number };
export type ShortCheck = { kind: 'short'; id: string; prompt: string; answers: string[] };
export type OrderCheck = { kind: 'order'; id: string; prompt: string; items: string[] };
export type PredictCheck = { kind: 'predict'; id: string; prompt: string; answers: string[]; hint: string };
export type Check = ChoiceCheck | ShortCheck | OrderCheck | PredictCheck;

export interface Lesson {
	id: string;
	title: string;
	checks: Check[];
}
export interface Module {
	id: string;
	tag: string; // "M0".."M7"
	title: string;
	lessonCount: number;
	checkCount: number;
	lessons: Lesson[];
}
export interface PlacementItem {
	module: string;
	check: string;
}

interface Curriculum {
	modules: Module[];
	placement: PlacementItem[];
	moduleCount: number;
	lessonCount: number;
	checkCount: number;
}

export const curriculum = content as unknown as Curriculum;
export const modules = curriculum.modules;
export const placement = curriculum.placement;

/** "M5" -> "CH-05" (the channel code the UI prints everywhere). */
export function chCode(tag: string): string {
	return 'CH-' + String(Number(tag.replace(/\D/g, ''))).padStart(2, '0');
}

/** "M5" + lesson index 0 -> "CH-05.01" (the lesson title code). */
export function chLesson(tag: string, lessonIndex: number): string {
	return `${chCode(tag)}.${String(lessonIndex + 1).padStart(2, '0')}`;
}

export function moduleByTag(tag: string): Module {
	const m = modules.find((x) => x.tag === tag);
	if (!m) throw new Error(`no module tagged ${tag}`);
	return m;
}

const CHECK_BY_ID = new Map<string, Check>();
for (const m of modules) for (const l of m.lessons) for (const c of l.checks) CHECK_BY_ID.set(c.id, c);

export function checkById(id: string): Check {
	const c = CHECK_BY_ID.get(id);
	if (!c) throw new Error(`no check ${id}`);
	return c;
}

export interface LessonRef {
	moduleId: string;
	tag: string;
	lessonId: string;
	lessonIndex: number;
	title: string;
	url: string;
	code: string; // CH-NN.LL
}

/** Every lesson in flat course order, with its URL and expected title code. */
export const lessonRefs: LessonRef[] = modules.flatMap((m) =>
	m.lessons.map((l, i) => ({
		moduleId: m.id,
		tag: m.tag,
		lessonId: l.id,
		lessonIndex: i,
		title: l.title,
		url: `/m/${m.id}/${l.id}/`,
		code: chLesson(m.tag, i)
	}))
);

/** Module index URLs (e.g. /m/m5-doom/). */
export const moduleUrls = modules.map((m) => ({ tag: m.tag, url: `/m/${m.id}/`, code: chCode(m.tag) }));

/** The static, non-lesson app + marketing routes exercised by smoke. */
export const staticRoutes = [
	{ url: '/', kind: 'marketing' as const },
	{ url: '/bench/', kind: 'app' as const },
	{ url: '/calibrate/', kind: 'app' as const },
	{ url: '/first-patch/', kind: 'app' as const },
	{ url: '/progress/', kind: 'app' as const },
	{ url: '/colophon/', kind: 'app' as const }
];
