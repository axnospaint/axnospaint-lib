// @description ツールウィンドウ：親クラス＞フィルタ
//
// 現在レイヤーへ一発適用するフィルタ（Color to Alpha・モザイク等）。
// アンドゥは通常の描画（'draw'タイプ）と同じ仕組みに乗せる（描画前後の画像比較→スナップショット保存）。

import { ToolWindow } from './window.js';
import htmldata from '../html/window_filter.txt';
import { colorToAlpha, mosaic, grayscale, levels, toneCurve, hsvAdjust, colorBalance } from './filters.js';
import { compareImages } from './etc.js';
import '../css/window_filter.css';

export class FilterSystem extends ToolWindow {
    CONST = {
        MOSAIC_BLOCK_MIN: 1,
        MOSAIC_BLOCK_MAX: 200,
        MOSAIC_BLOCK_DEFAULT: 10,
    }
    constructor(axpObj) {
        super(axpObj);
    }
    // 初期ウィンドウ位置（window_heightは他ウィンドウ同様に明示設定しないため、
    // 高さ計算に使わず固定値で画面内に収める）
    getDefaultPosition() {
        return {
            left: 10,
            top: 400,
        }
    }
    init() {
        this.createHTML(
            'axp_filter',
            'FLT',
            this.axpObj._('@WINDOW.FILTER'),
            'axpc_icon_window_filter',
            htmldata,
        );
        this.window_width = 460;
        const pos = this.getDefaultPosition();
        this.window_left = pos.left;
        this.window_top = pos.top;
    }
    startEvent() {
        document.getElementById('axp_filter_button_colorToAlpha').addEventListener('click', () => {
            this.applyColorToAlpha();
        });
        document.getElementById('axp_filter_button_mosaic').addEventListener('click', () => {
            this.applyMosaic();
        });
        document.getElementById('axp_filter_button_grayscale').addEventListener('click', () => {
            this._applyToCurrentLayer((img) => grayscale(img), '@INF1014');
        });
        document.getElementById('axp_filter_button_applyLevels').addEventListener('click', () => {
            const inBlack = Number(document.getElementById('axp_filter_range_levelsInBlack').value);
            const inWhite = Number(document.getElementById('axp_filter_range_levelsInWhite').value);
            const gamma = Number(document.getElementById('axp_filter_range_levelsGamma').value) / 100;
            this._applyToCurrentLayer((img) => levels(img, { inBlack, inWhite, gamma }), '@INF1015');
        });
        document.getElementById('axp_filter_button_applyToneCurve').addEventListener('click', () => {
            const points = [0, 1, 2, 3, 4].map((n) => Number(document.getElementById(`axp_filter_range_curve${n}`).value));
            this._applyToCurrentLayer((img) => toneCurve(img, points), '@INF1016');
        });
        document.getElementById('axp_filter_button_applyHsv').addEventListener('click', () => {
            const hueDelta = Number(document.getElementById('axp_filter_range_hsvHue').value);
            const saturationDelta = Number(document.getElementById('axp_filter_range_hsvSaturation').value);
            const valueDelta = Number(document.getElementById('axp_filter_range_hsvValue').value);
            this._applyToCurrentLayer((img) => hsvAdjust(img, { hueDelta, saturationDelta, valueDelta }), '@INF1017');
        });
        document.getElementById('axp_filter_button_applyColorBalance').addEventListener('click', () => {
            const v = (id) => Number(document.getElementById(id).value);
            this._applyToCurrentLayer((img) => colorBalance(img, {
                shadows: { cr: v('axp_filter_range_cbShadowCR'), mg: v('axp_filter_range_cbShadowMG'), yb: v('axp_filter_range_cbShadowYB') },
                midtones: { cr: v('axp_filter_range_cbMidCR'), mg: v('axp_filter_range_cbMidMG'), yb: v('axp_filter_range_cbMidYB') },
                highlights: { cr: v('axp_filter_range_cbHighCR'), mg: v('axp_filter_range_cbHighMG'), yb: v('axp_filter_range_cbHighYB') },
            }), '@INF1018');
        });
    }
    // 現在レイヤーへフィルタ関数を適用し、変化があればアンドゥ登録する共通処理
    _applyToCurrentLayer(filterFn, msgKey) {
        if (this.axpObj.layerSystem.isWriteProtection()) {
            // %1が%2のため、描画を禁止しています。
            this.axpObj.msg('@CAU0001', this.axpObj.layerSystem.getName(), this.axpObj.layerSystem.getReasonTextForWriteProtection());
            return;
        }
        // なげなわ変形中は確定してから処理する
        this.axpObj.finalizeNagenawaSelection();
        this.axpObj.finalizeLiquifySession();
        const before = this.axpObj.layerSystem.getCurrentLayerImage();
        const after = filterFn(before);
        // 無変化なら何もしない（_penobj.jsのend_common()と同じcompareImagesによる契約に合わせる。
        // 例: 完全白レイヤーへのColor to Alpha再適用等で、不要なアンドゥ履歴・自動保存を防ぐ）
        if (compareImages(before, after)) {
            return;
        }
        // アンドゥ用記録（既存の描画系と同一形式）
        this.axpObj.undoSystem.setUndo({
            type: 'draw',
            detail: 'filter',
            layerObj: {
                id: this.axpObj.layerSystem.getId(),
                index: this.axpObj.layerSystem.getIndex(),
                mode: this.axpObj.layerSystem.getMode(),
                alpha: this.axpObj.layerSystem.getAlpha(),
                checked: this.axpObj.layerSystem.getChecked(),
                locked: this.axpObj.layerSystem.getLocked(),
                masked: this.axpObj.layerSystem.getMasked(),
                name: this.axpObj.layerSystem.getName(),
                image: before,
            },
        });
        this.axpObj.layerSystem.write(after);
        this.axpObj.layerSystem.updateCanvas(this.axpObj.layerSystem.getId());
        this.axpObj.msg(msgKey, this.axpObj.layerSystem.getName());
        // 自動保存（他の描画操作と同様の頻度で）
        this.axpObj.saveSystem.autoSave();
    }
    applyColorToAlpha() {
        this._applyToCurrentLayer((img) => colorToAlpha(img, this.getColorToAlphaOptions()), '@INF1010');
    }
    getColorToAlphaOptions() {
        const mode = document.getElementById('axp_filter_select_colorToAlphaMode').value;
        const color = document.getElementById('axp_filter_color_colorToAlphaReplacement').value;
        const replacementColor = {
            r: parseInt(color.slice(1, 3), 16),
            g: parseInt(color.slice(3, 5), 16),
            b: parseInt(color.slice(5, 7), 16),
        };
        if (mode === 'unmix') {
            return { mode: 'unmix', baseColor: { r: 255, g: 255, b: 255 } };
        }
        return { mode, replacementColor };
    }
    applyMosaic() {
        const input = prompt(
            this.axpObj._('@FILTER.MOSAIC_PROMPT'),
            String(this.CONST.MOSAIC_BLOCK_DEFAULT)
        );
        // キャンセル（null）は明示的な取消のため、既定値へのフォールバックはせず何もしない
        if (input === null) {
            return;
        }
        // 空文字（OKのみ押した場合）は入力なしとして扱い、既定値にフォールバックする。
        // 空文字はNumber('')===0となりNaN判定をすり抜けるため、Number.isFinite()だけでは
        // 弾けず意図せずblockSize=1（実質無変化）になってしまう。
        const trimmed = input.trim();
        const parsed = trimmed ? Math.round(Number(trimmed)) : NaN;
        const blockSize = Math.max(
            this.CONST.MOSAIC_BLOCK_MIN,
            Math.min(this.CONST.MOSAIC_BLOCK_MAX, Number.isFinite(parsed) ? parsed : this.CONST.MOSAIC_BLOCK_DEFAULT)
        );
        this._applyToCurrentLayer((img) => mosaic(img, blockSize), '@INF1011');
    }
}
