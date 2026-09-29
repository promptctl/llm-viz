import type { ModelConfig } from './config';

// The four dimensions the tower is drawn from. Floats, not a ModelConfig, because a
// transition between two configs passes through shapes no config names: L = 12.5 is a
// thirteenth layer half grown.
export type TowerShape = { readonly L: number; readonly H: number; readonly V: number; readonly nCtx: number };

export function towerShape({ L, H, V, nCtx }: ModelConfig): TowerShape {
  return { L, H, V, nCtx };
}

// Twelve H×H weight matrices per layer, one unit of height each (PROJECT.md "The scene").
export const layerHeight = 12;

export type SlabKind = 'embedding' | 'positional' | 'layer';

// One call per slab, bottom to top, with no allocation: the stage runs this every frame.
export type SlabVisitor = (kind: SlabKind, index: number, y: number, width: number, height: number, depth: number) => void;

// [LAW:one-source-of-truth] a slab's volume is its parameter count, one cubic unit per
// weight, so the tower's volume is the ledger's total drawn from the same config. The
// embedding (V·H) and positional (nCtx·H) slabs keep the tower's H×H footprint, which makes
// their height their share of the whole: GPT-2 small's floor stands a third as tall as the
// twelve layers above it and shrinks to a sliver under XL (PROJECT.md "The scene").
export function forEachSlab({ L, H, V, nCtx }: TowerShape, visit: SlabVisitor): void {
  const embedding = V / H;
  const positional = nCtx / H;
  visit('embedding', 0, 0, H, embedding, H);
  visit('positional', 0, embedding, H, positional, H);
  const base = embedding + positional;
  const layers = Math.ceil(L);
  for (let i = 0; i < layers; i++) {
    // The top layer is as tall as the fraction of it that exists.
    visit('layer', i, base + i * layerHeight, H, layerHeight * Math.min(1, L - i), H);
  }
}

export function towerHeight({ L, H, V, nCtx }: TowerShape): number {
  return V / H + nCtx / H + layerHeight * L;
}

// A box the tower fits in; the footprint is square, so width serves as depth too.
export type Extent = { readonly width: number; readonly height: number };
