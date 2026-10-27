// Coordinates of the uninterrupted pane in the aligned v4 photographs.
export const GLASS_IMAGE = { width: 1672, height: 941 };
export const GLASS_PANE = { left: 140, top: 82, right: 1544, bottom: 804 };

// Straight upper rubber contact edge of the through-glass v6 tool photograph.
export const SQUEEGEE_ART = { size: 1254, left: 19, right: 1236, edgeY: 351 };

export function diagonalGlassStroke(width: number, height: number, progress: number) {
  const angle = -24 * Math.PI / 180;
  const along = { x: Math.cos(angle), y: Math.sin(angle) };
  const pull = { x: -along.y, y: along.x };
  const blade = Math.min(width * 0.52, height * 0.62);
  const half = blade / 2;
  // Start near the upper glass edge; the handle and gathered foam sit below.
  const start = { x: width * 0.36, y: height * 0.035 + Math.abs(along.y) * half };
  const distance = Math.max(0, Math.min(
    height * 0.7,
    (width - 12 - start.x - along.x * half) / pull.x,
    (height - 12 - start.y - Math.abs(along.y) * half) / pull.y,
  ));
  const clamped = Math.max(0, Math.min(1, progress));
  // Direct scrubbing: even the first scroll movement pulls the blade down.
  const t = clamped;
  const center = { x: start.x + pull.x * distance * t, y: start.y + pull.y * distance * t };
  const edge = (point: { x: number; y: number }, side: number) => ({
    x: point.x + along.x * half * side, y: point.y + along.y * half * side,
  });
  // A few millimetres of cleared glass expose the wet rubber's upper edge;
  // the bank of gathered foam covers the rest on the advancing side.
  const wipeCenter = { x: center.x + pull.x * 4, y: center.y + pull.y * 4 };
  const corners = [edge(start, -1), edge(start, 1), edge(wipeCenter, 1), edge(wipeCenter, -1)];
  const hole = [...corners, corners[0]].map((point) => `${point.x.toFixed(2)}px ${point.y.toFixed(2)}px`).join(', ');
  return {
    x: center.x, y: center.y, blade, corners, start, distance,
    spriteSize: blade / ((SQUEEGEE_ART.right - SQUEEGEE_ART.left) / SQUEEGEE_ART.size),
    // Even-odd winding leaves a transparent hole only in the swept central band.
    foamClip: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${hole})`,
  };
}

export function fitGlassPane(width: number, height: number) {
  const scale = Math.max(width / GLASS_IMAGE.width, height / GLASS_IMAGE.height);
  const imageWidth = GLASS_IMAGE.width * scale;
  const imageHeight = GLASS_IMAGE.height * scale;
  const imageLeft = (width - imageWidth) / 2;
  const imageTop = (height - imageHeight) / 2;
  const left = Math.max(0, imageLeft + GLASS_PANE.left * scale);
  const top = Math.max(0, imageTop + GLASS_PANE.top * scale);
  const right = Math.min(width, imageLeft + GLASS_PANE.right * scale);
  const bottom = Math.min(height, imageTop + GLASS_PANE.bottom * scale);
  return {
    left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top),
    imageLeft: imageLeft - left, imageTop: imageTop - top, imageWidth, imageHeight,
  };
}

export type FluidDrop = { x: number; y: number; radius: number; velocity: number; age: number };
export type GlassFluidState = {
  progress: number | null; collected: number; travel: number;
  sequence: number; drops: FluidDrop[];
};
export type FluidFrame = {
  width: number; height: number; progress: number;
  pane: ReturnType<typeof fitGlassPane>;
};
export function newGlassFluidState(): GlassFluidState {
  return { progress: null, collected: .12, travel: 0, sequence: 0, drops: [] };
}

/** Drops are emitted by forward blade travel, never by a repeating timer.
 * Reverse scrubbing discards the old runoff; the simulation is bounded. */
export function advanceGlassFluid(state: GlassFluidState, frame: FluidFrame, seconds: number) {
  const dt = Math.max(0, Math.min(seconds, .05));
  const stroke = diagonalGlassStroke(frame.width, frame.height, frame.progress);
  const change = state.progress === null ? 0 : frame.progress - state.progress;
  if (change < -.001) {
    state.drops.length = 0;
    state.travel = 0;
    state.collected = .12 + frame.progress * .45;
  }
  if (change > 0) {
    const travel = change * stroke.distance;
    state.collected = Math.min(1, state.collected + travel * .006);
    state.travel += travel;
    const interval = Math.max(14, stroke.blade * .065);
    let emitted = 0;
    while (state.travel >= interval && emitted < 2 && state.drops.length < 8) {
      state.travel -= interval;
      const position = ((state.sequence++ * .61803398875 + .19) % 1 - .5) * stroke.blade * .86;
      const angle = -24 * Math.PI / 180;
      state.drops.push({
        x: stroke.x + Math.cos(angle) * position,
        y: stroke.y + Math.sin(angle) * position + 9,
        radius: 1.5 + (state.sequence % 4) * .35,
        velocity: 18 + state.sequence % 9,
        age: 0,
      });
      emitted++;
      state.collected = Math.max(.12, state.collected - .035);
    }
    state.travel = Math.min(state.travel, interval);
  }
  state.progress = frame.progress;
  state.collected = Math.max(.12, state.collected - dt * .055);
  for (const drop of state.drops) {
    drop.velocity += 420 * dt;
    drop.y += drop.velocity * dt;
    drop.age += dt;
  }
  state.drops = state.drops.filter((drop) => drop.age < 1.6 && drop.y < frame.height + 12);
  return stroke;
}
