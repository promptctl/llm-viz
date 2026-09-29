import { describe, expect, it } from 'vitest';
import { isOver, sample, transition } from './clock';

const from = { L: 12, H: 768 };
const to = { L: 24, H: 1024 };

describe('transition', () => {
  it('refuses a duration that cannot be sampled', () => {
    expect(() => transition(from, to, 0, 0)).toThrow('transition duration must be positive, got 0');
    expect(() => transition(from, to, 0, Number.NaN)).toThrow('transition duration must be positive, got NaN');
  });

  it('holds `from` before it starts and `to` from the moment it ends', () => {
    const t = transition(from, to, 1000, 400);
    expect(sample(t, 0)).toEqual(from);
    expect(sample(t, 1000)).toEqual(from);
    expect(sample(t, 1400)).toEqual(to);
    expect(sample(t, 9999)).toEqual(to);
  });

  it('passes through the exact midpoint halfway, eased at both ends', () => {
    const t = transition(from, to, 1000, 400);
    expect(sample(t, 1200)).toEqual({ L: 18, H: 896 });
    const early = sample(t, 1100);
    const late = sample(t, 1300);
    expect(early.L - from.L).toBeLessThan(3); // slower than linear near the start
    expect(to.L - late.L).toBeLessThan(3); // and near the end
    expect(early.L - from.L).toBeCloseTo(to.L - late.L); // symmetric
  });

  it('is over exactly when its duration has elapsed', () => {
    const t = transition(from, to, 1000, 400);
    expect(isOver(t, 1399)).toBe(false);
    expect(isOver(t, 1400)).toBe(true);
  });

  it('a transition already over at the origin reads as its target on the first tick', () => {
    const t = transition(from, from, 0, 1);
    expect(isOver(t, 1)).toBe(true);
    expect(sample(t, 1)).toEqual(from);
  });
});
