// @description ペン定義：親クラス＞丸ペン＞消しゴム

import { Round } from './round.js';

// 消しゴム
export class Eraser extends Round {
    constructor(option) {
        super(option);
        // 値（Roundからの差分）
        this.name = this.axpObj._('@PENNAME.ERASER');
        this.type = 'eraser';
        this.size = 5;
        this.toneLevel = null;
        this.blurLevel = null;
        // 制御
        // 描画
        this.borderStyle = 'dashed';

        this.init_save();
    }
    init_brush() {
        // 合成モードと不透明度
        this.CANVAS.draw_ctx.globalCompositeOperation = 'destination-out';
        this.CANVAS.draw_ctx.globalAlpha = this.alpha / 100;
        // ブラシ
        this.CANVAS.brush_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.brush_ctx.globalAlpha = 1; // 先に不透明度100%の描画データを作成する
        this.CANVAS.brush_ctx.lineWidth = this.size;
        // トーンパターンをリセット
        this.CANVAS.brush_ctx.strokeStyle = 'black';
        this.CANVAS.brush_ctx.lineCap = this.lineCap;
        this.CANVAS.brush_ctx.lineJoin = this.lineJoin;
        //this.blur();
    }
}
