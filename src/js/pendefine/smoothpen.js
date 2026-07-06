// @description ペン定義：スタンプ系共通＞スムーズペン（良質ストローク輪郭）
//
// MITライセンスの perfect-freehand を使い、筆圧・速度に応じて先細りする
// なめらかな単一塗りの輪郭を生成する。既存のニブ形状（円スタンプ＋外接多角形）
// ではなく、ストローク全体を1つの多角形として毎フレーム再計算する方式のため、
// このペンはDirtyRect部分再合成の対象外とし、常に全面再合成にフォールバックする
// （round.js等のストローク末尾テーパー再構築と同様、対象範囲が「今回変化した場所」
// ではなく「ストローク全体」になるため、部分矩形での差分管理に馴染まない）。

import { StampPenBase } from './_stamppen.js';
import { range_index } from './rangeindex.js';
import { getStroke } from 'perfect-freehand';

export class SmoothPen extends StampPenBase {
    constructor(option) {
        super(option);
        this.name = this.axpObj._('@PENNAME.SMOOTHPEN');
        this.size = 6;
        this.index = range_index(this.size);
        this.usePressure = true;
        this.usePressureControl = true;
        this.useSubPxAlpha = false;
        this.flickTaper = null;

        this._allPoints = [];
        this.init_save();
    }
    start(x, y, e, option) {
        this._allPoints = [];
        super.start(x, y, e, option);
    }
    _drawCommits(commits, prevPoint) {
        // 全面再合成に固定する（このペンは毎フレームストローク全体を再計算するため）
        this._dirty = null;
        for (const cp of commits) {
            this._allPoints.push([cp.x, cp.y, cp.pressure ?? 0.5]);
        }
        // 1 pointermove内の中間coalesced eventでは、write()側がlastEventInFrame===falseを
        // 見て重いlayer反映をスキップする（_penobj.js write()参照）ため、その結果がどのみち
        // 使われない getStroke() 全点再計算をここでも省略する（累積のみ行い描画自体はスキップ）。
        // end()由来の最終描画（isLastDrawing）はフラグの残留状態に関わらず必ず描画する
        if (this.isLastDrawing || this.axpObj.lastEventInFrame !== false) {
            this._redrawOutline(!!this.isLastDrawing);
        }
        return commits.length > 0 ? commits[commits.length - 1] : prevPoint;
    }
    _redrawOutline(isComplete) {
        const ctx = this.CANVAS.brush_ctx;
        ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
        if (this._allPoints.length === 0) return;
        const outline = getStroke(this._allPoints, {
            size: this.size,
            thinning: 0.6,
            smoothing: 0.5,
            streamline: 0.5,
            // getStrokeは既定でsimulatePressure=trueのため、渡した実筆圧値を無視して
            // 速度ベースの疑似筆圧を使ってしまう。usePressureControlで実筆圧を反映する
            // 設計のため、明示的に無効化して_allPointsの実値を使わせる
            simulatePressure: false,
            last: isComplete,
        });
        if (outline.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(outline[0][0], outline[0][1]);
        for (let i = 1; i < outline.length; i++) {
            ctx.lineTo(outline[i][0], outline[i][1]);
        }
        ctx.closePath();
        ctx.fill();
    }
}
