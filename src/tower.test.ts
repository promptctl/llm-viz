import { describe, expect, it } from 'vitest';
import { presets } from './config';
import { parameterLedger } from './ledger';
import { forEachSlab, layerHeight, slabCount, towerHeight, towerShape, type SlabKind } from './tower';

type Slab = { kind: SlabKind; index: number; y: number; width: number; height: number; depth: number };

function slabs(shape: Parameters<typeof forEachSlab>[0]): Slab[] {
  const out: Slab[] = [];
  forEachSlab(shape, (kind, index, y, width, height, depth) => out.push({ kind, index, y, width, height, depth }));
  return out;
}

const small = towerShape(presets['GPT-2 small']);

describe('forEachSlab', () => {
  it('stacks the floor, the positional slab and L layers bottom to top with no gaps', () => {
    const stack = slabs(small);
    expect(stack.map((s) => s.kind)).toEqual(['embedding', 'positional', ...Array<SlabKind>(12).fill('layer')]);
    expect(stack.map((s) => s.index)).toEqual([0, 0, ...Array.from({ length: 12 }, (_, i) => i)]);
    for (const [i, slab] of stack.entries()) {
      expect(slab.y).toBeCloseTo(stack.slice(0, i).reduce((top, below) => top + below.height, 0));
    }
    expect(stack.at(-1)!.y + stack.at(-1)!.height).toBeCloseTo(towerHeight(small));
  });

  it('gives every slab the H×H footprint and each layer twelve units of height', () => {
    for (const slab of slabs(small)) {
      expect(slab.width).toBe(768);
      expect(slab.depth).toBe(768);
    }
    for (const layer of slabs(small).filter((s) => s.kind === 'layer')) {
      expect(layer.height).toBe(layerHeight);
    }
  });

  it('makes each slab’s volume its parameter count', () => {
    const ledger = parameterLedger(presets['GPT-2 small']);
    const volume = (s: Slab) => s.width * s.height * s.depth;
    const [embedding, positional, layer] = slabs(small);
    expect(volume(embedding!)).toBeCloseTo(ledger.embedding);
    expect(volume(positional!)).toBeCloseTo(ledger.positional);
    expect(volume(layer!)).toBeCloseTo(ledger.perLayer.attention.weights + ledger.perLayer.mlp.weights);
  });

  it('draws a fractional L as a top layer that is only as tall as the fraction that exists', () => {
    const layers = slabs({ ...small, L: 2.5 }).filter((s) => s.kind === 'layer');
    expect(layers.map((s) => s.height)).toEqual([12, 12, 6]);
    expect(slabs({ ...small, L: 2.5 })).toHaveLength(slabCount(2.5));
    expect(slabs(small)).toHaveLength(slabCount(12));
  });

  it('renders L=1 at the narrowest H as one layer on a floor taller than itself', () => {
    const stack = slabs({ ...small, L: 1, H: 64 });
    expect(stack.filter((s) => s.kind === 'layer')).toHaveLength(1);
    expect(stack[0]!.height).toBeGreaterThan(layerHeight);
  });

  it('quadruples the footprint and doubles the floor’s reach when H doubles', () => {
    const footprint = (H: number) => slabs({ ...small, H }).map((s) => s.width * s.depth);
    expect(footprint(1536)).toEqual(footprint(768).map((a) => a * 4));
    const floorShare = (H: number) => {
      const stack = slabs({ ...small, H });
      return stack[0]!.height / towerHeight({ ...small, H });
    };
    expect(floorShare(1536)).toBeLessThan(floorShare(768));
  });
});
