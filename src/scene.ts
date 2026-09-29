import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import { isOver, sample, transition, type Transition } from './clock';
import type { Telemetry } from './telemetry';
import { forEachSlab, type Extent, type SlabKind, type TowerShape } from './tower';

export type Viewport = { width: number; height: number; pixelRatio: number };

export type Stage = {
  resize(viewport: Viewport): void;
  reshape(shape: TowerShape): void;
};

export type StageOptions = {
  initial: TowerShape;
  // The box the camera frames once; `layers` bounds the slab count, so nothing allocates later.
  envelope: Extent & { readonly layers: number };
  transitionMs: number;
  telemetry: Telemetry;
};

// [LAW:dataflow-not-control-flow] the stage main drives when WebGPU is unavailable: the same
// calls arrive and draw nothing. The status line, not this object, tells the person why.
export const darkStage: Stage = { resize() {}, reshape() {} };

// The tower is either on its way to a shape or at one. The transition is the unit of work
// the settled event closes, so the two states are the enum and nothing else branches on it.
type Motion = { kind: 'moving'; transition: Transition<TowerShape> } | { kind: 'settled'; shape: TowerShape };

function shapeAt(motion: Motion, now: number): TowerShape {
  return motion.kind === 'moving' ? sample(motion.transition, now) : motion.shape;
}

// PROJECT.md "The color language" gives the stream and the writes their colors; slabs are
// the dark rooms those lights will move through. Layers alternate two shades so the stack
// reads as slabs without a gap that would misstate the volume.
const shade = {
  embedding: new Color(0x5b3f8a),
  positional: new Color(0x3f8a6b),
  layerEven: new Color(0x2c6f93),
  layerOdd: new Color(0x245b78),
};

function shadeOf(kind: SlabKind, index: number): Color {
  switch (kind) {
    case 'embedding':
      return shade.embedding;
    case 'positional':
      return shade.positional;
    case 'layer':
      return index % 2 === 0 ? shade.layerEven : shade.layerOdd;
  }
}

// Place the camera so the envelope's bounding sphere fills the narrower field of view,
// from a raised three-quarter angle that shows top faces as well as sides. The orbit
// target sits a third of the way up: only the narrowest towers reach the envelope's top.
function frame(camera: PerspectiveCamera, envelope: Extent): Vector3 {
  const target = new Vector3(0, envelope.height / 3, 0);
  const radius = 0.5 * Math.hypot(envelope.width, envelope.height, envelope.width);
  const vertical = (camera.fov * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2);
  camera.near = distance / 100;
  camera.far = distance * 10;
  camera.position.set(0.55, 0.35, 0.76).normalize().multiplyScalar(distance).add(target);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return target;
}

// The room every later slice draws into. Takes the GPUDevice the probe produced: handing
// three a device means it never requests an adapter itself, so its built-in WebGL2 fallback
// has no path to fire. [LAW:single-enforcer] WebGPU availability is decided in gpu.ts and
// nowhere else.
export async function mountStage(
  device: GPUDevice,
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  { initial, envelope, transitionMs, telemetry }: StageOptions,
): Promise<Stage> {
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
  scene.add(new HemisphereLight(0x9fc4ff, 0x0b0c14, 1.4));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 2.2, 1.4);
  scene.add(sun);

  // [LAW:one-type-per-behavior] every slab is one instance of one box; kind and index only
  // pick its transform and shade.
  const capacity = envelope.layers + 2;
  const slabs = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ roughness: 0.55, metalness: 0.15 }), capacity);
  slabs.instanceMatrix.setUsage(DynamicDrawUsage);
  const shades = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  shades.setUsage(DynamicDrawUsage);
  slabs.instanceColor = shades;
  scene.add(slabs);

  const slab = new Object3D();
  function layout(shape: TowerShape): void {
    let count = 0;
    forEachSlab(shape, (kind, index, y, width, height, depth) => {
      slab.position.set(0, y + height / 2, 0);
      slab.scale.set(width, height, depth);
      slab.updateMatrix();
      slabs.setMatrixAt(count, slab.matrix);
      shadeOf(kind, index).toArray(shades.array, count * 3);
      count++;
    });
    slabs.count = count;
    slabs.instanceMatrix.needsUpdate = true;
    shades.needsUpdate = true;
  }

  const camera = new PerspectiveCamera(50, viewport.width / viewport.height, 1, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(frame(camera, envelope));
  controls.update();

  // [LAW:no-ambient-temporal-coupling] `now` is the animation loop's timestamp and the only
  // clock the tower moves on. The first shape is a transition already over at the origin, so
  // its settled event's duration is the time to the first frame.
  let now = 0;
  let motion: Motion = { kind: 'moving', transition: transition(initial, initial, 0, 1) };

  const stage: Stage = {
    resize({ width, height, pixelRatio }) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    reshape(shape) {
      // Starts from wherever the tower is now, so a slider dragged mid-transition never jumps.
      motion = { kind: 'moving', transition: transition(shapeAt(motion, now), shape, now, transitionMs) };
    },
  };
  stage.resize(viewport);

  renderer.setAnimationLoop((time: number) => {
    now = time;
    layout(shapeAt(motion, now));
    renderer.render(scene, camera);
    // [LAW:nothing-unseen] the transition is the unit of work; its event closes here, once,
    // on the frame that first drew the shape it was asked for.
    if (motion.kind === 'moving' && isOver(motion.transition, now)) {
      const { to, startedAt } = motion.transition;
      motion = { kind: 'settled', shape: to };
      telemetry.emit({ kind: 'settled', shape: to, duration_ms: now - startedAt });
    }
  });
  return stage;
}
