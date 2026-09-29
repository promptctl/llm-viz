import { errorMessage } from './errors';

// [LAW:parse-dont-validate] the one unit that asks the browser for WebGPU. Its output type
// is the proof: everything downstream takes a GPUDevice and never checks again, and the
// unavailable arm carries the exact reason the page will show.
export type Gpu =
  | { kind: 'ready'; device: GPUDevice; adapter: string }
  | { kind: 'unavailable'; reason: string };

// [LAW:one-source-of-truth] what the status line and the boot event say about the GPU is
// the probe's result minus the device handle — derived, so a new arm on Gpu is a new arm here.
export type GpuDescriptor =
  | Omit<Extract<Gpu, { kind: 'ready' }>, 'device'>
  | Extract<Gpu, { kind: 'unavailable' }>;

export async function probeGpu(nav: Navigator): Promise<Gpu> {
  const gpu: GPU | undefined = nav.gpu;
  if (gpu === undefined) {
    return { kind: 'unavailable', reason: 'this browser exposes no navigator.gpu' };
  }
  const adapter = await gpu.requestAdapter();
  if (adapter === null) {
    return { kind: 'unavailable', reason: 'navigator.gpu.requestAdapter() returned no adapter' };
  }
  try {
    // Mirror three's own device request: every feature the adapter offers, so later slices
    // (timestamp-query for frame timing, float32-filterable) find them enabled. The spec
    // guarantees the set holds only GPUFeatureName values; the DOM typing widens it to string.
    const requiredFeatures = [...adapter.features] as GPUFeatureName[];
    const device = await adapter.requestDevice({ requiredFeatures });
    return { kind: 'ready', device, adapter: describeAdapter(adapter.info) };
  } catch (error) {
    return { kind: 'unavailable', reason: `adapter.requestDevice() failed: ${errorMessage(error)}` };
  }
}

function describeAdapter(info: GPUAdapterInfo): string {
  return [info.vendor, info.architecture, info.description].filter((s) => s !== '').join('/');
}
