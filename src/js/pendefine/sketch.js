// @description ペン定義：スタンプ系共通＞スケッチ（近傍点連結）
//
// Krita sketch_paintop の簡易版。現在の確定点から、そのストローク内で通過した
// 近傍の過去の点へ、一定の確率で細い線を結ぶ。落書き・ラフスケッチ向けの
// くしゃっとした線が得られる。

import { StampPenBase } from './_stamppen.js';
import { range_index } from './rangeindex.js';

export class Sketch extends StampPenBase {
    constructor(option) {
        super(option);
        this.name = this.axpObj._('@PENNAME.SKETCH');
        this.size = 30;
        this.index = range_index(this.size);
        this.usePressure = false;
        this.usePressureControl = false;
        this.useSubPxAlpha = false;
        this.flickTaper = null;
        // 近傍探索半径に対する乗数・接続確率・履歴保持上限（計算量の上限）
        this.searchRadiusScale = 2.5;
        this.connectProbability = 0.35;
        this.historyLimit = 80;

        this._sketchHistory = [];
        this.init_save();
    }
    start(x, y, e, option) {
        this._sketchHistory = [];
        super.start(x, y, e, option);
    }
    _drawStamp(cp) {
        const ctx = this.CANVAS.brush_ctx;
        const radius = this._halfWidth() * this.searchRadiusScale;
        const savedLW = ctx.lineWidth;
        ctx.lineWidth = 1;
        for (const p of this._sketchHistory) {
            const d = Math.hypot(cp.x - p.x, cp.y - p.y);
            if (d < radius && Math.random() < this.connectProbability) {
                ctx.beginPath();
                ctx.moveTo(cp.x, cp.y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            }
        }
        ctx.lineWidth = savedLW;

        this._sketchHistory.push({ x: cp.x, y: cp.y });
        if (this._sketchHistory.length > this.historyLimit) {
            this._sketchHistory.shift();
        }
        this._dirty?.add({ x: cp.x - radius, y: cp.y - radius, w: 2 * radius, h: 2 * radius });
    }
    _drawSegment(p1, p2) {
        // 過去点との接続はp2（現在点）基準で行う。p1自体も既に履歴に含まれるため
        // 通常のポリゴン塗り（外接多角形）は行わず、スタンプのみで構成する
        this._drawStamp(p2);
    }
    _drawShapeFull() {
        this._sketchHistory = [];
        super._drawShapeFull();
    }
}
