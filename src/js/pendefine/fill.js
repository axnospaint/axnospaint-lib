// @description ペン定義：親クラス＞バケツ

import { PenObj } from './_penobj.js';
import { createTonePattern, inRange } from '../etc.js';

// バケツ
export class Fill extends PenObj {
    constructor(option) {
        super();
        this.axpObj = option.axpObj;
        this.CANVAS = option.CANVAS;
        // 値（PenObjからの差分）
        this.name = 'バケツ';
        this.type = 'fill';
        this.alpha = 100;
        this.threshold = 2;
        this.toneLevel = 16;
        // 制御
        this.usePenPreview = true;
        this.usePenLock = true;
        this.canUndo = true;
        // 描画
        this.borderRadius = 0;
        this.borderStyle = 'normal';
        this.lineCap = 'square';
        this.lineJoin = 'bevel';

        this.init_save();
    }
    init_brush(option) {
        // 合成モードと不透明度
        this.init_globalCompositeOperation(option);
        this.CANVAS.draw_ctx.globalAlpha = this.alpha / 100;
        // ブラシ
        this.CANVAS.brush_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.brush_ctx.globalAlpha = 1; // 先に不透明度100%の描画データを作成する
        this.CANVAS.brush_ctx.lineWidth = this.size;
        this.CANVAS.brush_ctx.strokeStyle = '';
        this.CANVAS.brush_ctx.lineCap = "round";
        this.CANVAS.brush_ctx.lineJoin = "round";
        // ぼかし無し
        //        this.blur(0);
    }
    // 描画開始
    start(x, y, e, option) {
        // 書き込み禁止状態
        if (this.axpObj.layerSystem.isWriteProtection()) {
            return;
        }
        // モード設定
        this.set_modeflag();
        this.init_brush(option);
    }
    // 描画中
    move(x, y) {
    }
    // 描画終了
    end(x, y) {
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            // 描画開始時のイメージ記憶
            this.axpObj.layerSystem.save();
            // 範囲外の場合は処理しない
            if (inRange(x, 0, this.axpObj.x_size) && inRange(y, 0, this.axpObj.y_size)) {

                var pencolor = this.getColorRGB();
                var rgbCode = [pencolor[0], pencolor[1], pencolor[2]];
                console.log('rgb:', rgbCode);

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

                // 作成したimagedataをキャンバスに描画
                this.CANVAS.brush_ctx.putImageData(img_output, 0, 0);

                // トーン濃度使用時
                if (this.axpObj.config('axp_config_form_ToneLevel') === 'on' &&
                    this.toneLevel !== null &&
                    this.toneLevel !== 16) {
                    // トーンパターンを生成して塗り潰し
                    this.CANVAS.brush_ctx.globalCompositeOperation = 'destination-in';
                    this.CANVAS.brush_ctx.fillStyle = createTonePattern(this.toneLevel, '#000000');
                    this.CANVAS.brush_ctx.fillRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
                }
                this.write();
            }
        }
        this.end_common();
    }
}

// 塗りつぶし用関数（縁取り機能つき）
// ImageData:canvasのgetImageDataで取得したデータ
// x,y：現在の座標位置
// fillColor:塗りつぶし用の色
Fill.prototype.regionFill = function (img_input, img_output, x, y, fillColor) {

    let oversize = Number(document.getElementById('axp_pen_range_fillThreshold').value);

    var fillColorRGB = fillColor;
    if (x < 0 || y < 0 || x >= img_input.width || y >= img_input.height) {
        return;
    }
    var selectColorRGB = new Array(3);
    selectColorRGB[0] = img_input.data[(y * img_input.width + x) * 4 + 0];
    selectColorRGB[1] = img_input.data[(y * img_input.width + x) * 4 + 1];
    selectColorRGB[2] = img_input.data[(y * img_input.width + x) * 4 + 2];

    var selectColorAlpha = img_input.data[(y * img_input.width + x) * 4 + 3];
    var isAlpha = !Boolean(selectColorAlpha);

    var pxlArr = [{ x: x, y: y }];
    var idx, p;

    // 処理済み画素フラグ
    var Processed = [];

    // 色比較用関数
    const compareColor = (ImageData, x, y, selectColorRGB, isAlpha, Processed) => {

        if (Processed[(y * ImageData.width + x)]) {
            return false;
        }

        // xやyがcanvasの域内に収まっていなければfalseを返す
        if (x < 0 || y < 0 || x >= ImageData.width || y >= ImageData.height) {
            return false;
        }

        var currentColorRGB = new Array(3);
        currentColorRGB[0] = ImageData.data[(y * ImageData.width + x) * 4 + 0];
        currentColorRGB[1] = ImageData.data[(y * ImageData.width + x) * 4 + 1];
        currentColorRGB[2] = ImageData.data[(y * ImageData.width + x) * 4 + 2];
        var currentAlpha = ImageData.data[(y * ImageData.width + x) * 4 + 3];

        if (isAlpha) {
            if (currentAlpha === 0) {
                // 現在：透明
                return true;
            } else {
                return false;
            }
        } else {
            // 開始：有色
            if (currentAlpha === 0) {
                // 現在：透明
                return false;
            } else {
                // 現在：有色
                if (currentColorRGB[0] === selectColorRGB[0] &&
                    currentColorRGB[1] === selectColorRGB[1] &&
                    currentColorRGB[2] === selectColorRGB[2]) {
                    // 同色
                    return true;
                } else {
                    // 異色
                    return false;
                }
            }
        }
    }
    const setPixel = (imageData, x, y, fillColorRGB, Processed, oversize) => {

        if (Processed[y * imageData.width + x] === true) {
            return;
        }

        if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) {
            return;
        }
        let idx = (y * img_input.width + x) * 4;
        let alpha = 255 - (oversize - 1) * 50;

        imageData.data[idx + 0] = fillColorRGB[0];
        imageData.data[idx + 1] = fillColorRGB[1];
        imageData.data[idx + 2] = fillColorRGB[2];

        if (imageData.data[idx + 3] < alpha) {
            imageData.data[idx + 3] = alpha;
        }
    }

    var loop_count = 0;

    // すべての塗り潰し処理が完了するまで繰り返す
    while (pxlArr.length) {
        p = pxlArr.pop();

        if (Processed[p.y * img_input.width + p.x] === true) {
            // 処理済みの場合、座標の塗り潰しが既に完了しているため、処理しない
        } else {

            // 現在のピクセルが塗りつぶし対象に含まれるか判定
            if (compareColor(img_input, p.x, p.y, selectColorRGB, isAlpha, Processed)) {
                // 座標の画素を処理済みにする
                Processed[p.y * img_input.width + p.x] = true;

                // 出力用イメージデータに書き込む
                idx = (p.y * img_input.width + p.x) * 4;
                img_output.data[idx + 0] = fillColorRGB[0];
                img_output.data[idx + 1] = fillColorRGB[1];
                img_output.data[idx + 2] = fillColorRGB[2];
                img_output.data[idx + 3] = 255;

                // 座標の上下左右を操作して繰り返す（再起処理）
                // 上
                if (compareColor(img_input, p.x, p.y - 1, selectColorRGB, isAlpha, Processed)) {
                    pxlArr.push({ x: p.x, y: p.y - 1 });
                } else {
                    for (let i = 1; i < oversize + 1; i++) {
                        setPixel(img_output, p.x, p.y - i, fillColorRGB, Processed, i);
                    }
                }

                // 右
                if (compareColor(img_input, p.x + 1, p.y, selectColorRGB, isAlpha, Processed)) {
                    pxlArr.push({ x: p.x + 1, y: p.y });
                } else {
                    for (let i = 1; i < oversize + 1; i++) {
                        setPixel(img_output, p.x + i, p.y, fillColorRGB, Processed, i);
                    }
                }

                // 下
                if (compareColor(img_input, p.x, p.y + 1, selectColorRGB, isAlpha, Processed)) {
                    pxlArr.push({ x: p.x, y: p.y + 1 });
                } else {
                    for (let i = 1; i < oversize + 1; i++) {
                        setPixel(img_output, p.x, p.y + i, fillColorRGB, Processed, i);
                    }
                }

                // 左
                if (compareColor(img_input, p.x - 1, p.y, selectColorRGB, isAlpha, Processed)) {
                    pxlArr.push({ x: p.x - 1, y: p.y });
                } else {
                    for (let i = 1; i < oversize + 1; i++) {
                        setPixel(img_output, p.x - i, p.y, fillColorRGB, Processed, i);
                    }
                }
            }
        }

        loop_count++;
        if (loop_count > 3000000) {
            // 無現ループ回避（バグ検知用）
            alert('ERROR:塗り潰し中に異常が発生したため、処理を中断しました。');
            break;
        }
    }
    //console.log('塗り潰し完了 loop_count:',loop_count);
}

