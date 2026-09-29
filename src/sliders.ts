import { gpt2, gpt2HeadWidth, type ModelConfig } from './config';
import { towerHeight, towerShape, type Extent } from './tower';

export type Range = { readonly min: number; readonly max: number; readonly step: number };

// [LAW:one-source-of-truth] the reach of the two sliders, read by the DOM attributes and by
// the camera's framing alike. H moves in head-widths so every position names a valid GPT-2
// shape (PROJECT.md "The what-if ledger"); the top of both is the XL preset.
export const sliderRange = {
  H: { min: gpt2HeadWidth, max: 1600, step: gpt2HeadWidth },
  L: { min: 1, max: 48, step: 1 },
} as const satisfies Record<'H' | 'L', Range>;

export function sliderConfig(H: number, L: number): ModelConfig {
  return gpt2(L, H);
}

// The box every reachable tower fits in, so the camera is framed once and growth stays in
// frame. Height peaks at the most layers and the narrowest H: layers add height linearly
// in L, and the floor's height V/H falls as H grows.
export const sliderEnvelope: Extent & { readonly layers: number } = {
  width: sliderRange.H.max,
  height: towerHeight(towerShape(sliderConfig(sliderRange.H.min, sliderRange.L.max))),
  layers: sliderRange.L.max,
};
