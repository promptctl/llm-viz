import type { ModelConfig, PresetName } from './config';
import type { GpuDescriptor } from './gpu';
import type { TowerShape } from './tower';

// [LAW:nothing-unseen] one wide event per unit of work. Boot is the unit every run of the
// page passes through, so it is the first instrument and the substrate later units join.
// It explains its decisions: which preset was chosen and what the ledger made of it.
export type BootEvent = {
  kind: 'boot';
  renderer: GpuDescriptor;
  duration_ms: number;
  preset: PresetName;
  config: ModelConfig;
  parameters: number;
};

// The person moved a slider: the config that came out of it and the ledger's total.
export type ReshapeEvent = {
  kind: 'reshape';
  config: ModelConfig;
  parameters: number;
};

// The tower on screen reached a shape. duration_ms is measured on the stage's clock from
// the reshape that asked for it; for the first shape it is the time from the page's time
// origin to its first frame.
export type SettledEvent = {
  kind: 'settled';
  shape: TowerShape;
  duration_ms: number;
};

export type AppEvent = BootEvent | ReshapeEvent | SettledEvent;

export type Telemetry = { emit(event: AppEvent): void };

declare global {
  interface Window {
    llmviz: { readonly events: readonly AppEvent[] };
  }
}

// [LAW:no-shared-mutable-globals] the record has one owner (this module); the window
// handle returns a copy so tests and devtools can read what was emitted but never edit it.
// [LAW:one-source-of-truth] the log line is derived from the record, never the reverse.
export function createTelemetry(win: Window, log: (line: string) => void): Telemetry {
  const events: AppEvent[] = [];
  win.llmviz = {
    get events() {
      return events.slice();
    },
  };
  return {
    emit(event) {
      events.push(event);
      log(JSON.stringify(event));
    },
  };
}
