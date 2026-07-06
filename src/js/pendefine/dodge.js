// @description ペン定義：スタンプ系共通＞覆い焼き（dodge）ブラシ
//
// ChickenPaint CPBrushTool の dodge 相当。Canvas 2Dが標準サポートする合成モード
// 'color-dodge' を使い、白色スタンプを塗り重ねることで下地を明るくする
// （新しい色を塗るのではなく、既存のピクセルを明るくする効果）。

import { StampPenBase } from './_stamppen.js';
import { range_index } from './rangeindex.js';

export class Dodge extends StampPenBase {
    constructor(option) {
        super(option);
        this.name = this.axpObj._('@PENNAME.DODGE');
        this.size = 20;
        this.index = range_index(this.size);
        this.usePressure = true;
        this.usePressureControl = true;
        this.useSubPxAlpha = false;
        this.flickTaper = null;

        this.init_save();
    }
    init_brush(option) {
        super.init_brush(option);
        // 透明色描画（消しゴム化）・マスク保護時は既存の合成モードをそのまま尊重し、
        // 通常描画時のみ'color-dodge'に差し替える
        if (this.CANVAS.draw_ctx.globalCompositeOperation === 'source-over') {
            this.CANVAS.draw_ctx.globalCompositeOperation = 'color-dodge';
        }
        // dodgeは明るさを持ち上げる効果のため、選択色に関わらず白固定で塗る
        this.CANVAS.brush_ctx.strokeStyle = '#ffffff';
        this.CANVAS.brush_ctx.fillStyle = '#ffffff';
    }
}
