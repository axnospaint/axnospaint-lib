// @description ペン定義：親クラス(PenObj)＞描画ペン共通クラス
//
// スタンプ系 (StampPenBase) と蓄積系 (AccumulativePenBase) の双方が共有する、
// 「キャンバスに描画するペン」共通の値の既定・ブラシ初期化・描画開始の前段処理を持つ。
// パイプライン駆動か否か (start/move/end の中身) は各サブ基底クラスで定義する。

import { PenObj } from './_penobj.js';
import { range_index } from './rangeindex.js';
import { createTonePattern } from '../etc.js';

export class DrawingPenBase extends PenObj {
    constructor(option) {
        super();
        this.axpObj = option.axpObj;
        this.CANVAS = option.CANVAS;
        // 値の既定 (各ペンで差分上書き)
        this.type = 'draw';
        this.size = 1;
        this.index = range_index(this.size);
        this.alpha = 100;
        this.toneLevel = 16;
        this.blurLevel = 1;
        // 制御
        this.usePenGuide = true;
        this.usePenPreview = true;
        this.usePenLock = true;
        this.usePenStyle = true;
        this.canUndo = true;
        this.usePressure = false;        // 既定: 筆圧なし (Round のみ true)
        this.usePressureControl = false; // 既定: 筆圧チェック非表示 (Round のみ true)
        this.useSubPxAlphaControl = false;
        // 描画
        this.borderRadius = 50;
        this.borderStyle = 'normal';
        this.lineCap = 'round';
        this.lineJoin = 'round';
    }

    // ニブ半幅 (描画半径やブラシ線幅の基準)。サブピクセル幅対策で 0.25 引く。
    _halfWidth() {
        return (this.size - 0.25) / 2;
    }

    // 入力イベント → パイプライン入力 (生筆圧のまま。カーブ変換はパイプライン側)
    _toInput(x, y, e) {
        const rawPressure = (e && typeof e.pressure === 'number') ? e.pressure : 1.0;
        const pointerType = e ? e.pointerType : 'mouse';
        const t = (e && typeof e.timeStamp === 'number') ? e.timeStamp : performance.now();
        return { x, y, rawPressure, pointerType, t };
    }

    // ブラシ初期化 (既定: 通常色 / トーン濃度対応)。
    // 消しゴム・ブラシ等は destination-out やグラデのため override する。
    init_brush(option) {
        // 合成モードと不透明度
        this.init_globalCompositeOperation(option);
        this.CANVAS.draw_ctx.globalAlpha = this.alpha / 100;
        // ブラシ
        this.CANVAS.brush_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.brush_ctx.globalAlpha = 1; // 先に不透明度100%の描画データを作成する
        this.CANVAS.brush_ctx.lineWidth = this.size - 0.25;
        let style;
        if (this.axpObj.config('axp_config_form_ToneLevel') === 'on' &&
            this.toneLevel !== null &&
            this.toneLevel !== 16) {
            // トーン濃度使用時トーンパターン生成して色指定
            style = createTonePattern(this.toneLevel, this.getColor());
        } else {
            // 通常時の色指定
            style = this.getColor();
        }
        this.CANVAS.brush_ctx.strokeStyle = style;
        this.CANVAS.brush_ctx.fillStyle = style;
        this.CANVAS.brush_ctx.lineCap = this.lineCap;
        this.CANVAS.brush_ctx.lineJoin = this.lineJoin;
        this.CANVAS.brush_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
        this.blur();
    }

    // 累積系子クラスのみ意味あり (Dot: ImageData 初期化、Fude: lineWidth 初期化など)。
    start_draw() { }

    // 描画開始の共通前段 (書込禁止チェック → モード設定 → 座標記憶 → 保存 → ブラシ初期化)。
    // 書込禁止なら false を返す。
    _startCommon(x, y, option) {
        if (this.axpObj.layerSystem.isWriteProtection()) {
            return false;
        }
        this.set_modeflag();
        // 入力座標の記憶
        this.input_position = [];
        this.input_position.push({ x, y });
        // 描画開始時のイメージ記憶
        this.axpObj.layerSystem.save();
        this.axpObj.layerSystem.isStrokeActive = true;
        this.axpObj.layerSystem.activateFastPath();
        if (this.axpObj.layerSystem.compositeFastPathActive) {
            this.CANVAS.undoBase_ctx.putImageData(this.axpObj.layerSystem.load(), 0, 0);
        }
        this.init_brush(option);
        this.start_draw(x, y);
        return true;
    }
}
