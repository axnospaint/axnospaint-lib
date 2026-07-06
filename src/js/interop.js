import { ReferenceImageSystem } from './referenceimage.js';
import {
  collectUnsupportedBlendLayers,
  decodePsdReference,
  exportPsd,
  validatePsdReferenceFileHeader,
} from './psdcodec.js';
import { ClipboardExporter } from './clipboardexporter.js';
import { TimelapseRecorder, getTimelapseFileExtension } from './timelapse.js';
import { dispDate } from './etc.js';
import '../css/referenceimage.css';

const PERCENT_SCALE = 100;
const PSD_HEADER_BYTES = 26;

export class InteropSystem {
  constructor(axpObj) {
    this.axpObj = axpObj;
    this.referenceImageSystem = new ReferenceImageSystem(axpObj);
    this.timelapseRecorder = new TimelapseRecorder();
    this.clipboardExporter = new ClipboardExporter();
  }

  init() {
    this.referenceImageSystem.init();
  }

  startEvent() {
    const controls = document.getElementById('axp_tool_div_interopControls');
    const toggle = document.getElementById('axp_tool_button_interopToggle');
    const referenceControls = document.getElementById('axp_tool_div_referenceControls');
    const referenceToggle = document.getElementById('axp_tool_button_referenceToggle');
    const fileInput = document.getElementById('axp_tool_file_reference');
    const timelapseButton = document.getElementById('axp_tool_button_timelapse');
    this.setupDisclosure(toggle, controls);
    this.setupDisclosure(referenceToggle, referenceControls);
    timelapseButton.addEventListener('click', async () => {
      if (this.timelapseRecorder.isRecording) {
        await this.stopTimelapse(true);
      } else {
        this.startTimelapse();
      }
      this.syncTimelapseButton();
    });
    document.getElementById('axp_tool_button_clipboardCopy').addEventListener('click', async () => {
      try {
        await this.clipboardExporter.copyCanvas(this.axpObj.layerSystem.getCanvas());
        this.axpObj.msg('@INF6004');
      } catch (error) {
        this.axpObj.debugLog?.add?.('clipboard-copy', error);
        this.axpObj.msg('@CAU6003');
      }
    });
    document.getElementById('axp_tool_button_referenceLoad').addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });
    document.getElementById('axp_tool_button_psdExport').addEventListener('click', () => {
      try {
        this.axpObj.finalizeNagenawaSelection?.();
        const unsupportedBlendLayers = collectUnsupportedBlendLayers(this.axpObj.layerSystem.layerObj);
        if (unsupportedBlendLayers.length > 0) {
          this.axpObj.msg('@CAU6004', unsupportedBlendLayers.join(', '));
        }
        const bytes = exportPsd(this.axpObj.layerSystem);
        this.downloadBytes(bytes, `ap${dispDate(new Date(), 'YYYYMMDD_hhmmss')}.psd`, 'image/vnd.adobe.photoshop');
        this.axpObj.msg('@INF6001');
      } catch (error) {
        this.axpObj.debugLog?.add?.('psd-export', error);
        this.axpObj.msg('@CAU6001');
      }
    });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        if (this.isPsdFile(file)) {
          await this.loadPsdReference(file);
        } else {
          await this.referenceImageSystem.loadFile(file);
        }
        this.syncReferenceControls();
        this.axpObj.msg('@INF6000');
      } catch (error) {
        this.axpObj.debugLog?.add?.('reference-image', error);
        this.axpObj.msg('@CAU6000');
      }
    });
    document.getElementById('axp_tool_checkbox_referenceEdit').addEventListener('change', (event) => {
      this.referenceImageSystem.setEditing(event.target.checked);
      this.syncReferenceControls();
    });
    document.getElementById('axp_tool_checkbox_referenceVisible').addEventListener('change', (event) => {
      this.referenceImageSystem.setVisible(event.target.checked);
    });
    document.getElementById('axp_tool_range_referenceOpacity').addEventListener('input', (event) => {
      this.referenceImageSystem.setOpacity(Number(event.target.value) / PERCENT_SCALE);
    });
    document.getElementById('axp_tool_range_referenceScale').addEventListener('input', (event) => {
      this.referenceImageSystem.setScale(Number(event.target.value) / PERCENT_SCALE);
    });
    document.getElementById('axp_tool_range_referenceRotation').addEventListener('input', (event) => {
      this.referenceImageSystem.setRotation(Number(event.target.value));
    });
    document.getElementById('axp_tool_number_referenceX').addEventListener('change', (event) => {
      this.referenceImageSystem.setPosition(Number(event.target.value), this.referenceImageSystem.y);
      this.syncReferenceControls();
    });
    document.getElementById('axp_tool_number_referenceY').addEventListener('change', (event) => {
      this.referenceImageSystem.setPosition(this.referenceImageSystem.x, Number(event.target.value));
      this.syncReferenceControls();
    });
    document.getElementById('axp_tool_button_referenceRemove').addEventListener('click', () => {
      this.referenceImageSystem.remove();
      this.syncReferenceControls();
    });
    this.syncReferenceControls();
    this.syncTimelapseButton();
  }

  setupDisclosure(toggle, controls) {
    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      const nextExpanded = !isExpanded;
      toggle.setAttribute('aria-expanded', String(nextExpanded));
      controls.hidden = !nextExpanded;
      controls.classList.toggle('axpc_NONE', !nextExpanded);
    });
  }

  syncReferenceControls() {
    const reference = this.referenceImageSystem;
    const hasImage = reference.hasImage;
    const details = document.getElementById('axp_tool_div_referenceDetails');
    details.hidden = !hasImage;
    details.classList.toggle('axpc_NONE', !hasImage);
    const controlIds = [
      'axp_tool_checkbox_referenceEdit',
      'axp_tool_checkbox_referenceVisible',
      'axp_tool_range_referenceOpacity',
      'axp_tool_range_referenceScale',
      'axp_tool_range_referenceRotation',
      'axp_tool_number_referenceX',
      'axp_tool_number_referenceY',
      'axp_tool_button_referenceRemove',
    ];
    for (const id of controlIds) {
      document.getElementById(id).disabled = !hasImage;
    }
    document.getElementById('axp_tool_checkbox_referenceEdit').checked = hasImage && reference.isEditing;
    document.getElementById('axp_tool_checkbox_referenceVisible').checked = reference.isVisible;
    document.getElementById('axp_tool_range_referenceOpacity').value =
      Math.round(reference.opacity * PERCENT_SCALE);
    document.getElementById('axp_tool_range_referenceScale').value =
      Math.round(reference.scale * PERCENT_SCALE);
    document.getElementById('axp_tool_range_referenceRotation').value = reference.rotation;
    document.getElementById('axp_tool_number_referenceX').value = Math.round(reference.x);
    document.getElementById('axp_tool_number_referenceY').value = Math.round(reference.y);
  }

  syncToCanvas() {
    this.referenceImageSystem.syncToCanvas();
  }

  beforeCanvasReset(nextWidth, nextHeight) {
    if (!this.timelapseRecorder.isRecording) return;
    if (this.timelapseRecorder.matchesSourceSize(nextWidth, nextHeight)) return;
    void this.stopTimelapse(true, '@INF6005').then(() => this.syncTimelapseButton());
  }

  startTimelapse() {
    try {
      this.timelapseRecorder.start(this.axpObj.layerSystem.getCanvas());
      this.axpObj.msg('@INF6002');
    } catch (error) {
      this.axpObj.debugLog?.add?.('timelapse-start', error);
      this.axpObj.msg('@CAU6002');
    }
  }

  async stopTimelapse(shouldDownload, messageKey = '@INF6003') {
    try {
      const blob = await this.timelapseRecorder.stop();
      if (shouldDownload && blob) {
        const extension = getTimelapseFileExtension(blob.type);
        this.downloadBlob(blob, `ap_timelapse_${dispDate(new Date(), 'YYYYMMDD_hhmmss')}.${extension}`);
        this.axpObj.msg(messageKey);
      }
    } catch (error) {
      this.axpObj.debugLog?.add?.('timelapse-stop', error);
      this.axpObj.msg('@CAU6002');
    }
  }

  syncTimelapseButton() {
    const button = document.getElementById('axp_tool_button_timelapse');
    const isRecording = this.timelapseRecorder.isRecording;
    button.setAttribute('aria-pressed', String(isRecording));
    button.dataset.recording = isRecording ? 'true' : 'false';
    button.textContent = this.axpObj._(
      isRecording ? '@INTEROP.TIMELAPSE_STOP' : '@INTEROP.TIMELAPSE_START',
    );
  }

  isPsdFile(file) {
    return file.type === 'image/vnd.adobe.photoshop' || /\.psd$/i.test(file.name || '');
  }

  async loadPsdReference(file) {
    const header = await file.slice(0, PSD_HEADER_BYTES).arrayBuffer();
    validatePsdReferenceFileHeader(file.size, header);
    const buffer = await file.arrayBuffer();
    const { bitmap } = await decodePsdReference(buffer);
    try {
      this.referenceImageSystem.loadBitmap(bitmap, file.size);
    } finally {
      if (typeof bitmap.close === 'function') bitmap.close();
    }
  }

  downloadBytes(bytes, filename, type) {
    const blob = new Blob([bytes], { type });
    this.downloadBlob(blob, filename);
  }

  downloadBlob(blob, filename) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
