import { describe, expect, it } from 'vitest';
import { gpt2, presets } from './config';
import { sliderEnvelope, sliderRange } from './sliders';
import { slabCount, towerHeight, towerShape } from './tower';

describe('sliders', () => {
  it.each(Object.entries(presets))('%s sits on both sliders', (_, preset) => {
    const { H, L } = sliderRange;
    expect(preset.H).toBeGreaterThanOrEqual(H.min);
    expect(preset.H).toBeLessThanOrEqual(H.max);
    expect((preset.H - H.min) % H.step).toBe(0);
    expect(preset.L).toBeGreaterThanOrEqual(L.min);
    expect(preset.L).toBeLessThanOrEqual(L.max);
  });

  it('frames every reachable tower', () => {
    const { H, L } = sliderRange;
    for (let h = H.min; h <= H.max; h += H.step) {
      for (const l of [L.min, L.max]) {
        const shape = towerShape(gpt2(l, h));
        expect(shape.H).toBeLessThanOrEqual(sliderEnvelope.width);
        expect(towerHeight(shape)).toBeLessThanOrEqual(sliderEnvelope.height);
        expect(slabCount(shape.L)).toBeLessThanOrEqual(sliderEnvelope.slabs);
      }
    }
  });
});
