import { test as base, expect, type Page } from '@playwright/test';
import type { BootEvent } from '../src/telemetry';

declare global {
  interface Window {
    // Present only after recordCanvasContexts(page) installed the recorder.
    canvasContexts?: string[];
  }
}

// [LAW:single-enforcer] "the console is clean" is asserted here, once, for every test that
// uses this `test`; no spec repeats it.
export const test = base.extend<{ cleanConsole: void }>({
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
});

export { expect };

// One round-trip: polls until the boot event exists and returns it, so a Vite full reload
// between "it exists" and "read it" cannot strand the read on a destroyed context.
export async function bootEvent(page: Page): Promise<BootEvent> {
  const handle = await page.waitForFunction(
    () => ('llmviz' in window ? (window.llmviz.events.find((e) => e.kind === 'boot') ?? null) : null),
  );
  const boot = await handle.jsonValue();
  if (boot === null) throw new Error('waitForFunction resolved without a boot event');
  return boot;
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
