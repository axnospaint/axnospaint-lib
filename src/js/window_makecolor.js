// @description ツールウィンドウ：親クラス＞色作成

import { ToolWindow } from './window.js';
import htmldata from '../html/window_makecolor.txt';
// css適用
require('../css/window_makecolor.css');

import { hex2rgb, rgb2hex, isColor, adjustColorValue, UTIL } from './etc.js';

// カラーピッカーライブラリ
import ReinventedColorWheel from './reinvented-color-wheel.js';
require('../css/reinvented-color-wheel.css');

// カラー作成制御オブジェクト
export class ColorMakerSystem extends ToolWindow {
    // メインカラー、サブカラー（#付きで管理）
    maincolor;
    subcolor;
    colorWheel;
    colorWheel_subwindow;
    CONST = {
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
        document.getElementById('axp_makecolor_div_mainColor').style.backgroundColor = '#000000';
        document.getElementById('axp_makecolor_div_subColor').style.backgroundColor = '#FFFFFF';
        this.maincolor = "#000000";
        this.subcolor = "#FFFFFF";
        this.createTemporaryPalette();

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
    //　イベント受付開始
    startEvent() {
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
        const onchangeColorValue = (e) => {
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

        // 編集モードならカラーパレットにも反映
        this.axpObj.colorPaletteSystem.setColor(colorcode);
        // ペンプレビュー
        this.axpObj.penSystem.previewPenSize();
        this.updateTemporaryPalette();
        let temporary = document.querySelector('#axp_makecolor_div_mixedPalette>div>div[data-selected="true"]');
        if (temporary) {
            // メインカラー用表示を混色にする（CSS変数経由で疑似要素に参照させる）
            document.getElementById('axp_makecolor_div_mainColor').style.setProperty('--axp-mixedcolor', temporary.dataset.color);
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

        // 編集モードならカラーパレットにも反映
        this.axpObj.colorPaletteSystem.setColor(colorcode);
        // ペンプレビュー
        this.axpObj.penSystem.previewPenSize();
        this.updateTemporaryPalette();
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
    }
}