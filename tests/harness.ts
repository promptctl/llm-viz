import { test as base, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import type { AppEvent, BootEvent } from '../src/telemetry';

declare global {
  interface Window {
    // Present only after recordCanvasContexts(page) installed the recorder.
    canvasContexts?: string[];
  }
}

type Fixtures = {
  cleanConsole: void;
  // Resolves with the page's boot event. Listening starts before the test body runs, so a
  // Vite full reload mid-boot cannot lose it and no page round-trip is needed to read it.
  boot: Promise<BootEvent>;
};

export const test = base.extend<Fixtures>({
  // [LAW:single-enforcer] "the console is clean" is asserted here, once, for every test that
  // uses this `test`; no spec repeats it.
  cleanConsole: [
    async ({ page }, use) => {
      const noise: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          noise.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => noise.push(`pageerror: ${error.message}`));
      await use();
      expect(noise, 'console warnings/errors during the test').toEqual([]);
    },
    { auto: true },
  ],
  boot: async ({ page }, use) => {
    const message = page.waitForEvent('console', (m) => parseEvent(m.text())?.kind === 'boot');
    await use(message.then((m) => parseEvent(m.text()) as BootEvent));
  },
});

export { expect };

// Resolves with the next event of `kind` to reach the console. Register it before the action
// that causes the event, so the event cannot slip past between the action and the wait.
export function nextEvent<K extends AppEvent['kind']>(page: Page, kind: K): Promise<Extract<AppEvent, { kind: K }>> {
  return page
    .waitForEvent('console', (m) => parseEvent(m.text())?.kind === kind)
    .then((m) => parseEvent(m.text()) as Extract<AppEvent, { kind: K }>);
}

export type LitBounds = { pixels: number; width: number; height: number };

// Where the stage has drawn something: the count and bounding box of pixels brighter than
// the room's background, read from a screenshot of what the person sees with the DOM
// overlays hidden. A WebGPU canvas keeps nothing readable after it presents, so the
// compositor's picture is the rendered state. [LAW:behavior-not-structure]
export async function litBounds(page: Page): Promise<LitBounds> {
  const { width, height, data } = PNG.sync.read(
    await page.screenshot({ style: 'p#status, form#controls, p#ledger { visibility: hidden }' }),
  );
  let pixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // The background is #05060a; anything lit is far brighter than its 21.
      if (data[i]! + data[i + 1]! + data[i + 2]! > 60) {
        pixels++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { pixels, width: Math.max(0, maxX - minX + 1), height: Math.max(0, maxY - minY + 1) };
}
// [LAW:parse-dont-validate] telemetry's log line is JSON of an AppEvent; anything else on
// the console is not an event.
function parseEvent(text: string): AppEvent | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && 'kind' in parsed ? (parsed as AppEvent) : null;
  } catch {
    return null;
  }
}

// Records every canvas context the page asks for, so a test can prove which backend was
// used — and that no WebGL context was ever created.
export async function recordCanvasContexts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const requested: string[] = [];
    window.canvasContexts = requested;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      requested.push(String(args[0]));
      return (original as (...a: unknown[]) => unknown).apply(this, args);
    } as typeof original;
  });
}

// [LAW:no-silent-failure] a spec that forgot the recorder gets an error, not a vacuous [].
export function canvasContexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    if (window.canvasContexts === undefined) {
      throw new Error('recordCanvasContexts(page) was not called before navigation');
    }
    return window.canvasContexts;
  });
}
