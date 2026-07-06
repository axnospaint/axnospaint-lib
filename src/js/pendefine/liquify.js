import { PenObj } from './_penobj.js';
import {
  LIQUIFY_MODE,
  applyLiquifyDab,
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
    this.isActive = false;
    this.hasChanged = false;
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
    layerSystem.save();
    this.sourceImage = cloneImageData(layerSystem.getCurrentLayerImage());
    this.resultImage = cloneImageData(this.sourceImage);
    this.displacementField = createDisplacementField(this.axpObj.x_size, this.axpObj.y_size);
    this.previousX = x;
    this.previousY = y;
    this.isActive = true;
    this.hasChanged = false;
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
    if (!this.isActive || !this.axpObj.isDrawing || this.axpObj.isDrawCancel) return;

    const settings = this.settingsProvider();
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
    if (this.axpObj.isDrawCancel || !this.hasChanged || sameImageData(this.sourceImage, this.resultImage)) {
      this.cancelStroke();
      return;
    }

    const layerSystem = this.axpObj.layerSystem;
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
        image: layerSystem.load(),
      },
    });
    if (this.axpObj.isBackgroundimage) this.axpObj.drawBackground();
    this.axpObj.saveSystem.autoSave();
    this.releaseStroke();
  }

  cancelStroke() {
    if (!this.isActive) return;
    const layerSystem = this.axpObj.layerSystem;
    layerSystem.replaceCurrentImage(this.sourceImage);
    layerSystem.isStrokeActive = false;
    layerSystem.deactivateFastPath();
    layerSystem.updateCanvas(layerSystem.getId());
    this.releaseStroke();
  }

  forceIdle() {
    this.cancelStroke();
  }

  releaseStroke() {
    this.sourceImage = null;
    this.resultImage = null;
    this.displacementField = null;
    this.isActive = false;
    this.hasChanged = false;
    this.axpObj.isDrawing = false;
    this.axpObj.isDrawn = false;
    this.axpObj.isDrawCancel = false;
  }
}
