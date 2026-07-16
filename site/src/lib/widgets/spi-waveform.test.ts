import { describe, it, expect } from 'vitest';
import { spiWaveform, latchedValue, toByte, BITS, CELL } from './spi-waveform';

describe('spiWaveform', () => {
	it('spells 0x2C (RAMWR) MSB-first, matching the M3 lesson diagram', () => {
		// The Rust `waveform(0x2C)` "bit" row reads: 0 0 1 0 1 1 0 0.
		expect(spiWaveform(0x2c).bits).toEqual([0, 0, 1, 0, 1, 1, 0, 0]);
	});

	it('matches the thunk_sim bit rows for the cross-check bytes', () => {
		// Hand-derived from the ASCII waveform expectation in thunk-sim/src/trace.rs.
		expect(spiWaveform(0xff).bits).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
		expect(spiWaveform(0x00).bits).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
		expect(spiWaveform(0x01).bits).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
		expect(spiWaveform(0xa5).bits).toEqual([1, 0, 1, 0, 0, 1, 0, 1]);
	});

	it('produces one clock pulse per bit: low then high', () => {
		const { clk } = spiWaveform(0xa5);
		expect(clk).toHaveLength(BITS * CELL);
		// Every even sample is the low phase, every odd sample the high phase.
		for (let i = 0; i < clk.length; i += CELL) {
			expect(clk[i]).toBe(0);
			expect(clk[i + 1]).toBe(1);
		}
	});

	it('holds MOSI settled across each cell (stable before the rising edge)', () => {
		const { bits, mosi } = spiWaveform(0xa5);
		for (let i = 0; i < BITS; i++) {
			expect(mosi[i * CELL]).toBe(bits[i]);
			expect(mosi[i * CELL + 1]).toBe(bits[i]);
		}
	});

	it('rebuilds every byte from MOSI sampled at each rising edge (parity)', () => {
		// The invariant the Rust suite pins across all 256 bytes: read the data
		// line at each rising clock edge, MSB first, and you get the byte back.
		for (let b = 0; b <= 255; b++) {
			const { clk, mosi } = spiWaveform(b);
			let rebuilt = 0;
			for (let i = 0; i < clk.length; i++) {
				const rising = i > 0 && clk[i - 1] === 0 && clk[i] === 1;
				if (rising) rebuilt = (rebuilt << 1) | mosi[i];
			}
			expect(rebuilt).toBe(b);
		}
	});

	it('is total over out-of-range and negative input (wraps to a byte)', () => {
		expect(spiWaveform(256).bits).toEqual(spiWaveform(0).bits);
		expect(spiWaveform(-1).bits).toEqual(spiWaveform(255).bits);
		expect(toByte(300)).toBe(44);
	});
});

describe('latchedValue', () => {
	it('builds the running value most significant bit first', () => {
		const { bits } = spiWaveform(0x2c); // 0 0 1 0 1 1 0 0
		expect(latchedValue(bits, 0)).toBe(0b0);
		expect(latchedValue(bits, 3)).toBe(0b001);
		expect(latchedValue(bits, 6)).toBe(0b001011);
		expect(latchedValue(bits, 8)).toBe(0x2c);
	});

	it('clamps the step count to 0..8', () => {
		const { bits } = spiWaveform(0xff);
		expect(latchedValue(bits, -3)).toBe(0);
		expect(latchedValue(bits, 99)).toBe(0xff);
	});
});
