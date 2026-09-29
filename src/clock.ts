// [LAW:no-ambient-temporal-coupling] one timeline. The stage's animation loop owns `now`
// (PROJECT.md "One clock"); every animated value is a function of it, and nothing keeps a
// timer of its own. Second consumer: S4's pass animation reads the same clock.
export type Clock = { readonly now: number };

export type Numbers<T> = { readonly [K in keyof T]: number };

// A record of numbers moving from one value to another along the timeline.
export type Transition<T extends Numbers<T>> = {
  readonly from: T;
  readonly to: T;
  readonly startedAt: number;
  readonly durationMs: number;
};

// [LAW:parse-dont-validate] a zero-length transition has no progress to sample; refuse it
// here so sample() never divides by zero.
export function transition<T extends Numbers<T>>(from: T, to: T, startedAt: number, durationMs: number): Transition<T> {
  if (!(durationMs > 0)) {
    throw new Error(`transition duration must be positive, got ${durationMs}`);
  }
  return { from, to, startedAt, durationMs };
}

// Over once the elapsed time reaches the duration. Elapsed is computed the one way it is
// reported, so an event's duration_ms is never a rounding error short of durationMs.
export function isOver<T extends Numbers<T>>({ startedAt, durationMs }: Transition<T>, now: number): boolean {
  return now - startedAt >= durationMs;
}

// [LAW:dataflow-not-control-flow] sampling before the start gives `from` and after the end
// gives `to`, so a settled shape is a transition that is over and the same sample() runs
// every frame. Smoothstep eases both ends; the midpoint is the exact midpoint.
export function sample<T extends Numbers<T>>({ from, to, startedAt, durationMs }: Transition<T>, now: number): T {
  const t = Math.min(1, Math.max(0, (now - startedAt) / durationMs));
  const eased = t * t * (3 - 2 * t);
  const out = {} as { [K in keyof T]: number };
  for (const key of Object.keys(from) as (keyof T)[]) {
    out[key] = from[key] + (to[key] - from[key]) * eased;
  }
  return out as T;
}
