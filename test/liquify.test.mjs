import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LIQUIFY_MODE,
  applyLiquifyDab,
  clampRect,
  createDisplacementField,
  renderDisplacement,
} from '../src/js/liquify.js';

const CENTER_INDEX = 12;

test('push adds the stroke vector at the brush center', () => {
  const field = createDisplacementField(5, 5);

  applyLiquifyDab(field, {
    mode: LIQUIFY_MODE.PUSH,
    x: 2,
    y: 2,
    previousX: 1,
    previousY: 2,
    radius: 2,
    strength: 1,
    hardness: 1,
    invert: false,
  });

  assert.ok(field.dx[CENTER_INDEX] > 0);
  assert.equal(field.dy[CENTER_INDEX], 0);
});

test('alt reverses push displacement', () => {
  const field = createDisplacementField(5, 5);

  applyLiquifyDab(field, {
    mode: LIQUIFY_MODE.PUSH,
    x: 2,
    y: 2,
    previousX: 1,
    previousY: 2,
    radius: 2,
    strength: 1,
    hardness: 1,
    invert: true,
  });

  assert.ok(field.dx[CENTER_INDEX] < 0);
});

test('radial modes move away from and toward the brush center', () => {
  const expand = createDisplacementField(5, 5);
  const pinch = createDisplacementField(5, 5);
  const options = {
    x: 2,
    y: 2,
    previousX: 2,
    previousY: 2,
    radius: 2,
    strength: 1,
    hardness: 1,
    invert: false,
  };

  applyLiquifyDab(expand, { ...options, mode: LIQUIFY_MODE.EXPAND });
  applyLiquifyDab(pinch, { ...options, mode: LIQUIFY_MODE.PINCH });

  assert.ok(expand.dx[13] > 0);
  assert.ok(pinch.dx[13] < 0);
});

test('side modes move perpendicular to a horizontal stroke', () => {
  const left = createDisplacementField(5, 5);
  const right = createDisplacementField(5, 5);
  const options = {
    x: 2,
    y: 2,
    previousX: 1,
    previousY: 2,
    radius: 2,
    strength: 1,
    hardness: 1,
    invert: false,
  };

  applyLiquifyDab(left, { ...options, mode: LIQUIFY_MODE.PUSH_LEFT });
  applyLiquifyDab(right, { ...options, mode: LIQUIFY_MODE.PUSH_RIGHT });

  assert.ok(left.dy[CENTER_INDEX] < 0);
  assert.ok(right.dy[CENTER_INDEX] > 0);
});

test('twirl modes move in opposite tangential directions', () => {
  const clockwise = createDisplacementField(5, 5);
  const anticlockwise = createDisplacementField(5, 5);
  const options = {
    x: 2,
    y: 2,
    previousX: 2,
    previousY: 2,
    radius: 2,
    strength: 1,
    hardness: 1,
    invert: false,
  };

  applyLiquifyDab(clockwise, { ...options, mode: LIQUIFY_MODE.TWIRL_CLOCKWISE });
  applyLiquifyDab(anticlockwise, { ...options, mode: LIQUIFY_MODE.TWIRL_ANTICLOCKWISE });

  assert.ok(clockwise.dy[13] > 0);
  assert.ok(anticlockwise.dy[13] < 0);
});

test('hardness one produces a stronger edge displacement than hardness zero', () => {
  const soft = createDisplacementField(7, 7);
  const hard = createDisplacementField(7, 7);
  const options = {
    mode: LIQUIFY_MODE.EXPAND,
    x: 3,
    y: 3,
    previousX: 3,
    previousY: 3,
    radius: 3,
    strength: 1,
    invert: false,
  };

  applyLiquifyDab(soft, { ...options, hardness: 0 });
  applyLiquifyDab(hard, { ...options, hardness: 1 });

  assert.ok(hard.dx[26] > soft.dx[26]);
});

test('dirty rectangle is clipped to the canvas', () => {
  const field = createDisplacementField(5, 4);
  const dirtyRect = applyLiquifyDab(field, {
    mode: LIQUIFY_MODE.EXPAND,
    x: 0,
    y: 0,
    previousX: 0,
    previousY: 0,
    radius: 3,
    strength: 1,
    hardness: 0.5,
    invert: false,
  });

  assert.deepEqual(dirtyRect, { x: 0, y: 0, width: 4, height: 4 });
  assert.deepEqual(clampRect({ x: -2, y: 1, width: 8, height: 9 }, 5, 4), {
    x: 0,
    y: 1,
    width: 5,
    height: 3,
  });
});

test('inverse displacement samples source pixels and preserves the source', () => {
  const source = {
    width: 3,
    height: 1,
    data: new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ]),
  };
  const original = new Uint8ClampedArray(source.data);
  const field = createDisplacementField(3, 1);
  field.dx[1] = 1;

  const result = renderDisplacement(source, field, { x: 0, y: 0, width: 3, height: 1 });

  assert.deepEqual([...result.data.slice(4, 8)], [255, 0, 0, 255]);
  assert.deepEqual(source.data, original);
});

test('selection mask prevents output changes outside the selection', () => {
  const source = {
    width: 3,
    height: 1,
    data: new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ]),
  };
  const field = createDisplacementField(3, 1);
  field.dx[1] = 1;

  const result = renderDisplacement(
    source,
    field,
    { x: 0, y: 0, width: 3, height: 1 },
    new Uint8ClampedArray([0, 0, 0]),
  );

  assert.deepEqual(result.data, source.data);
});
