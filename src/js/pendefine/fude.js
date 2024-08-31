// @description ペン定義：親クラス＞丸ペン＞筆ペン

import { Round } from './round.js';
import { calcDistance } from '../etc.js';

// 筆ペン
export class Fude extends Round {
    constructor(option) {
        super(option);
        // 値（PenObjからの差分）
        this.name = this.axpObj._('@PENNAME.CALLIGRAPHY');
        this.size = 5;
        this.toneLevel = null;
        // 制御
        this.usePenStyle = false;
        // 描画

        this.init_save();
    }
    start_draw(x, y) {
        // 筆用サイズ調整
        this.CANVAS.brush_ctx.lineWidth = this.size / 2;
    }
    // 描画中
    move(x, y, e) {
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
        // 筆の場合ブラシエリアを初期化しない
        let old_x = this.input_position[this.input_position.length - 2].x;
        let old_y = this.input_position[this.input_position.length - 2].y;
        let x = this.input_position[this.input_position.length - 1].x;
        let y = this.input_position[this.input_position.length - 1].y;
        // 前回の位置からの距離を、太さ変動の判定に使用する
        const distance = calcDistance(
            old_x,
            old_y,
            x,
            y
        )
        let width = this.CANVAS.brush_ctx.lineWidth;
        //console.log(distance, width);
        if (distance * 1.4 > this.size) {
            // 描画距離が大きい場合、ペンの太さを減衰させながら線を引く

            // 線分の分割数
            let division = parseInt(distance * 1.4 / this.size) * 2;
            // 増分
            let ax = (x - old_x) / division;
            let ay = (y - old_y) / division;

            for (let i = 0; i < division; i++) {
                width = width * 0.9;
                width = Math.max(Math.min(this.size, width), 1); // ペンの太さの範囲内に補正
                this.CANVAS.brush_ctx.lineWidth = width;
                this.CANVAS.brush_ctx.beginPath();
                this.CANVAS.brush_ctx.moveTo(old_x + ax * i, old_y + ay * i);
                this.CANVAS.brush_ctx.lineTo(old_x + ax * (i + 1), old_y + ay * (i + 1));
                this.CANVAS.brush_ctx.stroke();
                this.CANVAS.brush_ctx.closePath();
            }

        } else {
            // 描画距離が小さい場合、ペンの太さを増加させて線を引く
            width = this.CANVAS.brush_ctx.lineWidth + this.size * 0.03;
            width = Math.max(Math.min(this.size, width), 1); // ペンの太さの範囲内に補正
            this.CANVAS.brush_ctx.lineWidth = width;
            this.CANVAS.brush_ctx.beginPath();
            this.CANVAS.brush_ctx.moveTo(old_x, old_y);
            this.CANVAS.brush_ctx.lineTo(x, y);
            this.CANVAS.brush_ctx.stroke();
            this.CANVAS.brush_ctx.closePath();
        }
        this.write();
    }
}