// [LAW:parse-dont-validate] the one unit that asks the browser for WebGPU. Its output type
// is the proof: everything downstream takes a GPUDevice and never checks again, and the
// unavailable arm carries the exact reason the page will show.
export type Gpu =
  | { kind: 'ready'; device: GPUDevice; adapter: string }
  | { kind: 'unavailable'; reason: string };

export async function probeGpu(nav: Navigator): Promise<Gpu> {
  const gpu: GPU | undefined = nav.gpu;
  if (gpu === undefined) {
    return { kind: 'unavailable', reason: 'this browser exposes no navigator.gpu' };
  }
  const adapter = await gpu.requestAdapter();
  if (adapter === null) {
    return { kind: 'unavailable', reason: 'navigator.gpu.requestAdapter() returned no adapter' };
  }
  const device = await adapter.requestDevice();
  return { kind: 'ready', device, adapter: describeAdapter(adapter.info) };
}

function describeAdapter(info: GPUAdapterInfo): string {
  return [info.vendor, info.architecture, info.description].filter((s) => s !== '').join('/');
}
