// @description ペン定義：親クラス＞スポイト

import { PenObj } from './_penobj.js';
import { inRange } from '../etc.js';

// スポイト
export class Spuit extends PenObj {
    constructor(option) {
        super();
        this.axpObj = option.axpObj;
        this.CANVAS = option.CANVAS;
        // 値（PenObjからの差分）
        this.name = this.axpObj._('@PENNAME.EYEDROPPER');
        this.type = 'spuit';
        this.cursor = 'crosshair';
        // 制御
        this.usePenPreview = true;

        this.init_save();
    }
    // ペンの太さプレビュー表示（スポイト専用）
    previewPenSize() {
        // ここでは赤枠だけ表示する
        // 更新キャンバス
        let canvas = this.axpObj.penSystem.CANVAS.pensize;
        let ctx = this.axpObj.penSystem.CANVAS.pensize_ctx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        // 赤枠の表示
        ctx.beginPath();
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.strokeRect(40, 40, 20, 20);
    }
    // 描画開始
    start(x, y, e) {
        // キャンバス内
        if (e.target.id === this.axpObj.CANVAS.main.id) {
            this.axpObj.isDrawing = true;
            this.axpObj.isDrawCancel = false;
            this.axpObj.penSystem.spuit(e);
        }
    }
    // 描画中
    move(x, y, e) {
        // スポイト使用中
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            // スポイト処理
            this.axpObj.penSystem.spuit(e);
        }

        const canvas = this.CANVAS.spuit;
        const ctx = this.CANVAS.spuit_ctx;
        // スポイトプレビュー用キャンバスのクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ポインタ座標がプレビュー表示範囲内なら、ポインタ周囲の画像を拡大表示する
        if (inRange(x, -2, this.axpObj.x_size - 1 + 2) && inRange(y, -2, this.axpObj.y_size - 1 + 2)) {
            // sx0,sy0:取り出す矩形の左上座標
            const sx0 = Math.max(x - 2, 0);
            const sy0 = Math.max(y - 2, 0);
            // sx1,sy1:取り出す矩形の右下座標
            const sx1 = Math.min(x + 2, this.axpObj.x_size - 1);
            const sy1 = Math.min(y + 2, this.axpObj.y_size - 1);
            // sw,sh:取り出す矩形の幅と高さ
            const sw = sx1 - sx0 + 1;
            const sh = sy1 - sy0 + 1;

            // 座標の周囲を読み取る（ポインタ座標がキャンバスをはみ出さない場合、通常は５ドット）
            const imagedata = this.axpObj.CANVAS.main_ctx.getImageData(sx0, sy0, sw, sh);

            // dx,dy:描画先キャンバスに画像データを配置する座標
            const dx = sx0 - (x - 2);
            const dy = sy0 - (y - 2);
            // 拡大イメージをプレビュー表示
            ctx.putImageData(imagedata, dx, dy);

            /*
            console.log('x,y:', x, y);
            console.log('sx0,sy0:', sx0, sy0);
            console.log('sx1,sy1:', sx1, sy1);
            console.log('sw,sh:', sw, sh);
            console.log('dx,dy:', dx, dy);
            */
        }

        let r = '-';
        let g = '-';
        let b = '-';
        let a = '-';
        // キャンバス内なら色情報取得
        if (e.target.id === this.axpObj.CANVAS.main.id) {
            // 座標のドットを読み取る
            const imagedataSpuitPonit = this.axpObj.CANVAS.main_ctx.getImageData(x, y, 1, 1);
            // RGBAの取得
            r = imagedataSpuitPonit.data[0];
            g = imagedataSpuitPonit.data[1];
            b = imagedataSpuitPonit.data[2];
            // 背景透過時はアルファチャンネルも表示する
            if (this.axpObj.assistToolSystem.getIsTransparent()) {
                a = imagedataSpuitPonit.data[3];
            }
        }
        // 色情報表示
        document.getElementById('axp_pen_span_spuitColorRed').textContent = r;
        document.getElementById('axp_pen_span_spuitColorGreen').textContent = g;
        document.getElementById('axp_pen_span_spuitColorBlue').textContent = b;
        document.getElementById('axp_pen_span_spuitColorAlpha').textContent = a;
    }
    // 描画終了
    end() {
        if (this.axpObj.isDrawing) {
            this.axpObj.isDrawing = false;
            this.axpObj.isDrawCancel = false;
            this.axpObj.penSystem.autoChangePen();
        }
    }
}
