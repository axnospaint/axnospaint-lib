// @description ペン定義：描画ペン共通＞スタンプ系ペン共通クラス
//
// 共通パイプライン (StrokePipeline) が出力する確定点群を受け取り、
// 「各確定点にニブを打ち (_drawStamp)、確定点間を塗る (_drawSegment)」描画を行う。
// ニブ形状は _drawStamp / _drawSegment の override で差し替える (既定は円スタンプ)。
// 筆圧採用のありなしは usePressure フラグで切り替わる (_radiusAt がフラグ駆動)。

import { DrawingPenBase } from './_drawingpen.js';
import { calcDistance } from '../etc.js';
import { StrokePipeline, readStrokeSettings } from '../stabilizer/strokePipeline.js';

export class StampPenBase extends DrawingPenBase {
    constructor(option) {
        super(option);
        // ピクセル単位の調節パラメータ (ペンごとに override 可)
        this.startRawPx = 2;   // 開幕この距離まで筆圧フィルタを素通し
        this.subPxFloor = 0.5; // サブピクセル幅の形状下限
        this._activeRadiusXform = null; // _drawPointSequence 内で一時設定される半径変換
        this.useSubPxAlpha = true; // 極細時に半透明化 (false = 常に不透明)
        // 終端ハライ/ハネ (速度依存・筆圧テーパー)。筆圧ペンのみ有効。具体ペンで上書き可。
        this.flickTaper = {
            enabled: true,
            thresholdBase: 0.1,   // ハライ判定速度 [canvas px/ms] (Z^-0.5 補正前)
            taperFactor: 40,      // テーパ長[px] = v[px/ms] × factor[ms] (実質ルックアヘッドms)
            minTaperRatio: 2.0,   // 下限 = ブラシ幅 × この倍率
            maxTaperRatio: 7.0,   // 上限 = (ブラシ幅 + 4px) × この倍率 (細ペンでもハライ出るよう+4)
            extrapRatio: 0.15,    // テーパ距離のうち外挿(進行方向への延長)が占める比率 (0〜0.8)
        };
    }

    // 描画開始
    start(x, y, e, option) {
        if (!this._startCommon(x, y, option)) return;

        // ハライは筆圧ペン入力時のみ。マウス/タッチは筆圧一定のため誤発火させない。
        const isPenInput = !!(e && e.pointerType === 'pen');
        this.pipeline = new StrokePipeline();
        this.pipeline.configure({
            ...readStrokeSettings(),
            usePressure: this.usePressure,
            startPx: this.startRawPx,
            flickTaper: this.flickTaper,
            zoom: this.axpObj.scale / 100,
            brushWidth: this.size,
            // 非筆圧ペンは半径が筆圧非依存のため、延長すると等幅で伸びてしまう → usePressure と pen で gate
            // (flickTaper は具体ペンで null 上書き可のため null ガードする)
            enableFlickTaper: this.usePressure && !!this.flickTaper && this.flickTaper.enabled && isPenInput,
        });
        this.lastCommitted = null;

        if (this.drawmode === this.axpObj.CONST.DRAW_FREEHAND && !this.axpObj.isLine) {
            const commits = this.pipeline.onStart(this._toInput(x, y, e));
            this.lastCommitted = this._drawCommits(commits, null);
        }
    }

    // 描画中
    move(x, y, e) {
        if (!this.axpObj.isDrawing || this.axpObj.isDrawCancel) return;
        this.axpObj.isDrawn = true;
        this.input_position.push({ x, y });

        if (this.drawmode === this.axpObj.CONST.DRAW_FREEHAND && !this.axpObj.isLine) {
            // FREEHAND: 累積描画 (ブラシキャンバスは clear せず、新しい区間のみ追加)
            const commits = this.pipeline.onMove(this._toInput(x, y, e), this._gap());
            this.lastCommitted = this._drawCommits(commits, this.lastCommitted);
            this.write();
        } else {
            // RECT/CIRCLE/直線モード: 従来通り全体再描画
            this._drawShapeFull();
        }
    }

    // 描画終了
    end(x, y, e) {
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            this.isLastDrawing = true;
            this.input_position.push({ x, y });

            if (this.drawmode === this.axpObj.CONST.DRAW_FREEHAND && !this.axpObj.isLine) {
                const commits = this.pipeline.onEnd(this._toInput(x, y, e), this._gap());
                this.lastCommitted = this._drawCommits(commits, this.lastCommitted);
                // 終端ハライ/ハネ・テーパー: 既存終端の筆圧を遡って下げる必要があるため、
                // ブラシキャンバスを clear し、テーパー後の全確定点を再描画する (write が
                // レイヤー再ロード後にブラシ全体を1回合成するため二重濃化は起きない)。
                const rebuild = this.pipeline.consumeRebuild();
                if (rebuild && rebuild.length > 0) {
                    this.CANVAS.brush_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
                    this.lastCommitted = this._drawCommits(rebuild, null);
                }
                // サブピクセル半透明モードの終端キャップ (ストローク中にスタンプを省略しているため)
                if (this.useSubPxAlpha && this.lastCommitted) {
                    const rLast = this._radiusAt(this.lastCommitted);
                    if (rLast > 0 && rLast < this.subPxFloor) {
                        this._drawStamp(this.lastCommitted);
                    }
                }
                this.write();
            } else {
                this._drawShapeFull();
            }
        }
        this.end_common();
    }

    // ── 内部ヘルパ ───────────────────────────────
    // (_toInput は DrawingPenBase 側に定義)

    // 確定点間隔: 太いほど粗く打てる (細部の取りこぼし防止に下限 2px)。
    // サブピクセル半透明モードでは gap を縮小してポリゴンタイリングを密にする。
    _gap() {
        const hw = this._halfWidth();
        if (this.usePressure && this.useSubPxAlpha && this.lastCommitted) {
            const r = hw * this.lastCommitted.pressure;
            if (r < this.subPxFloor) {
                return 2 * this.subPxFloor;
            }
        }
        return Math.max(2, hw);
    }

    // 描画半径: usePressure のとき筆圧に比例、それ以外は固定半幅。
    // _activeRadiusXform が設定されている場合、算出後の半径に変換を適用する。
    _radiusAt(cp) {
        const half = this._halfWidth();
        let r = this.usePressure ? half * cp.pressure : half;
        if (this._activeRadiusXform) r = this._activeRadiusXform(r);
        return r;
    }

    // サブピクセル幅 (直径 < 1px) のエミュレーション:
    // 形状は subPxFloor にクランプし、不透明度を真半径/subPxFloor で減衰させる
    _subPxAlpha(rTrue) {
        if (!this.useSubPxAlpha) return 1.0;
        const f = this.subPxFloor;
        return (rTrue < f) ? Math.max(0, rTrue) / f : 1.0;
    }

    // 点群描画 (関数F): alphaScale で brush_ctx の不透明度を制御し、
    // radiusXform が渡された場合は _radiusAt の出力を変換する。
    _drawPointSequence(points, alphaScale, prevPoint, radiusXform = null) {
        if (points.length === 0) return prevPoint;
        const ctx = this.CANVAS.brush_ctx;
        const savedAlpha = ctx.globalAlpha;
        const savedXform = this._activeRadiusXform;
        ctx.globalAlpha = alphaScale;
        this._activeRadiusXform = radiusXform;
        try {
            let last = prevPoint;
            for (const cp of points) {
                this._drawSegment(last, cp);
                last = cp;
            }
            return last;
        } finally {
            ctx.globalAlpha = savedAlpha;
            this._activeRadiusXform = savedXform;
        }
    }

    // 確定点群の描画フック。既定は単一パス。ペン側で override して二重描画等を実現する。
    _drawCommits(commits, prevPoint) {
        return this._drawPointSequence(commits, 1.0, prevPoint);
    }

    // 円スタンプ (既定ニブ)
    _drawStamp(cp) {
        const rTrue = this._radiusAt(cp);
        if (rTrue <= 0) return;
        const r = Math.max(rTrue, this.subPxFloor);
        const alphaScale = this._subPxAlpha(rTrue);
        const ctx = this.CANVAS.brush_ctx;
        const saved = ctx.globalAlpha;
        ctx.globalAlpha = saved * alphaScale;
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = saved;
    }

    // ２点間の塗り (半径可変の外接共通接線で構成した凸多角形)
    _drawSegment(p1, p2) {
        if (!p1) {
            this._drawStamp(p2);
            return;
        }
        const r1True = this._radiusAt(p1);
        const r2True = this._radiusAt(p2);
        // 両端ともゼロ → 何も描けない
        if (r1True <= 0 && r2True <= 0) return;
        // サブピクセル幅対応: 形状は >= subPxFloor にクランプ、不透明度で減衰
        const r1 = Math.max(r1True, this.subPxFloor);
        const r2 = Math.max(r2True, this.subPxFloor);
        const segAlpha = (this._subPxAlpha(r1True) + this._subPxAlpha(r2True)) / 2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.5) {
            this._drawStamp(p2);
            return;
        }
        // 外接共通接線の傾き: sin α = (r2 - r1) / d
        const sinA = (r2 - r1) / d;
        if (Math.abs(sinA) >= 0.999) {
            // 一方の円が他方を完全に包含 → 大きい方だけ塗って終わり
            const big = (r1 > r2) ? p1 : p2;
            this._drawStamp(big);
            // big が p2 のときは二重描画になる (サブピクセルα/消しゴムで濃くなる) ため回避
            if (big !== p2) this._drawStamp(p2);
            return;
        }
        const cosA = Math.sqrt(1 - sinA * sinA);
        const ux = dx / d;
        const uy = dy / d;
        // 上側接線における外向き垂線 (p_up = (-uy, ux) を α 回転)
        const nUx = -uy * cosA - ux * sinA;
        const nUy =  ux * cosA - uy * sinA;
        // 下側接線における外向き垂線 (p_down = (uy, -ux) を α 回転)
        const nLx =  uy * cosA + ux * sinA;
        const nLy =  uy * sinA - ux * cosA;
        const ctx = this.CANVAS.brush_ctx;
        const saved = ctx.globalAlpha;
        ctx.globalAlpha = saved * segAlpha;
        ctx.beginPath();
        ctx.moveTo(p1.x + r1 * nUx, p1.y + r1 * nUy);
        ctx.lineTo(p2.x + r2 * nUx, p2.y + r2 * nUy);
        ctx.lineTo(p2.x + r2 * nLx, p2.y + r2 * nLy);
        ctx.lineTo(p1.x + r1 * nLx, p1.y + r1 * nLy);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = saved;
        // 終端のキャップ円: サブピクセル半透明モードでは省略 (ポリゴンタイリングで均一化)
        const bothSubPx = this.useSubPxAlpha
            && r1True < this.subPxFloor && r2True < this.subPxFloor;
        if (!bothSubPx) {
            this._drawStamp(p2);
        }
    }

    // RECT / CIRCLE / 直線モード: 毎フレーム全体を再描画
    _drawShapeFull() {
        const ctx = this.CANVAS.brush_ctx;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);

        const firstPoint = this.input_position[0];
        const currentPoint = this.input_position[this.input_position.length - 1];

        switch (this.drawmode) {
            case this.axpObj.CONST.DRAW_FREEHAND: {
                // ここに来るのは isLine モードのみ
                if (this.axpObj.isLine) {
                    this._drawStraight(firstPoint, currentPoint);
                }
                break;
            }
            case this.axpObj.CONST.DRAW_RECT:
                ctx.strokeRect(
                    firstPoint.x,
                    firstPoint.y,
                    currentPoint.x - firstPoint.x,
                    currentPoint.y - firstPoint.y
                );
                break;
            case this.axpObj.CONST.DRAW_CIRCLE: {
                const r = calcDistance(
                    firstPoint.x,
                    firstPoint.y,
                    currentPoint.x,
                    currentPoint.y
                );
                ctx.beginPath();
                ctx.arc(firstPoint.x, firstPoint.y, r, 0, Math.PI * 2, true);
                ctx.stroke();
                break;
            }
        }
        this.write();
    }

    // 直線モードの描画 (始点→終点を 1 区間として円スタンプ＋多角形塗り)
    _drawStraight(p1, p2) {
        const a = { x: p1.x, y: p1.y, pressure: 1.0 };
        const b = { x: p2.x, y: p2.y, pressure: 1.0 };
        this._drawStamp(a);
        this._drawSegment(a, b);
    }
}
