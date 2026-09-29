// [LAW:effects-at-boundaries] the edge: the only module that touches document, window,
// navigator and console. Everything it calls takes those as values.
import { probeGpu, type Gpu } from './gpu';
import { mountStage, type Viewport } from './scene';
import { createTelemetry, type RendererDescriptor } from './telemetry';

function element<T extends Element>(selector: string, kind: new () => T): T {
  const found = document.querySelector(selector);
  if (!(found instanceof kind)) {
    throw new Error(`index.html is missing ${selector}`);
  }
  return found;
}

function viewport(win: Window): Viewport {
  return { width: win.innerWidth, height: win.innerHeight, pixelRatio: win.devicePixelRatio };
}

function statusText(gpu: Gpu): string {
  switch (gpu.kind) {
    case 'ready':
      return `WebGPU · ${gpu.adapter}`;
    case 'unavailable':
      return `WebGPU unavailable: ${gpu.reason}.`;
  }
}

async function mount(gpu: Gpu, canvas: HTMLCanvasElement, win: Window): Promise<RendererDescriptor> {
  switch (gpu.kind) {
    case 'ready': {
      const stage = await mountStage(gpu.device, canvas, viewport(win));
      win.addEventListener('resize', () => stage.resize(viewport(win)));
      return { kind: 'webgpu', adapter: gpu.adapter };
    }
    case 'unavailable':
      return { kind: 'unavailable', reason: gpu.reason };
  }
}

const telemetry = createTelemetry(window, (line) => console.info(line));
const canvas = element('canvas#stage', HTMLCanvasElement);
const status = element('p#status', HTMLParagraphElement);

const started = performance.now();
const gpu = await probeGpu(navigator);
status.textContent = statusText(gpu);
const renderer = await mount(gpu, canvas, window);
telemetry.emit({ kind: 'boot', renderer, duration_ms: performance.now() - started });
