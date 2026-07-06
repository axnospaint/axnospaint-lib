// @description ペン定義：スタンプ系共通＞マーカー（蛍光ペン）
//
// 丸ニブの不透明スタンプだが、レイヤーへの合成を'multiply'にすることで
// 蛍光ペンのように重ね塗り箇所が徐々に濃くなる効果を出す。

import { StampPenBase } from './_stamppen.js';
import { range_index } from './rangeindex.js';

export class Marker extends StampPenBase {
    constructor(option) {
        super(option);
        this.name = this.axpObj._('@PENNAME.MARKER');
        this.size = 12;
        this.index = range_index(this.size);
        this.usePressure = false;
        this.usePressureControl = false;
        this.useSubPxAlpha = false;
        this.flickTaper = null;

        this.init_save();
    }
    init_brush(option) {
        super.init_brush(option);
        // 透明色描画（消しゴム化）・マスク保護時は既存の合成モードをそのまま尊重し、
        // 通常描画時のみ'multiply'に差し替える
        if (this.CANVAS.draw_ctx.globalCompositeOperation === 'source-over') {
            this.CANVAS.draw_ctx.globalCompositeOperation = 'multiply';
        }
    }
}
