// @description ペン定義：ピクセル演算系共通＞混色ペン
//
// 丸型の作用領域でキャンバス内容を混色するペン。２つの効果を持つ。
//   広がり (diffusion): ストローク開始時スナップショットのガウシアン近似ぼかしを、
//     幾何マスク M (max 合成) の割合で合成する。同一ストローク内で軌跡が交差しても
//     二重にぼけない。σ は「広がり」スライダーと半径から決まる。
//   引きずり (drag): 運搬色バッファ C_carried を保持し、確定点ごとに
//     out = (1-α)・canvas + α・carried / carried ← (1-β)・carried + β・canvas
//     で色を運搬する (移流)。逐次依存のため確定点順に作業バッファへ適用する。
//     置き付け率・取り込み率はスタンプ間実距離でべき正規化する (弧状ムラ対策)。
//   硬さ (hardness): 半径方向フォールオフ f(u) = 1 − S(u^k) の指数 k を制御。
//     プラトーなし・縁で常に強度0 (詳細は _falloff を参照)。
//
// ピクセル演算は premultiply → 演算 → unmultiply の順を厳守する
// (透明ピクセルの RGB を素通しすると黒フリンジが生じるため)。

import { PixelFilterPenBase } from './_pixelfilterpen.js';
import { range_index } from './rangeindex.js';

// 内部固定パラメータ
const PRESSURE_GAMMA = 0.6;    // 筆圧→寄与度カーブ
const ALPHA_MIN_RATIO = 0.15;  // 筆圧最小時の寄与度 (α_max 比)
const DWELL_TAU_MS = 300;      // 滞留項の飽和時定数
const DWELL_BASE = 0.55;       // 滞留 0ms 時の寄与ゲイン (滞留で 1.0 へ飽和)
const CARRY_BETA = 0.25;       // 引きずりの色取り込み率
const DRAG_ALPHA_MAX = 0.9;    // 引きずり置き付け率の上限 (1.0=完全置換だと
                               // 最終スタンプの円盤輪郭が焼き付くため 1 未満に制限)
const SIGMA_MAX = 16;          // ぼかし σ の上限
const LUT_N = 512;             // フォールオフ／置き付け率 LUT の要素数 (u² 引数)

// σ に対応する box blur 幅×3 (Gaussian 近似の標準式)
function boxesForGauss(sigma, n) {
    const wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
    let wl = Math.floor(wIdeal);
    if (wl % 2 === 0) wl--;
    const wu = wl + 2;
    const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
    const m = Math.round(mIdeal);
    const sizes = [];
    for (let i = 0; i < n; i++) {
        sizes.push(i < m ? wl : wu);
    }
    return sizes;
}

// 混色ペン
export class Diffusion extends PixelFilterPenBase {
    constructor(option) {
        super(option);
        // 値（ピクセル演算系共通からの差分）
        this.name = this.axpObj._('@PENNAME.DIFFUSION');
        this.size = 20;
        this.index = range_index(this.size);
        this.alpha = 100;    // 寄与度の上限 α_max (不透明度スライダー)
        // 初期値はプリセット1「ぼかしペン」と一致させる (初回から反映中表示になる)
        this.hardness = 70;  // 足跡フォールオフの硬さ (0-100)
        this.diffusion = 80; // ぼかしの広がり (0-100)
        this.drag = 0;       // 引きずりの強さ (0-100)

        this.init_save();

        // ストローク中バッファ (startPixelStroke で確保、endPixelStroke で解放)
        this.basePre = null;   // premultiplied ストローク開始時スナップショット
        this.blurPre = null;   // basePre のぼかし
        this.tmpPre = null;    // box blur 中間バッファ
        this.mask = null;      // 幾何マスク M (max 合成)
        this.carried = null;   // 運搬色パッチ (premultiplied)
        this.boxRads = null;   // box blur 半径列
        this.fLut = null;      // フォールオフ LUT (u² 引数、毎画素 sqrt/pow の除去)
        this.adLut = null;     // 引きずり置き付け率 LUT (スタンプ毎に再計算)
        this.pendingBlurSync = null; // 複合時の局所再ブラー待ち矩形 (フレーム末尾で処理)
        this.dwellMs = 0;
        this.dwellAnchor = null;
        this.masked = false;
    }

    // ── ストローク管理 ───────────────────────────

    startPixelStroke() {
        const W = this.work.width;
        const H = this.work.height;
        this.W = W;
        this.H = H;
        this.masked = this.axpObj.layerSystem.getMasked();
        this.dwellMs = 0;
        this.dwellAnchor = null;
        this.carried = null;
        this.pendingBlurSync = null;
        // 硬さ→フォールオフ指数 k (1〜10)。ストローク中不変のためキャッシュする
        // (_pixelfilterpen.js の _gap() と同じマッピングに揃えること)
        this.kExp = 1 + 9 * Math.min(Math.max(this.hardness, 0), 100) / 100;
        // フォールオフ LUT: u² を引数にとる (idx = d²/r² · (LUT_N-1))。
        // カーネル内の毎画素 sqrt + pow を除去する
        this.fLut = new Float32Array(LUT_N);
        for (let i = 0; i < LUT_N; i++) {
            this.fLut[i] = this._falloff(Math.sqrt(i / (LUT_N - 1)));
        }
        this.adLut = new Float32Array(LUT_N);

        // premultiplied スナップショット
        this.basePre = new Uint8ClampedArray(W * H * 4);
        this._premultiplyFrom(this.work.data, this.basePre, 0, 0, W - 1, H - 1);

        if (this.diffusion > 0) {
            // ぼかし画像をストローク開始時に一括生成 (σ はストローク中固定)
            const r = Math.max(this._halfWidth(), 0.5);
            const sigma = Math.min(SIGMA_MAX, Math.max(0.5, (this.diffusion / 100) * r * 0.5));
            this.boxRads = boxesForGauss(sigma, 3).map((s) => (s - 1) / 2);
            this.blurPre = new Uint8ClampedArray(W * H * 4);
            this.tmpPre = new Uint8ClampedArray(W * H * 4);
            this.mask = new Float32Array(W * H);
            this._boxBlurRegion(0, 0, W - 1, H - 1);
        }
    }

    endPixelStroke() {
        this.basePre = null;
        this.blurPre = null;
        this.tmpPre = null;
        this.mask = null;
        this.carried = null;
        this.boxRads = null;
        this.fLut = null;
        this.adLut = null;
        this.pendingBlurSync = null;
    }

    // 確定点ごとのカーネル適用
    applyPoint(cp, prev) {
        const r = Math.max(this._halfWidth(), 0.5);
        // 筆圧 → 寄与度 (太さは変えない)
        const aMax = this.alpha / 100;
        const aMin = ALPHA_MIN_RATIO * aMax;
        const p = Math.max(0, Math.min(1, cp.pressure));
        const alphaEff = aMin + (aMax - aMin) * Math.pow(p, PRESSURE_GAMMA);
        // 滞留項 (ぼかしのみ): アンカー点の近傍に留まり続けた時間で寄与が深まる。
        // 直前確定点との変位で判定すると、確定点間隔 gap (< r/4) が常に「滞留」と
        // 誤判定され、移動中でも強度が経過時間で上昇してしまうため、
        // アンカーからの距離で判定する (r/4 を出たらアンカーを更新)。
        if (this.dwellAnchor === null) {
            this.dwellAnchor = { x: cp.x, y: cp.y };
        }
        if (prev) {
            const dt = Math.max(0, cp.t - prev.t);
            const dist = Math.hypot(cp.x - this.dwellAnchor.x, cp.y - this.dwellAnchor.y);
            if (dist < r / 4) {
                this.dwellMs += dt;
            } else {
                this.dwellAnchor = { x: cp.x, y: cp.y };
                this.dwellMs = Math.max(0, this.dwellMs - dt * 2);
            }
        }
        // 足跡バウンディングボックス (キャンバスにクリップ)
        const x0 = Math.max(0, Math.floor(cp.x - r));
        const x1 = Math.min(this.W - 1, Math.ceil(cp.x + r));
        const y0 = Math.max(0, Math.floor(cp.y - r));
        const y1 = Math.min(this.H - 1, Math.ceil(cp.y + r));
        if (x0 > x1 || y0 > y1) return;

        if (this.diffusion > 0) {
            this._applyDiffusion(cp, r, alphaEff, x0, y0, x1, y1);
        }
        if (this.drag > 0) {
            // スタンプ間実距離によるべき正規化係数 (間隔 r/2 を基準 s=1 とする)。
            // gap を詰めてもスタンプ密度に依らず蓄積量が一定になり、
            // スタンプ数の離散段差による弧状の濃度ムラを抑える。
            const spacing = prev ? Math.hypot(cp.x - prev.x, cp.y - prev.y) : this._gap();
            const sNorm = Math.min(1, Math.max(0.05, spacing / (r / 2)));
            this._applyDrag(cp, r, alphaEff, sNorm, x0, y0, x1, y1);
            if (this.diffusion > 0) {
                // 複合時: 引きずり後の見た目を新しいベースとして採用し、
                // マスクをリセットする (以降のぼかしは新ベースに新規に作用)。
                // ベース書き戻しとマスク消去は安価なため即時実行するが、
                // 支配的コストの局所再ブラー (box blur 6パス) は確定点ごとに行うと
                // 大サイズで処理落ちするため、矩形を蓄積してフレーム末尾
                // (beforeFrameFlush) に1回だけ実行する。フレーム内の後続確定点は
                // 一時的に旧ベースのぼかし画像を参照するが、1フレーム以内の
                // 遅延であり視覚上問題ない。
                this._premultiplyFrom(this.work.data, this.basePre, x0, y0, x1, y1);
                for (let y = y0; y <= y1; y++) {
                    this.mask.fill(0, y * this.W + x0, y * this.W + x1 + 1);
                }
                const pend = this.pendingBlurSync;
                if (pend === null) {
                    this.pendingBlurSync = { x0, y0, x1, y1 };
                } else {
                    if (x0 < pend.x0) pend.x0 = x0;
                    if (y0 < pend.y0) pend.y0 = y0;
                    if (x1 > pend.x1) pend.x1 = x1;
                    if (y1 > pend.y1) pend.y1 = y1;
                }
            }
        }
    }

    // フレーム反映直前: 複合時の局所再ブラーをまとめて実行
    beforeFrameFlush() {
        const pend = this.pendingBlurSync;
        if (pend === null) return;
        this.pendingBlurSync = null;
        this._boxBlurRegion(pend.x0, pend.y0, pend.x1, pend.y1);
    }

    // ── フォールオフ ─────────────────────────────

    // 半径方向フォールオフ f(u) = 1 − S(u^k), S(t) = 3t² − 2t³
    // プラトーを持たず、縁 u=1 で f=0 かつ f'=0 が硬さに依らず常に成立する
    // (縁に強度が残らないため、引きずり時にスタンプ輪郭の弧が焼き付かない)。
    // 硬さは指数 k (1〜10) として山の肩の位置・頂上の平坦さを連続制御する。
    _falloff(u) {
        if (u >= 1) return 0;
        if (u <= 0) return 1;
        const t = Math.pow(u, this.kExp);
        return 1 - t * t * (3 - 2 * t);
    }

    // ── ぼかし (diffusion) ───────────────────────

    _applyDiffusion(cp, r, alphaEff, x0, y0, x1, y1) {
        const W = this.W;
        const work = this.work.data;
        const basePre = this.basePre;
        const blurPre = this.blurPre;
        const mask = this.mask;
        const dwellGain = DWELL_BASE + (1 - DWELL_BASE) * (1 - Math.exp(-this.dwellMs / DWELL_TAU_MS));
        const rr = r * r;
        const fLut = this.fLut;
        const lutScale = (LUT_N - 1) / rr;
        const gain = alphaEff * dwellGain;
        for (let y = y0; y <= y1; y++) {
            const fy = y + 0.5 - cp.y;
            const fy2 = fy * fy;
            if (fy2 > rr) continue;
            // 円内の x 範囲に絞る (bbox 四隅の空走査を省く)
            const halfSpan = Math.sqrt(rr - fy2);
            const xs = Math.max(x0, Math.ceil(cp.x - 0.5 - halfSpan));
            const xe = Math.min(x1, Math.floor(cp.x - 0.5 + halfSpan));
            for (let x = xs; x <= xe; x++) {
                const fx = x + 0.5 - cp.x;
                const d2 = fx * fx + fy2;
                let li = (d2 * lutScale) | 0;
                if (li >= LUT_N) li = LUT_N - 1;
                const f = fLut[li];
                if (f <= 0) continue;
                const m = gain * f;
                const i = y * W + x;
                if (m <= mask[i]) continue; // max 合成: 二重ぼかしなし
                mask[i] = m;
                const q = i * 4;
                this._writeBlended(
                    work, q,
                    (1 - m) * basePre[q] + m * blurPre[q],
                    (1 - m) * basePre[q + 1] + m * blurPre[q + 1],
                    (1 - m) * basePre[q + 2] + m * blurPre[q + 2],
                    (1 - m) * basePre[q + 3] + m * blurPre[q + 3],
                    basePre[q + 3]
                );
            }
        }
    }

    // ── 引きずり (drag) ──────────────────────────

    _applyDrag(cp, r, alphaEff, sNorm, x0, y0, x1, y1) {
        const W = this.W;
        const work = this.work.data;
        const icx = Math.floor(cp.x);
        const icy = Math.floor(cp.y);
        // 運搬色パッチ: 初回足跡のキャンバス内容で初期化
        if (this.carried === null) {
            const R = Math.ceil(r);
            this.carriedR = R;
            const D = 2 * R + 1;
            this.carriedD = D;
            this.carried = new Float32Array(D * D * 4);
            for (let oy = 0; oy < D; oy++) {
                const sy = Math.max(0, Math.min(this.H - 1, icy + oy - R));
                for (let ox = 0; ox < D; ox++) {
                    const sx = Math.max(0, Math.min(this.W - 1, icx + ox - R));
                    const sp = (sy * W + sx) * 4;
                    const a = work[sp + 3];
                    const t = (oy * D + ox) * 4;
                    this.carried[t] = work[sp] * a / 255;
                    this.carried[t + 1] = work[sp + 1] * a / 255;
                    this.carried[t + 2] = work[sp + 2] * a / 255;
                    this.carried[t + 3] = a;
                }
            }
        }
        const carried = this.carried;
        const R = this.carriedR;
        const D = this.carriedD;
        const dragRate = this.drag / 100;
        const rr = r * r;
        // 色の取り込み率は足跡内で一様 (フォールオフを掛けるとセルごとに
        // 洗い出し速度が変わり、古い色がリング状の残像として焼き付くため)
        const bUniform = 1 - Math.pow(1 - CARRY_BETA, sNorm);
        // 置き付け率 LUT (u² 引数): min(上限, dragRate·alphaEff·f) の sNorm べき正規化
        // (逐次合成の飽和対策)。スタンプ内で alphaEff・sNorm は一定のため、
        // Math.pow を毎画素→LUT_N 回に削減する
        const fLut = this.fLut;
        const adLut = this.adLut;
        const gain = dragRate * alphaEff;
        for (let i = 0; i < LUT_N; i++) {
            const aBase = Math.min(DRAG_ALPHA_MAX, gain * fLut[i]);
            adLut[i] = 1 - Math.pow(1 - aBase, sNorm);
        }
        const lutScale = (LUT_N - 1) / rr;
        for (let y = y0; y <= y1; y++) {
            const fy = y + 0.5 - cp.y;
            const fy2 = fy * fy;
            if (fy2 > rr) continue;
            const oy = y - icy + R;
            if (oy < 0 || oy >= D) continue;
            // 円内の x 範囲に絞る (bbox 四隅の空走査を省く)
            const halfSpan = Math.sqrt(rr - fy2);
            const xs = Math.max(x0, Math.ceil(cp.x - 0.5 - halfSpan));
            const xe = Math.min(x1, Math.floor(cp.x - 0.5 + halfSpan));
            for (let x = xs; x <= xe; x++) {
                const fx = x + 0.5 - cp.x;
                const d2 = fx * fx + fy2;
                let li = (d2 * lutScale) | 0;
                if (li >= LUT_N) li = LUT_N - 1;
                const ad = adLut[li];
                if (ad <= 0.0005) continue;
                const ox = x - icx + R;
                if (ox < 0 || ox >= D) continue;
                const q = (y * W + x) * 4;
                const t = (oy * D + ox) * 4;
                // 現在のキャンバス色 (premultiply)
                const ca = work[q + 3];
                const cr = work[q] * ca / 255;
                const cg = work[q + 1] * ca / 255;
                const cb = work[q + 2] * ca / 255;
                // 運搬色の置き付け
                this._writeBlended(
                    work, q,
                    (1 - ad) * cr + ad * carried[t],
                    (1 - ad) * cg + ad * carried[t + 1],
                    (1 - ad) * cb + ad * carried[t + 2],
                    (1 - ad) * ca + ad * carried[t + 3],
                    this.basePre ? this.basePre[q + 3] : ca
                );
                // 色の取り込み (置き付け前のキャンバス色を一様レートで吸収)
                const b = bUniform;
                carried[t] = (1 - b) * carried[t] + b * cr;
                carried[t + 1] = (1 - b) * carried[t + 1] + b * cg;
                carried[t + 2] = (1 - b) * carried[t + 2] + b * cb;
                carried[t + 3] = (1 - b) * carried[t + 3] + b * ca;
            }
        }
    }

    // ── ピクセル入出力 ───────────────────────────

    // premultiplied 合成結果 (pr,pg,pb,pa: 0-255 スケール) を unmultiply して work へ書く。
    // 透明部分の保護 (masked) 時はベースのアルファ baseA を維持し、baseA=0 は書き換えない。
    _writeBlended(work, q, pr, pg, pb, pa, baseA) {
        if (this.masked) {
            if (baseA === 0) return;
            if (pa > 0.001) {
                work[q] = pr * 255 / pa;
                work[q + 1] = pg * 255 / pa;
                work[q + 2] = pb * 255 / pa;
            }
            work[q + 3] = baseA;
        } else {
            if (pa > 0.001) {
                work[q] = pr * 255 / pa;
                work[q + 1] = pg * 255 / pa;
                work[q + 2] = pb * 255 / pa;
                work[q + 3] = pa;
            } else {
                work[q] = 0;
                work[q + 1] = 0;
                work[q + 2] = 0;
                work[q + 3] = 0;
            }
        }
    }

    // straight (work.data) → premultiplied (dst) 変換を矩形範囲に適用
    _premultiplyFrom(src, dst, x0, y0, x1, y1) {
        const W = this.W;
        for (let y = y0; y <= y1; y++) {
            let q = (y * W + x0) * 4;
            for (let x = x0; x <= x1; x++, q += 4) {
                const a = src[q + 3];
                dst[q] = src[q] * a / 255;
                dst[q + 1] = src[q + 1] * a / 255;
                dst[q + 2] = src[q + 2] * a / 255;
                dst[q + 3] = a;
            }
        }
    }

    // ── box blur (ガウシアン近似) ─────────────────

    // basePre の矩形範囲 (変更されたベース領域) から blurPre を更新する。
    // 変更の影響はぼかし台座の総和 (support) だけ外側の blurPre にも及ぶため、
    // 最終パスの書き込み範囲を support 分広げ、さらに各パスは後続パスの
    // 読み取り半径ぶん外側へ広げる (padAfter)。これにより局所再計算でも
    // 全体計算と同じ結果になる。
    _boxBlurRegion(x0, y0, x1, y1) {
        const rads = this.boxRads;
        // パス列: H r0, V r0, H r1, V r1, H r2, V r2
        const seq = [rads[0], rads[0], rads[1], rads[1], rads[2], rads[2]];
        const support = seq.reduce((a, b) => a + b, 0);
        const padAfter = new Array(6).fill(support);
        for (let k = 4; k >= 0; k--) {
            padAfter[k] = padAfter[k + 1] + seq[k + 1];
        }
        // ping-pong: base→tmp→blur→tmp→blur→tmp→blur
        const bufs = [
            [this.basePre, this.tmpPre],
            [this.tmpPre, this.blurPre],
            [this.blurPre, this.tmpPre],
            [this.tmpPre, this.blurPre],
            [this.blurPre, this.tmpPre],
            [this.tmpPre, this.blurPre],
        ];
        for (let k = 0; k < 6; k++) {
            const pad = padAfter[k];
            const wx0 = Math.max(0, x0 - pad);
            const wy0 = Math.max(0, y0 - pad);
            const wx1 = Math.min(this.W - 1, x1 + pad);
            const wy1 = Math.min(this.H - 1, y1 + pad);
            if (k % 2 === 0) {
                this._boxBlurH(bufs[k][0], bufs[k][1], seq[k], wx0, wy0, wx1, wy1);
            } else {
                this._boxBlurV(bufs[k][0], bufs[k][1], seq[k], wx0, wy0, wx1, wy1);
            }
        }
    }

    // 水平 box blur (スライディングウィンドウ、端はクランプ)
    _boxBlurH(src, dst, rad, x0, y0, x1, y1) {
        const W = this.W;
        if (rad <= 0) {
            for (let y = y0; y <= y1; y++) {
                const s = (y * W + x0) * 4;
                const e = (y * W + x1) * 4 + 4;
                dst.set(src.subarray(s, e), s);
            }
            return;
        }
        const norm = 1 / (2 * rad + 1);
        for (let y = y0; y <= y1; y++) {
            const row = y * W;
            let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
            for (let k = x0 - rad; k <= x0 + rad; k++) {
                const kx = k < 0 ? 0 : (k >= W ? W - 1 : k);
                const q = (row + kx) * 4;
                s0 += src[q]; s1 += src[q + 1]; s2 += src[q + 2]; s3 += src[q + 3];
            }
            for (let x = x0; x <= x1; x++) {
                const q = (row + x) * 4;
                dst[q] = s0 * norm;
                dst[q + 1] = s1 * norm;
                dst[q + 2] = s2 * norm;
                dst[q + 3] = s3 * norm;
                const add = x + rad + 1;
                const rem = x - rad;
                const qa = (row + (add >= W ? W - 1 : add)) * 4;
                const qr = (row + (rem < 0 ? 0 : rem)) * 4;
                s0 += src[qa] - src[qr];
                s1 += src[qa + 1] - src[qr + 1];
                s2 += src[qa + 2] - src[qr + 2];
                s3 += src[qa + 3] - src[qr + 3];
            }
        }
    }

    // 垂直 box blur (スライディングウィンドウ、端はクランプ)
    _boxBlurV(src, dst, rad, x0, y0, x1, y1) {
        const W = this.W;
        const H = this.H;
        if (rad <= 0) {
            for (let y = y0; y <= y1; y++) {
                const s = (y * W + x0) * 4;
                const e = (y * W + x1) * 4 + 4;
                dst.set(src.subarray(s, e), s);
            }
            return;
        }
        const norm = 1 / (2 * rad + 1);
        for (let x = x0; x <= x1; x++) {
            let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
            for (let k = y0 - rad; k <= y0 + rad; k++) {
                const ky = k < 0 ? 0 : (k >= H ? H - 1 : k);
                const q = (ky * W + x) * 4;
                s0 += src[q]; s1 += src[q + 1]; s2 += src[q + 2]; s3 += src[q + 3];
            }
            for (let y = y0; y <= y1; y++) {
                const q = (y * W + x) * 4;
                dst[q] = s0 * norm;
                dst[q + 1] = s1 * norm;
                dst[q + 2] = s2 * norm;
                dst[q + 3] = s3 * norm;
                const add = y + rad + 1;
                const rem = y - rad;
                const qa = ((add >= H ? H - 1 : add) * W + x) * 4;
                const qr = ((rem < 0 ? 0 : rem) * W + x) * 4;
                s0 += src[qa] - src[qr];
                s1 += src[qa + 1] - src[qr + 1];
                s2 += src[qa + 2] - src[qr + 2];
                s3 += src[qa + 3] - src[qr + 3];
            }
        }
    }
}
