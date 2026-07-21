import { describe, it, expect } from 'vitest';
import {
	bytesPerFrame,
	bitsPerFrame,
	achievableFps,
	frameTimeMs,
	deadlineMs,
	meetsDeadline,
	minClockHz,
	toMHz,
	commas,
	fpsLabel,
	PIXELS,
	TARGET_FPS
} from './frame-budget';

describe('the frame, in bytes and bits', () => {
	it('windowed frame is the lesson figure exactly: 153,600 bytes', () => {
		expect(PIXELS).toBe(76_800);
		expect(bytesPerFrame('window')).toBe(153_600);
		expect(bitsPerFrame('window')).toBe(1_228_800);
	});

	it('per-pixel addressing costs far more - aim outweighs colour', () => {
		expect(bytesPerFrame('per-pixel')).toBe(768_000); // 10 bytes a pixel
		expect(bytesPerFrame('per-pixel')).toBeGreaterThan(bytesPerFrame('window') * 4);
	});
});

describe('the budget: does the loop close in time', () => {
	it('the crossing clock is bits/frame x fps ~ 36.9 MHz, the lesson-s 37 million', () => {
		const hz = minClockHz('window', TARGET_FPS);
		expect(hz).toBe(36_864_000);
		expect(toMHz(hz)).toBe('36.9');
	});

	it('achieves exactly 30 fps at the crossing clock', () => {
		expect(achievableFps(36_864_000, 'window')).toBeCloseTo(30, 6);
		expect(meetsDeadline(36_864_000, 'window')).toBe(true);
	});

	it('a hair under the crossing misses; a hair over meets', () => {
		expect(meetsDeadline(36_000_000, 'window')).toBe(false);
		expect(meetsDeadline(37_000_000, 'window')).toBe(true);
	});

	it('30 MHz does NOT buy 30 fps - the aha of the lesson', () => {
		// The clock is megahertz, the deadline is frames; they are not the same 30.
		expect(achievableFps(30_000_000, 'window')).toBeLessThan(30);
		expect(meetsDeadline(30_000_000, 'window')).toBe(false);
	});

	it('per-pixel addressing needs a five-times-faster clock', () => {
		expect(minClockHz('per-pixel')).toBe(minClockHz('window') * 5);
		expect(meetsDeadline(36_864_000, 'per-pixel')).toBe(false);
	});
});

describe('frame time vs the deadline', () => {
	it('at the crossing, frame time equals the 1/30 s budget', () => {
		expect(frameTimeMs(36_864_000, 'window')).toBeCloseTo(deadlineMs(30), 6);
		expect(deadlineMs(30)).toBeCloseTo(33.333, 3);
	});

	it('guards a zero/negative clock instead of dividing by it', () => {
		expect(achievableFps(0, 'window')).toBe(0);
		expect(frameTimeMs(0, 'window')).toBe(Infinity);
		expect(meetsDeadline(0, 'window')).toBe(false);
	});
});

describe('formatting', () => {
	it('groups thousands and floors fps to whole frames', () => {
		expect(commas(153_600)).toBe('153,600');
		expect(fpsLabel(30.11)).toBe('30');
		expect(fpsLabel(19.5)).toBe('19');
	});
});
