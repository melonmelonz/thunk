import { describe, it, expect } from 'vitest';
import { resumeTarget, type FlatLesson } from './resume';

const order: FlatLesson[] = [
	{ moduleId: 'm0', lessonId: 'a' },
	{ moduleId: 'm0', lessonId: 'b' },
	{ moduleId: 'm1', lessonId: 'c' },
	{ moduleId: 'm1', lessonId: 'd' }
];

describe('resumeTarget', () => {
	it('is null at the zero state (no visit, nothing completed)', () => {
		expect(resumeTarget(order, null, new Set())).toBeNull();
	});

	it('resumes the last opened lesson when it is real', () => {
		expect(resumeTarget(order, { module: 'm1', lesson: 'c' }, new Set())).toEqual({
			moduleId: 'm1',
			lessonId: 'c'
		});
	});

	it('ignores a stale last lesson and falls back to first unfinished', () => {
		// `last` names a lesson that no longer exists; one lesson done.
		const done = new Set(['a']);
		expect(resumeTarget(order, { module: 'mX', lesson: 'gone' }, done)).toEqual({
			moduleId: 'm0',
			lessonId: 'b'
		});
	});

	it('falls back to first unfinished when there is no last but there is progress', () => {
		const done = new Set(['a', 'b']);
		expect(resumeTarget(order, null, done)).toEqual({ moduleId: 'm1', lessonId: 'c' });
	});

	it('resumes the final lesson when everything is complete', () => {
		const done = new Set(['a', 'b', 'c', 'd']);
		expect(resumeTarget(order, null, done)).toEqual({ moduleId: 'm1', lessonId: 'd' });
	});
});
