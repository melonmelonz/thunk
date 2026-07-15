// The CONTINUE affordance's brain: pure, DOM-free, testable. Given the flat
// course order, the last lesson the reader opened, and the set of completed
// lesson ids, decide which lesson CONTINUE should resume - or null when there is
// nothing to resume yet (the zero state, where the chip stays hidden).

export interface FlatLesson {
	moduleId: string;
	lessonId: string;
}

/**
 * Resume target rules, in order:
 *   1. Zero state (never opened a lesson, nothing completed) -> null (hidden).
 *   2. The furthest lesson opened (`last`), if it still names a real lesson.
 *   3. Otherwise the first not-yet-completed lesson in course order.
 *   4. Everything complete but no valid `last` -> the final lesson.
 */
export function resumeTarget(
	order: FlatLesson[],
	last: { module: string; lesson: string } | null,
	completed: Set<string>
): FlatLesson | null {
	if (!last && completed.size === 0) return null;

	if (last) {
		const hit = order.find((o) => o.moduleId === last.module && o.lessonId === last.lesson);
		if (hit) return hit;
	}

	const firstUnfinished = order.find((o) => !completed.has(o.lessonId));
	if (firstUnfinished) return firstUnfinished;

	return order[order.length - 1] ?? null;
}
