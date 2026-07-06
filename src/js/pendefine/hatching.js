// @description ペン定義：スタンプ系共通＞ハッチング（角度付き平行線）
//
// Krita hatching_brush の簡易版。円/四角のニブではなく、固定角度の細い平行線群を
// ストロークの帯（sizeで指定した太さ）の中に敷き詰める。トーン網点とは別系統の
// 階調表現（縦横斜めの線を重ねて濃淡を出す、アナログの網掛け表現に近い）。

import { StampPenBase } from './_stamppen.js';
import { range_index } from './rangeindex.js';

export class Hatching extends StampPenBase {
    constructor(option) {
        super(option);
        this.name = this.axpObj._('@PENNAME.HATCHING');
        this.size = 24;
        this.index = range_index(this.size);
        this.usePressure = false;
        this.usePressureControl = false;
        this.useSubPxAlpha = false;
        this.flickTaper = null;
        // 平行線の固定角度（45度）・間隔・線幅
        this.hatchAngle = Math.PI / 4;
        this.hatchSpacing = 4;
        this.hatchLineWidth = 1.4;

        this.init_save();
    }
    _drawStamp(cp) {
        this._drawSegment(null, cp);
    }
    _drawSegment(p1, p2) {
        if (!p1) p1 = p2;
        const halfBand = this._halfWidth();
        if (halfBand <= 0) return;
        const ctx = this.CANVAS.brush_ctx;
        const savedLW = ctx.lineWidth;
        ctx.lineWidth = this.hatchLineWidth;

        const dirX = Math.cos(this.hatchAngle);
        const dirY = Math.sin(this.hatchAngle);
        const perpX = -dirY;
        const perpY = dirX;
        const lineHalfLen = Math.max(halfBand, this.hatchSpacing);

        // p1-p2間をhatchSpacing間隔でタイル状に敷き詰める。通常のフリーハンド描画では
        // p1-p2は毎フレームの短い区間のため実質1タイルだが、直線モード（[SHIFT]や
        // 図形選択の「直線」）ではp1-p2がストローク全体を1区間として渡されるため、
        // タイル分割しないと区間の中央付近にしかハッチが描かれない
        const segDx = p2.x - p1.x;
        const segDy = p2.y - p1.y;
        const segLen = Math.hypot(segDx, segDy);
        const tileCount = segLen === 0 ? 0 : Math.min(500, Math.max(1, Math.ceil(segLen / this.hatchSpacing)));

        for (let t = 0; t <= tileCount; t++) {
            const frac = tileCount === 0 ? 0 : t / tileCount;
            const midX = p1.x + segDx * frac;
            const midY = p1.y + segDy * frac;
            for (let off = -halfBand; off <= halfBand; off += this.hatchSpacing) {
                const cx = midX + perpX * off;
                const cy = midY + perpY * off;
                ctx.beginPath();
                ctx.moveTo(cx - dirX * lineHalfLen, cy - dirY * lineHalfLen);
                ctx.lineTo(cx + dirX * lineHalfLen, cy + dirY * lineHalfLen);
                ctx.stroke();
            }
        }
        ctx.lineWidth = savedLW;

        const pad = halfBand + lineHalfLen;
        this._dirty?.add({
            x: Math.min(p1.x, p2.x) - pad,
            y: Math.min(p1.y, p2.y) - pad,
            w: Math.abs(p2.x - p1.x) + 2 * pad,
            h: Math.abs(p2.y - p1.y) + 2 * pad,
        });
    }
}
