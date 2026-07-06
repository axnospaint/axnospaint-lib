export const REFERENCE_LIMITS = Object.freeze({
  MAX_FILE_BYTES: 64 * 1024 * 1024,
  MAX_EDGE_PIXELS: 8192,
  MAX_PIXEL_COUNT: 16777216,
});

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_HEADER_BYTES = 65536;

function toUint8Array(buffer) {
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  return new Uint8Array(0);
}

function getBitmapSize(bitmap) {
  return {
    width: bitmap.width || bitmap.naturalWidth || bitmap.videoWidth || 0,
    height: bitmap.height || bitmap.naturalHeight || bitmap.videoHeight || 0,
  };
}

export function validateReferenceMetadata(metadata) {
  if (!Number.isFinite(metadata.size) || metadata.size < 0) {
    return { ok: false, code: 'invalid-file-size' };
  }
  if (metadata.size > REFERENCE_LIMITS.MAX_FILE_BYTES) {
    return { ok: false, code: 'file-too-large' };
  }
  if (!Number.isFinite(metadata.width) || !Number.isFinite(metadata.height) ||
      metadata.width <= 0 || metadata.height <= 0) {
    return { ok: false, code: 'invalid-dimensions' };
  }
  if (metadata.width > REFERENCE_LIMITS.MAX_EDGE_PIXELS ||
      metadata.height > REFERENCE_LIMITS.MAX_EDGE_PIXELS) {
    return { ok: false, code: 'edge-too-large' };
  }
  if (metadata.width * metadata.height > REFERENCE_LIMITS.MAX_PIXEL_COUNT) {
    return { ok: false, code: 'pixel-count-too-large' };
  }
  return { ok: true, code: null };
}

async function decodeImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('unsupported-image-type');
  }
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function parsePngHeader(bytes) {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunkType !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

function parseJpegHeader(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += segmentLength;
  }
  return null;
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function parseWebpHeader(bytes) {
  if (bytes.length < 30) return null;
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff !== 'RIFF' || webp !== 'WEBP') return null;
  const format = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (format === 'VP8X') {
    return {
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }
  if (format === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  if (format === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    };
  }
  return null;
}

export function parseReferenceImageHeader(buffer, type) {
  const bytes = toUint8Array(buffer);
  if (type === 'image/png') return parsePngHeader(bytes);
  if (type === 'image/jpeg') return parseJpegHeader(bytes);
  if (type === 'image/webp') return parseWebpHeader(bytes);
  return null;
}

export class ReferenceImageSystem {
  constructor(axpObj) {
    this.axpObj = axpObj;
    this.host = null;
    this.frame = null;
    this.canvas = null;
    this.context = null;
    this.isVisible = true;
    this.isEditing = false;
    this.opacity = 0.5;
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.rotation = 0;
    this.width = 0;
    this.height = 0;
    this.hasImage = false;
  }

  init() {
    this.host = document.getElementById('axp_canvas_div_referenceHost');
    this.frame = document.getElementById('axp_canvas_div_referenceFrame');
    this.canvas = document.getElementById('axp_canvas_canvas_reference');
    this.context = this.canvas.getContext('2d');
    this.frame.addEventListener('pointerdown', (event) => this.startDrag(event));
    this.updateView();
  }

  async loadFile(file) {
    if (file.size > REFERENCE_LIMITS.MAX_FILE_BYTES) throw new Error('file-too-large');
    const headerDimensions = parseReferenceImageHeader(
      await file.slice(0, IMAGE_HEADER_BYTES).arrayBuffer(),
      file.type,
    );
    if (headerDimensions) {
      const validation = validateReferenceMetadata({ size: file.size, ...headerDimensions });
      if (!validation.ok) throw new Error(validation.code);
    }
    const bitmap = await decodeImageFile(file);
    try {
      return this.loadBitmap(bitmap, file.size);
    } finally {
      if (typeof bitmap.close === 'function') bitmap.close();
    }
  }

  loadBitmap(bitmap, fileSize = 0) {
    const { width, height } = getBitmapSize(bitmap);
    const validation = validateReferenceMetadata({
      size: fileSize,
      width,
      height,
    });
    if (!validation.ok) throw new Error(validation.code);

    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.clearRect(0, 0, width, height);
    this.context.drawImage(bitmap, 0, 0);
    this.x = (this.axpObj.x_size - width) / 2;
    this.y = (this.axpObj.y_size - height) / 2;
    this.scale = Math.min(1, this.axpObj.x_size / width, this.axpObj.y_size / height);
    this.rotation = 0;
    this.isVisible = true;
    this.hasImage = true;
    this.updateView();
  }

  setEditing(isEditing) {
    this.isEditing = isEditing && this.hasImage;
    this.updateView();
  }

  setOpacity(opacity) {
    this.opacity = Math.min(1, Math.max(0.05, Number(opacity)));
    this.updateView();
  }

  setScale(scale) {
    this.scale = Math.min(4, Math.max(0.05, Number(scale)));
    this.updateView();
  }

  setRotation(rotation) {
    this.rotation = Number(rotation) || 0;
    this.updateView();
  }

  setPosition(x, y) {
    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
    this.updateView();
  }

  setVisible(isVisible) {
    this.isVisible = Boolean(isVisible);
    this.updateView();
  }

  remove() {
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasImage = false;
    this.isEditing = false;
    this.updateView();
  }

  syncToCanvas() {
    if (!this.host || !this.axpObj.CANVAS.main) return;
    const mainStyle = this.axpObj.CANVAS.main.style;
    this.host.style.left = mainStyle.left;
    this.host.style.top = mainStyle.top;
    this.host.style.width = mainStyle.width;
    this.host.style.height = mainStyle.height;
    this.host.style.transformOrigin = mainStyle.transformOrigin;
    this.host.style.transform = mainStyle.transform;
    this.updateView();
  }

  startDrag(event) {
    if (!this.isEditing || !this.hasImage) return;
    event.preventDefault();
    event.stopPropagation();
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startX = this.x;
    const startY = this.y;
    const radians = -this.axpObj.rotation * Math.PI / 180;
    const displayScale = this.axpObj.scale / 100;
    const onMove = (moveEvent) => {
      const deltaClientX = moveEvent.clientX - startClientX;
      const deltaClientY = moveEvent.clientY - startClientY;
      const deltaX = deltaClientX * Math.cos(radians) - deltaClientY * Math.sin(radians);
      const deltaY = deltaClientX * Math.sin(radians) + deltaClientY * Math.cos(radians);
      this.setPosition(startX + deltaX / displayScale, startY + deltaY / displayScale);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  }

  updateView() {
    if (!this.frame || !this.canvas) return;
    this.host.hidden = !this.hasImage || !this.isVisible;
    this.frame.dataset.editing = this.isEditing ? 'true' : 'false';
    this.frame.style.pointerEvents = this.isEditing ? 'auto' : 'none';
    this.frame.style.left = `${this.x}px`;
    this.frame.style.top = `${this.y}px`;
    this.frame.style.width = `${this.width * this.scale}px`;
    this.frame.style.height = `${this.height * this.scale}px`;
    this.frame.style.opacity = String(this.opacity);
    this.frame.style.transform = `rotate(${this.rotation}deg)`;
  }
}
