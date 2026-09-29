// [LAW:nothing-unseen] one wide event per unit of work. Boot is the unit every run of the
// page passes through, so it is the first instrument and the substrate later units join.
export type RendererDescriptor =
  | { kind: 'webgpu'; adapter: string }
  | { kind: 'unavailable'; reason: string };

export type BootEvent = {
  kind: 'boot';
  renderer: RendererDescriptor;
  duration_ms: number;
};

export type AppEvent = BootEvent;

export type Telemetry = { emit(event: AppEvent): void };

declare global {
  interface Window {
    llmviz: { readonly events: readonly AppEvent[] };
  }
}

// [LAW:no-shared-mutable-globals] the record has one owner (this module); the window
// handle is a read-only view so tests and devtools can read what was emitted.
// [LAW:one-source-of-truth] the log line is derived from the record, never the reverse.
export function createTelemetry(win: Window, log: (line: string) => void): Telemetry {
  const events: AppEvent[] = [];
  win.llmviz = { events };
  return {
    emit(event) {
      events.push(event);
      log(JSON.stringify(event));
    },
  };
}
