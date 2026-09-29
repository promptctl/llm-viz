import { describe, expect, it } from 'vitest';
import { modelConfig, presets, type ModelShape } from './config';

const small: ModelShape = { L: 12, H: 768, heads: 12, dFf: 3072, V: 50257, nCtx: 1024 };

describe('modelConfig', () => {
  it('fails loudly when H does not divide by heads', () => {
    expect(() => modelConfig({ ...small, H: 770 })).toThrow('H=770 is not divisible by heads=12');
  });

  it.each([
    ['heads', 0],
    ['heads', -12],
    ['H', 0],
    ['L', 12.5],
    ['V', 50257.3],
  ] as const)('fails loudly when %s=%s is not a positive integer', (field, value) => {
    expect(() => modelConfig({ ...small, [field]: value })).toThrow(`${field}=${value} is not a positive integer`);
  });

  it('derives the head width', () => {
    expect(modelConfig({ L: 2, H: 96, heads: 3, dFf: 384, V: 100, nCtx: 8 }).dHead).toBe(32);
  });

  it('keeps only the shape, whatever else the source object carried', () => {
    const header = { ...small, name: 'gpt2', dtype: 'f32' } as ModelShape;
    expect(modelConfig(header)).toEqual({ ...small, dHead: 64 });
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
