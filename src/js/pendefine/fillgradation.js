// @description ペン定義：親クラス＞バケツ＞階調バケツ

import { Fill } from './fill.js';
import { hex2rgb, inRange, getRectSize } from '../etc.js';

// 階調バケツ
export class Fillgradation extends Fill {
    constructor(option) {
        super(option);
        // 値（Fillからの差分）
        this.name = '階調バケツ';
        this.toneLevel = null;
        this.gradation = 0;
        // 制御
        // 描画

        this.init_save();
    }
    // ペンの太さプレビュー表示（バケツ専用）
    previewPenSize() {
        // 更新キャンバス
        let canvas = this.axpObj.penSystem.CANVAS.pensize;
        let ctx = this.axpObj.penSystem.CANVAS.pensize_ctx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = this.alpha / 100;
        // グラデーションの表示
        let size = 80;
        let radius = 40;
        // 元の角度から270度減算し、cssのlinear-gradient()の仕様と合わせる
        let angle = this.gradation - 270;
        let x0 = size / 2;
        let y0 = size / 2;
        let dx = Math.round(radius * Math.cos(angle * (Math.PI / 180)));
        let dy = Math.round(radius * Math.sin(angle * (Math.PI / 180)));
        let x1 = x0 + dx;
        let y1 = y0 + dy;
        let x2 = x0 - dx;
        let y2 = y0 - dy;
        let lineargradient = ctx.createLinearGradient(x1, y1, x2, y2);
        //console.log('perv', x1, y1, x2, y2);
        let color1 = this.axpObj.colorMakerSystem.getMainColor();
        let color2 = this.axpObj.colorMakerSystem.getSubColor();
        //console.log(color1, color2);
        lineargradient.addColorStop(0, color1);
        lineargradient.addColorStop(1, color2);
        ctx.fillStyle = lineargradient;
        ctx.beginPath();
        ctx.fillRect(50 - size / 2, 50 - size / 2, size, size);
    }
    // 描画終了
    end(x, y) {
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            // 描画開始時のイメージ記憶
            this.axpObj.layerSystem.save();
            // 範囲外の場合は処理しない
            if (inRange(x, 0, this.axpObj.x_size) && inRange(y, 0, this.axpObj.y_size)) {
                // 透明色の場合は処理しない
                if (document.getElementById('axp_makecolor_div_transparent').dataset.selected === 'true') {
                    // %1は透明色を使用できません。
                    this.axpObj.msg('@CAU0500', this.name);
                } else {
                    var pencolor = hex2rgb(this.axpObj.colorMakerSystem.getMainColor());
                    //var rgbCode = [pencolor[0], pencolor[1], pencolor[2]];
                    var rgbCode = [255, 255, 255];
                    //console.log('rgb:', rgbCode);

                    // ◆入力画像
                    var img_input;
                    if (document.getElementById('axp_pen_select_fillMode').value === 'option_layer') {
                        // 判定対象：現在レイヤー
                        img_input = this.axpObj.layerSystem.getImage();
                    } else {
                        // 判定対象：全レイヤー
                        img_input = this.axpObj.layerSystem.getCanvasImage();
                    }

                    // ◆出力画像
                    var img_output = new ImageData(this.axpObj.x_size, this.axpObj.y_size);

                    // 一旦、不透明度100%の領域塗りつぶし画像を作成する
                    this.regionFill(
                        img_input,
                        img_output,
                        x,
                        y,
                        rgbCode
                    );
                    this.CANVAS.brush_ctx.putImageData(img_output, 0, 0);

                    let rect = getRectSize(img_output);

                    // 一時キャンバスにグラデーション作成
                    let canvas = document.createElement('canvas');
                    canvas.width = this.axpObj.x_size;
                    canvas.height = this.axpObj.y_size;
                    let ctx = canvas.getContext('2d');
                    // グラデーションの表示
                    let radius = Math.max(rect.x1 - rect.x0, rect.y1 - rect.y0) / 2;
                    // 元の角度から270度減算し、cssのlinear-gradient()の仕様と合わせる
                    let angle = this.gradation - 270;
                    let x0 = rect.x0 + (rect.x1 - rect.x0) / 2;
                    let y0 = rect.y0 + (rect.y1 - rect.y0) / 2;
                    console.log('x,y,r:', x0, y0, radius);
                    let dx = Math.round(radius * Math.cos(angle * (Math.PI / 180)));
                    let dy = Math.round(radius * Math.sin(angle * (Math.PI / 180)));
                    // グラデーション座標が描画範囲に収まるように変形
                    let x1 = x0 + dx;
                    if (x1 < rect.x0) x1 = rect.x0;
                    if (x1 > rect.x1) x1 = rect.x1;
                    let y1 = y0 + dy;
                    if (y1 < rect.y0) y1 = rect.y0;
                    if (y1 > rect.y1) y1 = rect.y1;
                    let x2 = x0 - dx;
                    if (x2 < rect.x0) x2 = rect.x0;
                    if (x2 > rect.x1) x2 = rect.x1;
                    let y2 = y0 - dy;
                    if (y2 < rect.y0) y2 = rect.y0;
                    if (y2 > rect.y1) y2 = rect.y1;
                    console.log('draw', x1, y1, x2, y2);
                    let lineargradient = ctx.createLinearGradient(x1, y1, x2, y2);

                    lineargradient.addColorStop(0, this.axpObj.colorMakerSystem.getMainColor());
                    lineargradient.addColorStop(1, this.axpObj.colorMakerSystem.getSubColor());
                    ctx.fillStyle = lineargradient;
                    ctx.beginPath();
                    ctx.fillRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);

                    // バケツ領域で型抜き
                    this.CANVAS.brush_ctx.globalCompositeOperation = 'source-in';
                    this.CANVAS.brush_ctx.drawImage(canvas, 0, 0);

                    // 透明度を適用して、元画像と合成する
                    this.CANVAS.draw_ctx.putImageData(this.axpObj.layerSystem.load(), 0, 0);
                    this.CANVAS.draw_ctx.drawImage(this.CANVAS.brush, 0, 0);

                    // レイヤー更新
                    this.axpObj.layerSystem.write(
                        this.CANVAS.draw_ctx.getImageData(0, 0, this.axpObj.x_size, this.axpObj.y_size)
                    );
                    this.axpObj.layerSystem.updateCanvas();
                }
            }
        }
        this.end_common();
    }
}
