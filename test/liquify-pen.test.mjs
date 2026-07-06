import assert from 'node:assert/strict';
import test from 'node:test';

import { Liquify } from '../src/js/pendefine/liquify.js';

function createImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = index * 5;
    data[index * 4 + 3] = 255;
  }
  return { width, height, data };
}

function createFixture({ source = createImage(5, 5) } = {}) {
  let currentImage = source;
  let savedImage = null;
  const undoEntries = [];
  let autoSaveCount = 0;
  const layerSystem = {
    currentLayer: { dataset: { id: '1' } },
    compositeFastPathActive: false,
    isStrokeActive: false,
    isWriteProtection: () => false,
    save: () => { savedImage = currentImage; },
    load: () => savedImage,
    getCurrentLayerImage: () => currentImage,
    write: (image) => { currentImage = image; },
    replaceCurrentImage: (image) => { currentImage = image; },
    activateFastPath: () => {},
    deactivateFastPath: () => {},
    updateCanvas: () => {},
    getId: () => '1',
    getIndex: () => 0,
    getMode: () => 'source-over',
    getAlpha: () => 100,
    getChecked: () => true,
    getLocked: () => false,
    getMasked: () => false,
    getName: () => 'Layer 1',
  };
  const axpObj = {
    x_size: 5,
    y_size: 5,
    isDrawing: false,
    isDrawn: false,
    isDrawCancel: false,
    isLine: false,
    isRect: false,
    isCircle: false,
    CONST: { DRAW_FREEHAND: 'freehand' },
    _: (key) => key,
    layerSystem,
    undoSystem: { setUndo: (entry) => undoEntries.push(entry) },
    saveSystem: { autoSave: () => { autoSaveCount += 1; } },
    getValidSelectionMask: () => null,
    isBackgroundimage: false,
  };
  const canvas = {
    draw_ctx: { putImageData: () => {} },
  };
  const settingsProvider = () => ({
    mode: 'push',
    radius: 2,
    strength: 1,
    hardness: 1,
  });
  const pen = new Liquify({ axpObj, CANVAS: canvas, settingsProvider });
  return {
    axpObj,
    pen,
    source,
    getCurrentImage: () => currentImage,
    getUndoEntries: () => undoEntries,
    getAutoSaveCount: () => autoSaveCount,
  };
}

test('completed stroke creates one undo entry and one autosave event', () => {
  const fixture = createFixture();

  fixture.pen.start(2, 2, { altKey: false });
  fixture.pen.move(3, 2, { altKey: false });
  fixture.pen.end(3, 2, { altKey: false });

  assert.equal(fixture.getUndoEntries().length, 1);
  assert.equal(fixture.getUndoEntries()[0].detail, 'liquify');
  assert.equal(fixture.getUndoEntries()[0].layerObj.image, fixture.source);
  assert.equal(fixture.getAutoSaveCount(), 1);
  assert.equal(fixture.axpObj.layerSystem.isStrokeActive, false);
});

test('cancelled stroke restores the source without creating undo', () => {
  const fixture = createFixture();

  fixture.pen.start(2, 2, { altKey: false });
  fixture.pen.move(3, 2, { altKey: false });
  fixture.axpObj.isDrawCancel = true;
  fixture.pen.end(3, 2, { altKey: false });

  assert.deepEqual(fixture.getCurrentImage().data, fixture.source.data);
  assert.equal(fixture.getUndoEntries().length, 0);
  assert.equal(fixture.getAutoSaveCount(), 0);
});

test('out-of-canvas liquify stroke does not create undo or autosave', () => {
  const fixture = createFixture();

  fixture.pen.start(2, 2, { altKey: false });
  fixture.pen.move(-10, -10, { altKey: false });
  fixture.pen.end(-10, -10, { altKey: false });

  assert.deepEqual(fixture.getCurrentImage().data, fixture.source.data);
  assert.equal(fixture.getUndoEntries().length, 0);
  assert.equal(fixture.getAutoSaveCount(), 0);
});

test('liquify stroke with no image delta does not create undo or autosave', () => {
  const source = { width: 5, height: 5, data: new Uint8ClampedArray(5 * 5 * 4) };
  const fixture = createFixture({ source });

  fixture.pen.start(2, 2, { altKey: false });
  fixture.pen.move(3, 2, { altKey: false });
  fixture.pen.end(3, 2, { altKey: false });

  assert.deepEqual(fixture.getCurrentImage().data, source.data);
  assert.equal(fixture.getUndoEntries().length, 0);
  assert.equal(fixture.getAutoSaveCount(), 0);
});
