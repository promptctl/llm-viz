import { describe, expect, it } from 'vitest';
import { presets, type PresetName } from './config';
import { parameterLedger } from './ledger';

// The counts every GPT-2 checkpoint sums to with the unembedding tied to the embedding.
// A ledger that is off by one is a ledger nobody should trust (PROJECT.md).
const counts: readonly (readonly [PresetName, number])[] = [
  ['GPT-2 small', 124_439_808],
  ['GPT-2 medium', 354_823_168],
  ['GPT-2 large', 774_030_080],
  ['GPT-2 XL', 1_557_611_200],
];

describe('parameterLedger', () => {
  it.each(counts)('%s totals %i parameters', (name, total) => {
    expect(parameterLedger(presets[name]).total).toBe(total);
  });

  it.each(counts)('%s: the total is the sum of the lines it prints', (name) => {
    const { L } = presets[name];
    const { perLayer, embedding, positional, finalNorm, total } = parameterLedger(presets[name]);
    const layer =
      perLayer.attention.weights + perLayer.attention.bias + perLayer.mlp.weights + perLayer.mlp.bias + perLayer.layerNorm;
    expect(L * layer + embedding + positional + finalNorm).toBe(total);
  });

  it('breaks GPT-2 small down as PROJECT.md writes it', () => {
    expect(parameterLedger(presets['GPT-2 small'])).toEqual({
      perLayer: {
        attention: { weights: 4 * 768 ** 2, bias: 4 * 768 },
        mlp: { weights: 8 * 768 ** 2, bias: 5 * 768 },
        layerNorm: 4 * 768,
      },
      embedding: 38_597_376,
      positional: 786_432,
      finalNorm: 1_536,
      total: 124_439_808,
    });
  });
});
