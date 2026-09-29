import { Color, PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu';

export type Viewport = { width: number; height: number; pixelRatio: number };

export type Stage = {
  resize(viewport: Viewport): void;
};

// The dark empty room every later slice draws into. Takes the GPUDevice the probe
// produced: handing three a device means it never requests an adapter itself, so its
// built-in WebGL2 fallback has no path to fire. [LAW:single-enforcer] WebGPU availability
// is decided in gpu.ts and nowhere else.
export async function mountStage(device: GPUDevice, canvas: HTMLCanvasElement, viewport: Viewport): Promise<Stage> {
  const renderer = new WebGPURenderer({ canvas, device, antialias: true });
  await renderer.init();
  // [LAW:no-silent-failure] three would swap in WebGL2 if its backend init threw; that must
  // never pass as a working instrument.
  const backend: object = renderer.backend;
  if (!('isWebGPUBackend' in backend && backend.isWebGPUBackend === true)) {
    renderer.dispose();
    throw new Error('WebGPURenderer initialised without a WebGPU backend');
  }

  const scene = new Scene();
  scene.background = new Color(0x05060a);
  const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 0, 10);

  const stage: Stage = {
    resize({ width, height, pixelRatio }) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
  };
  stage.resize(viewport);
  // Three's animation loop is the one timing authority for rendering.
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  return stage;
}
