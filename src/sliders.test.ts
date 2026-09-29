import { describe, expect, it } from 'vitest';
import { presets } from './config';
import { sliderConfig, sliderEnvelope, sliderRange } from './sliders';
import { towerHeight, towerShape } from './tower';

describe('sliders', () => {
  it.each(Object.entries(presets))('%s sits on both sliders', (_, preset) => {
    const { H, L } = sliderRange;
    expect(preset.H).toBeGreaterThanOrEqual(H.min);
    expect(preset.H).toBeLessThanOrEqual(H.max);
    expect((preset.H - H.min) % H.step).toBe(0);
    expect(preset.L).toBeGreaterThanOrEqual(L.min);
    expect(preset.L).toBeLessThanOrEqual(L.max);
    expect(sliderConfig(preset.H, preset.L)).toEqual(preset);
  });

  it('refuses an H that is not a whole number of heads', () => {
    expect(() => sliderConfig(770, 12)).toThrow('heads=12.03125 is not a positive integer');
  });

  it('frames every reachable tower', () => {
    const { H, L } = sliderRange;
    for (let h = H.min; h <= H.max; h += H.step) {
      for (const l of [L.min, L.max]) {
        const shape = towerShape(sliderConfig(h, l));
        expect(shape.H).toBeLessThanOrEqual(sliderEnvelope.width);
        expect(towerHeight(shape)).toBeLessThanOrEqual(sliderEnvelope.height);
        expect(shape.L).toBeLessThanOrEqual(sliderEnvelope.layers);
      }
    }
  });
});
