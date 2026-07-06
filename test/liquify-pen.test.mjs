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

function createFixture({
  source = createImage(5, 5),
  compositeFastPathActive = false,
  putImageData = () => {},
  drawFast = () => {},
} = {}) {
  let currentImage = source;
  let savedImage = null;
  const undoEntries = [];
  let autoSaveCount = 0;
  const layerSystem = {
    currentLayer: { dataset: { id: '1' } },
    compositeFastPathActive,
    isStrokeActive: false,
    isWriteProtection: () => false,
    save: () => { savedImage = currentImage; },
    load: () => savedImage,
    getCurrentLayerImage: () => currentImage,
    write: (image) => { currentImage = image; },
    replaceCurrentImage: (image) => { currentImage = image; },
    activateFastPath: () => {},
    deactivateFastPath: () => {},
    drawFast,
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
    draw_ctx: { putImageData },
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

test('multiple liquify strokes commit once when the session is finalized', () => {
  const fixture = createFixture();

  fixture.pen.start(2, 2, { altKey: false });
  fixture.pen.move(3, 2, { altKey: false });
  fixture.pen.end(3, 2, { altKey: false });
  fixture.pen.start(3, 2, { altKey: false });
  fixture.pen.move(3, 3, { altKey: false });
  fixture.pen.end(3, 3, { altKey: false });

  assert.equal(fixture.getUndoEntries().length, 0);
  assert.equal(fixture.getAutoSaveCount(), 0);
  assert.equal(fixture.axpObj.layerSystem.isStrokeActive, false);

  fixture.pen.finalizeLiquifySession();

  assert.equal(fixture.getUndoEntries().length, 1);
  assert.equal(fixture.getUndoEntries()[0].detail, 'liquify');
  assert.equal(fixture.getUndoEntries()[0].layerObj.image, fixture.source);
  assert.equal(fixture.getAutoSaveCount(), 1);
  assert.equal(fixture.axpObj.layerSystem.isStrokeActive, false);
  assert.equal(fixture.pen.session, 'idle');
  assert.notDeepEqual(fixture.getCurrentImage().data, fixture.source.data);
});

test('cancelled liquify session restores the source without creating undo', () => {
  const fixture = createFixture();

  fixture.pen.start(2, 2, { altKey: false });
  fixture.pen.move(3, 2, { altKey: false });
  fixture.pen.end(3, 2, { altKey: false });
  fixture.pen.cancelLiquifySession();

  assert.deepEqual(fixture.getCurrentImage().data, fixture.source.data);
  assert.equal(fixture.getUndoEntries().length, 0);
  assert.equal(fixture.getAutoSaveCount(), 0);
  assert.equal(fixture.pen.session, 'idle');
});

test('cancelled liquify stroke preserves earlier session changes', () => {
  const fixture = createFixture();

  fixture.pen.start(2, 2, { altKey: false });
  fixture.pen.move(3, 2, { altKey: false });
  fixture.pen.end(3, 2, { altKey: false });
  const afterFirstStroke = fixture.getCurrentImage();
  fixture.pen.start(3, 2, { altKey: false });
  fixture.pen.move(3, 3, { altKey: false });
  fixture.axpObj.isDrawCancel = true;
  fixture.pen.end(3, 3, { altKey: false });

  assert.deepEqual(fixture.getCurrentImage().data, afterFirstStroke.data);
  assert.equal(fixture.getUndoEntries().length, 0);
  assert.equal(fixture.getAutoSaveCount(), 0);

  fixture.pen.finalizeLiquifySession();

  assert.equal(fixture.getUndoEntries().length, 1);
  assert.equal(fixture.getAutoSaveCount(), 1);
});

test('liquify stroke start defers undo snapshot storage until a dirty rect exists', () => {
  const fixture = createFixture();

  fixture.pen.start(2, 2, { altKey: false });

  assert.equal(fixture.pen.strokeStartImage, null);
  assert.equal(fixture.pen.strokeStartDisplacementField, null);
});

test('fast-path liquify stroke cancel writes ImageData-compatible previews', () => {
  const OriginalImageData = globalThis.ImageData;
  class TestImageData {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  }
  globalThis.ImageData = TestImageData;
  const previewWrites = [];
  try {
    const fixture = createFixture({
      compositeFastPathActive: true,
      putImageData: (image) => {
        assert.ok(image instanceof TestImageData);
        previewWrites.push(image);
      },
    });

    fixture.pen.start(2, 2, { altKey: false });
    fixture.pen.move(3, 2, { altKey: false });
    fixture.axpObj.isDrawCancel = true;
    fixture.pen.end(3, 2, { altKey: false });

    assert.equal(fixture.axpObj.layerSystem.isStrokeActive, false);
    assert.equal(fixture.pen.isActive, false);
    assert.ok(previewWrites.length >= 3);
  } finally {
    if (OriginalImageData === undefined) {
      delete globalThis.ImageData;
    } else {
      globalThis.ImageData = OriginalImageData;
    }
  }
});

test('finalizing liquify for emergency save can defer autosave to the caller', () => {
  const fixture = createFixture();

  fixture.pen.start(2, 2, { altKey: false });
  fixture.pen.move(3, 2, { altKey: false });
  fixture.pen.end(3, 2, { altKey: false });
  const finalized = fixture.pen.finalizeLiquifySession({ autoSave: false });

  assert.equal(finalized, true);
  assert.equal(fixture.getUndoEntries().length, 1);
  assert.equal(fixture.getAutoSaveCount(), 0);
  assert.equal(fixture.pen.session, 'idle');
});

test('out-of-canvas liquify stroke does not create undo or autosave', () => {
  const fixture = createFixture();

  fixture.pen.start(2, 2, { altKey: false });
  fixture.pen.move(-10, -10, { altKey: false });
  fixture.pen.end(-10, -10, { altKey: false });
  fixture.pen.finalizeLiquifySession();

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
  fixture.pen.finalizeLiquifySession();

  assert.deepEqual(fixture.getCurrentImage().data, source.data);
  assert.equal(fixture.getUndoEntries().length, 0);
  assert.equal(fixture.getAutoSaveCount(), 0);
});
