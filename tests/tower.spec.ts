import { gpt2, presets } from '../src/config';
import { parameterLedger } from '../src/ledger';
import type { Page } from '@playwright/test';
import type { BootEvent, ReshapeEvent, TransitionEvent } from '../src/telemetry';
import { expect, litBounds, nextEvent, test, type LitBounds } from './harness';

function shown(total: number): string {
  return `${total.toLocaleString('en-US')} parameters`;
}

function settled(page: Page): Promise<TransitionEvent> {
  return nextEvent(page, 'transition', (event) => event.outcome === 'settled');
}

// Opens the page and resolves once the first tower has settled on screen.
async function open(page: Page, boot: Promise<BootEvent>): Promise<{ boot: BootEvent; settled: TransitionEvent }> {
  const first = settled(page);
  await page.goto('/');
  return { boot: await boot, settled: await first };
}

type Dragged = { reshape: ReshapeEvent; settled: TransitionEvent; lit: LitBounds };

// Moves one slider and resolves once the tower has settled at the shape it named.
async function drag(page: Page, slider: 'H' | 'L', value: number): Promise<Dragged> {
  const reshape = nextEvent(page, 'reshape');
  const arrival = settled(page);
  await page.locator(`input[name=${slider}]`).fill(String(value));
  const events = { reshape: await reshape, settled: await arrival };
  expect(events.reshape.config[slider]).toBe(value);
  expect(events.settled.to[slider]).toBe(value);
  expect(events.settled.duration_ms).toBeGreaterThanOrEqual(400);
  return { ...events, lit: await litBounds(page) };
}

function differences(values: number[]): number[] {
  return values.slice(1).map((v, i) => v - values[i]!);
}

test('boots into GPT-2 small: ledger, sliders, boot and settled events, and a lit tower', async ({ page, boot }) => {
  const events = await open(page, boot);
  expect(events.boot).toMatchObject({ preset: 'GPT-2 small', config: { L: 12, H: 768 }, parameters: 124_439_808 });
  expect(events.settled).toMatchObject({ from: { L: 12, H: 768 }, to: { L: 12, H: 768, V: 50257, nCtx: 1024 } });
  await expect(page.locator('p#ledger')).toHaveText(shown(124_439_808));
  await expect(page.locator('input[name=H]')).toHaveValue('768');
  await expect(page.locator('input[name=L]')).toHaveValue('12');
  await expect(page.locator('output[name=H]')).toHaveText('768');
  await expect(page.locator('output[name=L]')).toHaveText('12');
  expect((await litBounds(page)).pixels).toBeGreaterThan(1000);
});

test('dragging H widens the tower and the count climbs on a curve', async ({ page, boot }) => {
  await open(page, boot);
  const widths: number[] = [];
  const totals: number[] = [];
  for (const H of [512, 1024, 1536]) {
    const { reshape, lit } = await drag(page, 'H', H);
    expect(reshape).toMatchObject({ config: { H, L: 12 }, parameters: parameterLedger(gpt2(12, H)).total });
    await expect(page.locator('p#ledger')).toHaveText(shown(reshape.parameters));
    widths.push(lit.width);
    totals.push(reshape.parameters);
  }
  expect(widths[0]).toBeLessThan(widths[1]!);
  expect(widths[1]).toBeLessThan(widths[2]!);
  const [first, second] = differences(totals);
  expect(second).toBeGreaterThan(first!); // a curve: equal steps in H, growing steps in count
});

test('dragging L stacks slabs and the count climbs on a line', async ({ page, boot }) => {
  await open(page, boot);
  const heights: number[] = [];
  const totals: number[] = [];
  for (const L of [4, 16, 28]) {
    const { reshape, lit } = await drag(page, 'L', L);
    heights.push(lit.height);
    totals.push(reshape.parameters);
  }
  expect(heights[0]).toBeLessThan(heights[1]!);
  expect(heights[1]).toBeLessThan(heights[2]!);
  const [first, second] = differences(totals);
  expect(second).toBe(first); // a line: equal steps in L, equal steps in count
});

test('the smallest shape and the XL shape both render', async ({ page, boot }) => {
  await open(page, boot);
  await drag(page, 'L', 1);
  const smallest = (await drag(page, 'H', 64)).lit;
  expect(smallest.pixels).toBeGreaterThan(100);
  await expect(page.locator('p#ledger')).toHaveText(shown(parameterLedger(gpt2(1, 64)).total));

  await drag(page, 'H', 1600);
  const xl = (await drag(page, 'L', 48)).lit;
  expect(xl.pixels).toBeGreaterThan(smallest.pixels);
  await expect(page.locator('p#ledger')).toHaveText(shown(parameterLedger(presets['GPT-2 XL']).total));
});

test('a slider moved mid-transition supersedes the first transition and settles at the last shape', async ({ page, boot }) => {
  await open(page, boot);
  const superseded = nextEvent(page, 'transition', (event) => event.outcome === 'superseded');
  const arrival = settled(page);
  // Both moves are made from inside the page, 150ms apart on its own timers, so the second
  // lands mid-transition regardless of how long a round trip from the test takes.
  await page.evaluate(
    ([first, second, gapMs]) =>
      new Promise<void>((resolve) => {
        const slider = document.querySelector('input[name=L]');
        if (!(slider instanceof HTMLInputElement)) {
          throw new Error('input[name=L] is missing');
        }
        const move = (value: string) => {
          slider.value = value;
          slider.dispatchEvent(new Event('input', { bubbles: true }));
        };
        move(first);
        setTimeout(() => {
          move(second);
          resolve();
        }, gapMs);
      }),
    ['30', '20', 150] as const,
  );
  const first = await superseded;
  expect(first.to.L).toBe(30);
  expect(first.duration_ms).toBeLessThan(400);
  const last = await arrival;
  expect(last.to.L).toBe(20);
  expect(last.from.L).toBeGreaterThan(12); // it set off from partway up, not from where it started
  expect(last.from.L).toBeLessThan(30);
});

test('dragging on the canvas orbits the camera', async ({ page, boot }) => {
  await open(page, boot);
  const before = await litBounds(page);
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.down();
  await page.mouse.move(width / 2 + 200, height / 2 + 120, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => litBounds(page)).not.toEqual(before);
});
