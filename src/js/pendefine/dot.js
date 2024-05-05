// @description ペン定義：親クラス＞ドットペン

import { Round } from './round.js';

// ドット
export class Dot extends Round {
    img_draw;
    constructor(option) {
        super(option);
        // 値（Roundからの差分）
        this.name = 'ドットペン';
        this.toneLevel = null;
        // 制御
        // 描画
        this.borderRadius = 0;
        this.borderStyle = 'normal';
        this.lineCap = 'square';
        this.lineJoin = 'bevel';

        this.init_save();
    }
    // ペンガイド表示座標
    getCursorPosition(e) {
        const pos = this.getCursorPositionDot(e);
        return { x: pos.x, y: pos.y };
    }
    // ドット用
    getCursorPositionDot(e) {
        // ヘッダを表示している場合、座標がズレるので補正する
        const rect = this.axpObj.ELEMENT.view.getBoundingClientRect();

        // ペンの太さ単位でドットを描画するため、太さに応じて座標ををずらす
        let crect = this.axpObj.CANVAS.main.getBoundingClientRect();
        // キャンバス座標を、ペンの太さで割り（剰余切り捨て）、ペンの太さを乗算する
        let t_canvas_x = Math.floor((e.clientX - crect.left) * 100 / this.axpObj.scale);
        let t_canvas_y = Math.floor((e.clientY - crect.top) * 100 / this.axpObj.scale);
        let t_width = this.size;
        let t_dot_x = Math.floor(t_canvas_x / t_width) * t_width;
        let t_dot_y = Math.floor(t_canvas_y / t_width) * t_width;
        let x = parseInt(t_dot_x * this.axpObj.scale / 100) + crect.left - rect.left;
        let y = parseInt(t_dot_y * this.axpObj.scale / 100) + crect.top - rect.top;

        return { x: x, y: y };
    }
    start_draw(x, y) {
        this.img_draw = new ImageData(this.axpObj.x_size, this.axpObj.y_size);
    }
    // 描画中
    move(x, y) {
        // 描画継続中
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            // 描画確定済み
            this.axpObj.isDrawn = true;
            // 入力座標の記憶
            this.input_position.push({ x, y });
            // 描画領域の初期化
            this.clear_brush();
            // 描画
            this.draw();
        }
    }
    clear_brush() {
        let needClear = false;
        if (this.axpObj.isLine) {
            needClear = true;
        }
        switch (this.drawmode) {
            case this.axpObj.CONST.DRAW_RECT:
            case this.axpObj.CONST.DRAW_CIRCLE:
                needClear = true;
                break;
        }
        if (needClear) {
            this.img_draw = new ImageData(this.axpObj.x_size, this.axpObj.y_size);
        }
    }
    // ドット座標に変換
    trans_dot(point) {
        return Math.floor(point / this.size) * this.size + this.size / 2;
    }
    draw() {
        let start_x;
        let start_y;
        let end_x;
        let end_y;
        let pencolor = this.getColorRGB();
        // 終了点（今回入力座標）
        end_x = this.trans_dot(this.input_position[this.input_position.length - 1].x);
        end_y = this.trans_dot(this.input_position[this.input_position.length - 1].y);
        switch (this.drawmode) {
            case this.axpObj.CONST.DRAW_FREEHAND:
                // 開始点（前回座標）
                if (this.axpObj.isLine) {
                    //　直線モードの場合、始点を最初の入力座標にする
                    start_x = this.trans_dot(this.input_position[0].x);
                    start_y = this.trans_dot(this.input_position[0].y);
                } else {
                    start_x = this.trans_dot(this.input_position[this.input_position.length - 2].x);
                    start_y = this.trans_dot(this.input_position[this.input_position.length - 2].y);
                }
                // 直線
                this.drawLine(
                    this.img_draw,
                    start_x,
                    start_y,
                    end_x,
                    end_y,
                    this.size,
                    pencolor
                );
                break;
            case this.axpObj.CONST.DRAW_RECT:
                // 開始点
                start_x = this.trans_dot(this.input_position[0].x);
                start_y = this.trans_dot(this.input_position[0].y);
                this.drawLine(this.img_draw, start_x, start_y, start_x, end_y, this.size, pencolor);
                this.drawLine(this.img_draw, start_x, end_y, end_x, end_y, this.size, pencolor);
                this.drawLine(this.img_draw, start_x, start_y, end_x, start_y, this.size, pencolor);
                this.drawLine(this.img_draw, end_x, start_y, end_x, end_y, this.size, pencolor);
                break;
            case this.axpObj.CONST.DRAW_CIRCLE:
                // 開始点
                start_x = this.trans_dot(this.input_position[0].x);
                start_y = this.trans_dot(this.input_position[0].y);
                this.drawCircle(this.img_draw, start_x, start_y, end_x, end_y, this.size, pencolor);
                break;
        }
        this.CANVAS.brush_ctx.putImageData(this.img_draw, 0, 0);
        this.write();
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
            let divx0 = Math.floor(vx / lineWidth) * lineWidth;
            let divy0 = Math.floor(vy / lineWidth) * lineWidth;
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
