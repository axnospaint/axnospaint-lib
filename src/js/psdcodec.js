import * as agPsd from 'ag-psd';
import { hasActiveLayerStyle, applyLayerStyle } from './layerstyle.js';
import { hasActiveMask, applyLayerMask } from './layermask.js';
import { validateReferenceMetadata } from './referenceimage.js';

const { readPsd, writePsdUint8Array } = agPsd;

export const CANVAS_BLEND_MODES = Object.freeze([
  'source-over',
  'source-atop',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
]);

const PSD_BLEND_MODE_MAP = Object.freeze({
  'source-over': 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color dodge',
  'color-burn': 'color burn',
  'hard-light': 'hard light',
  'soft-light': 'soft light',
  difference: 'difference',
  exclusion: 'exclusion',
});

function getDataView(buffer) {
  if (buffer instanceof ArrayBuffer) {
    return new DataView(buffer);
  }
  if (ArrayBuffer.isView(buffer)) {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  throw new Error('invalid-psd-buffer');
}

function clonePixelData(imageData) {
  return {
    width: imageData.width,
    height: imageData.height,
    data: new Uint8ClampedArray(imageData.data),
  };
}

function createCanvasFromPixelData(pixelData, documentRef = globalThis.document) {
  if (!documentRef?.createElement) {
    throw new Error('canvas-unavailable');
  }
  const canvas = documentRef.createElement('canvas');
  canvas.width = pixelData.width;
  canvas.height = pixelData.height;
  const context = canvas.getContext('2d');
  const imageData = new ImageData(
    new Uint8ClampedArray(pixelData.data),
    pixelData.width,
    pixelData.height,
  );
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function getCompositePixelData(layerSystem) {
  const transparentContext = layerSystem.CANVAS?.backscreen_trans_ctx;
  if (transparentContext) {
    return transparentContext.getImageData(0, 0, layerSystem.axpObj.x_size, layerSystem.axpObj.y_size);
  }
  return layerSystem.getCanvasImage();
}

export function mapBlendMode(canvasMode) {
  if (canvasMode === 'source-atop') {
    return { mode: 'normal', supported: true, clipping: true };
  }
  const mode = PSD_BLEND_MODE_MAP[canvasMode];
  if (mode) {
    return { mode, supported: true };
  }
  return { mode: 'normal', supported: false };
}

export function collectUnsupportedBlendLayers(layerObj) {
  return layerObj
    .map((layer, index) => ({ layer, name: layer.name || `Layer ${index + 1}` }))
    .filter(({ layer }) => !mapBlendMode(layer.mode).supported)
    .map(({ name }) => name);
}

export function axnosOpacityToPsd(alpha) {
  const clamped = Math.max(0, Math.min(100, Number(alpha) || 0));
  return clamped / 100;
}

export function rasterizeLayerImage(layer) {
  let image = layer.image;
  if (hasActiveMask(layer.mask)) {
    image = applyLayerMask(image, layer.mask.image);
  }
  if (hasActiveLayerStyle(layer.layerStyle)) {
    image = applyLayerStyle(image, layer.layerStyle, image.width, image.height);
  }
  return clonePixelData(image);
}

export function buildPsdLayers(layerObj) {
  return layerObj.map((layer, index) => {
    const blend = mapBlendMode(layer.mode);
    return {
      name: layer.name || `Layer ${index + 1}`,
      top: 0,
      left: 0,
      blendMode: blend.mode,
      opacity: axnosOpacityToPsd(layer.alpha),
      hidden: layer.checked === false,
      clipping: Boolean(blend.clipping),
      imageData: rasterizeLayerImage(layer),
    };
  });
}

export function createPsdDocument(layerSystem) {
  const width = layerSystem.axpObj?.x_size ?? layerSystem.x_size;
  const height = layerSystem.axpObj?.y_size ?? layerSystem.y_size;
  return {
    width,
    height,
    imageData: clonePixelData(getCompositePixelData(layerSystem)),
    children: buildPsdLayers(layerSystem.layerObj),
  };
}

export function exportPsd(layerSystem, deps = {}) {
  const writePsd = deps.writePsdUint8Array || writePsdUint8Array;
  return writePsd(createPsdDocument(layerSystem), { generateThumbnail: false });
}

export function parsePsdHeader(buffer, fileSize = null) {
  const view = getDataView(buffer);
  if (view.byteLength < 26) throw new Error('invalid-psd-header');
  const signature = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );
  if (signature !== '8BPS') throw new Error('invalid-psd-signature');
  const version = view.getUint16(4);
  if (version !== 1) throw new Error('unsupported-psd-version');

  const channels = view.getUint16(12);
  const height = view.getUint32(14);
  const width = view.getUint32(18);
  const depth = view.getUint16(22);
  const colorMode = view.getUint16(24);
  const validation = validateReferenceMetadata({
    size: fileSize ?? view.byteLength,
    width,
    height,
  });
  if (!validation.ok) throw new Error(validation.code);
  if (depth !== 8) throw new Error('unsupported-psd-depth');
  if (colorMode !== 3) throw new Error('unsupported-psd-color-mode');

  return { width, height, channels, depth, colorMode };
}

export function validatePsdReferenceFileHeader(fileSize, headerBuffer) {
  return parsePsdHeader(headerBuffer, fileSize);
}

export async function decodePsdReference(buffer, deps = {}) {
  const header = parsePsdHeader(buffer);
  const read = deps.readPsd || readPsd;
  const psd = read(buffer, { skipLayerImageData: true, skipThumbnail: true });
  const source = psd.canvas
    || (psd.imageData ? createCanvasFromPixelData(psd.imageData, deps.document) : null);
  if (!source) throw new Error('missing-psd-composite');
  const createBitmap = deps.createBitmap || globalThis.createImageBitmap;
  const bitmap = typeof createBitmap === 'function'
    ? await createBitmap(source)
    : source;
  delete psd.children;
  delete psd.canvas;
  delete psd.imageData;
  return {
    bitmap,
    width: header.width,
    height: header.height,
  };
}
