// [LAW:effects-at-boundaries] the edge: the only module that touches document, window,
// navigator and console. Everything it calls takes those as values.
import { errorMessage } from './errors';
import { probeGpu, type Gpu, type GpuDescriptor } from './gpu';
import { mountStage, type Viewport } from './scene';
import { createTelemetry } from './telemetry';

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

function statusText(gpu: GpuDescriptor): string {
  switch (gpu.kind) {
    case 'ready':
      return `WebGPU · ${gpu.adapter}`;
    case 'unavailable':
      return `WebGPU unavailable: ${gpu.reason}.`;
  }
}

// [LAW:dataflow-not-control-flow] every outcome of mounting — including the renderer refusing
// to come up — is a value the status line and the boot event carry; nothing throws past here.
async function mount(gpu: Gpu, canvas: HTMLCanvasElement, win: Window): Promise<GpuDescriptor> {
  switch (gpu.kind) {
    case 'ready': {
      try {
        const stage = await mountStage(gpu.device, canvas, viewport(win));
        win.addEventListener('resize', () => stage.resize(viewport(win)));
        return { kind: 'ready', adapter: gpu.adapter };
      } catch (error) {
        return { kind: 'unavailable', reason: `renderer failed to initialise: ${errorMessage(error)}` };
      }
    }
    case 'unavailable':
      return gpu;
  }
}

const telemetry = createTelemetry(window, (line) => console.info(line));
const canvas = element('canvas#stage', HTMLCanvasElement);
const status = element('p#status', HTMLParagraphElement);

const started = performance.now();
const renderer = await mount(await probeGpu(navigator), canvas, window);
status.textContent = statusText(renderer);
telemetry.emit({ kind: 'boot', renderer, duration_ms: performance.now() - started });
