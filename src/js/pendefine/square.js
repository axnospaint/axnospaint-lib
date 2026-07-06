// @description ペン定義：スタンプ系共通＞角ペン
//
// 「正方形ペン」: 軸合わせの正方形ニブが軌跡に沿って動く描画。
// 各確定点でフィルレクト (軸合わせ正方形) を打ち、区間は2 つの正方形を
// 結ぶ凸 6 角形 (= 軸合わせ正方形の Minkowski sum) で塗る。
// 筆圧は使わない (常に halfWidth 固定)。

import { StampPenBase } from './_stamppen.js';

// 角ペン
export class Square extends StampPenBase {
    constructor(option) {
        super(option);
        // 値（Roundからの差分）
        this.name = this.axpObj._('@PENNAME.SQUARE');
        this.size = 8;
        // 制御
        this.usePressure = false;        // 角ペンは筆圧を反映しない
        this.usePressureControl = false; // ペンウィンドウに筆圧チェックを出さない
        // 描画
        this.borderRadius = 0;
        this.borderStyle = 'normal';
        this.lineCap = 'square';
        this.lineJoin = 'bevel';

        this.init_save();
    }

    // 軸合わせ正方形のスタンプ
    _drawStamp(cp) {
        const rTrue = this._halfWidth();
        if (rTrue <= 0) return;
        const r = Math.max(rTrue, this.subPxFloor);
        const alphaScale = this._subPxAlpha(rTrue);
        const ctx = this.CANVAS.brush_ctx;
        const saved = ctx.globalAlpha;
        ctx.globalAlpha = saved * alphaScale;
        ctx.fillRect(cp.x - r, cp.y - r, 2 * r, 2 * r);
        ctx.globalAlpha = saved;
        this._dirty?.add({ x: cp.x - r, y: cp.y - r, w: 2 * r, h: 2 * r });
    }

    // 2 点間: 軸合わせ正方形の Minkowski sum (凸 6 角形 / 軸方向移動時は矩形)
    _drawSegment(p1, p2) {
        if (!p1) {
            this._drawStamp(p2);
            return;
        }
        const rTrue = this._halfWidth();
        if (rTrue <= 0) return;
        const r = Math.max(rTrue, this.subPxFloor);
        const alphaScale = this._subPxAlpha(rTrue);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
            this._drawStamp(p2);
            return;
        }
        // dx = 0 や dy = 0 の場合も矩形として描けるよう sign(0) を +1 に倒す
        const sx = (dx >= 0) ? 1 : -1;
        const sy = (dy >= 0) ? 1 : -1;

        const ctx = this.CANVAS.brush_ctx;
        const saved = ctx.globalAlpha;
        ctx.globalAlpha = saved * alphaScale;
        ctx.beginPath();
        // CCW: leading → p2 perp-A → p1 perp-A → trailing → p1 perp-B → p2 perp-B
        ctx.moveTo(p2.x + sx * r, p2.y + sy * r);
        ctx.lineTo(p2.x - sx * r, p2.y + sy * r);
        ctx.lineTo(p1.x - sx * r, p1.y + sy * r);
        ctx.lineTo(p1.x - sx * r, p1.y - sy * r);
        ctx.lineTo(p1.x + sx * r, p1.y - sy * r);
        ctx.lineTo(p2.x + sx * r, p2.y - sy * r);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = saved;
        // 6 角形は p2 の正方形を含むため、追加スタンプ不要
        this._dirty?.add({
            x: Math.min(p1.x, p2.x) - r,
            y: Math.min(p1.y, p2.y) - r,
            w: Math.abs(p2.x - p1.x) + 2 * r,
            h: Math.abs(p2.y - p1.y) + 2 * r,
        });
    }
}
