/// <reference lib="webworker" />

// Streamline pre-compute worker.
// Receives { frames, duration } from the main thread, traces every seed
// in SEEDS at each frame's time, and posts the resulting line-segment
// position buffers back as Transferable Float32Arrays so the main thread
// can build BufferGeometries without copying.

import { traceStreamline } from "./fieldMath";
import { SEEDS } from "./streamlineSeeds";

type Request = { frames: number; duration: number };
type Progress = { type: "progress"; current: number; total: number };
type Done = { type: "done"; buffers: Float32Array[] };

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<Request>) => {
  const { frames, duration } = e.data;
  const buffers: Float32Array[] = [];

  for (let f = 0; f < frames; f++) {
    const t = (f / frames) * duration;
    const positions: number[] = [];

    for (const [sx, sy] of SEEDS) {
      const line = traceStreamline(sx, sy, t, {
        stepSize: 0.45,
        maxSteps: 180,
        maxRadius: 56,
      });
      if (line.length < 2) continue;
      // Streamlines only render on the left half of the plot (the
      // Radiation Power / |B| panels) - the right (Density) panel in
      // the reference video has no field-line overlay. Drop any
      // segment that touches x >= 0.
      for (let i = 0; i < line.length - 1; i++) {
        const [x1, y1] = line[i];
        const [x2, y2] = line[i + 1];
        if (x1 >= 0 || x2 >= 0) continue;
        positions.push(x1, y1, 0.05, x2, y2, 0.05);
      }
    }

    buffers.push(new Float32Array(positions));

    const progress: Progress = {
      type: "progress",
      current: f + 1,
      total: frames,
    };
    self.postMessage(progress);
  }

  const done: Done = { type: "done", buffers };
  // Transfer the buffers' underlying ArrayBuffers so we don't copy ~tens of MB.
  self.postMessage(done, buffers.map((b) => b.buffer));
};

export {};
