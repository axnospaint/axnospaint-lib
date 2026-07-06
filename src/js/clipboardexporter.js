function canvasToPngBlob(canvas) {
  if (typeof canvas?.toBlob !== 'function') {
    return Promise.reject(new Error('canvas-blob-unavailable'));
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('canvas-blob-failed'));
      }
    }, 'image/png');
  });
}

export class ClipboardExporter {
  constructor({
    ClipboardItemCtor = globalThis.ClipboardItem,
    clipboard = globalThis.navigator?.clipboard,
  } = {}) {
    this.ClipboardItemCtor = ClipboardItemCtor;
    this.clipboard = clipboard;
  }

  async copyCanvas(canvas) {
    if (!this.ClipboardItemCtor || typeof this.clipboard?.write !== 'function') {
      throw new Error('clipboard-unavailable');
    }
    const blob = await canvasToPngBlob(canvas);
    const item = new this.ClipboardItemCtor({ 'image/png': blob });
    await this.clipboard.write([item]);
    return blob;
  }
}
