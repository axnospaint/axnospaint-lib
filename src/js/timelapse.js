export const PREFERRED_TIMELAPSE_MIME_TYPES = Object.freeze([
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
]);

export function getSupportedMimeType(MediaRecorderCtor = globalThis.MediaRecorder) {
  if (!MediaRecorderCtor || typeof MediaRecorderCtor.isTypeSupported !== 'function') {
    return null;
  }
  return PREFERRED_TIMELAPSE_MIME_TYPES.find((type) => MediaRecorderCtor.isTypeSupported(type)) || null;
}

export function getTimelapseFileExtension(mimeType) {
  return String(mimeType || '').toLowerCase().includes('mp4') ? 'mp4' : 'webm';
}

export class TimelapseRecorder {
  constructor({
    MediaRecorderCtor = globalThis.MediaRecorder,
    frameRate = 12,
  } = {}) {
    this.MediaRecorderCtor = MediaRecorderCtor;
    this.frameRate = frameRate;
    this.mediaRecorder = null;
    this.stream = null;
    this.mimeType = null;
    this.chunks = [];
    this.isRecording = false;
    this.sourceWidth = null;
    this.sourceHeight = null;
  }

  _stopTracks() {
    for (const track of this.stream?.getTracks?.() || []) {
      track.stop();
    }
  }

  _resetState() {
    this.mediaRecorder = null;
    this.stream = null;
    this.chunks = [];
    this.isRecording = false;
    this.sourceWidth = null;
    this.sourceHeight = null;
  }

  start(canvas) {
    if (this.isRecording) throw new Error('timelapse-already-recording');
    if (!this.MediaRecorderCtor) throw new Error('media-recorder-unavailable');
    if (typeof canvas?.captureStream !== 'function') throw new Error('capture-stream-unavailable');

    const mimeType = getSupportedMimeType(this.MediaRecorderCtor);
    if (!mimeType) throw new Error('timelapse-mime-unavailable');

    this.stream = canvas.captureStream(this.frameRate);
    this.mimeType = mimeType;
    this.sourceWidth = canvas.width;
    this.sourceHeight = canvas.height;
    this.chunks = [];
    this.mediaRecorder = new this.MediaRecorderCtor(this.stream, { mimeType });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.mediaRecorder.onerror = () => {
      this._stopTracks();
      this._resetState();
    };
    try {
      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (error) {
      this._stopTracks();
      this._resetState();
      throw error;
    }
  }

  matchesSourceSize(width, height) {
    return this.sourceWidth === width && this.sourceHeight === height;
  }

  stop() {
    if (!this.isRecording || !this.mediaRecorder) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const recorder = this.mediaRecorder;
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this._stopTracks();
        this._resetState();
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        this._stopTracks();
        this._resetState();
        resolve(null);
      }
    });
  }
}
