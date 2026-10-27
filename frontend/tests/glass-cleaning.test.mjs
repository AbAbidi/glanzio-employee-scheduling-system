import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceGlassFluid, newGlassFluidState, diagonalGlassStroke, fitGlassPane, GLASS_IMAGE, GLASS_PANE } from '../app/lib/glass-cleaning.ts';

test('the street refraction uses the same cover geometry as the clear photograph', () => {
  for (const [width, height] of [[1280, 720], [390, 844], [1920, 900], [844, 390]]) {
    const pane = fitGlassPane(width, height);
    assert.ok(pane.left >= 0 && pane.top >= 0);
    assert.ok(pane.left + pane.width <= width + 0.001);
    assert.ok(pane.top + pane.height <= height + 0.001);
    assert.ok(pane.width > 0 && pane.height > 0);
    assert.ok(Math.abs(pane.imageWidth / pane.imageHeight - GLASS_IMAGE.width / GLASS_IMAGE.height) < 0.00001);
    const sourceTop = -pane.imageTop / (pane.imageWidth / GLASS_IMAGE.width);
    const scale = pane.imageWidth / GLASS_IMAGE.width;
    const visibleSourceTop = Math.max(GLASS_PANE.top, (GLASS_IMAGE.height - height / scale) / 2);
    assert.ok(Math.abs(sourceTop - visibleSourceTop) < 0.00001);
  }
});

const fluidFrame = (progress) => {
  const pane = fitGlassPane(1280, 720);
  return { width: pane.width, height: pane.height, pane, progress };
};

test('idle liquid does not emit endless repeating drops', () => {
  const state = newGlassFluidState();
  for (let i = 0; i < 600; i++) advanceGlassFluid(state, fluidFrame(0), 1 / 30);
  assert.equal(state.drops.length, 0);
  assert.equal(state.sequence, 0);
});

test('forward wiping collects soap and drops fall under gravity, then drain away', () => {
  const state = newGlassFluidState();
  advanceGlassFluid(state, fluidFrame(0), 0);
  advanceGlassFluid(state, fluidFrame(.4), 1 / 30);
  assert.ok(state.collected > .12);
  assert.ok(state.drops.length > 0);
  const { y, velocity } = state.drops[0];
  advanceGlassFluid(state, fluidFrame(.4), 1 / 30);
  assert.ok(state.drops[0].y > y);
  assert.ok(state.drops[0].velocity > velocity);
  const emitted = state.sequence;
  for (let i = 0; i < 90; i++) advanceGlassFluid(state, fluidFrame(.4), 1 / 30);
  assert.equal(state.drops.length, 0);
  assert.equal(state.sequence, emitted);
});

test('reverse scrubbing clears old runoff and rapid jumps keep at most eight drops', () => {
  const state = newGlassFluidState();
  advanceGlassFluid(state, fluidFrame(0), 0);
  for (let i = 1; i <= 30; i++) {
    advanceGlassFluid(state, fluidFrame(i / 30), 1 / 1000);
    assert.ok(state.drops.length <= 8);
  }
  assert.ok(state.drops.length > 0);
  advanceGlassFluid(state, fluidFrame(.2), 0);
  assert.equal(state.drops.length, 0);
  assert.equal(state.travel, 0);
});

test('the same scroll/time sequence produces the same fluid, without random input', () => {
  const first = newGlassFluidState(), second = newGlassFluidState();
  for (const progress of [0, .02, .1, .25, .3, .5, .7, .85, 1]) {
    advanceGlassFluid(first, fluidFrame(progress), 1 / 30);
    advanceGlassFluid(second, fluidFrame(progress), 1 / 30);
  }
  assert.deepEqual(first, second);
});

test('mobile wiping covers the visible glass instead of travelling off-screen first', () => {
  const pane = fitGlassPane(390, 844);
  assert.equal(pane.left, 0);
  assert.equal(pane.width, 390);
  assert.ok(pane.imageLeft < 0);
});

test('the windowsill and frame stay outside the cleaning area', () => {
  const pane = fitGlassPane(GLASS_IMAGE.width, GLASS_IMAGE.height);
  assert.equal(pane.top, GLASS_PANE.top);
  assert.equal(pane.height, GLASS_PANE.bottom - GLASS_PANE.top);
  assert.equal(pane.left, GLASS_PANE.left);
  assert.equal(pane.width, GLASS_PANE.right - GLASS_PANE.left);
  assert.ok(pane.top + pane.height < GLASS_IMAGE.height - 100);
});

test('the realistic blade sweeps a bounded central diagonal, never the whole window', () => {
  for (const [width, height] of [[1075, 553], [390, 648], [1600, 800], [844, 300]]) {
    const first = diagonalGlassStroke(width, height, 0);
    const final = diagonalGlassStroke(width, height, 1);
    assert.ok(Math.abs(Math.min(first.corners[0].y, first.corners[1].y) - height * .035) < .00001);
    assert.ok(diagonalGlassStroke(width, height, .001).y > first.y);
    assert.ok(final.x > first.x && final.y > first.y);
    assert.ok(final.blade * final.distance > width * height * 0.12);
    assert.ok(final.blade * final.distance < width * height * 0.65);
    assert.match(final.foamClip, /^polygon\(evenodd,/);
    for (const corner of final.corners) {
      assert.ok(corner.x >= 0 && corner.x <= width);
      assert.ok(corner.y >= 0 && corner.y <= height);
    }
    const midpoint = diagonalGlassStroke(width, height, .5);
    assert.ok(Math.abs(midpoint.x - (first.x + final.x) / 2) < .00001);
    assert.ok(Math.abs(midpoint.y - (first.y + final.y) / 2) < .00001);
    assert.deepEqual(diagonalGlassStroke(width, height, -.5), first);
    assert.deepEqual(diagonalGlassStroke(width, height, 2), final);
  }
});
