// @description ペン定義：親クラス＞ドットペン＞クレヨン

import { Dot } from './dot.js';

// クレヨン
export class Crayon extends Dot {
    constructor(option) {
        super(option);
        // 値（Roundからの差分）
        this.name = this.axpObj._('@PENNAME.CRAYON');
        this.size = 15;
        this.toneLevel = null;
        this.radius = 50;
        // 制御
        // 描画
        this.borderRadius = 50;
        this.borderStyle = 'normal';
        this.lineCap = 'square';
        this.lineJoin = 'bevel';

        this.init_save();
    }
    // ペンガイド表示座標（クレヨンはDotを継承するが、ガイドは_penObjと同等の処理を行う）
    getCursorPosition(e) {
        const pos = this.getCursorPositionNormal(e);
        return { x: pos.x, y: pos.y };
    }
    // ドット座標の変換は行わない
    trans_dot(point) {
        return point;
    }
    // 角丸の範囲内に収まるランダムな座標を生成
    getRandomPosition(size) {
        let x, y;
        // 単位円の丸みを帯びない範囲
        let width0 = 1 - this.radius / 50;
        // 単位円の丸みを帯びる範囲
        let width1 = 1 - width0;

        while (true) {
            x = Math.random() * 2 - 1;
            y = Math.random() * 2 - 1;

            const absX = Math.abs(x);
            const absY = Math.abs(y);
            // 丸みを帯びない矩形の範囲内であれば有効値とする
            if (absX > width0 && absY > width0) {
            } else {
                break;
            }

            // 丸みを帯びる範囲の場合
            let dx = (absX - width0) / width1;
            let dy = (absY - width0) / width1;
            const root = (dx * dx) + (dy * dy);
            // 原点からの距離が1未満であれば単位円の範囲（丸みを帯びる領域の範囲）に収まるので有効値とする
            if (root < 1) {
                break;
            }
        }

        x = parseInt(x * size / 2);
        y = parseInt(y * size / 2);

        return { x: x, y: y };
    }
    // クレヨン描画
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
        const TIMES = 20 + lineWidth * 2;
        const diff = parseInt(lineWidth / 2);

        let err = dx - dy;
        let vx = x0;
        let vy = y0;
        let old_divx0 = -1;
        let old_divy0 = -1;

        while (true) {
            // setpixel
            let divx0 = vx;
            let divy0 = vy;
            // 計算座標が前回描画位置から変化した場合、その座標に幅lineWidthの正方形を描画
            if (divx0 !== old_divx0 || divy0 !== old_divy0) {
                let divx1 = divx0 + lineWidth;
                let divy1 = divy0 + lineWidth;

                for (let i = 0; i < TIMES; i++) {
                    // 角丸の範囲内のランダムノイズ描画
                    let pos = this.getRandomPosition(lineWidth);
                    let x = pos.x + divx0;
                    let y = pos.y + divy0;

                    let a = parseInt(Math.random() * 30) + 20;
                    // 正方形がキャンバスをはみ出す部分は、描画しない
                    if (x >= 0 && x < this.axpObj.x_size && y >= 0 && y < this.axpObj.y_size) {
                        //console.log(x,y);
                        const i = (x + y * width) * 4
                        data[i + 0] = color[0]
                        data[i + 1] = color[1]
                        data[i + 2] = color[2]
                        data[i + 3] = a;
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
        const TIMES = 20 + lineWidth * 2;
        const diff = parseInt(lineWidth / 2);
        const r = parseInt(Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2)));
        if (r <= 0) { return };

        var xx = parseInt(128 * r);
        var yy = 0;
        var x = 0;
        var y = 0;

        const SetPixel = (divx0, divy0) => {
            let divx1 = divx0 + lineWidth;
            let divy1 = divy0 + lineWidth;

            for (let i = 0; i < TIMES; i++) {
                // 正方形の範囲内でランダムノイズ描画
                let x = parseInt(Math.random() * (divx1 - divx0) + divx0) - diff;
                let y = parseInt(Math.random() * (divy1 - divy0) + divy0) - diff;
                let a = parseInt(Math.random() * 30) + 20;
                // 正方形がキャンバスをはみ出す部分は、描画しない
                if (x >= 0 && x < this.axpObj.x_size && y >= 0 && y < this.axpObj.y_size) {
                    //console.log(x,y);
                    const i = (x + y * width) * 4
                    data[i + 0] = color[0]
                    data[i + 1] = color[1]
                    data[i + 2] = color[2]
                    data[i + 3] = a;
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
