// @description ペン定義：親クラス＞バケツ＞階調バケツ

import { Fill } from './fill.js';
import { inRange, getRectSize } from '../etc.js';

// 階調バケツ
// 注意: thisTypeはFillの'fill'のまま意図的に上書きしていない。window_pen.jsの
// fillMode選択ボックス（判定対象：現在レイヤー／全レイヤー）表示条件がtype==='fill'
// に依存しており、Fillgradationもその対象に含める必要があるため。Fillgradation固有の
// UI表示判定（多ストップグラデーション編集欄の表示等）は、typeではなくgradientStops
// プロパティの有無で行うこと（window_pen.js changePenMode()参照）
export class Fillgradation extends Fill {
    constructor(option) {
        super(option);
        // 値（Fillからの差分）
        this.name = this.axpObj._('@PENNAME.GRADATION_FILL');
        this.toneLevel = null;
        this.gradation = 0;
        // 制御
        // 描画

        // 多ストップグラデーション（Phase2-7）。既定は2点（メインカラー／サブカラーに
        // 動的追従。color:nullがその印）。ストップを追加すると常に追加時点のメインカラーを
        // 固定値として持つ（nullにはならない）ため、既存の「メイン/サブカラーが変わると
        // グラデーションも追従する」という単純な2色運用は無改造のまま残る。
        // 追従先はrole('main'|'sub')で明示的に持たせる（配列index基準で「先頭=メイン」と
        // 判定すると、ストップの位置変更に伴うソートで並び順が入れ替わった際に
        // メイン/サブの意味が反転してしまうバグになるため。review4指摘で発覚）
        this.gradientStops = [{ offset: 0, color: null, role: 'main' }, { offset: 1, color: null, role: 'sub' }];
        this.selectedStop = this.gradientStops[0];
        // UI表示判定用の明示フラグ（既存のusesSelectionModeと同じ設計。gradientStops
        // プロパティの有無で判別すると、将来別のペンが偶然同名のプロパティを持った場合に
        // UI表示が誤爆しうるため、専用フラグで意図を明示する）
        this.usesGradientStops = true;

        this.init_save();
    }
    // 太さ・不透明度に加え、多ストップグラデーションの状態も既定へ戻す
    // （基底のinit()はsize/index/alphaのみ対象のため、resetPenStyle()等での
    // 「ペン設定初期化」がgradientStopsを取りこぼさないようにオーバーライドする）
    init() {
        super.init();
        this.gradientStops = [{ offset: 0, color: null, role: 'main' }, { offset: 1, color: null, role: 'sub' }];
        this.selectedStop = this.gradientStops[0];
    }
    // ストップの実効色を解決する（null=roleに応じてメイン/サブカラーへ動的追従）
    _resolveStopColor(stop) {
        if (stop.color !== null) return stop.color;
        return stop.role === 'main'
            ? this.axpObj.colorMakerSystem.getMainColor()
            : this.axpObj.colorMakerSystem.getSubColor();
    }
    addGradientStop(offsetPercent) {
        let offset;
        if (offsetPercent === undefined || offsetPercent === null) {
            // 位置省略時は、既存ストップ間で最も広い空き区間の中点へ自動配置する
            // （呼び出し元が常に固定値を渡す実装だと、位置を動かさずに「追加」を
            // 連打した際に同一offsetへストップが重なってしまうため。review4指摘）
            offset = this._findLargestGapMidpoint();
        } else {
            offset = Math.max(0, Math.min(100, Number(offsetPercent) || 0)) / 100;
        }
        // 追加ストップは常に固定色を持つ（roleなし＝動的追従の対象外）
        const stop = { offset, color: this.axpObj.colorMakerSystem.getMainColor(), role: null };
        this.gradientStops.push(stop);
        this.gradientStops.sort((a, b) => a.offset - b.offset);
        this.selectedStop = stop;
    }
    _findLargestGapMidpoint() {
        const sorted = [...this.gradientStops].sort((a, b) => a.offset - b.offset);
        let gapStart = sorted[0].offset;
        let gapSize = 0;
        for (let i = 0; i < sorted.length - 1; i++) {
            const gap = sorted[i + 1].offset - sorted[i].offset;
            if (gap > gapSize) {
                gapSize = gap;
                gapStart = sorted[i].offset;
            }
        }
        return gapStart + gapSize / 2;
    }
    removeSelectedGradientStop() {
        // 最低2点は維持する（グラデーションとして成立しなくなるため）
        if (this.gradientStops.length <= 2 || !this.selectedStop) return;
        const idx = this.gradientStops.indexOf(this.selectedStop);
        if (idx === -1) return;
        this.gradientStops.splice(idx, 1);
        this.selectedStop = this.gradientStops[Math.max(0, idx - 1)];
    }
    setSelectedGradientStopColor() {
        if (!this.selectedStop) return;
        this.selectedStop.color = this.axpObj.colorMakerSystem.getMainColor();
    }
    setSelectedGradientStopPosition(offsetPercent) {
        if (!this.selectedStop) return;
        this.selectedStop.offset = Math.max(0, Math.min(100, Number(offsetPercent) || 0)) / 100;
        this.gradientStops.sort((a, b) => a.offset - b.offset);
    }
    selectGradientStop(stop) {
        if (this.gradientStops.includes(stop)) {
            this.selectedStop = stop;
        }
    }
    // ペンの太さプレビュー表示（バケツ専用）
    previewPenSize() {
        // 更新キャンバス
        let canvas = this.axpObj.penSystem.CANVAS.pensize;
        let ctx = this.axpObj.penSystem.CANVAS.pensize_ctx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = this.alpha / 100;
        // グラデーションの表示
        let size = 80;
        let radius = 40;
        // 元の角度から270度減算し、cssのlinear-gradient()の仕様と合わせる
        let angle = this.gradation - 270;
        let x0 = size / 2;
        let y0 = size / 2;
        let dx = Math.round(radius * Math.cos(angle * (Math.PI / 180)));
        let dy = Math.round(radius * Math.sin(angle * (Math.PI / 180)));
        let x1 = x0 + dx;
        let y1 = y0 + dy;
        let x2 = x0 - dx;
        let y2 = y0 - dy;
        let lineargradient = ctx.createLinearGradient(x1, y1, x2, y2);
        //console.log('perv', x1, y1, x2, y2);
        this.gradientStops.forEach((stop) => {
            lineargradient.addColorStop(stop.offset, this._resolveStopColor(stop));
        });
        ctx.fillStyle = lineargradient;
        ctx.beginPath();
        ctx.fillRect(50 - size / 2, 50 - size / 2, size, size);

        // 多ストップグラデーション編集UI（表示中の場合のみ）
        this.renderGradientStopsUI();
    }
    // 多ストップグラデーション編集UIの再描画（ペンツールパネル、階調バケツ選択時のみ表示）
    renderGradientStopsUI() {
        const preview = document.getElementById('axp_pen_div_gradientPreview');
        if (!preview) return;
        const cssStops = this.gradientStops.map(
            (stop) => `${this._resolveStopColor(stop)} ${Math.round(stop.offset * 100)}%`
        );
        preview.style.background = `linear-gradient(to right, ${cssStops.join(', ')})`;

        // このメソッドはメインカラー変更のたびに（階調バケツ選択中は）previewPenSize()経由で
        // 無条件に呼ばれる。カラーホイールのドラッグはpointermoveと同期して高頻度に発火するため、
        // ストップ数が変わっていないのに毎回ボタンDOMを全削除・再生成していると、ストップ数が
        // 多いほどドラッグ中のカラー調整が目に見えて重くなる（review4指摘）。
        // ストップ数が変わった時だけDOMを再生成し、それ以外（色/選択状態のみの変化）は
        // 既存ボタンのスタイル更新のみで済ませる。クリックはlist単位のイベント委譲にして
        // data-index経由で現在のgradientStopsを参照するため、再生成しない限りは
        // addEventListenerもindex更新も不要
        const list = document.getElementById('axp_pen_div_gradientStopList');
        if (list.children.length !== this.gradientStops.length) {
            list.textContent = '';
            this.gradientStops.forEach((stop, i) => {
                const swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = 'axpc_gradient_stopSwatch';
                swatch.dataset.index = i;
                list.appendChild(swatch);
            });
            if (!list.dataset.delegated) {
                list.addEventListener('click', (e) => {
                    const btn = e.target.closest('.axpc_gradient_stopSwatch');
                    if (!btn) return;
                    const stop = this.gradientStops[Number(btn.dataset.index)];
                    if (!stop) return;
                    this.selectGradientStop(stop);
                    this.renderGradientStopsUI();
                });
                list.dataset.delegated = 'true';
            }
        }
        this.gradientStops.forEach((stop, i) => {
            const swatch = list.children[i];
            swatch.dataset.index = i; // 並べ替え後の位置に追従させる
            swatch.style.backgroundColor = this._resolveStopColor(stop);
            swatch.dataset.selected = (stop === this.selectedStop) ? 'true' : 'false';
        });

        const posInput = document.getElementById('axp_pen_number_gradientStopPosition');
        if (this.selectedStop) {
            posInput.value = Math.round(this.selectedStop.offset * 100);
            posInput.disabled = false;
        } else {
            posInput.disabled = true;
        }
        document.getElementById('axp_pen_button_gradientRemoveStop').disabled = this.gradientStops.length <= 2;
    }
    // 描画終了
    end(x, y) {
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            // 描画開始時のイメージ記憶
            this.axpObj.layerSystem.save();
            // 範囲外の場合は処理しない
            if (inRange(x, 0, this.axpObj.x_size) && inRange(y, 0, this.axpObj.y_size)) {
                // 透明色の場合は処理しない
                if (document.getElementById('axp_makecolor_div_transparent').dataset.selected === 'true') {
                    // %1は透明色を使用できません。
                    this.axpObj.msg('@CAU0500', this.name);
                } else {
                    var rgbCode = [255, 255, 255];
                    //console.log('rgb:', rgbCode);

                    // ◆入力画像
                    var img_input;
                    if (document.getElementById('axp_pen_select_fillMode').value === 'option_layer') {
                        // 判定対象：現在レイヤー
                        img_input = this.axpObj.layerSystem.getImage();
                    } else {
                        // 判定対象：全レイヤー
                        img_input = this.axpObj.layerSystem.getCanvasImage();
                    }

                    // ◆出力画像
                    var img_output = new ImageData(this.axpObj.x_size, this.axpObj.y_size);

                    // 一旦、不透明度100%の領域塗りつぶし画像を作成する
                    this.regionFill(
                        img_input,
                        img_output,
                        x,
                        y,
                        rgbCode,
                        this.colorTolerance
                    );
                    this.CANVAS.brush_ctx.putImageData(img_output, 0, 0);

                    let rect = getRectSize(img_output);

                    // 一時キャンバスにグラデーション作成
                    let canvas = document.createElement('canvas');
                    canvas.width = this.axpObj.x_size;
                    canvas.height = this.axpObj.y_size;
                    let ctx = canvas.getContext('2d');
                    // グラデーションの表示
                    let radius = Math.max(rect.x1 - rect.x0, rect.y1 - rect.y0) / 2;
                    // 元の角度から270度減算し、cssのlinear-gradient()の仕様と合わせる
                    let angle = this.gradation - 270;
                    let x0 = rect.x0 + (rect.x1 - rect.x0) / 2;
                    let y0 = rect.y0 + (rect.y1 - rect.y0) / 2;
                    console.log('x,y,r:', x0, y0, radius);
                    let dx = Math.round(radius * Math.cos(angle * (Math.PI / 180)));
                    let dy = Math.round(radius * Math.sin(angle * (Math.PI / 180)));
                    // グラデーション座標が描画範囲に収まるように変形
                    let x1 = x0 + dx;
                    if (x1 < rect.x0) x1 = rect.x0;
                    if (x1 > rect.x1) x1 = rect.x1;
                    let y1 = y0 + dy;
                    if (y1 < rect.y0) y1 = rect.y0;
                    if (y1 > rect.y1) y1 = rect.y1;
                    let x2 = x0 - dx;
                    if (x2 < rect.x0) x2 = rect.x0;
                    if (x2 > rect.x1) x2 = rect.x1;
                    let y2 = y0 - dy;
                    if (y2 < rect.y0) y2 = rect.y0;
                    if (y2 > rect.y1) y2 = rect.y1;
                    console.log('draw', x1, y1, x2, y2);
                    let lineargradient = ctx.createLinearGradient(x1, y1, x2, y2);

                    this.gradientStops.forEach((stop) => {
                        lineargradient.addColorStop(stop.offset, this._resolveStopColor(stop));
                    });
                    ctx.fillStyle = lineargradient;
                    ctx.beginPath();
                    ctx.fillRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);

                    // バケツ領域で型抜き
                    this.CANVAS.brush_ctx.globalCompositeOperation = 'source-in';
                    this.CANVAS.brush_ctx.drawImage(canvas, 0, 0);

                    // 透明度を適用して、元画像と合成する
                    this.CANVAS.draw_ctx.putImageData(this.axpObj.layerSystem.load(), 0, 0);
                    this.CANVAS.draw_ctx.drawImage(this.CANVAS.brush, 0, 0);

                    // レイヤー更新
                    this.axpObj.layerSystem.write(
                        this.CANVAS.draw_ctx.getImageData(0, 0, this.axpObj.x_size, this.axpObj.y_size)
                    );
                    this.axpObj.layerSystem.updateCanvas();
                }
            }
        }
        this.end_common();
    }
}
