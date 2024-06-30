// @description ペン定義：親クラス＞丸ペン

import { PenObj } from './_penobj.js';
import { range_index } from './rangeindex.js';
import { createTonePattern, calcDistance, calcMidPointBetween } from '../etc.js';

// 丸ペン
export class Round extends PenObj {
    constructor(option) {
        super();
        this.axpObj = option.axpObj;
        this.CANVAS = option.CANVAS;
        // 値（PenObjからの差分）
        this.name = '丸ペン';
        this.type = 'draw';
        this.size = 1;
        this.index = range_index(this.size);
        this.alpha = 100;
        this.toneLevel = 16;
        this.blurLevel = 0;
        // 制御
        this.usePenGuide = true;
        this.usePenPreview = true;
        this.usePenLock = true;
        this.usePenStyle = true;
        this.canUndo = true;
        // 描画
        this.borderRadius = 50;
        this.borderStyle = 'normal';
        this.lineCap = 'round';
        this.lineJoin = 'round';

        this.init_save();
    }

    init_brush(option) {
        // 合成モードと不透明度
        this.init_globalCompositeOperation(option);
        this.CANVAS.draw_ctx.globalAlpha = this.alpha / 100;
        // ブラシ
        this.CANVAS.brush_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.brush_ctx.globalAlpha = 1; // 先に不透明度100%の描画データを作成する
        this.CANVAS.brush_ctx.lineWidth = this.size - 0.25;
        if (this.axpObj.config('axp_config_form_ToneLevel') === 'on' &&
            this.toneLevel !== null &&
            this.toneLevel !== 16) {
            // トーン濃度使用時トーンパターン生成して色指定
            this.CANVAS.brush_ctx.strokeStyle = createTonePattern(this.toneLevel, this.getColor());
        } else {
            // 通常時の色指定
            this.CANVAS.brush_ctx.strokeStyle = this.getColor();
        }
        this.CANVAS.brush_ctx.lineCap = this.lineCap;
        this.CANVAS.brush_ctx.lineJoin = this.lineJoin;
        this.CANVAS.brush_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
        this.blur();
    }
    // 描画開始
    start(x, y, e, option) {
        // 書き込み禁止状態
        if (this.axpObj.layerSystem.isWriteProtection()) {
            return;
        }
        // モード設定
        this.set_modeflag();

        // 入力座標の記憶
        this.input_position = [];
        this.input_position.push({ x, y });

        //console.log(this.input_position[0]);

        // 描画開始時のイメージ記憶
        this.axpObj.layerSystem.save();

        this.init_brush(option);
        this.start_draw(x, y);
    }
    start_draw(x, y) {
        this.CANVAS.brush_ctx.beginPath();
        this.CANVAS.brush_ctx.moveTo(x, y);
    }
    // 描画中
    move(x, y, e) {
        // 描画継続中
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            // 描画確定済み
            this.axpObj.isDrawn = true;
            // 入力座標の記憶
            this.input_position.push({ x, y });
            // 線の描画
            this.draw();
        }
    }
    // 線の描画
    draw() {
        // 描画領域の初期化
        this.CANVAS.brush_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.brush_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);

        let firstPoint = this.input_position[0];
        let lastPoint = this.input_position[this.input_position.length - 2];
        let currentPoint = this.input_position[this.input_position.length - 1];
        let midPoint = calcMidPointBetween(lastPoint, currentPoint);

        switch (this.drawmode) {
            case this.axpObj.CONST.DRAW_FREEHAND:
                let isStabilizer = false;
                const stabilizer_value = Number(document.getElementById('axp_config_form_stabilizerValue').volume.value);
                if (stabilizer_value !== 0) {
                    if (this.axpObj.isLine || this.isLastDrawing) {
                        // 終点の描画、または直線モードの時は手ぶれ補正しない
                    } else {
                        // 手ぶれ補正あり
                        isStabilizer = true;
                    }
                }
                //　直線モードの場合、始点を最初の入力座標にする
                if (this.axpObj.isLine) {
                    this.CANVAS.brush_ctx.beginPath();
                    this.CANVAS.brush_ctx.moveTo(
                        firstPoint.x,
                        firstPoint.y
                    );
                }
                if (isStabilizer) {
                    // 手ぶれ補正
                    // 2次ベジェ曲線（前回の入力座標を制御点とし、入力から計算した終点までの曲線を描く）
                    this.CANVAS.brush_ctx.quadraticCurveTo(
                        lastPoint.x,
                        lastPoint.y,
                        midPoint.x,
                        midPoint.y,
                    );
                } else {
                    // 補正なし
                    this.CANVAS.brush_ctx.lineTo(
                        currentPoint.x,
                        currentPoint.y
                    );
                }
                break;
            case this.axpObj.CONST.DRAW_RECT:
                this.CANVAS.brush_ctx.strokeRect(
                    firstPoint.x,
                    firstPoint.y,
                    currentPoint.x - firstPoint.x,
                    currentPoint.y - firstPoint.y
                );
                break;
            case this.axpObj.CONST.DRAW_CIRCLE:
                const r = calcDistance(
                    firstPoint.x,
                    firstPoint.y,
                    currentPoint.x,
                    currentPoint.y
                );
                this.CANVAS.brush_ctx.beginPath();
                this.CANVAS.brush_ctx.arc(
                    firstPoint.x,
                    firstPoint.y,
                    r,
                    0,
                    Math.PI * 2,
                    true
                );
                break;
        }
        this.CANVAS.brush_ctx.stroke();
        this.write();
    }
    // 描画終了
    end(x, y, e) {
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            this.isLastDrawing = true;
            // 入力座標の記憶
            this.input_position.push({ x, y });
            // 線の描画
            this.draw();
        }
        this.end_common();
    }
}
