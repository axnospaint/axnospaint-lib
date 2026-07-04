// @description ペン定義：親クラス＞なげなわツール

import { PenObj } from './_penobj.js';
import { UTIL } from '../etc.js';

const SCALE_SENSITIVITY = 0.005;
const ROTATE_SENSITIVITY = 0.5;
const MIN_PATH_POINTS = 3;

// なげなわ
export class Nagenawa extends PenObj {
    constructor(option) {
        super();
        this.axpObj = option.axpObj;
        this.CANVAS = option.CANVAS;
        // 値（PenObjからの差分）
        this.name = this.axpObj._('@PENNAME.NAGENAWA');
        this.type = 'nagenawa';
        this.cursor = 'crosshair';
        // 制御
        this.usePenLock = true;
        this.canUndo = false;

        // 状態
        this.state = 'idle';
        this.lassoPath = [];

        // オフスクリーンキャンバス
        this.rawCanvas = null;
        this.rawCtx = null;
        this.maskCanvas = null;
        this.maskCtx = null;
        this.baseCanvas = null;
        this.baseCtx = null;

        // アフィン変換パラメータ
        this.affine = { tx: 0, ty: 0, scale: 1, rotation: 0, flipX: false };

        // ドラッグ用
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.affineSaved = { tx: 0, ty: 0 };

        // 選択領域の重心
        this.centroidX = 0;
        this.centroidY = 0;

        this.init_save();
    }
    setupOverlayEvents() {
        const scaleKnob = document.getElementById('axp_canvas_div_nagenawaScale');
        const rotateKnob = document.getElementById('axp_canvas_div_nagenawaRotate');
        const flipBtn = document.getElementById('axp_canvas_div_nagenawaFlip');
        const duplicateBtn = document.getElementById('axp_canvas_div_nagenawaDuplicate');
        const finishBtn = document.getElementById('axp_canvas_div_nagenawaFinish');

        if (scaleKnob) {
            scaleKnob.addEventListener('pointerdown', (e) => {
                if (this.state !== 'transforming') return;
                e.preventDefault();
                e.stopPropagation();
                this.drawTransformed(false);
                let prevX = e.clientX;
                const baseScale = this.affine.scale;
                const onMove = (ev) => {
                    const dx = ev.clientX - prevX;
                    this.affine.scale = Math.max(0.1, baseScale + dx * SCALE_SENSITIVITY);
                    this.drawTransformed(false);
                };
                const cleanup = () => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', cleanup);
                    window.removeEventListener('pointercancel', cleanup);
                    this.drawTransformed();
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', cleanup);
                window.addEventListener('pointercancel', cleanup);
            });
        }

        if (rotateKnob) {
            rotateKnob.addEventListener('pointerdown', (e) => {
                if (this.state !== 'transforming') return;
                e.preventDefault();
                e.stopPropagation();
                this.drawTransformed(false);
                let prevX = e.clientX;
                const onMove = (ev) => {
                    const dx = ev.clientX - prevX;
                    this.affine.rotation += dx * ROTATE_SENSITIVITY * Math.PI / 180;
                    prevX = ev.clientX;
                    this.drawTransformed(false);
                };
                const cleanup = () => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', cleanup);
                    window.removeEventListener('pointercancel', cleanup);
                    this.drawTransformed();
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', cleanup);
                window.addEventListener('pointercancel', cleanup);
            });
        }

        if (flipBtn) {
            flipBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            flipBtn.addEventListener('click', () => {
                if (this.state === 'transforming') {
                    this.affine.flipX = !this.affine.flipX;
                    this.drawTransformed();
                }
            });
        }

        if (duplicateBtn) {
            duplicateBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            duplicateBtn.addEventListener('click', () => {
                if (this.state === 'transforming') {
                    this.duplicateSelection();
                }
            });
        }

        if (finishBtn) {
            finishBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            finishBtn.addEventListener('click', () => {
                if (this.state === 'transforming') {
                    this.finalizeSelection();
                }
            });
        }
    }
    // 描画開始
    start(x, y, e) {
        if (this.state === 'idle') {
            if (this.axpObj.layerSystem.isWriteProtection()) {
                return;
            }
            this.set_modeflag();
            this.axpObj.layerSystem.save();
            this.axpObj.layerSystem.isStrokeActive = true;
            this.axpObj.layerSystem.activateFastPath();
            if (this.axpObj.layerSystem.compositeFastPathActive) {
                this.CANVAS.undoBase_ctx.putImageData(this.axpObj.layerSystem.load(), 0, 0);
            }
            this.lassoPath = [{ x, y }];
            this.state = 'drawing';
        } else if (this.state === 'transforming') {
            this.axpObj.isDrawing = true;
            this.axpObj.isDrawCancel = false;
            this.dragStartX = x;
            this.dragStartY = y;
            this.affineSaved.tx = this.affine.tx;
            this.affineSaved.ty = this.affine.ty;
            this.drawTransformed(false);
        }
    }
    // 描画中
    move(x, y, e) {
        if (this.state === 'drawing' && this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            this.axpObj.isDrawn = true;
            this.lassoPath.push({ x, y });
            this.drawLassoTrail();
        } else if (this.state === 'transforming' && this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            this.affine.tx = this.affineSaved.tx + (x - this.dragStartX);
            this.affine.ty = this.affineSaved.ty + (y - this.dragStartY);
            this.drawTransformed(false);
        }
    }
    // 描画終了
    end(x, y, e) {
        if (this.state === 'drawing') {
            if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
                // ポインタを離した位置もパスに含めて確定する
                this.lassoPath.push({ x, y });
                if (this.lassoPath.length < MIN_PATH_POINTS) {
                    this.cancelSelection();
                    return;
                }
                if (!this.axpObj.layerSystem.compositeFastPathActive) {
                    // 非 fast path ではプレビュー（点線）がレイヤーへ write 済みのため、
                    // 抽出前に開始時の画像へ復元する (isBlank も維持)
                    this.axpObj.layerSystem.replaceCurrentImage(this.axpObj.layerSystem.load());
                }
                this.createSelectionMask();
                this.extractRawData();
                this.computeCentroid();
                this.clearSelectedRegion();
                this.affine = { tx: 0, ty: 0, scale: 1, rotation: 0, flipX: false };
                this.drawTransformed();
                this.showOverlay();
                this.state = 'transforming';
                this.reset_modeflag();
            } else {
                this.cancelSelection();
            }
        } else if (this.state === 'transforming') {
            if (this.axpObj.isDrawCancel) {
                // ピンチ・長押しスポイト等によるキャンセル: ドラッグ開始位置へ戻す
                this.affine.tx = this.affineSaved.tx;
                this.affine.ty = this.affineSaved.ty;
            }
            this.axpObj.isDrawing = false;
            this.axpObj.isDrawCancel = false;
            this.drawTransformed();
        }
    }
    drawLassoTrail() {
        const ctx = this.CANVAS.draw_ctx;
        const w = this.axpObj.x_size;
        const h = this.axpObj.y_size;

        ctx.clearRect(0, 0, w, h);
        if (this.axpObj.layerSystem.compositeFastPathActive) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            ctx.drawImage(this.CANVAS.undoBase, 0, 0);
        } else {
            ctx.putImageData(this.axpObj.layerSystem.load(), 0, 0);
        }

        if (this.lassoPath.length < 2) return;

        // 白ストローク（背景コントラスト用）
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = 4;
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(this.lassoPath[0].x, this.lassoPath[0].y);
        for (let i = 1; i < this.lassoPath.length; i++) {
            ctx.lineTo(this.lassoPath[i].x, this.lassoPath[i].y);
        }
        ctx.stroke();

        // 黒ストローク
        ctx.lineDashOffset = 0;
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(this.lassoPath[0].x, this.lassoPath[0].y);
        for (let i = 1; i < this.lassoPath.length; i++) {
            ctx.lineTo(this.lassoPath[i].x, this.lassoPath[i].y);
        }
        ctx.stroke();
        ctx.restore();

        if (this.axpObj.layerSystem.compositeFastPathActive) {
            this.axpObj.layerSystem.drawFast();
        } else {
            this.axpObj.layerSystem.write(
                ctx.getImageData(0, 0, w, h)
            );
            this.axpObj.layerSystem.updateCanvas();
        }
    }
    createSelectionMask() {
        const w = this.axpObj.x_size;
        const h = this.axpObj.y_size;
        this.maskCanvas = document.createElement('canvas');
        this.maskCanvas.width = w;
        this.maskCanvas.height = h;
        this.maskCtx = this.maskCanvas.getContext('2d');

        this.maskCtx.fillStyle = '#ffffff';
        this.maskCtx.beginPath();
        this.maskCtx.moveTo(this.lassoPath[0].x, this.lassoPath[0].y);
        for (let i = 1; i < this.lassoPath.length; i++) {
            this.maskCtx.lineTo(this.lassoPath[i].x, this.lassoPath[i].y);
        }
        this.maskCtx.closePath();
        this.maskCtx.fill('evenodd');
    }
    extractRawData() {
        const w = this.axpObj.x_size;
        const h = this.axpObj.y_size;
        this.rawCanvas = document.createElement('canvas');
        this.rawCanvas.width = w;
        this.rawCanvas.height = h;
        this.rawCtx = this.rawCanvas.getContext('2d');

        this.rawCtx.putImageData(this.axpObj.layerSystem.getCurrentLayerImage(), 0, 0);
        this.rawCtx.globalCompositeOperation = 'destination-in';
        this.rawCtx.drawImage(this.maskCanvas, 0, 0);
        this.rawCtx.globalCompositeOperation = 'source-over';
    }
    computeCentroid() {
        let sumX = 0;
        let sumY = 0;
        for (const p of this.lassoPath) {
            sumX += p.x;
            sumY += p.y;
        }
        this.centroidX = sumX / this.lassoPath.length;
        this.centroidY = sumY / this.lassoPath.length;
    }
    clearSelectedRegion() {
        const w = this.axpObj.x_size;
        const h = this.axpObj.y_size;
        this.baseCanvas = document.createElement('canvas');
        this.baseCanvas.width = w;
        this.baseCanvas.height = h;
        this.baseCtx = this.baseCanvas.getContext('2d');

        this.baseCtx.putImageData(this.axpObj.layerSystem.getCurrentLayerImage(), 0, 0);
        this.baseCtx.globalCompositeOperation = 'destination-out';
        this.baseCtx.drawImage(this.maskCanvas, 0, 0);
        this.baseCtx.globalCompositeOperation = 'source-over';

        this.axpObj.layerSystem.write(
            this.baseCtx.getImageData(0, 0, w, h)
        );
    }
    drawTransformed(showOutline = true) {
        const ctx = this.CANVAS.draw_ctx;
        const w = this.axpObj.x_size;
        const h = this.axpObj.y_size;

        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.drawImage(this.baseCanvas, 0, 0);

        ctx.save();
        const sx = this.affine.flipX ? -this.affine.scale : this.affine.scale;
        ctx.translate(this.centroidX + this.affine.tx, this.centroidY + this.affine.ty);
        ctx.rotate(this.affine.rotation);
        ctx.scale(sx, this.affine.scale);
        ctx.translate(-this.centroidX, -this.centroidY);
        ctx.drawImage(this.rawCanvas, 0, 0);
        ctx.restore();

        // 変形後のパス座標に沿った選択輪郭を描画
        if (showOutline && this.lassoPath.length >= 2) {
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;

            const cos = Math.cos(this.affine.rotation);
            const sin = Math.sin(this.affine.rotation);
            const sxo = this.affine.flipX ? -this.affine.scale : this.affine.scale;
            const sy = this.affine.scale;
            const cx = this.centroidX;
            const cy = this.centroidY;
            const tx = this.affine.tx;
            const ty = this.affine.ty;

            const transformPoint = (px, py) => {
                const dx = px - cx;
                const dy = py - cy;
                return {
                    x: cos * dx * sxo - sin * dy * sy + cx + tx,
                    y: sin * dx * sxo + cos * dy * sy + cy + ty,
                };
            };

            // 白ストローク（背景コントラスト用）
            ctx.lineDashOffset = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            const p0w = transformPoint(this.lassoPath[0].x, this.lassoPath[0].y);
            ctx.moveTo(p0w.x, p0w.y);
            for (let i = 1; i < this.lassoPath.length; i++) {
                const p = transformPoint(this.lassoPath[i].x, this.lassoPath[i].y);
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.stroke();

            // 黒ストローク
            ctx.lineDashOffset = 0;
            ctx.strokeStyle = '#000000';
            ctx.beginPath();
            const p0b = transformPoint(this.lassoPath[0].x, this.lassoPath[0].y);
            ctx.moveTo(p0b.x, p0b.y);
            for (let i = 1; i < this.lassoPath.length; i++) {
                const p = transformPoint(this.lassoPath[i].x, this.lassoPath[i].y);
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.stroke();

            ctx.restore();
        }

        if (this.axpObj.layerSystem.compositeFastPathActive) {
            this.axpObj.layerSystem.drawFast();
        } else {
            this.axpObj.layerSystem.write(
                ctx.getImageData(0, 0, w, h)
            );
            this.axpObj.layerSystem.updateCanvas();
        }
    }
    finalizeSelection() {
        if (this.state !== 'transforming') return;

        // 書き込み先レイヤーが消失している場合（ロード・キャンバス初期化直後など）、
        // 確定は不可能なため変形状態の破棄のみ行う
        const layerSystem = this.axpObj.layerSystem;
        if (!layerSystem.currentLayer ||
            layerSystem.getLayerIndex(layerSystem.currentLayer.dataset.id) === -1) {
            this.forceIdle();
            return;
        }

        const w = this.axpObj.x_size;
        const h = this.axpObj.y_size;

        this.drawTransformed(false);

        const finalImage = this.CANVAS.draw_ctx.getImageData(0, 0, w, h);
        this.axpObj.layerSystem.isStrokeActive = false;
        this.axpObj.layerSystem.deactivateFastPath();
        this.axpObj.layerSystem.write(finalImage);
        this.axpObj.layerSystem.updateCanvas();

        this.axpObj.undoSystem.setUndo({
            type: 'draw',
            detail: 'nagenawa',
            layerObj: {
                id: this.axpObj.layerSystem.getId(),
                index: this.axpObj.layerSystem.getIndex(),
                mode: this.axpObj.layerSystem.getMode(),
                alpha: this.axpObj.layerSystem.getAlpha(),
                checked: this.axpObj.layerSystem.getChecked(),
                locked: this.axpObj.layerSystem.getLocked(),
                masked: this.axpObj.layerSystem.getMasked(),
                name: this.axpObj.layerSystem.getName(),
                image: this.axpObj.layerSystem.load(),
            },
        });

        if (this.axpObj.isBackgroundimage) {
            this.axpObj.drawBackground();
        }
        this.axpObj.saveSystem.autoSave();

        this.hideOverlay();
        this.releaseCanvases();
        this.state = 'idle';
    }
    duplicateSelection() {
        if (this.state !== 'transforming') return;
        const w = this.axpObj.x_size;
        const h = this.axpObj.y_size;

        this.drawTransformed(false);
        const stamped = this.CANVAS.draw_ctx.getImageData(0, 0, w, h);

        this.baseCtx.clearRect(0, 0, w, h);
        this.baseCtx.putImageData(stamped, 0, 0);

        this.axpObj.undoSystem.setUndo({
            type: 'draw',
            detail: 'nagenawa',
            layerObj: {
                id: this.axpObj.layerSystem.getId(),
                index: this.axpObj.layerSystem.getIndex(),
                mode: this.axpObj.layerSystem.getMode(),
                alpha: this.axpObj.layerSystem.getAlpha(),
                checked: this.axpObj.layerSystem.getChecked(),
                locked: this.axpObj.layerSystem.getLocked(),
                masked: this.axpObj.layerSystem.getMasked(),
                name: this.axpObj.layerSystem.getName(),
                image: this.axpObj.layerSystem.load(),
            },
        });

        this.axpObj.layerSystem.write(stamped);
        this.axpObj.layerSystem.save();

        this.drawTransformed();
    }
    // 変形・選択状態をレイヤーへ書き込まずに破棄して idle に戻す
    // （書き込み先レイヤーの消失時や、キャンバス初期化時の後始末用）
    forceIdle() {
        if (this.state === 'idle') return;
        this.axpObj.layerSystem.isStrokeActive = false;
        this.axpObj.layerSystem.deactivateFastPath();
        this.hideOverlay();
        this.releaseCanvases();
        this.reset_modeflag();
        this.state = 'idle';
    }
    cancelSelection() {
        if (this.state === 'drawing' || this.state === 'transforming') {
            const hadOverlay = this.state === 'transforming';

            this.axpObj.layerSystem.write(this.axpObj.layerSystem.load());
            this.axpObj.layerSystem.isStrokeActive = false;
            this.axpObj.layerSystem.deactivateFastPath();
            this.axpObj.layerSystem.updateCanvas();

            if (hadOverlay) {
                this.hideOverlay();
            }
            this.releaseCanvases();
            this.reset_modeflag();
            this.state = 'idle';
        }
    }
    showOverlay() {
        const group = document.getElementById('axp_canvas_div_nagenawaGroup');
        if (group) UTIL.show(group);
        this.axpObj.updateRotateHandle();
    }
    hideOverlay() {
        const group = document.getElementById('axp_canvas_div_nagenawaGroup');
        if (group) UTIL.hide(group);
        this.axpObj.updateRotateHandle();
    }
    releaseCanvases() {
        this.rawCanvas = null;
        this.rawCtx = null;
        this.maskCanvas = null;
        this.maskCtx = null;
        this.baseCanvas = null;
        this.baseCtx = null;
        this.lassoPath = [];
    }
}
