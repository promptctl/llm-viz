import { canvasContexts, expect, recordCanvasContexts, test } from './harness';

test('draws the scene on WebGPU and reports the adapter', async ({ page, boot }) => {
  await recordCanvasContexts(page);
  await page.goto('/');
  const event = await boot;
  expect(event.renderer).toEqual({ kind: 'ready', adapter: expect.stringMatching(/\S/) });
  expect(event.duration_ms).toBeGreaterThan(0);
  await expect(page.locator('p#status')).toHaveText(/^WebGPU · \S/);
  expect(await canvasContexts(page)).toEqual(['webgpu']);
});

test('says exactly that when the browser has no navigator.gpu, and draws nothing', async ({ page, boot }) => {
  await recordCanvasContexts(page);
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined });
  });
  await page.goto('/');
  const event = await boot;
  expect(event.renderer).toEqual({ kind: 'unavailable', reason: 'this browser exposes no navigator.gpu' });
  await expect(page.locator('p#status')).toHaveText('WebGPU unavailable: this browser exposes no navigator.gpu.');
  expect(await canvasContexts(page)).toEqual([]);
});

test('says exactly that when no adapter is offered, and draws nothing', async ({ page, boot }) => {
  await recordCanvasContexts(page);
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'gpu', { get: () => ({ requestAdapter: async () => null }) });
  });
  await page.goto('/');
  const event = await boot;
  expect(event.renderer).toEqual({ kind: 'unavailable', reason: 'navigator.gpu.requestAdapter() returned no adapter' });
  await expect(page.locator('p#status')).toHaveText('WebGPU unavailable: navigator.gpu.requestAdapter() returned no adapter.');
  expect(await canvasContexts(page)).toEqual([]);
});
