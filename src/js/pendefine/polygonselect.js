// @description ペン定義：親クラス＞多角形選択

import { PenObj } from './_penobj.js';
import { UTIL, inRange, calcDistance } from '../etc.js';
import { polygonToMask } from '../selectionutil.js';

const MIN_VERTICES = 3;
const CLOSE_HIT_RADIUS = 10;

// 多角形選択：クリックで頂点を配置し、始点付近のクリックで確定する選択ツール。
// なげなわの「切り取って移動」機構とは独立しており、確定した多角形は
// axpObj.selectionMask（キャンバス上の可視化のみ）に反映され、レイヤーのimageデータは
// 一切変更しない。プレビュー描画は頂点配置開始時点のmain_ctxを1度だけキャッシュし
// （_cachePreviewBase）、以降はそのキャッシュへの軽量な drawImage 復元＋プレビュー線の
// 重ね描きのみで完結させる（move()毎に全レイヤーのlayerSystem.draw()は呼ばない）。
// なげなわのようにレイヤーへ一時書き込みはしない
export class PolygonSelect extends PenObj {
    constructor(option) {
        super();
        this.axpObj = option.axpObj;
        this.CANVAS = option.CANVAS;
        // 値（PenObjからの差分）
        this.name = this.axpObj._('@PENNAME.POLYGONSELECT');
        this.type = 'polygonselect';
        this.cursor = 'crosshair';
        // 制御
        this.usePenPreview = false;
        this.usePenLock = false;
        this.usesSelectionMode = true;
        this.canUndo = false;

        // 状態
        this.state = 'idle'; // 'idle' | 'drawing'
        this.vertices = [];
        this.hoverX = 0;
        this.hoverY = 0;
        // 頂点配置開始時点の合成結果を1度だけキャッシュしたオフスクリーンcanvas。
        // 配置中はmove()毎にlayerSystem.draw()（全レイヤー完全再合成）を呼ばず、
        // このキャッシュへの軽量なdrawImageで復元してからプレビュー線を重ね描きする
        this._previewBaseCanvas = null;
        this._previewBaseCtx = null;

        this.init_save();
    }
    setupOverlayEvents() {
        const finishBtn = document.getElementById('axp_canvas_div_polygonFinish');
        const cancelBtn = document.getElementById('axp_canvas_div_polygonCancel');
        if (finishBtn) {
            finishBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            finishBtn.addEventListener('click', () => {
                if (this.state === 'drawing') this.closePolygon();
            });
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            cancelBtn.addEventListener('click', () => {
                if (this.state === 'drawing') this.cancelPolygon();
            });
        }
    }
    init_brush() {
        // レイヤーへの描画を行わないため何もしない
    }
    // 描画開始（クリックで頂点を確定する）
    start() {
        this.set_modeflag();
    }
    // 描画中（ホバー座標を記録し、ゴムバンドプレビューを更新する）
    move(x, y) {
        this.hoverX = x;
        this.hoverY = y;
        if (this.state === 'drawing') {
            this.redrawPreview();
        }
    }
    // 描画終了（クリック確定方式のため、頂点の追加処理はここで行う）
    end(x, y) {
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            if (inRange(x, 0, this.axpObj.x_size) && inRange(y, 0, this.axpObj.y_size)) {
                if (this.state === 'idle') {
                    this.vertices = [{ x, y }];
                    this.state = 'drawing';
                    this.showOverlay();
                    this._cachePreviewBase();
                    this.redrawPreview();
                } else if (this.vertices.length >= MIN_VERTICES &&
                    calcDistance(x, y, this.vertices[0].x, this.vertices[0].y) <= CLOSE_HIT_RADIUS) {
                    this.closePolygon();
                } else {
                    this.vertices.push({ x, y });
                    this.redrawPreview();
                }
            }
        }
        this.end_common();
    }
    // 頂点配置開始時点のmain_ctxの内容を軽量なオフスクリーンcanvasへ複製する。
    // 配置中はレイヤー内容が変わらない前提のため、これを毎回のプレビュー復元に使い回す
    _cachePreviewBase() {
        if (!this._previewBaseCanvas) {
            this._previewBaseCanvas = document.createElement('canvas');
            this._previewBaseCtx = this._previewBaseCanvas.getContext('2d');
        }
        this._previewBaseCanvas.width = this.axpObj.x_size;
        this._previewBaseCanvas.height = this.axpObj.y_size;
        this._previewBaseCtx.drawImage(this.axpObj.CANVAS.main_ctx.canvas, 0, 0);
    }
    // 頂点列＋始点からホバー座標へのゴムバンド線を、通常合成結果の上に重ね描きする
    // （どのレイヤーのimageデータにも書き込まない、表示専用のプレビュー）
    redrawPreview() {
        const ctx = this.axpObj.CANVAS.main_ctx;
        if (this._previewBaseCanvas) {
            // キャッシュ済みの合成結果へ軽量に復元（全レイヤー再合成を毎回行わない）
            ctx.drawImage(this._previewBaseCanvas, 0, 0);
        } else {
            this.axpObj.layerSystem.draw();
        }
        if (this.vertices.length === 0) return;

        const drawPath = (color, dashOffset) => {
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = dashOffset;
            ctx.lineWidth = 1;
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
            for (let i = 1; i < this.vertices.length; i++) {
                ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
            }
            ctx.lineTo(this.hoverX, this.hoverY);
            ctx.stroke();
            ctx.restore();
        };
        // 白ストローク（背景コントラスト用）
        drawPath('#ffffff', 4);
        // 黒ストローク
        drawPath('#000000', 0);

        // 頂点マーカー
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        for (const v of this.vertices) {
            ctx.beginPath();
            ctx.arc(v.x, v.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }
    closePolygon() {
        if (this.vertices.length < MIN_VERTICES) {
            this.cancelPolygon();
            return;
        }
        const mask = polygonToMask(this.vertices, this.axpObj.x_size, this.axpObj.y_size);
        this.axpObj.applySelectionMask(mask);
        this.vertices = [];
        this.state = 'idle';
        this.hideOverlay();
        this._releasePreviewBase();
        this.axpObj.layerSystem.updateCanvas();
    }
    cancelPolygon() {
        this.vertices = [];
        this.state = 'idle';
        this.hideOverlay();
        this._releasePreviewBase();
        this.axpObj.layerSystem.updateCanvas();
    }
    _releasePreviewBase() {
        this._previewBaseCanvas = null;
        this._previewBaseCtx = null;
    }
    showOverlay() {
        const group = document.getElementById('axp_canvas_div_polygonGroup');
        if (group) UTIL.show(group);
    }
    hideOverlay() {
        const group = document.getElementById('axp_canvas_div_polygonGroup');
        if (group) UTIL.hide(group);
    }
    // キャンバス再初期化時などに、途中状態を書き込まずに破棄する
    forceIdle() {
        if (this.state === 'idle') return;
        this.vertices = [];
        this.state = 'idle';
        this.hideOverlay();
        this._releasePreviewBase();
    }
}
