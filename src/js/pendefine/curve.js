// @description ペン定義：スタンプ系共通＞カーブ（追従リボン）
//
// Krita curvebrush の低不透明度リボン挙動を踏襲した簡易版。既存の丸スタンプ形状
// （StampPenBase既定）をそのまま使い、不透明度だけ下げて重ね塗りする。1回の
// ストロークで同じ場所を往復するとリボンが徐々に濃くなる、柔らかい線になる。

import { StampPenBase } from './_stamppen.js';
import { range_index } from './rangeindex.js';

export class Curve extends StampPenBase {
    constructor(option) {
        super(option);
        this.name = this.axpObj._('@PENNAME.CURVE');
        this.size = 10;
        this.index = range_index(this.size);
        this.usePressure = false;
        this.usePressureControl = false;
        this.useSubPxAlpha = false;
        this.flickTaper = null;
        // リボンの不透明度（重ね塗りで徐々に濃くなる効果の基準値）
        this.ribbonAlpha = 0.35;

        this.init_save();
    }
    _drawCommits(commits, prevPoint) {
        return this._drawPointSequence(commits, this.ribbonAlpha, prevPoint);
    }
}
