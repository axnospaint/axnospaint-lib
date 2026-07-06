export const LIQUIFY_MODE = Object.freeze({
  PUSH: 'push',
  EXPAND: 'expand',
  PINCH: 'pinch',
  PUSH_LEFT: 'push-left',
  PUSH_RIGHT: 'push-right',
  TWIRL_CLOCKWISE: 'twirl-clockwise',
  TWIRL_ANTICLOCKWISE: 'twirl-anticlockwise',
});

const HARD_EDGE_RATIO = 0.85;
const RADIAL_STRENGTH_SCALE = 0.25;
const TWIRL_STRENGTH_SCALE = 0.2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampUnit(value) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function getFalloff(distance, radius, hardness) {
  if (distance > radius) return 0;
  const normalizedDistance = radius === 0 ? 0 : distance / radius;
  const innerRadius = clampUnit(hardness) * HARD_EDGE_RATIO;
  if (normalizedDistance <= innerRadius) return 1;
  const remaining = 1 - innerRadius;
  if (remaining <= 0) return 0;
  const edge = clampUnit((1 - normalizedDistance) / remaining);
  return edge * edge * (3 - 2 * edge);
}

function getModeVector(mode, offsetX, offsetY, strokeX, strokeY, radius) {
  const distance = Math.hypot(offsetX, offsetY);
  const strokeLength = Math.hypot(strokeX, strokeY);

  if (mode === LIQUIFY_MODE.PUSH) {
    return { x: strokeX, y: strokeY };
  }

  if (mode === LIQUIFY_MODE.PUSH_LEFT || mode === LIQUIFY_MODE.PUSH_RIGHT) {
    if (strokeLength === 0) return { x: 0, y: 0 };
    const side = mode === LIQUIFY_MODE.PUSH_LEFT ? 1 : -1;
    return {
      x: side * strokeY,
      y: side * -strokeX,
    };
  }

  if (distance === 0) return { x: 0, y: 0 };

  const radialX = offsetX / distance;
  const radialY = offsetY / distance;
  if (mode === LIQUIFY_MODE.EXPAND || mode === LIQUIFY_MODE.PINCH) {
    const direction = mode === LIQUIFY_MODE.EXPAND ? 1 : -1;
    const magnitude = radius * RADIAL_STRENGTH_SCALE * direction;
    return { x: radialX * magnitude, y: radialY * magnitude };
  }

  const clockwise = mode === LIQUIFY_MODE.TWIRL_CLOCKWISE ? 1 : -1;
  const magnitude = radius * TWIRL_STRENGTH_SCALE * clockwise;
  return {
    x: -radialY * magnitude,
    y: radialX * magnitude,
  };
}

function createImageDataResult(data, width, height) {
  if (typeof ImageData === 'function') {
    return new ImageData(data, width, height);
  }
  return { data, width, height };
}

function sampleBilinear(data, width, height, x, y, target, targetOffset) {
  const sampleX = clamp(x, 0, width - 1);
  const sampleY = clamp(y, 0, height - 1);
  const x0 = Math.floor(sampleX);
  const y0 = Math.floor(sampleY);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const weightX = sampleX - x0;
  const weightY = sampleY - y0;
  const topLeft = (y0 * width + x0) * 4;
  const topRight = (y0 * width + x1) * 4;
  const bottomLeft = (y1 * width + x0) * 4;
  const bottomRight = (y1 * width + x1) * 4;

  for (let channel = 0; channel < 4; channel += 1) {
    const top = data[topLeft + channel] * (1 - weightX) +
      data[topRight + channel] * weightX;
    const bottom = data[bottomLeft + channel] * (1 - weightX) +
      data[bottomRight + channel] * weightX;
    target[targetOffset + channel] = Math.round(top * (1 - weightY) + bottom * weightY);
  }
}

export function createDisplacementField(width, height) {
  const length = width * height;
  return {
    width,
    height,
    dx: new Float32Array(length),
    dy: new Float32Array(length),
  };
}

export function clampRect(rect, width, height) {
  const left = clamp(Math.floor(rect.x), 0, width);
  const top = clamp(Math.floor(rect.y), 0, height);
  const right = clamp(Math.ceil(rect.x + rect.width), 0, width);
  const bottom = clamp(Math.ceil(rect.y + rect.height), 0, height);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function applyLiquifyDab(field, options) {
  const radius = Math.max(1, Number(options.radius) || 1);
  const strength = clampUnit(options.strength);
  if (strength === 0) return null;

  const dirtyRect = clampRect({
    x: options.x - radius,
    y: options.y - radius,
    width: radius * 2 + 1,
    height: radius * 2 + 1,
  }, field.width, field.height);
  const strokeX = options.x - options.previousX;
  const strokeY = options.y - options.previousY;
  const invertDirection = options.invert ? -1 : 1;

  for (let y = dirtyRect.y; y < dirtyRect.y + dirtyRect.height; y += 1) {
    for (let x = dirtyRect.x; x < dirtyRect.x + dirtyRect.width; x += 1) {
      const offsetX = x - options.x;
      const offsetY = y - options.y;
      const distance = Math.hypot(offsetX, offsetY);
      const falloff = getFalloff(distance, radius, options.hardness);
      if (falloff === 0) continue;

      const vector = getModeVector(
        options.mode,
        offsetX,
        offsetY,
        strokeX,
        strokeY,
        radius,
      );
      const index = y * field.width + x;
      const amount = strength * falloff * invertDirection;
      field.dx[index] += vector.x * amount;
      field.dy[index] += vector.y * amount;
    }
  }

  return dirtyRect;
}

export function renderDisplacement(source, field, rect, selectionMask = null, previous = null) {
  if (source.width !== field.width || source.height !== field.height) {
    throw new RangeError('Source and displacement field dimensions must match');
  }

  const output = new Uint8ClampedArray(previous?.data || source.data);
  const dirtyRect = clampRect(rect, source.width, source.height);
  for (let y = dirtyRect.y; y < dirtyRect.y + dirtyRect.height; y += 1) {
    for (let x = dirtyRect.x; x < dirtyRect.x + dirtyRect.width; x += 1) {
      const pixelIndex = y * source.width + x;
      if (selectionMask && selectionMask[pixelIndex] === 0) continue;
      const targetOffset = pixelIndex * 4;
      sampleBilinear(
        source.data,
        source.width,
        source.height,
        x - field.dx[pixelIndex],
        y - field.dy[pixelIndex],
        output,
        targetOffset,
      );
    }
  }

  return createImageDataResult(output, source.width, source.height);
}
