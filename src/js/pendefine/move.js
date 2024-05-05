// @description ペン定義：親クラス＞移動ツール

import { PenObj } from './_penobj.js';

// 移動ツール
export class Move extends PenObj {
    constructor(option) {
        super();
        this.axpObj = option.axpObj;
        this.CANVAS = option.CANVAS;
        // 値（PenObjからの差分）
        this.name = '移動ツール';
        this.type = 'move';
        this.cursor = 'move';
        // 制御
        this.usePenLock = true;
        this.canUndo = true;

        this.init_save();
    }
    // 描画開始
    start(x, y, e) {
        // 書き込み禁止状態
        if (this.axpObj.layerSystem.isWriteProtection()) {
            return;
        }
        // モード設定
        this.set_modeflag();

        // 入力座標の記憶
        this.input_position = [];
        this.input_position.push({ x, y });

        // 描画開始時のイメージ記憶
        this.axpObj.layerSystem.save();
    }
    // 描画中
    move(x, y) {
        // 描画継続中
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            // 描画確定済み
            this.axpObj.isDrawn = true;
            // 入力座標の記憶
            this.input_position.push({ x, y });
            // 描画
            this.draw();
        }
    }
    // 描画
    draw() {
        let firstPoint = this.input_position[0];
        let currentPoint = this.input_position[this.input_position.length - 1];

        // 表示領域をクリア
        this.CANVAS.draw_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
        // 移動した座標にイメージコピー
        this.CANVAS.draw_ctx.putImageData(
            this.axpObj.layerSystem.load(),
            currentPoint.x - firstPoint.x,
            currentPoint.y - firstPoint.y,
        );
        // レイヤー更新
        this.axpObj.layerSystem.write(
            this.CANVAS.draw_ctx.getImageData(0, 0, this.axpObj.x_size, this.axpObj.y_size)
        );
        this.axpObj.layerSystem.updateCanvas();
    }
    // 描画終了
    end(x, y, e) {
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            // 入力座標の記憶
            this.input_position.push({ x, y });
            // 描画
            this.draw();
        }
        this.end_common();
    }
}