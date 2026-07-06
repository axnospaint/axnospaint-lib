import { PenObj } from './_penobj.js';
import { UTIL } from '../etc.js';
import {
  LIQUIFY_MODE,
  applyLiquifyDab,
  clampRect,
  createDisplacementField,
  renderDisplacement,
} from '../liquify.js';

const DEFAULT_SIZE = 40;
const DEFAULT_SIZE_INDEX = 78;
const DEFAULT_STRENGTH = 50;
const DEFAULT_HARDNESS = 50;
const PERCENT_SCALE = 100;

function cloneImageData(image) {
  const data = new Uint8ClampedArray(image.data);
  if (typeof ImageData === 'function') {
    return new ImageData(data, image.width, image.height);
  }
  return { data, width: image.width, height: image.height };
}

function isEmptyRect(rect) {
  return !rect || rect.width <= 0 || rect.height <= 0;
}

function createLiquifyDirtyRect(x, y, radius, width, height) {
  const effectiveRadius = Math.max(1, Number(radius) || 1);
  return clampRect({
    x: x - effectiveRadius,
    y: y - effectiveRadius,
    width: effectiveRadius * 2 + 1,
    height: effectiveRadius * 2 + 1,
  }, width, height);
}

function unionRects(first, second) {
  const left = Math.min(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const right = Math.max(first.x + first.width, second.x + second.width);
  const bottom = Math.max(first.y + first.height, second.y + second.height);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function rectContains(container, candidate) {
  return candidate.x >= container.x &&
    candidate.y >= container.y &&
    candidate.x + candidate.width <= container.x + container.width &&
    candidate.y + candidate.height <= container.y + container.height;
}

function copyImageRect(image, rect) {
  const rowLength = rect.width * 4;
  const data = new Uint8ClampedArray(rowLength * rect.height);
  for (let row = 0; row < rect.height; row += 1) {
    const sourceStart = ((rect.y + row) * image.width + rect.x) * 4;
    const targetStart = row * rowLength;
    data.set(image.data.subarray(sourceStart, sourceStart + rowLength), targetStart);
  }
  return data;
}

function copyFieldRect(field, rect, key) {
  const data = new Float32Array(rect.width * rect.height);
  for (let row = 0; row < rect.height; row += 1) {
    const sourceStart = (rect.y + row) * field.width + rect.x;
    const targetStart = row * rect.width;
    data.set(field[key].subarray(sourceStart, sourceStart + rect.width), targetStart);
  }
  return data;
}

function createStrokeSnapshot(image, field, rect) {
  return {
    rect,
    imageData: copyImageRect(image, rect),
    dx: copyFieldRect(field, rect, 'dx'),
    dy: copyFieldRect(field, rect, 'dy'),
  };
}

function expandStrokeSnapshot(snapshot, image, field, rect) {
  if (rectContains(snapshot.rect, rect)) return snapshot;

  const nextRect = unionRects(snapshot.rect, rect);
  const imageData = new Uint8ClampedArray(nextRect.width * nextRect.height * 4);
  const dx = new Float32Array(nextRect.width * nextRect.height);
  const dy = new Float32Array(nextRect.width * nextRect.height);

  for (let y = 0; y < nextRect.height; y += 1) {
    const canvasY = nextRect.y + y;
    for (let x = 0; x < nextRect.width; x += 1) {
      const canvasX = nextRect.x + x;
      const targetIndex = y * nextRect.width + x;
      const targetImageIndex = targetIndex * 4;
      if (
        canvasX >= snapshot.rect.x &&
        canvasX < snapshot.rect.x + snapshot.rect.width &&
        canvasY >= snapshot.rect.y &&
        canvasY < snapshot.rect.y + snapshot.rect.height
      ) {
        const sourceIndex = (canvasY - snapshot.rect.y) * snapshot.rect.width +
          (canvasX - snapshot.rect.x);
        const sourceImageIndex = sourceIndex * 4;
        imageData.set(snapshot.imageData.subarray(sourceImageIndex, sourceImageIndex + 4), targetImageIndex);
        dx[targetIndex] = snapshot.dx[sourceIndex];
        dy[targetIndex] = snapshot.dy[sourceIndex];
        continue;
      }

      const sourceIndex = canvasY * image.width + canvasX;
      const sourceImageIndex = sourceIndex * 4;
      imageData.set(image.data.subarray(sourceImageIndex, sourceImageIndex + 4), targetImageIndex);
      dx[targetIndex] = field.dx[sourceIndex];
      dy[targetIndex] = field.dy[sourceIndex];
    }
  }

  return {
    rect: nextRect,
    imageData,
    dx,
    dy,
  };
}

function restoreStrokeSnapshot(image, field, snapshot) {
  const { rect } = snapshot;
  for (let row = 0; row < rect.height; row += 1) {
    const imageSourceStart = row * rect.width * 4;
    const imageTargetStart = ((rect.y + row) * image.width + rect.x) * 4;
    image.data.set(
      snapshot.imageData.subarray(imageSourceStart, imageSourceStart + rect.width * 4),
      imageTargetStart,
    );

    const fieldSourceStart = row * rect.width;
    const fieldTargetStart = (rect.y + row) * field.width + rect.x;
    field.dx.set(snapshot.dx.subarray(fieldSourceStart, fieldSourceStart + rect.width), fieldTargetStart);
    field.dy.set(snapshot.dy.subarray(fieldSourceStart, fieldSourceStart + rect.width), fieldTargetStart);
  }
}

function sameImageData(a, b) {
  if (!a || !b || a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) return false;
  for (let i = 0; i < a.data.length; i += 1) {
    if (a.data[i] !== b.data[i]) return false;
  }
  return true;
}

export class Liquify extends PenObj {
  constructor(option) {
    super();
    this.axpObj = option.axpObj;
    this.CANVAS = option.CANVAS;
    this.settingsProvider = option.settingsProvider || (() => this.readSettings());
    this.name = this.axpObj._('@PENNAME.LIQUIFY');
    this.type = 'liquify';
    this.size = DEFAULT_SIZE;
    this.index = DEFAULT_SIZE_INDEX;
    this.alpha = 100;
    this.strength = DEFAULT_STRENGTH;
    this.hardness = DEFAULT_HARDNESS;
    this.liquifyMode = LIQUIFY_MODE.PUSH;
    this.cursor = 'crosshair';
    this.usePenGuide = true;
    this.usePenPreview = true;
    this.usePenLock = true;
    this.borderRadius = 50;
    this.borderStyle = 'dashed';
    this.sourceImage = null;
    this.resultImage = null;
    this.displacementField = null;
    this.previousX = 0;
    this.previousY = 0;
    this.session = 'idle';
    this.isActive = false;
    this.hasChanged = false;
    this.strokeStartImage = null;
    this.strokeStartDisplacementField = null;
    this.strokeSnapshot = null;
    this.init_save();
  }

  readSettings() {
    const modeElement = document.getElementById('axp_pen_select_liquifyMode');
    const strengthElement = document.getElementById('axp_pen_range_liquifyStrength');
    const hardnessElement = document.getElementById('axp_pen_range_liquifyHardness');
    return {
      mode: modeElement?.value || this.liquifyMode,
      radius: Math.max(1, this.size / 2),
      strength: Number(strengthElement?.value ?? this.strength) / PERCENT_SCALE,
      hardness: Number(hardnessElement?.value ?? this.hardness) / PERCENT_SCALE,
    };
  }

  start(x, y) {
    if (this.axpObj.layerSystem.isWriteProtection()) return;

    const layerSystem = this.axpObj.layerSystem;
    if (this.session === 'idle') {
      layerSystem.save();
      this.sourceImage = cloneImageData(layerSystem.getCurrentLayerImage());
      this.resultImage = cloneImageData(this.sourceImage);
      this.displacementField = createDisplacementField(this.axpObj.x_size, this.axpObj.y_size);
      this.hasChanged = false;
      this.session = 'active';
      this.showOverlay();
    }
    this.strokeStartImage = null;
    this.strokeStartDisplacementField = null;
    this.strokeSnapshot = null;
    this.previousX = x;
    this.previousY = y;
    this.isActive = true;
    this.axpObj.isDrawing = true;
    this.axpObj.isDrawn = false;
    this.axpObj.isDrawCancel = false;
    layerSystem.isStrokeActive = true;
    layerSystem.activateFastPath();
    if (layerSystem.compositeFastPathActive) {
      this.CANVAS.draw_ctx.putImageData(this.sourceImage, 0, 0);
    }
  }

  move(x, y, event) {
    if (this.session !== 'active' || !this.isActive || !this.axpObj.isDrawing || this.axpObj.isDrawCancel) return;

    const settings = this.settingsProvider();
    const pendingDirtyRect = createLiquifyDirtyRect(
      x,
      y,
      settings.radius,
      this.axpObj.x_size,
      this.axpObj.y_size,
    );
    const strength = Number(settings.strength);
    if (!isEmptyRect(pendingDirtyRect) && Number.isFinite(strength) && strength > 0) {
      this.captureStrokeSnapshot(pendingDirtyRect);
    }
    const dirtyRect = applyLiquifyDab(this.displacementField, {
      mode: settings.mode,
      x,
      y,
      previousX: this.previousX,
      previousY: this.previousY,
      radius: settings.radius,
      strength: settings.strength,
      hardness: settings.hardness,
      invert: event?.altKey === true,
    });
    this.previousX = x;
    this.previousY = y;
    if (!dirtyRect) return;

    this.resultImage = renderDisplacement(
      this.sourceImage,
      this.displacementField,
      dirtyRect,
      this.axpObj.getValidSelectionMask(),
      this.resultImage,
    );
    this.hasChanged = true;
    this.axpObj.isDrawn = true;
    this.drawPreview(dirtyRect);
  }

  captureStrokeSnapshot(rect) {
    if (isEmptyRect(rect) || !this.resultImage || !this.displacementField) return;
    this.strokeSnapshot = this.strokeSnapshot
      ? expandStrokeSnapshot(this.strokeSnapshot, this.resultImage, this.displacementField, rect)
      : createStrokeSnapshot(this.resultImage, this.displacementField, rect);
  }

  drawPreview(dirtyRect) {
    const layerSystem = this.axpObj.layerSystem;
    if (layerSystem.compositeFastPathActive) {
      this.CANVAS.draw_ctx.putImageData(this.resultImage, 0, 0);
      layerSystem.drawFast({
        x: dirtyRect.x,
        y: dirtyRect.y,
        w: dirtyRect.width,
        h: dirtyRect.height,
      });
      return;
    }
    layerSystem.write(this.resultImage);
    layerSystem.updateCanvas(layerSystem.getId());
  }

  end() {
    if (!this.isActive) return;
    if (this.axpObj.isDrawCancel) {
      this.cancelStroke();
      return;
    }
    this.finishStroke();
  }

  finishStroke() {
    if (!this.isActive) return;

    const layerSystem = this.axpObj.layerSystem;
    layerSystem.isStrokeActive = false;
    layerSystem.deactivateFastPath();
    this.strokeStartImage = null;
    this.strokeStartDisplacementField = null;
    this.strokeSnapshot = null;
    this.isActive = false;
    this.axpObj.isDrawing = false;
    this.axpObj.isDrawn = false;
    this.axpObj.isDrawCancel = false;
  }

  finalizeLiquifySession({ autoSave = true } = {}) {
    if (this.session !== 'active') return false;
    if (this.isActive) {
      if (this.axpObj.isDrawCancel) {
        this.cancelStroke();
      } else {
        this.finishStroke();
      }
    }

    if (!this.hasChanged || sameImageData(this.sourceImage, this.resultImage)) {
      this.cancelLiquifySession();
      return false;
    }

    const layerSystem = this.axpObj.layerSystem;
    const imageForUndo = layerSystem.load();
    layerSystem.write(this.resultImage);
    layerSystem.isStrokeActive = false;
    layerSystem.deactivateFastPath();
    layerSystem.updateCanvas(layerSystem.getId());
    this.axpObj.undoSystem.setUndo({
      type: 'draw',
      detail: this.type,
      layerObj: {
        id: layerSystem.getId(),
        index: layerSystem.getIndex(),
        mode: layerSystem.getMode(),
        alpha: layerSystem.getAlpha(),
        checked: layerSystem.getChecked(),
        locked: layerSystem.getLocked(),
        masked: layerSystem.getMasked(),
        name: layerSystem.getName(),
        image: imageForUndo,
      },
    });
    if (this.axpObj.isBackgroundimage) this.axpObj.drawBackground();
    if (autoSave) this.axpObj.saveSystem.autoSave();
    this.releaseSession();
    return true;
  }

  cancelLiquifySession() {
    if (this.session !== 'active') return;
    const layerSystem = this.axpObj.layerSystem;
    layerSystem.write(layerSystem.load() || this.sourceImage);
    layerSystem.isStrokeActive = false;
    layerSystem.deactivateFastPath();
    layerSystem.updateCanvas(layerSystem.getId());
    this.releaseSession();
  }

  cancelStroke() {
    if (!this.isActive) return;
    const layerSystem = this.axpObj.layerSystem;
    if (this.strokeSnapshot) {
      restoreStrokeSnapshot(this.resultImage, this.displacementField, this.strokeSnapshot);
    }
    if (layerSystem.compositeFastPathActive) {
      this.CANVAS.draw_ctx.putImageData(this.resultImage, 0, 0);
      layerSystem.drawFast();
    } else {
      layerSystem.replaceCurrentImage(this.resultImage);
      layerSystem.updateCanvas(layerSystem.getId());
    }
    layerSystem.isStrokeActive = false;
    layerSystem.deactivateFastPath();
    this.strokeStartImage = null;
    this.strokeStartDisplacementField = null;
    this.strokeSnapshot = null;
    this.isActive = false;
    this.axpObj.isDrawing = false;
    this.axpObj.isDrawn = false;
    this.axpObj.isDrawCancel = false;
  }

  forceIdle() {
    this.cancelLiquifySession();
  }

  setupOverlayEvents() {
    if (typeof document === 'undefined') return;
    const finishBtn = document.getElementById('axp_canvas_button_liquifyFinish');
    const cancelBtn = document.getElementById('axp_canvas_button_liquifyCancel');
    const stopPointer = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const finishSession = (e) => {
      stopPointer(e);
      this.finalizeLiquifySession();
    };
    const cancelSession = (e) => {
      stopPointer(e);
      this.cancelLiquifySession();
    };
    if (finishBtn) {
      finishBtn.addEventListener('pointerdown', stopPointer);
      finishBtn.addEventListener('click', finishSession);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('pointerdown', stopPointer);
      cancelBtn.addEventListener('click', cancelSession);
    }
  }

  showOverlay() {
    if (typeof document === 'undefined') return;
    const group = document.getElementById('axp_canvas_div_liquifyGroup');
    if (group) UTIL.show(group);
  }

  hideOverlay() {
    if (typeof document === 'undefined') return;
    const group = document.getElementById('axp_canvas_div_liquifyGroup');
    if (group) UTIL.hide(group);
  }

  releaseSession() {
    this.sourceImage = null;
    this.resultImage = null;
    this.displacementField = null;
    this.strokeStartImage = null;
    this.strokeStartDisplacementField = null;
    this.strokeSnapshot = null;
    this.session = 'idle';
    this.isActive = false;
    this.hasChanged = false;
    this.axpObj.isDrawing = false;
    this.axpObj.isDrawn = false;
    this.axpObj.isDrawCancel = false;
    this.hideOverlay();
  }
}
