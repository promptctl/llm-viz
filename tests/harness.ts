import { test as base, expect, type Page } from '@playwright/test';
import type { AppEvent, BootEvent } from '../src/telemetry';

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

export async function bootEvent(page: Page): Promise<BootEvent> {
  await page.waitForFunction(() => window.llmviz.events.some((e: AppEvent) => e.kind === 'boot'));
  const events = await page.evaluate(() => window.llmviz.events);
  const boot = events.find((e): e is BootEvent => e.kind === 'boot');
  if (boot === undefined) throw new Error('boot event vanished between waitForFunction and evaluate');
  return boot;
}

// Records every canvas context the page asks for, so a test can prove which backend was
// used — and that no WebGL context was ever created.
export async function recordCanvasContexts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const requested: string[] = [];
    (window as Window & { canvasContexts?: string[] }).canvasContexts = requested;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      requested.push(String(args[0]));
      return (original as (...a: unknown[]) => unknown).apply(this, args);
    } as typeof original;
  });
}

export function canvasContexts(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as Window & { canvasContexts?: string[] }).canvasContexts ?? []);
}
