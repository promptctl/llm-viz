// [LAW:effects-at-boundaries] the edge: the only module that touches document, window,
// navigator and console. Everything it calls takes those as values.
import { presets, type ModelConfig, type PresetName } from './config';
import { errorMessage } from './errors';
import { probeGpu, type Gpu, type GpuDescriptor } from './gpu';
import { parameterLedger } from './ledger';
import { darkStage, mountStage, type Stage, type StageOptions, type Viewport } from './scene';
import { sliderConfig, sliderEnvelope, sliderRange, type Range } from './sliders';
import { createTelemetry } from './telemetry';
import { towerShape } from './tower';

// How long the tower takes to reach a new shape (PROJECT.md "Interaction": a smooth
// transition so the eye can track what grew).
const transitionMs = 400;

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

type Mounted = { renderer: GpuDescriptor; stage: Stage };

// [LAW:dataflow-not-control-flow] every outcome of mounting — including the renderer refusing
// to come up — is a value the status line and the boot event carry, and every outcome hands
// back a stage the sliders drive; nothing throws past here.
async function mount(gpu: Gpu, canvas: HTMLCanvasElement, win: Window, options: StageOptions): Promise<Mounted> {
  switch (gpu.kind) {
    case 'ready': {
      try {
        const stage = await mountStage(gpu.device, canvas, viewport(win), options);
        win.addEventListener('resize', () => stage.resize(viewport(win)));
        return { renderer: { kind: 'ready', adapter: gpu.adapter }, stage };
      } catch (error) {
        // three destroys only devices it created; this one is ours to release.
        gpu.device.destroy();
        return { renderer: { kind: 'unavailable', reason: `renderer failed to initialise: ${errorMessage(error)}` }, stage: darkStage };
      }
    }
    case 'unavailable':
      return { renderer: gpu, stage: darkStage };
  }
}

function setRange(input: HTMLInputElement, { min, max, step }: Range): void {
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
}

const telemetry = createTelemetry(window, (line) => console.info(line));
const canvas = element('canvas#stage', HTMLCanvasElement);
const status = element('p#status', HTMLParagraphElement);
const ledger = element('p#ledger', HTMLParagraphElement);
const sliders = { H: element('input[name=H]', HTMLInputElement), L: element('input[name=L]', HTMLInputElement) };
const readouts = { H: element('output[name=H]', HTMLOutputElement), L: element('output[name=L]', HTMLOutputElement) };
const count = new Intl.NumberFormat('en-US');

// [LAW:one-source-of-truth] the readouts and the ledger are drawn from the config, never
// from the sliders' own strings. Returns the total so the event carries what the page shows.
function present(config: ModelConfig): number {
  const { total } = parameterLedger(config);
  readouts.H.value = String(config.H);
  readouts.L.value = String(config.L);
  ledger.textContent = `${count.format(total)} parameters`;
  return total;
}

const started = performance.now();
const preset: PresetName = 'GPT-2 small';
const initial = presets[preset];
setRange(sliders.H, sliderRange.H);
setRange(sliders.L, sliderRange.L);
sliders.H.value = String(initial.H);
sliders.L.value = String(initial.L);
const parameters = present(initial);

const { renderer, stage } = await mount(await probeGpu(navigator), canvas, window, {
  initial: towerShape(initial),
  envelope: sliderEnvelope,
  transitionMs,
  telemetry,
});
status.textContent = statusText(renderer);
telemetry.emit({ kind: 'boot', renderer, duration_ms: performance.now() - started, preset, config: initial, parameters });

// [LAW:nothing-unseen] a slider move is a unit of work: the config it named and the ledger's
// answer land on one event. The stage's own settled event follows when the tower arrives.
function reshape(): void {
  const config = sliderConfig(sliders.H.valueAsNumber, sliders.L.valueAsNumber);
  const parameters = present(config);
  stage.reshape(towerShape(config));
  telemetry.emit({ kind: 'reshape', config, parameters });
}
sliders.H.addEventListener('input', reshape);
sliders.L.addEventListener('input', reshape);
