import { describe, it, expect } from 'vitest';
import type { Row } from './sim';
import { serializeTrace, traceKindLabel } from './trace';

const rows: Row[] = [
	{ kind: 0, byte: 0x01, text: 'SWRESET' },
	{ kind: 2, byte: -1, text: 'CS v' },
	{ kind: 1, byte: 0x55, text: 'RAMWR 55 55 55' }
];

describe('trace serializer', () => {
	it('labels each kind', () => {
		expect(traceKindLabel(0)).toBe('CMD');
		expect(traceKindLabel(1)).toBe('DATA');
		expect(traceKindLabel(2)).toBe('SEL');
	});

	it('produces the exact text: header comment then one line per row', () => {
		const out = serializeTrace(rows, { frame: 42 });
		expect(out).toBe(
			'# thunk bus trace\n' +
				'# frame 00042  3 events  240x320 RGB565\n' +
				'CMD  SWRESET\n' +
				'SEL  CS v\n' +
				'DATA RAMWR 55 55 55\n'
		);
	});

	it('reports the real event count and pads the frame', () => {
		const out = serializeTrace([], { frame: 0 });
		expect(out).toBe('# thunk bus trace\n# frame 00000  0 events  240x320 RGB565\n');
	});
});
