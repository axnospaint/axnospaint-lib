// @description ペン定義：親クラス＞ドットペン＞角消しゴム

import { Dot } from './dot.js';

// 消しゴム
export class EraserDot extends Dot {
    img_draw;
    constructor(option) {
        super(option);
        // 値（Dotからの差分）
        this.name = this.axpObj._('@PENNAME.SQUARE_ERASER');
        this.type = 'eraser';
        this.size = 5;
        this.blurLevel = null;
        // 制御
        // 描画
        this.borderStyle = 'dashed';

        this.init_save();
    }
    // ペンガイド表示座標
    getCursorPosition(e) {
        const pos = this.getCursorPositionNormal(e);
        return { x: pos.x, y: pos.y };
    }
    init_brush() {
        // 透明色
        this.CANVAS.draw_ctx.globalCompositeOperation = 'destination-out';
        this.CANVAS.draw_ctx.globalAlpha = this.alpha / 100;
        // ブラシ
        this.CANVAS.brush_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.brush_ctx.globalAlpha = 1; // 先に不透明度100%の描画データを作成する
        // 消しゴムは、ぼかし無し
    }
    // ドット座標に変換
    trans_dot(point) {
        // 角消しゴムは変換処理を行わない
        return point;
    }
    // 直線描画(Bresenham's line algorithm)
    drawLine(
        imageData,
        x0,
        y0,
        x1,
        y1,
        lineWidth,
        color,
    ) {
        const { width, height, data } = imageData;
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;

        let err = dx - dy;
        let vx = x0;
        let vy = y0;
        let old_divx0 = -1;
        let old_divy0 = -1;

        while (true) {
            // setpixel
            /*
            let divx0 = Math.trunc(vx / lineWidth) * lineWidth;
            let divy0 = Math.trunc(vy / lineWidth) * lineWidth;
            */
            let divx0 = Math.round(vx - lineWidth / 2);
            let divy0 = Math.round(vy - lineWidth / 2);
            // 計算座標が前回描画位置から変化した場合、その座標に幅lineWidthの正方形を描画
            if (divx0 !== old_divx0 || divy0 !== old_divy0) {
                let divx1 = divx0 + lineWidth - 1;
                let divy1 = divy0 + lineWidth - 1;
                for (let x = divx0; x <= divx1; x++) {
                    for (let y = divy0; y <= divy1; y++) {
                        // 計算された座標がキャンバス内のみ描画する
                        if (x >= 0 && x < this.axpObj.x_size && y >= 0 && y < this.axpObj.y_size) {
                            const i = (x + y * width) * 4
                            data[i + 0] = color[0]
                            data[i + 1] = color[1]
                            data[i + 2] = color[2]
                            data[i + 3] = 255;
                        }
                    }
                }
                // 前回描画位置の更新
                old_divx0 = divx0;
                old_divy0 = divy0;
            }
            // 終点まで走査したら終了
            if (vx === x1 && vy === y1) break;

            // 次の座標を計算
            let e2 = 2 * err;
            if (e2 > -dy) {
                err = err - dy;
                vx = vx + sx;
            }
            if (e2 < dx) {
                err = err + dx;
                vy = vy + sy;
            }
        }
    }
    // 円描画
    drawCircle(
        imageData,
        x0,
        y0,
        x1,
        y1,
        lineWidth,
        color,
    ) {
        const { width, height, data } = imageData;
        const r = parseInt(Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2)));

        if (r <= 0) { return };

        var xx = parseInt(128 * r);
        var yy = 0;
        var x = 0;
        var y = 0;

        const SetPixel = (x, y) => {
            let divx0 = Math.floor(x / lineWidth) * lineWidth;
            let divy0 = Math.floor(y / lineWidth) * lineWidth;
            let divx1 = divx0 + lineWidth - 1;
            let divy1 = divy0 + lineWidth - 1;
            for (let x = divx0; x <= divx1; x++) {
                for (let y = divy0; y <= divy1; y++) {
                    // 計算された座標がキャンバス内のみ描画する
                    if (x >= 0 && x < this.axpObj.x_size && y >= 0 && y < this.axpObj.y_size) {
                        const i = (x + y * width) * 4
                        data[i + 0] = color[0]
                        data[i + 1] = color[1]
                        data[i + 2] = color[2]
                        data[i + 3] = 255;
                    }
                }
            }
        }
        while (yy <= xx) {
            x = parseInt(xx / 128);
            y = parseInt(yy / 128);
            SetPixel(x0 + x, y0 + y);
            SetPixel(x0 - x, y0 - y);
            SetPixel(x0 - x, y0 + y);
            SetPixel(x0 + x, y0 - y);
            SetPixel(x0 + y, y0 + x);
            SetPixel(x0 - y, y0 - x);
            SetPixel(x0 - y, y0 + x);
            SetPixel(x0 + y, y0 - x);
            yy += parseInt(xx / 128);
            xx -= parseInt(yy / 128);
        }
    }
}
