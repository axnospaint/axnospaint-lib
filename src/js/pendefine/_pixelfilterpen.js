// @description ペン定義：描画ペン共通＞ピクセル演算系ペン共通クラス
//
// レイヤー画素を読み取り・加工して書き戻す (read-modify-write) ペンの基底。
// スタンプ系と同じ StrokePipeline から確定点ストリームを受け取るが、
// ブラシキャンバスへのベクタ描画ではなく、作業 ImageData (work) を直接更新する。
//
// 仕組み:
//   - ストローク開始時に現在レイヤー画像の複製 (work) を作成し、
//     layerSystem.replaceCurrentImage() でレイヤー画像と差し替える (isBlank 維持)。
//     layerSystem.save() が保持するのは差し替え前の ImageData への参照であるため、
//     end_common() の差分アンドゥは無改修で機能する。
//   - work はカーネル (applyPoint) が in-place 更新し、write() の updateCanvas()
//     による再合成 (putImageData) で画面に反映される。
//   - GPU fast path はブラシ合成前提のため使用しない (activateFastPath を呼ばない)。
//     end_common() は compositeFastPathActive=false のままなら無改修で整合する。
//   - 透明色 (右クリック描画) や透明部分の保護は合成モードでは表現できないため、
//     init_globalCompositeOperation は使用しない。保護はカーネル側で行う。

import { DrawingPenBase } from './_drawingpen.js';
import { StrokePipeline, readStrokeSettings } from '../stabilizer/strokePipeline.js';

export class PixelFilterPenBase extends DrawingPenBase {
    constructor(option) {
        super(option);
        // 制御 (描画ペン共通からの差分)
        this.usePenStyle = false;        // ピクセル演算はフリーハンド専用 (図形モード非表示)
        this.usePressure = true;         // 筆圧は太さでなく寄与度 (α) に反映する
        this.usePressureControl = true;
        this.useSubPxAlphaControl = false;
        this.toneLevel = null;           // トーン濃度スライダー非表示
        this.blurLevel = null;           // ぼかし度 (shadowBlur) スライダー非表示
        this.borderStyle = 'solid';      // 透明色の概念がないためカーソルは常に実線
        this.startRawPx = 2;             // 開幕この距離まで筆圧フィルタを素通し
        this.work = null;                // ストローク中の作業 ImageData (レイヤー画像と同一実体)
        this.pipeline = null;
        this.lastCommitted = null;
        this.enforcesSelectionConstraintInKernel = false;
    }

    // フリーハンド固定 (非表示の drawMode select の stale 値や isLineMod を読まない)
    set_modeflag() {
        this.drawmode = this.axpObj.CONST.DRAW_FREEHAND;
        this.axpObj.isDrawing = true;
        this.axpObj.isDrawn = false;
        this.axpObj.isDrawCancel = false;
        this.isLastDrawing = false;
    }

    // 描画開始の共通前段。ブラシ初期化・fast path 起動を行わない代わりに、
    // 作業 ImageData を生成してレイヤー画像と差し替える。
    _startCommon(x, y, option) {
        if (this.axpObj.layerSystem.isWriteProtection()) {
            return false;
        }
        this.set_modeflag();
        // 入力座標の記憶
        this.input_position = [];
        this.input_position.push({ x, y });
        // 描画開始時のイメージ記憶 (差し替え前の参照がアンドゥ差分の基準になる)
        this.axpObj.layerSystem.save();
        this.axpObj.layerSystem.isStrokeActive = true;
        this.beginSelectionStrokeConstraint();
        const base = this.selectionBaseImage || this.axpObj.layerSystem.load();
        this.work = new ImageData(
            new Uint8ClampedArray(base.data),
            base.width,
            base.height
        );
        // isBlank を維持したまま差し替える (本ペンは透明画素から内容を生成できないため、
        // 空レイヤーはストローク後も必ず空。write() だと開始しただけで非空扱いになる)
        this.axpObj.layerSystem.replaceCurrentImage(this.work);
        this.startPixelStroke(option);
        return true;
    }

    // 描画開始
    start(x, y, e, option) {
        if (!this._startCommon(x, y, option)) return;
        this.pipeline = new StrokePipeline();
        this.pipeline.configure({
            ...readStrokeSettings(),
            usePressure: this.usePressure,
            startPx: this.startRawPx,
            zoom: this.axpObj.scale / 100,
            brushWidth: this.size,
            // 半径テーパー前提の終端ハライは寄与度ベースの本ペンでは使用しない
            flickTaper: null,
            enableFlickTaper: false,
        });
        this.lastCommitted = null;
        this._applyCommits(this.pipeline.onStart(this._toInput(x, y, e)));
    }

    // 描画中
    move(x, y, e) {
        if (!this.axpObj.isDrawing || this.axpObj.isDrawCancel) return;
        this.axpObj.isDrawn = true;
        this.input_position.push({ x, y });
        this._applyCommits(this.pipeline.onMove(this._toInput(x, y, e), this._gap()));
        this.write();
    }

    // 描画終了
    end(x, y, e) {
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            this.isLastDrawing = true;
            this.input_position.push({ x, y });
            this._applyCommits(this.pipeline.onEnd(this._toInput(x, y, e), this._gap()));
            this.write();
        } else if (this.work && this.axpObj.isDrawCancel) {
            // 描画キャンセル (長押しスポイト・ピンチ操作等)。
            // 作業イメージは既にレイヤーに差し替え済みのため、開始時の画像へ戻す。
            this.axpObj.layerSystem.replaceCurrentImage(this.axpObj.layerSystem.load());
        }
        this.endPixelStroke();
        this.work = null;
        this.pipeline = null;
        this.end_common();
    }

    // 確定点間隔: フォールオフのすそ野幅に連動して詰める。
    // フォールオフ f(u) = 1−S(u^k) は縁付近で f ≈ 3k²(1−u)² となり、
    // すそ野幅が約 r/k に縮むため gap = r/(2k) でスタンプ間リップルを防ぐ
    // (k = 1 + 9·hardness/100。diffusion.js の kExp と同じマッピングに揃えること)。
    // hardness を持たないサブクラスは h=0.5 相当で動作する。
    _gap() {
        const r = Math.max(this._halfWidth(), 0.5);
        const h = (typeof this.hardness === 'number')
            ? Math.min(Math.max(this.hardness, 0), 100) / 100
            : 0.5;
        const k = 1 + 9 * h;
        let gap = Math.max(1, Math.min(r / 2, r / (2 * k)));
        // 引きずり使用時は最も柔らかい設定でも r/4 まで締める (逐次合成の安全マージン)
        if (typeof this.drag === 'number' && this.drag > 0) {
            gap = Math.min(gap, Math.max(1, r / 4));
        }
        return gap;
    }

    // 確定点を順に作用させる
    _applyCommits(commits) {
        for (const cp of commits) {
            this.applyPoint(cp, this.lastCommitted);
            this.lastCommitted = cp;
        }
    }

    // レイヤー更新: work は applyPoint で更新済みのため画面への再合成のみ行う。
    // lastEventInFrame / pendingPenFlush の契約は PenObj.write() と同一に保つ
    // (pointermove ハンドラ末尾の強制 flush が pen.write() を直接呼ぶため)。
    write() {
        if (this.axpObj.lastEventInFrame === false) {
            this.axpObj.pendingPenFlush = true;
            return;
        }
        this.axpObj.pendingPenFlush = false;
        this.beforeFrameFlush();
        if (this.work && !this.enforcesSelectionConstraintInKernel) {
            this.applySelectionStrokeConstraint(this.work);
        }
        this.axpObj.layerSystem.updateCanvas(this.axpObj.layerSystem.getId());
    }

    // ── サブクラスフック ─────────────────────────
    // ストローク開始時のバッファ確保
    startPixelStroke() { }
    // 確定点ごとのカーネル適用 (cp: {x, y, pressure, t}, prev: 直前の確定点 or null)
    applyPoint() { }
    // フレーム反映 (updateCanvas) 直前に呼ばれる。確定点ごとに行うと高コストな
    // 処理をフレーム単位にまとめて実行するためのフック
    beforeFrameFlush() { }
    // ストローク終了時のバッファ解放
    endPixelStroke() { }
}
