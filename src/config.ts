// [LAW:one-source-of-truth] the model's shape lives in this one structure (PROJECT.md
// "Principles": one configuration). Geometry, labels, the ledger and a loaded checkpoint
// derive from a ModelConfig or are checked against it; none keeps a shape of its own.
export type ModelShape = {
  readonly L: number; // layers
  readonly H: number; // hidden width, the residual stream's lane count
  readonly heads: number;
  readonly dFf: number; // MLP inner width, 4H in GPT-2
  readonly V: number; // vocabulary
  readonly nCtx: number; // context length, the positional table's height
};

declare const configured: unique symbol;

// [LAW:parse-dont-validate] the stamp. Only modelConfig() produces one, so a consumer
// that takes a ModelConfig knows H divides by heads without asking, and reads dHead
// instead of dividing again.
export type ModelConfig = ModelShape & { readonly dHead: number; readonly [configured]: true };

// [LAW:single-enforcer] H divisible by heads is checked here and nowhere else.
export function modelConfig(shape: ModelShape): ModelConfig {
  if (shape.H % shape.heads !== 0) {
    throw new Error(`H=${shape.H} is not divisible by heads=${shape.heads}`);
  }
  return { ...shape, dHead: shape.H / shape.heads } as ModelConfig;
}

// [LAW:one-type-per-behavior] the GPT-2 family differs only in L, H and heads; the rest
// of the shape is shared by every member.
function gpt2(L: number, H: number, heads: number): ModelConfig {
  return modelConfig({ L, H, heads, dFf: 4 * H, V: 50257, nCtx: 1024 });
}

// Presets the ledger anchors to (PROJECT.md "The what-if ledger"). Only small runs live;
// the others shape the tower and fill the ledger.
export const presets = {
  'GPT-2 small': gpt2(12, 768, 12),
  'GPT-2 medium': gpt2(24, 1024, 16),
  'GPT-2 large': gpt2(36, 1280, 20),
  'GPT-2 XL': gpt2(48, 1600, 25),
} as const satisfies Record<string, ModelConfig>;

export type PresetName = keyof typeof presets;
