// @description ペン定義：スタンプ系共通＞焼き込み（burn）ブラシ
//
// dodgeの反対。合成モード'color-burn'を使い、黒色スタンプを塗り重ねることで
// 下地を暗くする（新しい色を塗るのではなく、既存のピクセルを暗くする効果）。

import { StampPenBase } from './_stamppen.js';
import { range_index } from './rangeindex.js';

export class Burn extends StampPenBase {
    constructor(option) {
        super(option);
        this.name = this.axpObj._('@PENNAME.BURN');
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
        if (this.CANVAS.draw_ctx.globalCompositeOperation === 'source-over') {
            this.CANVAS.draw_ctx.globalCompositeOperation = 'color-burn';
        }
        // burnは暗さを持ち上げる効果のため、選択色に関わらず黒固定で塗る
        this.CANVAS.brush_ctx.strokeStyle = '#000000';
        this.CANVAS.brush_ctx.fillStyle = '#000000';
    }
}
