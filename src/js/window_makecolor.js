// @description ツールウィンドウ：親クラス＞色作成

import { ToolWindow } from './window.js';
import htmldata from '../html/window_makecolor.txt';
// css適用
import '../css/window_makecolor.css';

import { hex2rgb, rgb2hex, isColor, adjustColorValue, UTIL } from './etc.js';
import { rgb2cmyk, cmyk2rgb, rgb2lab, lab2rgb } from './colorconvert.js';

// カラーピッカーライブラリ
import ReinventedColorWheel from './reinvented-color-wheel.js';
import '../css/reinvented-color-wheel.css';

// カラー作成制御オブジェクト
export class ColorMakerSystem extends ToolWindow {
    // メインカラー、サブカラー（#付きで管理）
    maincolor;
    subcolor;
    colorWheel;
    colorWheel_subwindow;
    // 色履歴（MRU、直近使用順）。setMainColorの度に記録すると連続変化で埋まるため、
    // 操作が一段落してから（デバウンス）記録する。
    colorHistory = [];
    _historyDebounceTimer = null;
    _cmykModelOverride = null;
    CONST = {
        COLOR_HISTORY_MAX: 12,
        COLOR_HISTORY_DEBOUNCE_MS: 800,
    }
    constructor(axpObj) {
        super(axpObj);
    }
    // 初期ウィンドウ位置
    getDefaultPosition() {
        return {
            //left: this.axpObj.paintBodyElement.clientWidth - this.window_width - 10,
            left: this.axpObj.paintBodyElement.clientWidth - this.window_width - 120 - 10,
            top: 250,
        }
    }
    // 初期化
    init() {
        // HTML
        this.createHTML(
            'axp_makecolor',
            'MKC',
            this.axpObj._('@WINDOW.COLOR'),
            'axpc_icon_window_colormaker',
            htmldata
        );
        this.window_width = 180;
        // 初期座標設定
        const pos = this.getDefaultPosition();
        this.window_left = pos.left;
        this.window_top = pos.top;
        // メインカラー／サブカラーの初期値設定
        this.maincolor = this.axpObj.defaultColor?.main || '#000000';
        this.subcolor = this.axpObj.defaultColor?.sub || '#FFFFFF';
        document.getElementById('axp_makecolor_div_mainColor').style.backgroundColor = this.maincolor;
        document.getElementById('axp_makecolor_div_subColor').style.backgroundColor = this.subcolor;
        this.createTemporaryPalette();

        // クロスボウル調色：キャンバス取得
        this.crossBowlCanvas = document.getElementById('axp_makecolor_canvas_crossBowl');
        this.crossBowlCtx = this.crossBowlCanvas.getContext('2d');
        this.renderCrossBowl();

        // 混色ウェットパレット：キャンバス取得（初期状態は空＝透明）
        this.wetPaletteCanvas = document.getElementById('axp_makecolor_canvas_wetPalette');
        this.wetPaletteCtx = this.wetPaletteCanvas.getContext('2d');

        // カラーピッカー：使用定義
        this.colorWheel = new ReinventedColorWheel({
            // appendTo is the only required property. specify the parent element of the color wheel.
            appendTo: document.querySelector('#axp_makecolor_div_colorPicker>div'),
            // initial color (can be specified in hsv / hsl / rgb / hex)
            rgb: [0, 0, 0],
            // hsl: [0, 100, 50],
            // rgb: [255, 0, 0],
            // hex: "#ff0000",

            // appearance
            wheelDiameter: 166,
            wheelThickness: 20,
            handleDiameter: 16,
            wheelReflectsSaturation: false,

            // handler
            onChange: (color) => {
                this.setMainColor(color.hex, 'picker');
            },
        });
        /*
        // 使用方法
        // set color in HSV / HSL / RGB / HEX
        colorWheel.hsv = [240, 100, 100];
        colorWheel.hsl = [120, 100, 50];
        colorWheel.rgb = [255, 128, 64];
        colorWheel.hex = '#888888';

        // get color in HSV / HSL / RGB / HEX
        console.log("hsv:", colorWheel.hsv[0], colorWheel.hsv[1], colorWheel.hsv[2]);
        console.log("hsl:", colorWheel.hsl[0], colorWheel.hsl[1], colorWheel.hsl[2]);
        console.log("rgb:", colorWheel.rgb[0], colorWheel.rgb[1], colorWheel.rgb[2]);
        console.log("hex:", colorWheel.hex);

        // please call redraw() after changing some appearance properties.
        colorWheel.wheelDiameter = 400;
        colorWheel.wheelThickness = 40;
        colorWheel.redraw();
        */
    }
    // イベント受付開始
    startEvent() {
        // 色履歴（config復元→初期描画）
        const savedHistory = this.axpObj.configSystem.getConfig('COLHS');
        if (typeof savedHistory === 'string') {
            try {
                const arr = JSON.parse(savedHistory);
                if (Array.isArray(arr)) {
                    // 要素単位で型ガードする。isColor()は文字列以外を渡されると例外を投げるため、
                    // 1件でも不正な要素（数値/null/オブジェクト等）が混ざるとfilter全体が中断し
                    // 有効な要素まで巻き添えで失われる（catchで空配列化）事態を防ぐ。
                    // 正規化（6桁大文字化）＋Setで、3桁省略形と6桁表記の重複も統一する。
                    this.colorHistory = [...new Set(
                        arr.filter((c) => typeof c === 'string' && isColor(c))
                            .map((c) => '#' + rgb2hex(hex2rgb(c)))
                    )].slice(0, this.CONST.COLOR_HISTORY_MAX);
                }
            } catch {
                // 破損データは既定値（空）のまま
            }
        }
        this._renderColorHistory();

        // クロスボウル調色：ポインタ操作（ドラッグ中は連続して色を反映する）。
        // activePointerIdで最初に触れた指/ポインタのみ追従し、マルチタッチ時に
        // 別の指のイベントで状態が乱れないようにする。pointercancel/lostpointercapture
        // でも確実に状態を解除する（OS都合のジェスチャ横取り等での状態残留対策）
        {
            const canvas = document.getElementById('axp_makecolor_canvas_crossBowl');
            let activePointerId = null;
            const endDrag = (e) => {
                if (activePointerId === null || e.pointerId !== activePointerId) return;
                activePointerId = null;
                if (canvas.hasPointerCapture(e.pointerId)) {
                    canvas.releasePointerCapture(e.pointerId);
                }
            };
            canvas.addEventListener('pointerdown', (e) => {
                if (activePointerId !== null) return;
                activePointerId = e.pointerId;
                canvas.setPointerCapture(e.pointerId);
                this._pickCrossBowlColorAt(e.clientX, e.clientY);
            });
            canvas.addEventListener('pointermove', (e) => {
                if (e.pointerId !== activePointerId) return;
                this._pickCrossBowlColorAt(e.clientX, e.clientY);
            });
            canvas.addEventListener('pointerup', endDrag);
            canvas.addEventListener('pointercancel', endDrag);
            canvas.addEventListener('lostpointercapture', endDrag);
        }

        // 混色ウェットパレット：ドラッグで塗り重ねて混色、動かさずクリックでサンプル。
        // クロスボウルと同じくactivePointerIdで単一ポインタのみ追従する
        {
            const canvas = this.wetPaletteCanvas;
            const ctx = this.wetPaletteCtx;
            const MOVE_THRESHOLD = 3; // これ未満の移動量なら「クリック」＝サンプル操作とみなす
            const STAMP_RADIUS = 14;
            const STAMP_ALPHA = 0.18; // 低めの不透明度で塗り重ね、混色させる
            let activePointerId = null;
            let moved = false;
            let startX = 0;
            let startY = 0;
            let lastX = 0;
            let lastY = 0;

            const toCanvasCoords = (clientX, clientY) => {
                const rect = canvas.getBoundingClientRect();
                return {
                    x: (clientX - rect.left) * (canvas.width / rect.width),
                    y: (clientY - rect.top) * (canvas.height / rect.height),
                };
            };
            const stampAt = (x0, y0, x1, y1) => {
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = STAMP_ALPHA;
                ctx.fillStyle = this.maincolor;
                const dist = Math.hypot(x1 - x0, y1 - y0);
                const steps = Math.max(1, Math.ceil(dist / (STAMP_RADIUS / 2)));
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const x = x0 + (x1 - x0) * t;
                    const y = y0 + (y1 - y0) * t;
                    ctx.beginPath();
                    ctx.arc(x, y, STAMP_RADIUS, 0, Math.PI * 2);
                    ctx.fill();
                }
            };
            const sampleAt = (x, y) => {
                const cx = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
                const cy = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
                const pixel = ctx.getImageData(cx, cy, 1, 1).data;
                if (pixel[3] === 0) return; // 未着色（透明）の場所は無視する
                this.setMainColor('#' + rgb2hex([pixel[0], pixel[1], pixel[2]]));
            };

            canvas.addEventListener('pointerdown', (e) => {
                if (activePointerId !== null) return;
                activePointerId = e.pointerId;
                moved = false;
                canvas.setPointerCapture(e.pointerId);
                const pos = toCanvasCoords(e.clientX, e.clientY);
                startX = lastX = pos.x;
                startY = lastY = pos.y;
            });
            canvas.addEventListener('pointermove', (e) => {
                if (e.pointerId !== activePointerId) return;
                const pos = toCanvasCoords(e.clientX, e.clientY);
                if (!moved && Math.hypot(pos.x - startX, pos.y - startY) > MOVE_THRESHOLD) {
                    moved = true;
                }
                if (moved) {
                    stampAt(lastX, lastY, pos.x, pos.y);
                }
                lastX = pos.x;
                lastY = pos.y;
            });
            const endDrag = (e) => {
                if (activePointerId === null || e.pointerId !== activePointerId) return;
                const wasMoved = moved;
                activePointerId = null;
                if (canvas.hasPointerCapture(e.pointerId)) {
                    canvas.releasePointerCapture(e.pointerId);
                }
                if (e.type === 'pointerup' && !wasMoved) {
                    // ほぼ動かさずに離した＝クリック操作としてサンプルする
                    const pos = toCanvasCoords(e.clientX, e.clientY);
                    sampleAt(pos.x, pos.y);
                }
            };
            canvas.addEventListener('pointerup', endDrag);
            canvas.addEventListener('pointercancel', endDrag);
            canvas.addEventListener('lostpointercapture', endDrag);
        }
        // ボタン：ウェットパレットのクリア
        document.getElementById('axp_makecolor_button_wetPaletteClear').addEventListener('click', () => {
            this.wetPaletteCtx.clearRect(0, 0, this.wetPaletteCanvas.width, this.wetPaletteCanvas.height);
        });

        // ボタン：スワップ
        document.getElementById('axp_makecolor_button_swapColor').addEventListener('click', () => {
            // メインカラーとサブカラーの交換
            let colorcode = this.maincolor;
            this.maincolor = this.subcolor;
            this.subcolor = colorcode;
            this.displayColorMaker();
            // メインカラー RGB:(%1) <-> サブカラー (%2)
            this.axpObj.msg('@COL0003', hex2rgb(this.maincolor), hex2rgb(this.subcolor));
        });
        // ボタン：パレット登録
        document.getElementById('axp_makecolor_button_addColor').addEventListener('click', () => {
            this.axpObj.colorPaletteSystem.addcolor();
        });

        // レンジスライダー：三原色カラー
        const oninputRangeColor = () => {
            var r, g, b;
            r = Number(document.getElementById('axp_makecolor_range_red').value);
            g = Number(document.getElementById('axp_makecolor_range_green').value);
            b = Number(document.getElementById('axp_makecolor_range_blue').value);
            let colorcode = '#' + rgb2hex([r, g, b]);
            // メインカラー更新
            this.setMainColor(colorcode);
        }
        document.getElementById('axp_makecolor_range_red').oninput = oninputRangeColor;
        document.getElementById('axp_makecolor_range_green').oninput = oninputRangeColor;
        document.getElementById('axp_makecolor_range_blue').oninput = oninputRangeColor;

        // テキストボックス：カラーコード直接入力
        document.getElementById('axp_makecolor_text_colorCode').onchange = () => {
            var code = document.getElementById('axp_makecolor_text_colorCode').value;
            if (isColor(code)) {
                var rgb = hex2rgb(code);
                var hex = rgb2hex(rgb);
                var colorcode = '#' + hex.toUpperCase();
                // メインカラー更新
                this.setMainColor(colorcode);
                // カラーコードの入力を受け付けました。%1 / RGB:(%2)
                this.axpObj.msg('@INF2000', colorcode, rgb);
            } else {
                // カラーコードが正しくありません。入力例：#ffffff または #fff（#は省略可）
                this.axpObj.msg('@CAU2000');
            }
        }

        // テキストボックス：三原色カラー数値入力
        const onchangeColorValue = () => {
            //console.log('onchange');
            //  RGBの取得
            var r = adjustColorValue(document.getElementById('axp_makecolor_number_red').value);
            var g = adjustColorValue(document.getElementById('axp_makecolor_number_green').value);
            var b = adjustColorValue(document.getElementById('axp_makecolor_number_blue').value);

            // メインカラー更新
            let colorcode = '#' + rgb2hex([r, g, b]);
            this.setMainColor(colorcode);
        }
        document.getElementById('axp_makecolor_number_red').onchange = onchangeColorValue;
        document.getElementById('axp_makecolor_number_green').onchange = onchangeColorValue;
        document.getElementById('axp_makecolor_number_blue').onchange = onchangeColorValue;

        // 数値入力を範囲内にクランプする（adjustColorValueは0-255固定のためCMYK/Labでは使えない）
        const clampRange = (value, min, max) => {
            let result = Number(value);
            if (isNaN(result)) result = 0;
            return Math.max(min, Math.min(max, result));
        }

        // 多モデル数値ピッカー：CMYK
        const oninputCMYK = () => {
            const c = Number(document.getElementById('axp_makecolor_range_cyan').value);
            const m = Number(document.getElementById('axp_makecolor_range_magenta').value);
            const y = Number(document.getElementById('axp_makecolor_range_yellow').value);
            const k = Number(document.getElementById('axp_makecolor_range_key').value);
            this._cmykModelOverride = [c, m, y, k];
            const rgb = cmyk2rgb([c, m, y, k]);
            this.setMainColor('#' + rgb2hex(rgb), 'cmyk');
        }
        for (const id of ['axp_makecolor_range_cyan', 'axp_makecolor_range_magenta', 'axp_makecolor_range_yellow', 'axp_makecolor_range_key']) {
            document.getElementById(id).oninput = oninputCMYK;
        }
        const onchangeCMYKValue = () => {
            const c = clampRange(document.getElementById('axp_makecolor_number_cyan').value, 0, 100);
            const m = clampRange(document.getElementById('axp_makecolor_number_magenta').value, 0, 100);
            const y = clampRange(document.getElementById('axp_makecolor_number_yellow').value, 0, 100);
            const k = clampRange(document.getElementById('axp_makecolor_number_key').value, 0, 100);
            this._cmykModelOverride = [c, m, y, k];
            const rgb = cmyk2rgb([c, m, y, k]);
            this.setMainColor('#' + rgb2hex(rgb), 'cmyk');
        }
        for (const id of ['axp_makecolor_number_cyan', 'axp_makecolor_number_magenta', 'axp_makecolor_number_yellow', 'axp_makecolor_number_key']) {
            document.getElementById(id).onchange = onchangeCMYKValue;
        }

        // 多モデル数値ピッカー：Lab
        const oninputLab = () => {
            const L = Number(document.getElementById('axp_makecolor_range_labL').value);
            const a = Number(document.getElementById('axp_makecolor_range_labA').value);
            const b = Number(document.getElementById('axp_makecolor_range_labB').value);
            const rgb = lab2rgb([L, a, b]);
            this.setMainColor('#' + rgb2hex(rgb), 'lab');
        }
        for (const id of ['axp_makecolor_range_labL', 'axp_makecolor_range_labA', 'axp_makecolor_range_labB']) {
            document.getElementById(id).oninput = oninputLab;
        }
        const onchangeLabValue = () => {
            const L = clampRange(document.getElementById('axp_makecolor_number_labL').value, 0, 100);
            const a = clampRange(document.getElementById('axp_makecolor_number_labA').value, -128, 127);
            const b = clampRange(document.getElementById('axp_makecolor_number_labB').value, -128, 127);
            // CMYKと同じ理由で明示的な書き戻しは不要（setMainColor()側で無条件に同期される）
            const rgb = lab2rgb([L, a, b]);
            this.setMainColor('#' + rgb2hex(rgb));
        }
        for (const id of ['axp_makecolor_number_labL', 'axp_makecolor_number_labA', 'axp_makecolor_number_labB']) {
            document.getElementById(id).onchange = onchangeLabValue;
        }

        // イベント登録終了
    }
    selectMainColor() {
        this.selectPalette('main');
        this.setMainColor(this.maincolor);
        // %drawingColorName RGB:(%1)
        this.axpObj.msg('@COL0001', hex2rgb(this.maincolor));
    }
    selectSubColor() {
        this.selectPalette('sub');
        this.setMainColor(this.subcolor);
        // %drawingColorName RGB:(%1)
        this.axpObj.msg('@COL0001', hex2rgb(this.subcolor));
    }
    selectTransparent() {
        this.selectPalette('transparent');
        this.setMainColor(this.maincolor);
        // 透明色
        this.axpObj.msg('@COL0002');
    }
    getMainColor() {
        return this.maincolor;
    }
    getMainColorRGB() {
        return hex2rgb(this.maincolor);
    }
    setMainColor(colorcode, changer = null) {
        //console.log('setmaincolor:', colorcode, changer);
        const cmykModelOverride = changer === 'cmyk' ? this._cmykModelOverride : null;
        // ＠サブカラー
        if (document.getElementById('axp_makecolor_div_subColor').dataset.selected === 'true') {
            this.subcolor = colorcode;
            // サブカラー表示
            document.getElementById('axp_makecolor_div_subColor').style.backgroundColor = colorcode;
        } else {
            this.maincolor = colorcode;
            // メインカラー表示
            document.getElementById('axp_makecolor_div_mainColor').style.backgroundColor = colorcode;
            // カラーコード(HEX)表示
            document.getElementById('axp_makecolor_text_colorCode').value = colorcode.toUpperCase();
            // 色履歴へデバウンス記録（メインカラーのみ。ドラッグ中の連続変化が
            // 履歴を埋め尽くさないよう、操作が一段落してから記録する）
            this._scheduleColorHistoryRecord(colorcode);
        }

        // 各要素の表示更新

        // カラーピッカー（自分自身は更新しない）
        if (changer !== 'picker') {
            this.colorWheel.hex = colorcode;
        }

        // カラースライドバー
        let hex = colorcode.slice(1);
        let rgbcolor = hex.match(/.{2}/g);
        document.getElementById('axp_makecolor_range_red').value = parseInt(rgbcolor[0], 16);
        document.getElementById('axp_makecolor_range_green').value = parseInt(rgbcolor[1], 16);
        document.getElementById('axp_makecolor_range_blue').value = parseInt(rgbcolor[2], 16);
        document.getElementById('axp_makecolor_number_red').value = parseInt(rgbcolor[0], 16);
        document.getElementById('axp_makecolor_number_green').value = parseInt(rgbcolor[1], 16);
        document.getElementById('axp_makecolor_number_blue').value = parseInt(rgbcolor[2], 16);

        // 多モデル数値ピッカー（CMYK/Lab）
        if (changer === 'cmyk' && cmykModelOverride) {
            this._cmykModelOverride = cmykModelOverride;
        }
        this._updateColorModelInputs(hex2rgb(colorcode), changer);

        // 編集モードならカラーパレットにも反映
        this.axpObj.colorPaletteSystem.setColor(colorcode);
        // ペンプレビュー
        this.axpObj.penSystem.previewPenSize();
        this.updateTemporaryPalette();
        // クロスボウル自身のピック操作が変更元の場合は再描画しない。ここで毎回再描画すると
        // 描画色（四隅の基準色の1つ）が変わるたびに補間元の面が動いてしまい、ドラッグ中に
        // ピック対象の面そのものが足元から変化する不具合になる（CodeRabbit指摘で発覚）。
        // colorWheel.hexへの代入がReinventedColorWheel内部のonChangeを同期的に再発火させ、
        // changer='picker'で自分自身を再帰的に呼び直す（既存の仕様）ため、changer比較だけでは
        // その再帰呼び出し分を防げない。呼び出し中フラグで再帰呼び出しも含めて抑止する
        if (changer !== 'crossBowl' && !this._suppressCrossBowlRender) {
            this.renderCrossBowl();
        }
        let temporary = document.querySelector('#axp_makecolor_div_mixedPalette>div>div[data-selected="true"]');
        if (temporary) {
            // メインカラー用表示を混色にする（CSS変数経由で疑似要素に参照させる）
            document.getElementById('axp_makecolor_div_mainColor').style.setProperty('--axp-mixedcolor', temporary.dataset.color);
        }
    }
    // 多モデル数値ピッカー（CMYK/Lab）の表示をRGBから同期する。
    // 常に無条件で全チャンネル（range・number双方）を更新する。CMYK/Labはchannelごとに
    // range/numberの2コントロールがあり、片方（例:numberでCだけ変更）を起点とした更新を
    // changerで丸ごとスキップすると、もう片方（rangeのC）が古い値のまま取り残され、
    // 次に別チャンネル（M等）を操作した際に古いC値を使って計算してしまう（実際に発生した
    // バグ）。ただし任意CMYK値はRGBへ投影するとGCR形式へ再分解されるため、CMYK入力が
    // 起点の更新では直前のCMYK値をそのまま書き戻して、入力中のチャンネルジャンプを防ぐ。
    _updateColorModelInputs(rgb, changer = null) {
        {
            const [c, m, y, k] = (changer === 'cmyk' && Array.isArray(this._cmykModelOverride))
                ? this._cmykModelOverride
                : rgb2cmyk(rgb);
            document.getElementById('axp_makecolor_range_cyan').value = c;
            document.getElementById('axp_makecolor_number_cyan').value = c;
            document.getElementById('axp_makecolor_range_magenta').value = m;
            document.getElementById('axp_makecolor_number_magenta').value = m;
            document.getElementById('axp_makecolor_range_yellow').value = y;
            document.getElementById('axp_makecolor_number_yellow').value = y;
            document.getElementById('axp_makecolor_range_key').value = k;
            document.getElementById('axp_makecolor_number_key').value = k;
            if (changer !== 'cmyk') this._cmykModelOverride = null;
        }
        {
            const [L, a, b] = rgb2lab(rgb).map(Math.round);
            document.getElementById('axp_makecolor_range_labL').value = L;
            document.getElementById('axp_makecolor_number_labL').value = L;
            document.getElementById('axp_makecolor_range_labA').value = a;
            document.getElementById('axp_makecolor_number_labA').value = a;
            document.getElementById('axp_makecolor_range_labB').value = b;
            document.getElementById('axp_makecolor_number_labB').value = b;
        }
    }
    // 選択している描画色の名称（混色パレット対象外版）
    get drawingColorName() {
        if (document.getElementById('axp_makecolor_div_subColor').dataset.selected === 'true') {
            return 'サブカラー';
        } else {
            // 混色パレット、透明色も含む
            return 'メインカラー';
        }
    }
    // 選択している描画色の名称（混色パレット対象版）
    get addPaletteName() {
        let temporary = document.querySelector('#axp_makecolor_div_mixedPalette>div>div[data-selected="true"]');
        if (temporary) {
            return '混色パレット';
        } else {
            if (document.getElementById('axp_makecolor_div_subColor').dataset.selected === 'true') {
                return 'サブカラー';
            } else {
                // 透明色も含む
                return 'メインカラー';
            }
        }
    }
    displayColorMaker() {
        // メインカラー表示
        document.getElementById('axp_makecolor_div_mainColor').style.backgroundColor = this.maincolor;
        // カラーコード(HEX)表示
        document.getElementById('axp_makecolor_text_colorCode').value = this.maincolor.toUpperCase();
        // サブカラー表示
        document.getElementById('axp_makecolor_div_subColor').style.backgroundColor = this.subcolor;;

        let colorcode;
        // ＠サブカラー
        if (document.getElementById('axp_makecolor_div_subColor').dataset.selected === 'true') {
            colorcode = this.subcolor;
        } else {
            colorcode = this.maincolor;
        }
        // カラーピッカー
        this.colorWheel.hex = colorcode;

        // カラースライドバー
        let hex = colorcode.slice(1);
        let rgbcolor = hex.match(/.{2}/g);
        document.getElementById('axp_makecolor_range_red').value = parseInt(rgbcolor[0], 16);
        document.getElementById('axp_makecolor_range_green').value = parseInt(rgbcolor[1], 16);
        document.getElementById('axp_makecolor_range_blue').value = parseInt(rgbcolor[2], 16);
        document.getElementById('axp_makecolor_number_red').value = parseInt(rgbcolor[0], 16);
        document.getElementById('axp_makecolor_number_green').value = parseInt(rgbcolor[1], 16);
        document.getElementById('axp_makecolor_number_blue').value = parseInt(rgbcolor[2], 16);

        // 多モデル数値ピッカー（CMYK/Lab）
        this._updateColorModelInputs(hex2rgb(colorcode));

        // 編集モードならカラーパレットにも反映
        this.axpObj.colorPaletteSystem.setColor(colorcode);
        // ペンプレビュー
        this.axpObj.penSystem.previewPenSize();
        this.updateTemporaryPalette();
        this.renderCrossBowl();

        // setMainColor()と同じUI同期（スワップボタン等、displayColorMaker()経由で色が
        // 切り替わった場合にも、混色パレット選択中の表示や色履歴が古いままにならないようにする）。
        // 色履歴はsetMainColor()と同じくメインカラー選択時のみ記録する（サブカラー選択中は対象外）
        if (document.getElementById('axp_makecolor_div_subColor').dataset.selected !== 'true') {
            this._scheduleColorHistoryRecord(colorcode);
        }
        let temporary = document.querySelector('#axp_makecolor_div_mixedPalette>div>div[data-selected="true"]');
        if (temporary) {
            document.getElementById('axp_makecolor_div_mainColor').style.setProperty('--axp-mixedcolor', temporary.dataset.color);
        }
    }
    // パレット選択状態の変更
    selectPalette(target = 'none') {
        //console.log('select', typeof target);
        // 混色パレットが既に選択されていれば解除
        let old = document.querySelector('#axp_makecolor_div_mixedPalette>div>div[data-selected="true"]');
        if (old) {
            old.dataset.selected = '';
        }
        // 未指定の場合、サブ以外が選択されているなら、メインに戻す
        if (target === 'none') {
            if (document.getElementById('axp_makecolor_div_subColor').dataset.selected === 'true') {
                // サブカラー選択状態
            } else {
                target = 'main';
            }
        }
        switch (target) {
            case 'main':
                document.getElementById('axp_makecolor_div_mainColor').dataset.selected = 'true';
                document.getElementById('axp_makecolor_div_subColor').dataset.selected = 'false';
                document.getElementById('axp_makecolor_div_transparent').dataset.selected = 'false';
                break;
            case 'sub':
                document.getElementById('axp_makecolor_div_mainColor').dataset.selected = 'false';
                document.getElementById('axp_makecolor_div_subColor').dataset.selected = 'true';
                document.getElementById('axp_makecolor_div_transparent').dataset.selected = 'false';
                break;
            case 'transparent':
                document.getElementById('axp_makecolor_div_mainColor').dataset.selected = 'false';
                document.getElementById('axp_makecolor_div_subColor').dataset.selected = 'false';
                document.getElementById('axp_makecolor_div_transparent').dataset.selected = 'true';
                break;
        }
        if (typeof target === 'object') {
            // 混色パレット指定
            target.dataset.selected = 'true';
            document.getElementById('axp_makecolor_div_mainColor').dataset.selected = 'false';
            document.getElementById('axp_makecolor_div_subColor').dataset.selected = 'false';
            document.getElementById('axp_makecolor_div_transparent').dataset.selected = 'false';
            document.getElementById('axp_makecolor_div_mainColor').dataset.mixed = 'true';
        } else {
            // 混色パレット以外
            document.getElementById('axp_makecolor_div_mainColor').dataset.mixed = 'false';
        }
    }
    // 混色パレット：新規作成
    createTemporaryPalette() {
        const box = document.querySelector('#axp_makecolor_div_mixedPalette>div');
        // パレットボックスの要素の全削除
        while (box.firstChild) {
            box.removeChild(box.firstChild);
        }
        // HTML生成
        const createPaletteHTML = (colorcode, index) => {
            const newDiv = document.createElement('div');
            newDiv.setAttribute('class', 'axpc_makecolor_mixedColorRect');
            newDiv.dataset.color = colorcode;
            newDiv.style.backgroundColor = colorcode;
            const percentage = (index + 1) * 5;
            // パレットにカーソルを当てたとき
            newDiv.addEventListener('pointerenter', (e) => {
                // 描画色を混色パレット(%1%)に変更します。RGB:(%2)
                this.axpObj.msg('@AXP2000', percentage, hex2rgb(e.target.dataset.color));
            });
            // パレットがクリックされたとき
            newDiv.addEventListener('click', (e) => {
                var colorcode = e.target.dataset.color;
                // 混色パレットを選択
                this.selectPalette(e.target);
                // ピッカーなどをメインカラーに戻す
                this.setMainColor(this.maincolor);
                // 混色パレット(%1%) RGB:(%2)
                this.axpObj.msg('@COL0004', percentage, hex2rgb(colorcode));
            });
            return newDiv;
        }
        // ２０個分ループ生成
        for (let index = 0; index < 20; index++) {
            // 画面に作成したカラーパレットを追加
            box.appendChild(
                createPaletteHTML(this.adjust(index), index)
            );
        }
    }
    // 混色パレット：更新
    updateTemporaryPalette() {
        const palettes = document.querySelectorAll('#axp_makecolor_div_mixedPalette>div>div');
        let index = 0;
        for (let item of palettes) {
            item.dataset.color = this.adjust(index);
            item.style.backgroundColor = this.adjust(index);
            index++;
        }
    }
    adjust(index) {
        // メインカラーを、明度補正の値を加味したカラーコードに調整して返却
        let rgb1 = hex2rgb(this.maincolor);
        let rgb2 = hex2rgb(this.subcolor);
        let alpha = (index + 1) * 5 / 100;
        let d_red;
        let d_green;
        let d_blue;
        d_red = Math.floor(rgb2[0] * alpha + rgb1[0] * (1 - alpha));
        d_green = Math.floor(rgb2[1] * alpha + rgb1[1] * (1 - alpha));
        d_blue = Math.floor(rgb2[2] * alpha + rgb1[2] * (1 - alpha));
        let newcolor = [d_red, d_green, d_blue];
        return "#" + rgb2hex(newcolor);
    };
    // クロスボウル調色：四隅（左上=メイン／右上=サブ／左下=白／右下=黒）を補間して描画する
    renderCrossBowl() {
        if (!this.crossBowlCtx) return;
        const w = this.crossBowlCanvas.width;
        const h = this.crossBowlCanvas.height;
        const mainRgb = hex2rgb(this.maincolor);
        const subRgb = hex2rgb(this.subcolor);
        const imageData = this.crossBowlCtx.createImageData(w, h);
        const data = imageData.data;

        // 上端（メイン→サブ）・下端（白→黒）はxのみに依存しyには依存しないため、
        // 列ごとに1回だけ計算して使い回す（従来はw×h回すべてでmixRgb()を3回ずつ呼び、
        // 配列を都度生成していたが、上下端はyのループ回数分だけ完全に無駄な再計算だった。
        // 14400px描画がsetMainColor()の度に走るため、この削減は体感差に直結する）
        const topR = new Float64Array(w);
        const topG = new Float64Array(w);
        const topB = new Float64Array(w);
        const bot = new Float64Array(w); // 白→黒はR=G=Bが常に等しいため1本で足りる
        for (let x = 0; x < w; x++) {
            const u = w > 1 ? x / (w - 1) : 0;
            topR[x] = mainRgb[0] + (subRgb[0] - mainRgb[0]) * u;
            topG[x] = mainRgb[1] + (subRgb[1] - mainRgb[1]) * u;
            topB[x] = mainRgb[2] + (subRgb[2] - mainRgb[2]) * u;
            bot[x] = 255 * (1 - u);
        }
        for (let y = 0; y < h; y++) {
            const v = h > 1 ? y / (h - 1) : 0;
            let idx = y * w * 4;
            for (let x = 0; x < w; x++) {
                const b = bot[x];
                data[idx] = Math.round(topR[x] + (b - topR[x]) * v);
                data[idx + 1] = Math.round(topG[x] + (b - topG[x]) * v);
                data[idx + 2] = Math.round(topB[x] + (b - topB[x]) * v);
                data[idx + 3] = 255;
                idx += 4;
            }
        }
        this.crossBowlCtx.putImageData(imageData, 0, 0);
    }
    // クロスボウル調色：指定クライアント座標のピクセル色を描画色に反映する
    _pickCrossBowlColorAt(clientX, clientY) {
        const rect = this.crossBowlCanvas.getBoundingClientRect();
        const scaleX = this.crossBowlCanvas.width / rect.width;
        const scaleY = this.crossBowlCanvas.height / rect.height;
        const x = Math.max(0, Math.min(this.crossBowlCanvas.width - 1, Math.round((clientX - rect.left) * scaleX)));
        const y = Math.max(0, Math.min(this.crossBowlCanvas.height - 1, Math.round((clientY - rect.top) * scaleY)));
        const pixel = this.crossBowlCtx.getImageData(x, y, 1, 1).data;
        const colorcode = '#' + rgb2hex([pixel[0], pixel[1], pixel[2]]);
        // colorWheel.hexへの代入で発生する再帰的なsetMainColor('picker')呼び出しの間も
        // 再描画を抑止できるよう、フラグはsetMainColor呼び出し全体を囲む
        this._suppressCrossBowlRender = true;
        try {
            this.setMainColor(colorcode, 'crossBowl');
        } finally {
            this._suppressCrossBowlRender = false;
        }
    }
    // 他システムが参照する色
    getAdjustColor() {
        return this.getPaletteColor();
    }
    getAdjustColorRGB() {
        return hex2rgb(this.getAdjustColor());
    }
    // 混色パレットを考慮した色の取得
    getPaletteColor() {
        let temporary = document.querySelector('#axp_makecolor_div_mixedPalette>div>div[data-selected="true"]');
        if (temporary) {
            return temporary.dataset.color;
        } else {
            if (document.getElementById('axp_makecolor_div_subColor').dataset.selected === 'true') {
                return this.subcolor;
            } else {
                // 透明色の時含む
                return this.maincolor;
            }
        }
    }
    getPaletteColorRGB() {
        return hex2rgb(this.getPaletteColor());
    }
    getSubColor() {
        return this.subcolor;
    }
    setSubColor(colorcode) {
        this.subcolor = colorcode;
        document.getElementById('axp_makecolor_div_subColor').style.backgroundColor = colorcode;
    }
    swap_maincolor() {
        // メインカラーとサブカラーの交換
        // サブカラー選択状態なら解除
        if (document.getElementById('axp_makecolor_div_subColor').dataset.selected === 'true') {
            this.selectPalette('main');
            this.setMainColor(this.maincolor);
            // メインカラー RGB:(%1)
            this.axpObj.msg('@COL0001', hex2rgb(this.maincolor));
        } else {
            this.selectPalette('sub');
            this.setMainColor(this.subcolor);
            // サブカラー RGB:(%1)
            this.axpObj.msg('@COL0001', hex2rgb(this.subcolor));
        }
        this.axpObj.penSystem.previewPenSize();
    }
    swap_transparent() {
        // 透明色選択状態なら解除
        if (document.getElementById('axp_makecolor_div_transparent').dataset.selected === 'true') {
            this.selectPalette('main');
            this.setMainColor(this.maincolor);
            // メインカラー RGB:(%1)
            this.axpObj.msg('@COL0001', hex2rgb(this.maincolor));
        } else {
            this.selectPalette('transparent');
            this.setMainColor(this.maincolor);
            // 透明色
            this.axpObj.msg('@COL0002');
        }
        this.axpObj.penSystem.previewPenSize();
    }
    updateMakeColorType() {
        // 混色パレット
        switch (this.axpObj.config('axp_config_form_makeColorTypeMixed')) {
            case 'off':
                UTIL.hide('axp_makecolor_div_mixedPalette');
                // 混色パレットの選択を解除する
                this.selectPalette('main');
                break;
            case 'on':
                UTIL.show('axp_makecolor_div_mixedPalette');
                break;
        }
        // RGBスライダー
        switch (this.axpObj.config('axp_config_form_makeColorTypeRGB')) {
            case 'off':
                UTIL.hide('axp_makecolor_div_RGBSlider');
                break;
            case 'on':
                UTIL.show('axp_makecolor_div_RGBSlider');
                break;
        }
        // カラーピッカータイプ
        switch (this.axpObj.config('axp_config_form_makeColorTypePicker')) {
            case 'off':
                UTIL.hide('axp_makecolor_div_colorPicker');
                break;
            case 'on':
                UTIL.show('axp_makecolor_div_colorPicker');
                break;
        }
        // CMYKスライダー
        switch (this.axpObj.config('axp_config_form_makeColorTypeCMYK')) {
            case 'off':
                UTIL.hide('axp_makecolor_div_CMYKSlider');
                break;
            case 'on':
                UTIL.show('axp_makecolor_div_CMYKSlider');
                break;
        }
        // Labスライダー
        switch (this.axpObj.config('axp_config_form_makeColorTypeLab')) {
            case 'off':
                UTIL.hide('axp_makecolor_div_LabSlider');
                break;
            case 'on':
                UTIL.show('axp_makecolor_div_LabSlider');
                break;
        }
    }
    // 色履歴への記録をデバウンスする（ドラッグ中の連続変化で埋まらないように）
    _scheduleColorHistoryRecord(colorcode) {
        if (this._historyDebounceTimer !== null) {
            clearTimeout(this._historyDebounceTimer);
        }
        this._historyDebounceTimer = setTimeout(() => {
            this._historyDebounceTimer = null;
            this._recordColorHistory(colorcode);
        }, this.CONST.COLOR_HISTORY_DEBOUNCE_MS);
    }
    // 色履歴へ実際に記録する（直近使用順、重複は先頭へ移動、上限を超えたら末尾を切り捨て）
    _recordColorHistory(colorcode) {
        // hex2rgb/rgb2hexで6桁大文字表記に正規化する。大文字小文字だけでなく
        // #fff等の3桁省略形と#FFFFFF等の6桁表記も同一色として重複排除するため。
        const normalized = '#' + rgb2hex(hex2rgb(colorcode));
        this.colorHistory = this.colorHistory.filter((c) => c !== normalized);
        this.colorHistory.unshift(normalized);
        if (this.colorHistory.length > this.CONST.COLOR_HISTORY_MAX) {
            this.colorHistory.length = this.CONST.COLOR_HISTORY_MAX;
        }
        this.axpObj.configSystem.saveConfig('COLHS', JSON.stringify(this.colorHistory));
        this._renderColorHistory();
    }
    // 色履歴スウォッチの再描画
    _renderColorHistory() {
        const container = document.getElementById('axp_makecolor_div_colorHistory');
        if (!container) return;
        container.textContent = '';
        for (const colorcode of this.colorHistory) {
            const swatch = document.createElement('div');
            swatch.className = 'axpc_makecolor_historySwatch';
            swatch.style.backgroundColor = colorcode;
            swatch.addEventListener('click', () => {
                this.setMainColor(colorcode);
            });
            container.appendChild(swatch);
        }
    }
}
