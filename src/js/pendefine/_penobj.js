// @description ペン定義：親クラス

import { createTonePattern, compareImages } from '../etc.js';

// ダーティ矩形（フレームごとに実際に変化した範囲）の和集合を保持する累積器。
// E-4/フェーズ0（ブラシ合成のダーティ矩形化）対応ペンのみが使用する。
// 未対応ペンは this._dirty を持たないため、write() 側で自動的に null（＝全面再合成）へフォールバックする。
export class DirtyRectAccumulator {
    constructor() {
        this.rect = null;
    }
    add(r) {
        if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y)
            || !Number.isFinite(r.w) || !Number.isFinite(r.h) || r.w <= 0 || r.h <= 0) return;
        if (!this.rect) {
            this.rect = { x: r.x, y: r.y, w: r.w, h: r.h };
            return;
        }
        const right = Math.max(this.rect.x + this.rect.w, r.x + r.w);
        const bottom = Math.max(this.rect.y + this.rect.h, r.y + r.h);
        this.rect.x = Math.min(this.rect.x, r.x);
        this.rect.y = Math.min(this.rect.y, r.y);
        this.rect.w = right - this.rect.x;
        this.rect.h = bottom - this.rect.y;
    }
    consume() {
        const r = this.rect;
        this.rect = null;
        return r;
    }
}

// shadowBlurの滲み出し分の余白を加算し、キャンバス範囲内へクランプする。
// ⚠️ マージン係数（blur値の5倍）はChromiumのshadowBlurガウシアン近似のみに基づく
// 安全側の暫定値であり、HTML Living StandardはshadowBlurの拡散アルゴリズムを
// 規定していないため、Firefox/WebKit系エンジンでの滲み範囲は未検証・未保証。
// Chromiumでの決定的ピクセルテストでもこの前提自体は検証できない。
// 他エンジンでの目視確認を行うまでは、この余白は保守的な安全マージンとして
// 実測値より大きめ（3→5倍）にしてある。
// クランプ後に実質範囲がなくなった場合はnullを返す（＝呼び出し元は全面再合成にフォールバック）。
function padAndClampRect(rect, blurPx, xSize, ySize) {
    if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y)
        || !Number.isFinite(rect.w) || !Number.isFinite(rect.h)) return null;
    const safeBlur = Number.isFinite(blurPx) ? blurPx : 0;
    const m = Math.ceil(Math.max(0, safeBlur)) * 5;
    let x = Math.floor(rect.x - m);
    let y = Math.floor(rect.y - m);
    let right = Math.ceil(rect.x + rect.w + m);
    let bottom = Math.ceil(rect.y + rect.h + m);
    x = Math.max(0, x);
    y = Math.max(0, y);
    right = Math.min(xSize, right);
    bottom = Math.min(ySize, bottom);
    const w = right - x;
    const h = bottom - y;
    if (w <= 0 || h <= 0) return null;
    return { x, y, w, h };
}

// ペンオブジェクト
export class PenObj {
    constructor() {
        this.base_x = 0; // 描画開始X座標
        this.base_y = 0; // 描画開始Y座標
        this.base_index = 0;
        this.old_x = 0; // 前回の入力X座標
        this.old_y = 0; // 前回の入力Y座標
        this.end_x = 0; // 描画終了X座標
        this.end_y = 0; // 描画終了Y座標
        this.drawmode = null;
        this.isLastDrawing = false;
        this.input_position = [];
        // 値
        this.name = null
        this.type = null;
        this.size = null;
        this.index = null;
        this.alpha = null;
        this.threshold = null;
        this.colorTolerance = null; // バケツ専用：色の許容誤差
        this.toneLevel = null;
        this.blurLevel = null;
        this.gradation = null;
        this.radius = null;
        this.hardness = null;  // 混色ペン専用：硬さ
        this.diffusion = null; // 混色ペン専用：広がり
        this.drag = null;      // 混色ペン専用：引きずり
        this.cursor = 'auto';
        // 制御
        this.usePenGuide = false;
        this.usePenPreview = false;
        this.usePenLock = false;
        this.usePenStyle = false;
        this.canUndo = false;
        this.usePressureControl = false; // ペンウィンドウに筆圧 ON/OFF チェックボックスを出すか
        // 描画
        this.borderRadius = null;
        this.borderStyle = null;
        this.lineCap = null;
        this.lineJoin = null;
        this.selectionMaskAtStrokeStart = null;
        this.selectionBaseImage = null;

    }
    // 太さ、不透明度の初期値の保存（初期化用）
    init_save() {
        this.init_size = this.size;
        this.init_index = this.index;
        this.init_alpha = this.alpha;
    }
    // 太さ、不透明度の初期化
    init() {
        this.size = this.init_size;
        this.index = this.init_index;
        this.alpha = this.init_alpha;
    }
    getColor() {
        return this.axpObj.colorMakerSystem.getAdjustColor();
    }
    getColorRGB() {
        return this.axpObj.colorMakerSystem.getAdjustColorRGB();
    }
    // ぼかし設定
    blur(level) {
        this.CANVAS.draw_ctx.shadowColor = this.getColor();
        var blur_value;
        if (level === undefined) {
            // ぼかしスライダー有効時のみ各ペンの blurLevel を使用、
            // OFF のときは常に 1 を反映する (軽い既定ぼかし)
            if (this.axpObj.config('axp_config_form_blurLevel') === 'on') {
                blur_value = this.blurLevel;
            } else {
                blur_value = 1;
            }
        } else {
            blur_value = Number(level);
        }
        if (blur_value > 0) {
            // ぼかしをかける場合、色が重なって濃くなるため、不透明度を補正する
            // ただし、不透明度100%のときは補正しない
            if (this.CANVAS.draw_ctx.globalAlpha !== 1) {
                this.CANVAS.draw_ctx.globalAlpha = this.CANVAS.draw_ctx.globalAlpha / Math.sqrt(2);
            }
        }
        // console.log('blu', blur_value);
        this.CANVAS.draw_ctx.shadowBlur = blur_value;
        this.CANVAS.draw_ctx.shadowOffsetX = 0;
        this.CANVAS.draw_ctx.shadowOffsetY = 0;
    }
    // カーソル表示
    drawCursor(e) {
        if (this.usePenLock) {
            // ロックの影響を受けるタイプ
            if (this.axpObj.layerSystem.isWriteProtection()) {
                // レイヤー書き込み不可状態のときは、注意喚起のため表示しない
                // マウスポインタ：不許可
                this.axpObj.ELEMENT.view.style.cursor = 'not-allowed';
                // ペンガイド線非表示
                this.axpObj.ELEMENT.cursor.style.visibility = 'hidden';
                // 処理終了
                return;
            }
        }
        // マウスポインタの形状を指定
        this.axpObj.ELEMENT.view.style.cursor = this.cursor;
        // マウスポインタの場所に、ペンの太さを示すガイド線を表示
        if (this.usePenGuide) {
            // ペンガイド線を表示するタイプの処理（丸ペン、筆ペン、エアブラシなど）
            this.axpObj.ELEMENT.cursor.style.visibility = 'visible';
            this.axpObj.ELEMENT.cursor.style.borderRadius = `${this.borderRadius}%`;
            // ガイド線の色設定
            if (this.borderStyle === 'normal') {
                // 透明色を考慮するパターン指定
                if (document.getElementById('axp_makecolor_div_transparent').dataset.selected === 'true') {
                    // 透明色の場合、破線にする
                    this.axpObj.ELEMENT.cursor.style.borderStyle = 'dashed';
                } else {
                    this.axpObj.ELEMENT.cursor.style.borderStyle = 'solid';
                }
            } else {
                this.axpObj.ELEMENT.cursor.style.borderStyle = this.borderStyle;
            }
            if (this.radius !== null) {
                // クレヨン丸み
                this.axpObj.ELEMENT.cursor.style.borderRadius = `${this.radius}%`;
            }
            const size = parseInt(this.size * this.axpObj.scale / 100);
            this.axpObj.ELEMENT.cursor.style.width = size + 'px';
            this.axpObj.ELEMENT.cursor.style.height = size + 'px';
            const pos = this.getCursorPosition(e);
            this.axpObj.ELEMENT.cursor.style.left = pos.x + 'px';
            this.axpObj.ELEMENT.cursor.style.top = pos.y + 'px';

        } else {
            // ペンガイド線を表示しないタイプの処理（バケツ、ハンド、スポイトなど）
            // ペンガイド線非表示
            this.axpObj.ELEMENT.cursor.style.visibility = 'hidden';
        }
    }
    // ペンガイド表示座標（子クラスと孫クラスで変更できるように階層定義）
    getCursorPosition(e) {
        const pos = this.getCursorPositionNormal(e);
        return { x: pos.x, y: pos.y };
    }
    // 通常用
    getCursorPositionNormal(e) {
        const size = parseInt(this.size * this.axpObj.scale / 100);
        // ヘッダを表示している場合、座標がズレるので補正する
        const rect = this.axpObj.ELEMENT.view.getBoundingClientRect();
        const x = parseInt((e.clientX - rect.left) - size / 2);
        const y = parseInt((e.clientY - rect.top) - size / 2);
        return { x: x, y: y };
    }
    // 各種モードの設定
    set_modeflag() {
        this.drawmode = this.axpObj.CONST.DRAW_FREEHAND;
        if (this.axpObj.isLineMod) { this.axpObj.isLine = true; }
        // 描画モード指定
        switch (document.getElementById('axp_pen_select_drawMode').value) {
            case 'option_line':
                this.axpObj.isLine = true;
                break;
            case 'option_rectangle':
                this.axpObj.isRect = true;
                this.drawmode = this.axpObj.CONST.DRAW_RECT;
                break;
            case 'option_circle':
                this.drawmode = this.axpObj.CONST.DRAW_CIRCLE;
                break;
        }
        this.axpObj.isDrawing = true;
        this.axpObj.isDrawn = false;
        this.axpObj.isDrawCancel = false;
        this.isLastDrawing = false;
    }
    reset_modeflag() {
        this.axpObj.isDrawing = false;
        this.axpObj.isDrawn = false;
        this.axpObj.isDrawCancel = false;
        this.axpObj.isLine = false;
        this.axpObj.isRect = false;
        this.axpObj.isCircle = false;
    }
    init_globalCompositeOperation(option) {
        // 合成モードと不透明度
        let type;
        if (typeof option.task !== 'undefined' && option.task == 'transdraw') {
            // 透明色描画（マウス右ボタン／ホイールボタン）
            type = 'destination-out';
        } else {
            if (document.getElementById('axp_makecolor_div_transparent').dataset.selected === 'true') {
                // 透明色
                type = 'destination-out';
            } else {
                if (this.axpObj.layerSystem.getMasked()) {
                    // 透明部分の保護
                    type = 'source-atop';
                } else {
                    type = 'source-over';
                }
            }
        }
        this.axpObj.penSystem.CANVAS.draw_ctx.globalCompositeOperation = type;
    }
    beginSelectionStrokeConstraint() {
        const selectionMask = this.axpObj.getValidSelectionMask?.();
        if (!selectionMask) {
            this.clearSelectionStrokeConstraint();
            return false;
        }
        this.selectionMaskAtStrokeStart = selectionMask;
        this.selectionBaseImage = this.axpObj.layerSystem.load();
        return true;
    }
    clearSelectionStrokeConstraint() {
        this.selectionMaskAtStrokeStart = null;
        this.selectionBaseImage = null;
    }
    hasSelectionStrokeConstraint() {
        return this.selectionMaskAtStrokeStart !== null && this.selectionBaseImage !== null;
    }
    isStrokeSelectionPixelSelected(pixelIndex) {
        const selectionMask = this.selectionMaskAtStrokeStart;
        return selectionMask === null || selectionMask[pixelIndex] !== 0;
    }
    applySelectionStrokeConstraint(imageData) {
        if (!this.hasSelectionStrokeConstraint()) return imageData;
        const selectionMask = this.selectionMaskAtStrokeStart;
        const baseImage = this.selectionBaseImage;
        const pixelCount = imageData.width * imageData.height;
        if (
            selectionMask.length !== pixelCount ||
            baseImage.width !== imageData.width ||
            baseImage.height !== imageData.height
        ) {
            return imageData;
        }
        const data = imageData.data;
        const base = baseImage.data;
        for (let i = 0, q = 0; i < pixelCount; i++, q += 4) {
            if (selectionMask[i] !== 0) continue;
            data[q] = base[q];
            data[q + 1] = base[q + 1];
            data[q + 2] = base[q + 2];
            data[q + 3] = base[q + 3];
        }
        return imageData;
    }
    // 描画開始
    start() {
        // ペンの種類ごとに子クラスでオーバーライドする
    }
    // 描画中
    move() {
        // ペンの種類ごとに子クラスでオーバーライドする
    }
    // 描画終了
    end() {
        // ペンの種類ごとに子クラスでオーバーライドする
    }
    init_brush() {
        // ペンの種類ごとに子クラスでオーバーライドする
    }
    draw() {
        // ペンの種類ごとに子クラスでオーバーライドする
    }
    // レイヤー更新
    write() {
        // 1 pointermove 内で getCoalescedEvents の中間イベントが処理されている場合、
        // ブラシ path への積み増しは各 draw() で完了しているため、ここでの重い layer 反映は遅延し
        // フレーム末尾（lastEventInFrame===true）のイベントでのみ実行する。
        // 遅延した事実は pendingPenFlush に記録し、pointermove ハンドラの末尾で必ず flush させる。
        if (this.axpObj.lastEventInFrame === false) {
            this.axpObj.pendingPenFlush = true;
            return;
        }
        this.axpObj.pendingPenFlush = false;
        if (this.hasSelectionStrokeConstraint() && this.axpObj.layerSystem.compositeFastPathActive) {
            this.axpObj.layerSystem.deactivateFastPath();
        }
        if (this.axpObj.layerSystem.compositeFastPathActive) {
            // GPU fast path: restore base via drawImage (GPU→GPU) instead of putImageData
            const savedOp = this.CANVAS.draw_ctx.globalCompositeOperation;
            const savedAlpha = this.CANVAS.draw_ctx.globalAlpha;
            const savedShadowBlur = this.CANVAS.draw_ctx.shadowBlur;
            this.CANVAS.draw_ctx.globalCompositeOperation = 'copy';
            this.CANVAS.draw_ctx.globalAlpha = 1;
            this.CANVAS.draw_ctx.shadowBlur = 0;
            this.CANVAS.draw_ctx.drawImage(this.CANVAS.undoBase, 0, 0);
            this.CANVAS.draw_ctx.globalCompositeOperation = savedOp;
            this.CANVAS.draw_ctx.globalAlpha = savedAlpha;
            this.CANVAS.draw_ctx.shadowBlur = savedShadowBlur;
            this.CANVAS.draw_ctx.drawImage(this.CANVAS.brush, 0, 0);
            // このフレームで実際に変化した範囲のみ再合成する（対応ペンのみ）。
            // 未対応ペン（this._dirtyを持たない）や、蓄積が空の場合は常にnullとなり、
            // 既存の全面再合成（drawFastのフォールバック）にそのまま委ねる。
            let dirtyRect = null;
            if (this._dirty) {
                const raw = this._dirty.consume();
                if (raw) {
                    dirtyRect = padAndClampRect(raw, savedShadowBlur, this.axpObj.x_size, this.axpObj.y_size);
                }
            }
            this.axpObj.layerSystem.drawFast(dirtyRect);
        } else {
            this.CANVAS.draw_ctx.putImageData(this.axpObj.layerSystem.load(), 0, 0);
            this.CANVAS.draw_ctx.drawImage(this.CANVAS.brush, 0, 0);
            const imageData = this.CANVAS.draw_ctx.getImageData(0, 0, this.axpObj.x_size, this.axpObj.y_size);
            this.applySelectionStrokeConstraint(imageData);
            this.axpObj.layerSystem.write(imageData);
            this.axpObj.layerSystem.updateCanvas(this.axpObj.layerSystem.getId());
        }
    }
    // 描画終了 - 共通処理
    end_common() {
        // ダーティ矩形累積器のリセット（次ストロークのstart()で再生成される。
        // 未対応ペンではそもそも設定されないため影響なし）
        this._dirty = null;
        if (this.axpObj.layerSystem.isStrokeActive) {
            if (this.axpObj.layerSystem.compositeFastPathActive && !this.axpObj.isDrawCancel) {
                const imageData = this.CANVAS.draw_ctx.getImageData(0, 0, this.axpObj.x_size, this.axpObj.y_size);
                this.applySelectionStrokeConstraint(imageData);
                this.axpObj.layerSystem.write(imageData);
            }
            this.axpObj.layerSystem.isStrokeActive = false;
            this.axpObj.layerSystem.deactivateFastPath();
            this.axpObj.layerSystem.updateCanvas();
        }
        if (this.axpObj.isDrawing) {
            // アンドゥ対象の機能かつ描画キャンセルされていない時アンドゥデータ作成
            if (this.canUndo && !this.axpObj.isDrawCancel) {
                // 描画前と描画後を比較し、差分があればアンドゥ用記録
                // キャンバス外で描画操作を行った場合にアンドゥ対象としないための処理
                // キャンバス外から太いペンでキャンバス内に描画したり、直線描画時にキャンバス外の２点を指定された場合を考慮
                if (!compareImages(
                    this.axpObj.layerSystem.load(),
                    this.axpObj.layerSystem.getCurrentLayerImage()
                )
                ) {
                    // アンドゥデータ作成
                    this.axpObj.undoSystem.setUndo({
                        type: 'draw',
                        detail: this.type,
                        layerObj: {
                            id: this.axpObj.layerSystem.getId(),
                            index: this.axpObj.layerSystem.getIndex(),
                            mode: this.axpObj.layerSystem.getMode(),
                            alpha: this.axpObj.layerSystem.getAlpha(),
                            checked: this.axpObj.layerSystem.getChecked(),
                            locked: this.axpObj.layerSystem.getLocked(),
                            masked: this.axpObj.layerSystem.getMasked(),
                            name: this.axpObj.layerSystem.getName(),
                            image: this.axpObj.layerSystem.load(),
                        },
                    });
                    // 背景タイルプレビュー表示
                    if (this.axpObj.isBackgroundimage) {
                        this.axpObj.drawBackground();
                    }
                    // 自動保存（10回の描画に一度、保存処理を実行する）
                    this.axpObj.saveSystem.autoSave();
                }
            }
            // 描画フラグリセット
            this.reset_modeflag();
        }
        this.clearSelectionStrokeConstraint();
    }
    // ペンの太さプレビュー表示
    previewPenSize() {
        // 更新キャンバス
        let canvas = this.axpObj.penSystem.CANVAS.pensize;
        let ctx = this.axpObj.penSystem.CANVAS.pensize_ctx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // スポイトキャンバスのクリア
        let canvas_spuit = this.axpObj.penSystem.CANVAS.spuit;
        let ctx_spuit = this.axpObj.penSystem.CANVAS.spuit_ctx;
        ctx_spuit.clearRect(0, 0, canvas_spuit.width, canvas_spuit.height);

        if (!this.usePenPreview) {
            // ペンガイド線を表示しないタイプの処理（バケツ、ハンドなど）
            // 表示クリアのみ
            return;
        }
        // ※注意：スポイトはオーバーライドで独自処理

        // 透明色と消しゴムの場合は、破線で表示するため、事前判定を行う
        let isDashed;
        if (this.borderStyle === 'normal') {
            // 透明色を考慮するパターン指定
            if (document.getElementById('axp_makecolor_div_transparent').dataset.selected === 'true') {
                // 透明色の場合、破線にする
                isDashed = true;
            } else {
                isDashed = false;
            }
        } else {
            isDashed = true;
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = this.alpha / 100;

        ctx.lineCap = this.lineCap;
        ctx.lineJoin = this.lineJoin;

        // size指定できないタイプ(null)の場合、固定値
        let size;
        if (this.size !== null) {
            size = this.size * (this.axpObj.scale / 100);
        } else {
            // バケツ時の表示サイズ
            size = 80;
        }

        let radius = size * this.borderRadius / 100;
        this.createRoundRectPath(ctx, 49.5 - size / 2, 49.5 - size / 2, size, size, radius);
        if (isDashed) {
            // 透明色の場合の破線
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // トーン濃度使用時
            if (this.axpObj.config('axp_config_form_ToneLevel') === 'on' &&
                this.toneLevel !== null &&
                this.toneLevel !== 16) {
                // トーンパターン生成
                ctx.fillStyle = createTonePattern(this.toneLevel, this.getColor());
            } else {
                ctx.fillStyle = this.getColor();
            }
            ctx.fill();
        }

        if (this.size !== null) {
            // 補助線を引く
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
            ctx.strokeStyle = "#333";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(49.5, 0);
            ctx.lineTo(49.5, 99);
            ctx.moveTo(0, 49.5);
            ctx.lineTo(99, 49.5);
            ctx.stroke();
        }
    }
    /*
    * 角が丸い四角形のパスを作成する
    * @param  {CanvasRenderingContext2D} ctx コンテキスト
    * @param  {Number} x   左上隅のX座標
    * @param  {Number} y   左上隅のY座標
    * @param  {Number} w   幅
    * @param  {Number} h   高さ
    * @param  {Number} r   半径
    */
    createRoundRectPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arc(x + w - r, y + r, r, Math.PI * (3 / 2), 0, false);
        ctx.lineTo(x + w, y + h - r);
        ctx.arc(x + w - r, y + h - r, r, 0, Math.PI * (1 / 2), false);
        ctx.lineTo(x + r, y + h);
        ctx.arc(x + r, y + h - r, r, Math.PI * (1 / 2), Math.PI, false);
        ctx.lineTo(x, y + r);
        ctx.arc(x + r, y + r, r, Math.PI, Math.PI * (3 / 2), false);
        ctx.closePath();
    }

}
