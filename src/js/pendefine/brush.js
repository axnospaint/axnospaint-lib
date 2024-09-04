// @description ペン定義：親クラス＞丸ペン＞エアブラシ

import { Round } from './round.js';

// ブラシ
export class Brush extends Round {
    constructor(option) {
        super(option);
        // 値（Roundからの差分）
        this.name = this.axpObj._('@PENNAME.AIRBRUSH');
        this.size = 100;
        this.alpha = 30;
        this.toneLevel = null;
        // 制御
        this.usePenStyle = false;
        // 描画

        this.init_save();
    }
    init_brush(option) {
        // 合成モードと不透明度
        this.init_globalCompositeOperation(option);
        this.CANVAS.draw_ctx.globalAlpha = this.alpha / 100;
        // ブラシ
        this.CANVAS.brush_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.brush_ctx.globalAlpha = 1; // 先に不透明度100%の描画データを作成する
        this.CANVAS.brush_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
        this.blur();
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
    draw() {
        var radius = this.size / 2; // 半径指定
        var grad = this.CANVAS.brush_ctx.createRadialGradient(
            this.input_position.at(-1).x,
            this.input_position.at(-1).y,
            0,
            this.input_position.at(-1).x,
            this.input_position.at(-1).y,
            radius);
        var rgb = this.getColorRGB();
        var rbga = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + this.alpha / 100 + ')';
        var rbga0 = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)';
        grad.addColorStop(0, rbga);
        grad.addColorStop(1, rbga0);
        this.CANVAS.brush_ctx.fillStyle = grad;
        this.CANVAS.brush_ctx.fillRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
        this.write();
    }
}