import { describe, it, expect } from 'vitest';
import {
	formatWadProgress,
	toDoomKey,
	initialSwitchState,
	reduceSwitch,
	needsDoomLoad
} from './doom';

describe('formatWadProgress', () => {
	it('shows loaded / total in MiB when the total is known', () => {
		expect(formatWadProgress(4.2 * 1024 * 1024, 27.5 * 1024 * 1024)).toBe(
			'FETCHING WAD - 4.2 / 27.5 MB'
		);
	});
	it('falls back to bytes-read when total is unknown', () => {
		expect(formatWadProgress(3 * 1024 * 1024, 0)).toBe('FETCHING WAD - 3.0 MB');
	});
	it('falls back to bytes-read when a gzipped transfer overshoots content-length', () => {
		// Decompressed read (27.5 MiB) exceeds a compressed content-length (9.8 MiB).
		const s = formatWadProgress(27.5 * 1024 * 1024, 9.8 * 1024 * 1024);
		expect(s).toBe('FETCHING WAD - 27.5 MB');
	});
});

describe('toDoomKey', () => {
	const k = (key: string, code = '') => toDoomKey({ key, code });
	it('maps arrows to turn/move codes', () => {
		expect(k('ArrowLeft')).toBe(0xac);
		expect(k('ArrowRight')).toBe(0xae);
		expect(k('ArrowUp')).toBe(0xad);
		expect(k('ArrowDown')).toBe(0xaf);
	});
	it('maps WASD to the same movement codes as the arrows', () => {
		expect(k('w')).toBe(0xad);
		expect(k('a')).toBe(0xac);
		expect(k('s')).toBe(0xaf);
		expect(k('d')).toBe(0xae);
	});
	it('maps fire/use/confirm', () => {
		expect(k(' ', 'Space')).toBe(0xa2);
		expect(k('Control', 'ControlLeft')).toBe(0xa3);
		expect(k('Enter')).toBe(13);
	});
	it('passes a single printable char through (menu answers / cheats)', () => {
		expect(k('y')).toBe('y'.charCodeAt(0));
		expect(k('Y')).toBe('y'.charCodeAt(0));
	});
	it('returns 0 for keys it does not handle (incl. Escape, which releases)', () => {
		expect(k('Escape')).toBe(0);
		expect(k('Tab')).toBe(0);
	});
});

describe('reduceSwitch', () => {
	it('starts on the finale, unloaded, paused', () => {
		expect(initialSwitchState()).toEqual({ source: 'finale', doom: 'unloaded', running: false });
	});

	it('selecting the same source is a no-op (identity)', () => {
		const s = initialSwitchState();
		expect(reduceSwitch(s, { type: 'select', source: 'finale' })).toBe(s);
	});

	it('switching sources always pauses first', () => {
		const running = reduceSwitch(initialSwitchState(), { type: 'run' });
		expect(running.running).toBe(true);
		const switched = reduceSwitch(running, { type: 'select', source: 'doom' });
		expect(switched.source).toBe('doom');
		expect(switched.running).toBe(false);
	});

	it('switching back to finale while DOOM runs also pauses', () => {
		let s = initialSwitchState();
		s = reduceSwitch(s, { type: 'select', source: 'doom' });
		s = reduceSwitch(s, { type: 'doom-ready' });
		s = reduceSwitch(s, { type: 'run' });
		s = reduceSwitch(s, { type: 'select', source: 'finale' });
		expect(s).toEqual({ source: 'finale', doom: 'ready', running: false });
	});

	it('loading is one-way and never regresses once ready', () => {
		let s = reduceSwitch(initialSwitchState(), { type: 'doom-ready' });
		s = reduceSwitch(s, { type: 'doom-loading' });
		expect(s.doom).toBe('ready');
	});

	it('needsDoomLoad only when DOOM is selected and still unloaded', () => {
		let s = initialSwitchState();
		expect(needsDoomLoad(s)).toBe(false); // finale
		s = reduceSwitch(s, { type: 'select', source: 'doom' });
		expect(needsDoomLoad(s)).toBe(true);
		s = reduceSwitch(s, { type: 'doom-loading' });
		expect(needsDoomLoad(s)).toBe(false);
		s = reduceSwitch(s, { type: 'doom-ready' });
		expect(needsDoomLoad(s)).toBe(false);
	});
});
