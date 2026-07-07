import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/js/window_makecolor.js', import.meta.url), 'utf8');

function loadWetPaletteHelpers() {
  const start = source.indexOf('export const WET_PALETTE_STORAGE_KEY');
  const end = source.indexOf('// カラー作成制御オブジェクト');
  assert.notEqual(start, -1, 'wet palette storage helpers must be exported before ColorMakerSystem');
  assert.ok(end > start, 'wet palette storage helpers must stay before ColorMakerSystem');

  const helperSource = source.slice(start, end).replaceAll('export ', '');
  const context = { helpers: null };
  vm.runInNewContext(`${helperSource}
helpers = {
  WET_PALETTE_STORAGE_KEY,
  isValidWetPaletteDataUrl,
  serializeWetPaletteCanvas,
  saveWetPaletteSnapshot,
  clearWetPaletteSnapshot,
};`, context);
  return context.helpers;
}

function loadWetPaletteMethodInstance() {
  const helperStart = source.indexOf('export const WET_PALETTE_STORAGE_KEY');
  const helperEnd = source.indexOf('// カラー作成制御オブジェクト');
  const methodStart = source.indexOf('    _saveWetPaletteSnapshot() {');
  const methodEnd = source.indexOf('    // 他システムが参照する色', methodStart);
  assert.notEqual(helperStart, -1);
  assert.ok(helperEnd > helperStart);
  assert.notEqual(methodStart, -1);
  assert.ok(methodEnd > methodStart);

  const helperSource = source.slice(helperStart, helperEnd).replaceAll('export ', '');
  const methodSource = source
    .slice(methodStart, methodEnd)
    .replace(/^    /gm, '')
    .replace(/\n(?=_[A-Za-z].*\(\) \{)/g, ',\n');
  const context = {
    calls: [],
    images: [],
    instance: null,
    localStorage: {
      getItem() {
        return 'data:image/png;base64,old';
      },
      setItem() {},
      removeItem() {},
    },
  };
  context.Image = class FakeImage {
    constructor() {
      context.images.push(this);
    }
    set src(value) {
      this.value = value;
    }
  };
  vm.runInNewContext(`${helperSource}
const wetPaletteMethods = {
${methodSource}
};
instance = {
  ...wetPaletteMethods,
  wetPaletteCanvas: {
    width: 2,
    height: 2,
    toDataURL() {
      return 'data:image/png;base64,new';
    },
  },
  wetPaletteCtx: {
    clearRect() {
      calls.push('clear');
    },
    drawImage() {
      calls.push('draw');
    },
  },
};`, context);
  return context;
}

test('wet palette storage helpers serialize only valid canvas snapshots', () => {
  const { isValidWetPaletteDataUrl, serializeWetPaletteCanvas } = loadWetPaletteHelpers();

  assert.equal(isValidWetPaletteDataUrl('data:image/png;base64,abc123'), true);
  assert.equal(isValidWetPaletteDataUrl('data:text/plain;base64,abc123'), false);
  assert.equal(isValidWetPaletteDataUrl(''), false);
  assert.equal(isValidWetPaletteDataUrl(null), false);
  assert.equal(
    serializeWetPaletteCanvas({ toDataURL: () => 'data:image/png;base64,abc123' }),
    'data:image/png;base64,abc123',
  );
  assert.equal(serializeWetPaletteCanvas({ toDataURL: () => { throw new Error('blocked'); } }), null);
});

test('wet palette storage helpers never throw when persistence is unavailable', () => {
  const {
    WET_PALETTE_STORAGE_KEY,
    saveWetPaletteSnapshot,
    clearWetPaletteSnapshot,
  } = loadWetPaletteHelpers();
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
    removeItem(key) {
      writes.push([key, null]);
    },
  };

  assert.equal(
    saveWetPaletteSnapshot(storage, { toDataURL: () => 'data:image/png;base64,abc123' }),
    true,
  );
  assert.deepEqual(writes.at(-1), [WET_PALETTE_STORAGE_KEY, 'data:image/png;base64,abc123']);
  assert.equal(clearWetPaletteSnapshot(storage), true);
  assert.deepEqual(writes.at(-1), [WET_PALETTE_STORAGE_KEY, null]);

  assert.doesNotThrow(() => saveWetPaletteSnapshot({
    setItem() {
      throw new Error('quota');
    },
  }, { toDataURL: () => 'data:image/png;base64,abc123' }));
  assert.doesNotThrow(() => clearWetPaletteSnapshot({
    removeItem() {
      throw new Error('blocked');
    },
  }));
});

test('wet palette restore ignores stale image loads after the palette is cleared', () => {
  const context = loadWetPaletteMethodInstance();

  context.instance._restoreWetPaletteSnapshot();
  assert.equal(context.images.length, 1);
  context.instance._clearWetPaletteSnapshot();
  context.images[0].onload();

  assert.deepEqual(context.calls, []);
});
