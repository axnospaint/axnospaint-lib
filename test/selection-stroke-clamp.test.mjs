import assert from 'node:assert/strict';
import test from 'node:test';

import { DrawingPenBase } from '../src/js/pendefine/_drawingpen.js';
import { PenObj } from '../src/js/pendefine/_penobj.js';
import { PixelFilterPenBase } from '../src/js/pendefine/_pixelfilterpen.js';
import { Diffusion } from '../src/js/pendefine/diffusion.js';

function makeImage(width, height, data) {
  return {
    width,
    height,
    data: new Uint8ClampedArray(data),
  };
}

function cloneImage(image) {
  return makeImage(image.width, image.height, image.data);
}

test('pen write restores pixels outside the active selection from the stroke snapshot', () => {
  const base = makeImage(2, 1, [
    10, 11, 12, 255,
    20, 21, 22, 255,
  ]);
  const painted = makeImage(2, 1, [
    110, 111, 112, 255,
    220, 221, 222, 255,
  ]);
  const selectionMask = new Uint8Array([255, 0]);
  let writtenImage = null;
  let draftImage = null;
  const pen = new PenObj();

  pen.axpObj = {
    x_size: 2,
    y_size: 1,
    lastEventInFrame: true,
    pendingPenFlush: false,
    getValidSelectionMask: () => selectionMask,
    layerSystem: {
      compositeFastPathActive: false,
      load: () => base,
      write: (image) => { writtenImage = image; },
      updateCanvas: () => {},
      getId: () => '1',
    },
  };
  pen.CANVAS = {
    brush: {},
    draw_ctx: {
      putImageData: (image) => { draftImage = cloneImage(image); },
      drawImage: () => { draftImage = cloneImage(painted); },
      getImageData: () => draftImage,
    },
  };

  pen.beginSelectionStrokeConstraint();
  pen.write();

  assert.deepEqual(Array.from(writtenImage.data), [
    110, 111, 112, 255,
    20, 21, 22, 255,
  ]);
});

test('drawing pen start disables the composite fast path while a selection is active', () => {
  class TestDrawingPen extends DrawingPenBase {
    set_modeflag() {
      this.axpObj.isDrawing = true;
    }
    init_brush() {}
    start_draw() {}
  }

  const base = makeImage(1, 1, [10, 11, 12, 255]);
  let undoBaseWrites = 0;
  const layerSystem = {
    compositeFastPathActive: false,
    isStrokeActive: false,
    isWriteProtection: () => false,
    save: () => {},
    load: () => base,
    activateFastPath: () => { layerSystem.compositeFastPathActive = true; },
    deactivateFastPath: () => { layerSystem.compositeFastPathActive = false; },
  };
  const pen = new TestDrawingPen({
    axpObj: {
      x_size: 1,
      y_size: 1,
      isDrawing: false,
      layerSystem,
      getValidSelectionMask: () => new Uint8Array([255]),
    },
    CANVAS: {
      undoBase_ctx: {
        putImageData: () => { undoBaseWrites += 1; },
      },
    },
  });

  assert.equal(pen._startCommon(0, 0, {}), true);
  assert.equal(layerSystem.compositeFastPathActive, false);
  assert.equal(undoBaseWrites, 0);
});

test('diffusion kernel leaves pixels outside the active selection unchanged', () => {
  const pen = new Diffusion({
    axpObj: {
      _: (key) => key,
      layerSystem: { getMasked: () => false },
    },
    CANVAS: {},
  });
  pen.W = 2;
  pen.H = 1;
  pen.work = makeImage(2, 1, [
    10, 0, 0, 255,
    20, 0, 0, 255,
  ]);
  pen.basePre = new Uint8ClampedArray([
    10, 0, 0, 255,
    20, 0, 0, 255,
  ]);
  pen.blurPre = new Uint8ClampedArray([
    110, 0, 0, 255,
    220, 0, 0, 255,
  ]);
  pen.mask = new Float32Array(2);
  pen.fLut = new Float32Array(512).fill(1);
  pen.dwellMs = 0;
  pen.masked = false;
  pen.selectionMaskAtStrokeStart = new Uint8Array([255, 0]);

  pen._applyDiffusion({ x: 0.5, y: 0.5 }, 2, 1, 0, 0, 1, 0);

  assert.notEqual(pen.work.data[0], 10);
  assert.equal(pen.work.data[4], 20);
});

test('diffusion drag leaves pixels outside the active selection unchanged', () => {
  const pen = new Diffusion({
    axpObj: {
      _: (key) => key,
      layerSystem: { getMasked: () => false },
    },
    CANVAS: {},
  });
  pen.W = 2;
  pen.H = 1;
  pen.work = makeImage(2, 1, [
    10, 0, 0, 255,
    20, 0, 0, 255,
  ]);
  pen.basePre = new Uint8ClampedArray([
    10, 0, 0, 255,
    20, 0, 0, 255,
  ]);
  pen.fLut = new Float32Array(512).fill(1);
  pen.adLut = new Float32Array(512);
  pen.drag = 100;
  pen.masked = false;
  pen.selectionMaskAtStrokeStart = new Uint8Array([255, 0]);
  pen.carriedR = 1;
  pen.carriedD = 3;
  pen.carried = new Float32Array(3 * 3 * 4);
  for (let offset = 0; offset < pen.carried.length; offset += 4) {
    pen.carried[offset] = 200;
    pen.carried[offset + 3] = 255;
  }

  pen._applyDrag({ x: 0.5, y: 0.5 }, 2, 1, 1, 0, 0, 1, 0);

  assert.notEqual(pen.work.data[0], 10);
  assert.equal(pen.work.data[4], 20);
});

test('diffusion drag carries colors from the full initial footprint across selection edges', () => {
  const pen = new Diffusion({
    axpObj: {
      _: (key) => key,
      layerSystem: { getMasked: () => false },
    },
    CANVAS: {},
  });
  pen.W = 3;
  pen.H = 1;
  pen.work = makeImage(3, 1, [
    10, 0, 0, 255,
    200, 0, 0, 255,
    30, 0, 0, 255,
  ]);
  pen.basePre = new Uint8ClampedArray(pen.work.data);
  pen.fLut = new Float32Array(512).fill(1);
  pen.adLut = new Float32Array(512);
  pen.drag = 100;
  pen.masked = false;
  pen.selectionMaskAtStrokeStart = new Uint8Array([0, 255, 0]);

  pen._applyDrag({ x: 0.5, y: 0.5 }, 1, 1, 1, 0, 0, 2, 0);
  pen._applyDrag({ x: 1.5, y: 0.5 }, 1, 1, 1, 0, 0, 2, 0);

  assert.equal(pen.work.data[7], 255);
});

test('pixel filter pen write clamps any subclass changes to the active selection', () => {
  const base = makeImage(2, 1, [
    10, 0, 0, 255,
    20, 0, 0, 255,
  ]);
  const pen = new PixelFilterPenBase({
    axpObj: {
      lastEventInFrame: true,
      pendingPenFlush: false,
      layerSystem: {
        updateCanvas: () => {},
        getId: () => '1',
      },
    },
    CANVAS: {},
  });
  pen.selectionMaskAtStrokeStart = new Uint8Array([255, 0]);
  pen.selectionBaseImage = base;
  pen.work = makeImage(2, 1, [
    110, 0, 0, 255,
    220, 0, 0, 255,
  ]);

  pen.write();

  assert.deepEqual(Array.from(pen.work.data), [
    110, 0, 0, 255,
    20, 0, 0, 255,
  ]);
});
