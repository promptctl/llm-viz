import { describe, expect, it } from 'vitest';
import { modelConfig, presets } from './config';

describe('modelConfig', () => {
  it('fails loudly when H does not divide by heads', () => {
    expect(() => modelConfig({ L: 12, H: 770, heads: 12, dFf: 3080, V: 50257, nCtx: 1024 })).toThrow(
      'H=770 is not divisible by heads=12',
    );
  });

  it('derives the head width', () => {
    expect(modelConfig({ L: 2, H: 96, heads: 3, dFf: 384, V: 100, nCtx: 8 }).dHead).toBe(32);
  });
});

describe('GPT-2 presets', () => {
  it.each([
    ['GPT-2 small', 12, 768],
    ['GPT-2 medium', 24, 1024],
    ['GPT-2 large', 36, 1280],
    ['GPT-2 XL', 48, 1600],
  ] as const)('%s is L=%i × H=%i with 64-wide heads', (name, L, H) => {
    expect(presets[name]).toMatchObject({ L, H, dHead: 64, dFf: 4 * H, V: 50257, nCtx: 1024 });
  });
});
