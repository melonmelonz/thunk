// Frame Budget (M5 L02): the arithmetic the lesson walks, made a knob. The panel
// is fixed (240x320, two bytes a pixel, thirty frames a second, one bit per bus
// tick - the numbers M4 and M5 name); the learner turns the bus clock and reads
// off whether the loop closes in time. A second control swaps the window trick
// for per-pixel addressing so the wasted-bytes lesson is a thing you can watch
// blow the budget. Pure and unit-tested; the component is only its dial.

// ---- Fixed panel facts (M4 measured them; M5 spends them) -------------------
export const WIDTH = 240;
export const HEIGHT = 320;
export const PIXELS = WIDTH * HEIGHT; // 76,800
export const BYTES_PER_PIXEL = 2; // RGB565, one 16-bit word per pixel
export const BITS_PER_BYTE = 8;
export const TARGET_FPS = 30; // the smooth-motion deadline
// If you named coordinates for every pixel instead of setting the window once,
// the aim would cost this many bytes per pixel - more than the colour itself,
// exactly as the "Spending it well" section warns.
export const ADDR_BYTES_PER_PIXEL = 8;

export type Addressing = 'window' | 'per-pixel';

/** Bytes the driver streams for one frame, under each addressing scheme. */
export function bytesPerFrame(addressing: Addressing): number {
	return addressing === 'window'
		? PIXELS * BYTES_PER_PIXEL // 153,600 - the lesson's figure, colour only
		: PIXELS * (BYTES_PER_PIXEL + ADDR_BYTES_PER_PIXEL); // 768,000 - colour + aim
}

/** Bits per frame: what the serial bus must actually carry, one per tick. */
export function bitsPerFrame(addressing: Addressing): number {
	return bytesPerFrame(addressing) * BITS_PER_BYTE;
}

/** Frames per second the bus can deliver at `clockHz` (one bit per tick). */
export function achievableFps(clockHz: number, addressing: Addressing): number {
	if (clockHz <= 0) return 0;
	return clockHz / bitsPerFrame(addressing);
}

/** How long one frame takes to travel the bus, in milliseconds. */
export function frameTimeMs(clockHz: number, addressing: Addressing): number {
	if (clockHz <= 0) return Infinity;
	return (bitsPerFrame(addressing) / clockHz) * 1000;
}

/** The frame budget: the time one frame is allowed, in milliseconds. */
export function deadlineMs(fps: number = TARGET_FPS): number {
	return 1000 / fps;
}

/** Does the loop close in time? True exactly at the crossing and above. */
export function meetsDeadline(
	clockHz: number,
	addressing: Addressing,
	fps: number = TARGET_FPS
): boolean {
	return achievableFps(clockHz, addressing) >= fps;
}

/** The slowest clock that still meets the deadline: bits/frame x fps ticks/s. */
export function minClockHz(addressing: Addressing, fps: number = TARGET_FPS): number {
	return bitsPerFrame(addressing) * fps;
}

// ---- Formatting -------------------------------------------------------------

/** Hz as megahertz, one decimal: 36_864_000 -> "36.9". */
export function toMHz(hz: number): string {
	return (hz / 1_000_000).toFixed(1);
}

/** A whole number with thousands separators: 153600 -> "153,600". */
export function commas(n: number): string {
	return Math.round(n).toLocaleString('en-US');
}

/** Achievable fps, rounded to a whole frame for the headline readout. */
export function fpsLabel(fps: number): string {
	return String(Math.floor(fps));
}

/** Bits per second the deadline demands, as megabits: "36.9 Mb/s". */
export function toMbps(bitsPerSecond: number): string {
	return (bitsPerSecond / 1_000_000).toFixed(1);
}
