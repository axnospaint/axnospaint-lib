// @description ペン定義：親クラス＞ハンドツール

import { PenObj } from './_penobj.js';

// ハンド
export class Hand extends PenObj {
    constructor(option) {
        super();
        this.axpObj = option.axpObj;
        this.CANVAS = option.CANVAS;
        // 値（PenObjからの差分）
        this.name = this.axpObj._('@PENNAME.HAND');
        this.type = 'hand';
        this.cursor = 'grab';
        // 制御

        this.init_save();
    }
    // 描画開始
    start(x, y, e) {
        //console.log('hand');
        this.axpObj.isDrawing = true;
        this.axpObj.isDrawCancel = false;
        // 初期カメラ位置記憶
        this.baseCameraX = this.axpObj.cameraX;
        this.baseCameraY = this.axpObj.cameraY;
        // 初期入力座標
        this.baseInputX = e.clientX;
        this.baseInputY = e.clientY;
    }
    // 描画開始
    move(x, y, e) {
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            // カメラ位置移動
            const diffX = this.baseInputX - e.clientX;
            const diffY = this.baseInputY - e.clientY;
            this.axpObj.cameraX = Math.round(this.baseCameraX + (diffX * 100 / this.axpObj.scale));
            this.axpObj.cameraY = Math.round(this.baseCameraY + (diffY * 100 / this.axpObj.scale));
            this.axpObj.refreshCanvas();
        }
    }
    // 描画終了
    end() {
        if (this.axpObj.isDrawing) {
            this.axpObj.isDrawing = false;
            this.axpObj.isDrawCancel = false;
        }
    }
}