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
// that takes a ModelConfig knows every dimension is a positive integer and H divides by
// heads without asking, and reads dHead instead of dividing again.
export type ModelConfig = ModelShape & { readonly dHead: number; readonly [configured]: true };

// [LAW:single-enforcer] the shape's invariants are checked here and nowhere else. The
// config is rebuilt from the six named fields so a wider object (a checkpoint header)
// leaves nothing extra inside the one configuration.
export function modelConfig({ L, H, heads, dFf, V, nCtx }: ModelShape): ModelConfig {
  for (const [name, value] of Object.entries({ L, H, heads, dFf, V, nCtx })) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${name}=${value} is not a positive integer`);
    }
  }
  if (H % heads !== 0) {
    throw new Error(`H=${H} is not divisible by heads=${heads}`);
  }
  const config: ModelShape & { dHead: number } = { L, H, heads, dFf, V, nCtx, dHead: H / heads };
  return config as ModelConfig;
}

// Every GPT-2 head is 64 wide, so the family is fixed by L and H alone: heads is H / 64.
export const gpt2HeadWidth = 64;

// [LAW:one-type-per-behavior] the GPT-2 family differs only in L and H; the rest of the
// shape is shared by every member. An H that is not a whole number of heads fails in
// modelConfig, the single enforcer, as a non-integer head count.
export function gpt2(L: number, H: number): ModelConfig {
  return modelConfig({ L, H, heads: H / gpt2HeadWidth, dFf: 4 * H, V: 50257, nCtx: 1024 });
}

// Presets the ledger anchors to (PROJECT.md "The what-if ledger"). Only small runs live;
// the others shape the tower and fill the ledger.
export const presets = {
  'GPT-2 small': gpt2(12, 768),
  'GPT-2 medium': gpt2(24, 1024),
  'GPT-2 large': gpt2(36, 1280),
  'GPT-2 XL': gpt2(48, 1600),
} as const satisfies Record<string, ModelConfig>;

export type PresetName = keyof typeof presets;
