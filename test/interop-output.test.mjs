import assert from 'node:assert/strict';
import test from 'node:test';

import { ClipboardExporter } from '../src/js/clipboardexporter.js';
import {
  TimelapseRecorder,
  getSupportedMimeType,
  getTimelapseFileExtension,
} from '../src/js/timelapse.js';

test('selects the first supported timelapse MIME type', () => {
  const MediaRecorderCtor = {
    isTypeSupported: (mime) => mime === 'video/webm',
  };

  assert.equal(getSupportedMimeType(MediaRecorderCtor), 'video/webm');
  assert.equal(getSupportedMimeType(null), null);
});

test('maps the actual timelapse MIME type to a download extension', () => {
  assert.equal(getTimelapseFileExtension('video/mp4'), 'mp4');
  assert.equal(getTimelapseFileExtension('video/webm;codecs=vp9'), 'webm');
  assert.equal(getTimelapseFileExtension(''), 'webm');
});

test('timelapse recorder collects chunks and stops stream tracks', async () => {
  const stoppedTracks = [];
  const stream = {
    getTracks: () => [{ stop: () => stoppedTracks.push('video') }],
  };
  const canvas = {
    width: 320,
    height: 240,
    captureStream: (fps) => {
      assert.equal(fps, 12);
      return stream;
    },
  };
  class FakeMediaRecorder {
    static isTypeSupported(mime) {
      return mime === 'video/webm';
    }

    constructor(inputStream, options) {
      assert.equal(inputStream, stream);
      assert.equal(options.mimeType, 'video/webm');
      this.state = 'inactive';
    }

    start() {
      this.state = 'recording';
      this.ondataavailable({ data: new Blob(['abc'], { type: 'video/webm' }) });
    }

    stop() {
      this.state = 'inactive';
      this.onstop();
    }
  }

  const recorder = new TimelapseRecorder({ MediaRecorderCtor: FakeMediaRecorder });
  recorder.start(canvas);
  assert.equal(recorder.matchesSourceSize(320, 240), true);
  assert.equal(recorder.matchesSourceSize(640, 240), false);
  const blob = await recorder.stop();

  assert.equal(blob.type, 'video/webm');
  assert.equal(blob.size, 3);
  assert.deepEqual(stoppedTracks, ['video']);
  assert.equal(recorder.isRecording, false);
});

test('clipboard exporter writes one PNG item and does not mutate canvas state', async () => {
  const writes = [];
  const canvas = {
    marker: 'unchanged',
    toBlob(callback, type) {
      assert.equal(type, 'image/png');
      callback(new Blob(['png'], { type }));
    },
  };
  class FakeClipboardItem {
    constructor(items) {
      this.items = items;
    }
  }
  const exporter = new ClipboardExporter({
    ClipboardItemCtor: FakeClipboardItem,
    clipboard: { write: async (items) => writes.push(items) },
  });

  const blob = await exporter.copyCanvas(canvas);

  assert.equal(blob.type, 'image/png');
  assert.equal(canvas.marker, 'unchanged');
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0].items['image/png'], blob);
});

test('clipboard exporter rejects when the browser API is unavailable', async () => {
  const exporter = new ClipboardExporter({ ClipboardItemCtor: null, clipboard: null });
  await assert.rejects(
    () => exporter.copyCanvas({ toBlob() {} }),
    /clipboard-unavailable/,
  );
});
