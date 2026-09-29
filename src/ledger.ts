import type { ModelConfig } from './config';

// PROJECT.md "Parameters, made visible", one field per line of its table. Attention and
// the MLP keep weights and biases apart because the ledger prints them that way:
// 4H² (+ 4H bias). Every number is a parameter count; shares and labels are the
// consumer's to derive.
export type Ledger = {
  readonly perLayer: {
    readonly attention: { readonly weights: number; readonly bias: number }; // Q, K, V, O
    readonly mlp: { readonly weights: number; readonly bias: number }; // in, out
    readonly layerNorm: number; // two per layer, each a scale and a shift
  };
  readonly embedding: number; // V · H, the unembedding is tied to it
  readonly positional: number; // nCtx · H
  readonly finalNorm: number; // 2H
  readonly total: number;
};

// [LAW:one-source-of-truth] the count is a function of the configuration and of nothing
// else, so the ledger cannot disagree with the tower drawn from the same config. The MLP
// is written in dFf rather than 4H so a shape that is not 4H wide is counted honestly;
// at dFf = 4H it is the doc's 8H² + 5H and the total is L·(12H² + 13H) + V·H + nCtx·H + 2H.
export function parameterLedger({ L, H, dFf, V, nCtx }: ModelConfig): Ledger {
  const attention = { weights: 4 * H * H, bias: 4 * H };
  const mlp = { weights: 2 * H * dFf, bias: dFf + H };
  const layerNorm = 4 * H;
  const embedding = V * H;
  const positional = nCtx * H;
  const finalNorm = 2 * H;
  const layer = attention.weights + attention.bias + mlp.weights + mlp.bias + layerNorm;
  return {
    perLayer: { attention, mlp, layerNorm },
    embedding,
    positional,
    finalNorm,
    total: L * layer + embedding + positional + finalNorm,
  };
}
