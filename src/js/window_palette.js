// @description ツールウィンドウ：親クラス＞パレット

import { ToolWindow } from './window.js';
import htmldata from '../html/window_palette.txt';
// css適用
require('../css/window_palette.css');

import { UTIL, hex2rgb } from './etc.js';

// デフォルトカラーパレット
const arrayPaletteDefault = [
    '#000000',
    '#333333',
    '#777777',
    '#cccccc',
    '#32486f',
    '#1b25b5',
    '#ba09ba',
    '#ff3bde',
    '#0cc3e8',
    '#852f04',
    '#b80410',
    '#d12c2c',
    '#e88460',
    '#ff8b1f',
    '#56bc9d',
    '#0fc23c',
    '#87ee6d',
    '#ffff47',
    '#fffcb4',
    '#ffc076',
    '#ffc4b5',
    '#ffe4d6',
    '#fff5df',
    '#ffffff'
];

// カラーパレット制御オブジェクト
export class ColorPaletteSystem extends ToolWindow {
    CONST = {
        // 最大カラーパレット数
        COLOR_MAX: 50,
    }
    // パレット情報
    currentPalette = {
        column: 5,
        // パレット配列（カラーコードの配列）
        palette: [],
    }

    // 編集中フラグ
    isEditMode = false;
    // 現在選択中のパレット要素
    elementCurrentPalette;
    elementPaletteBox;

    constructor(axpObj) {
        super(axpObj);
    }
    // 初期ウィンドウ位置
    getDefaultPosition() {
        return {
            //left: this.axpObj.paintBodyElement.clientWidth - this.window_width - 200,
            left: this.axpObj.paintBodyElement.clientWidth - this.window_width - 74,
            top: 250,
        }
    }
    // 初期化（＆キャンバスリセット時の再初期化）
    init() {
        // HTML
        this.createHTML(
            'axp_palette',
            'PLT',
            this.axpObj._('@WINDOW.SWATCHES'),
            'axpc_icon_window_palette',
            htmldata
        );
        this.window_width = 46;
        // 初期座標設定
        const pos = this.getDefaultPosition();
        this.window_left = pos.left;
        this.window_top = pos.top;
        // パレット要素取得
        this.elementPaletteBox = document.getElementById('axp_palette_div_paletteBox');
        // デフォルトパレット配列生成
        this.setPaletteArray();
    }
    //　イベント受付開始
    startEvent() {
        // ボタン：編集モード
        const edit = (e) => {
            // 編集モードに切り替わる場合、事前にメインカラーを更新
            if (!this.isEditMode) {
                this.axpObj.colorMakerSystem.setMainColor(this.getColor());
                // ペンプレビュー
                this.axpObj.penSystem.previewPenSize();
            }
            // 編集中フラグ更新
            this.isEditMode = !this.isEditMode;
            if (this.isEditMode) {
                // ボタンを凹ませる
                document.getElementById('axp_palette_button_edit').dataset.selected = 'true';
                // 削除ボタン表示
                UTIL.show('axp_palette_button_delete');
                // 列数スライダー表示
                if (document.getElementById('axp_config_checkbox_paletteColumnEdit').checked) {
                    const elemSlider = document.getElementById('axp_palette_div_column');
                    //elemSlider.style.top = this.window_top + 'px';
                    //elemSlider.style.left = this.window_left + 'px';
                    UTIL.show(elemSlider);
                }
                // ツールウィンドウの色を変化（注意喚起）
                document.getElementById('axp_palette').classList.add('axpc_window_attention');
                // パレット編集モードに切り替えました。（パレットの更新／位置入れ替え／削除が行えます）
                this.axpObj.msg('@INF3000');
            } else {
                // 設定の解除
                UTIL.hide('axp_palette_button_delete');
                UTIL.hide('axp_palette_div_column');
                document.getElementById('axp_palette_button_edit').dataset.selected = 'false';
                document.getElementById('axp_palette').classList.remove('axpc_window_attention');
                // パレット編集モードを解除しました。
                this.axpObj.msg('@INF3001');
            }
        }
        document.getElementById('axp_palette_button_edit').onclick = edit;

        const p_delete = (e) => {
            if (this.currentPalette.palette.length <= 1) {
                // すべてのパレットを削除することはできません。
                this.axpObj.msg('@CAU3000');
                return;
            }
            // index取得
            let idx;
            for (idx = 0; idx < this.elementPaletteBox.childElementCount; idx++) {
                if (this.elementPaletteBox.children[idx] === this.elementCurrentPalette) {
                    break;
                }
            }
            // パレット配列から削除
            this.currentPalette.palette.splice(idx, 1);
            // DBへ保存
            this.axpObj.saveSystem.save_palette(this.currentPalette.palette);

            // 画面から削除
            this.elementPaletteBox.removeChild(this.elementCurrentPalette);

            // パレット列数更新
            this.updatePaletteColumn();

            // カレントパレットの設定
            if (idx === this.elementPaletteBox.childElementCount) {
                // 末尾のパレットを削除した場合は、indexを一つ手前にずらす
                idx--;
            }
            this.elementCurrentPalette = this.elementPaletteBox.children[idx];
            this.elementCurrentPalette.dataset.selected = 'true';

            // 削除によって新しく選択されたパレット
            let colorcode = this.elementCurrentPalette.dataset.color;
            // 色を変更
            this.axpObj.colorMakerSystem.setMainColor(colorcode);
            // ペンプレビュー
            this.axpObj.penSystem.previewPenSize();

            // カラーパレットを削除しました。
            this.axpObj.msg('@INF3002');
        }
        document.getElementById('axp_palette_button_delete').onclick = p_delete;

        // ボタン：登録
        document.getElementById('axp_palette_button_addColor').addEventListener('click', () => {
            this.addcolor();
        });
        // カラーパレットの列数
        document.getElementById('axp_palette_range_column').oninput = (e) => {
            this.setPaletteColumn(e.target.value);
        }
    }

    addcolor() {
        let colorcode = this.axpObj.colorMakerSystem.getAdjustColor();
        if (this.currentPalette.palette.length >= this.CONST.COLOR_MAX) {
            // 登録できるパレット数は%1個までです。
            this.axpObj.msg('@CAU3001', this.CONST.COLOR_MAX);
            return;
        }

        var box = document.getElementById('axp_palette_div_paletteBox');
        // 現在のパレットを選択解除
        this.elementCurrentPalette.dataset.selected = '';
        // 登録：パレットボックスの最後尾に追加
        this.elementCurrentPalette = box.appendChild(this.createPaletteHTML(colorcode));
        // 新パレットを選択
        this.elementCurrentPalette.dataset.selected = 'true';

        // パレット配列追加
        this.currentPalette.palette.push(colorcode);
        // DBへ保存
        this.axpObj.saveSystem.save_palette(this.currentPalette.palette);

        // パレット列数更新
        this.updatePaletteColumn();
        // カラーパレットを登録しました。RGB:(%1)
        this.axpObj.msg('@INF3003', hex2rgb(colorcode));
    }

    // パレットのドラッグ＆ドロップ
    drag_down(e) {
        const target = e.currentTarget;
        const pageX = e.pageX;
        const pageY = e.pageY;
        ps_data.idx_source = palette_sorting.index(target); // 移動するパレットの添字
        ps_data.target = target;
        ps_data.diffX = pageX;
        ps_data.diffY = pageY;
        ps_data.ofx = target.offsetLeft;
        ps_data.ofy = target.offsetTop;

        const targetPosL = ps_data.ofx;
        const targetPosT = ps_data.ofy;
        target.style.left = `${targetPosL}px`;
        target.style.top = `${targetPosT}px`;

        ps_data.cloneName = palette_sorting.insertClone(target, palette_sorting.index(target));
        // クラス名axpc_onGRABを付与することで、CSSで指定してあるposition: absolute;が有効となる→自由にドラッグができる
        target.classList.add('axpc_onGRAB');
        // ドラッグ中
        const onPointerMove = (e) => {
            const target = ps_data.target;
            const pageX = e.pageX;
            const pageY = e.pageY;
            const targetPosL = ps_data.ofx + pageX - ps_data.diffX;
            const targetPosT = ps_data.ofy + pageY - ps_data.diffY;
            target.style.left = `${targetPosL}px`;
            target.style.top = `${targetPosT}px`;
            palette_sorting.swap(target);
        }
        // ドロップ
        const onPointerUp = (e) => {
            const target = ps_data.target;
            const cloneSelector = `.${ps_data.cloneName}`;
            const clone = document.querySelector(cloneSelector);
            ps_data.cloneName = '';
            clone.remove();
            target.classList.remove('axpc_onGRAB');
            // イベントリスナー解除
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);

            // 操作終了時のインデックス
            ps_data.idx_dest = palette_sorting.index(target);

            //console.log(`開始:${ps_data.idx_source} 終了:${ps_data.idx_dest}`);

            // 実際に入れ替えが行われたかを判定する（開始時と終了時でindexが異なる場合）
            if (ps_data.idx_source !== ps_data.idx_dest) {
                // パレット配列
                const color = this.currentPalette.palette[ps_data.idx_source];
                // 開始位置のパレットを削除
                this.currentPalette.palette.splice(ps_data.idx_source, 1);
                // 終了位置にパレットを挿入
                this.currentPalette.palette.splice(ps_data.idx_dest, 0, color);
                // DBへ保存
                this.axpObj.saveSystem.save_palette(this.currentPalette.palette);
            }
        }
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    getColor() {
        // 現在選択中のパレットを返却
        // #13 バグ修正に伴い、引数指定は廃止
        return this.elementCurrentPalette.dataset.color;
    }
    setColor(colorCode) {
        // 編集モードでなければ処理しない
        if (!this.isEditMode) return;
        // index取得
        let idx;
        for (idx = 0; idx < this.elementPaletteBox.childElementCount; idx++) {
            if (this.elementPaletteBox.children[idx] === this.elementCurrentPalette) {
                break;
            }
        }
        // 現在選択中のパレットを、メインカラーに更新
        this.elementCurrentPalette.style.backgroundColor = colorCode;
        this.elementCurrentPalette.dataset.color = colorCode;
        // パレット配列更新
        this.currentPalette.palette[idx] = colorCode;
        // DBへ保存
        this.axpObj.saveSystem.save_palette(this.currentPalette.palette);

    }
    setPaletteArray(array) {
        if (array === undefined) {
            array = arrayPaletteDefault;
            this.currentPalette.column = 3;
        }
        // パレット最大数を超過していたらエラー
        if (array.length > this.CONST.COLOR_MAX) {
            throw new Error('colorPalette MAX over');
        }
        for (let idx = 0; idx < array.length; idx++) {
            // カラーコードの先頭に#がついていない場合、#を付与する（ver.1.13以前と互換）
            if (array[idx].substring(0, 1) !== '#') {
                array[idx] = '#' + array[idx];
            }
        }
        this.currentPalette.palette.splice(0);
        // そのまま代入するとパレットの更新で元の配列が上書きされてしまうため、値をコピーする
        for (let item of array) {
            this.currentPalette.palette.push(item);
        }
    }

    setPaletteColumn(col) {
        let column = Number(col)
        // 桁数０を折り返し無しと定義する
        if (column > this.currentPalette.palette.length) {
            column = 0;
        }
        this.currentPalette.column = column;
        // 列数の更新
        this.updatePaletteColumn();
        this.axpObj.configSystem.saveConfig('PLTCO', column);
    }
    // パレット全体の生成
    createPalette() {
        // パレットボックスの要素の全削除
        while (this.elementPaletteBox.firstChild) {
            this.elementPaletteBox.removeChild(this.elementPaletteBox.firstChild);
        }
        for (const item of this.currentPalette.palette) {
            // 画面に作成したカラーパレットを追加
            this.elementPaletteBox.appendChild(this.createPaletteHTML(item));
        }
        // 最初の要素を選択済みにする
        this.elementCurrentPalette = document.querySelector('#axp_palette_div_paletteBox :first-child');
        this.elementCurrentPalette.dataset.selected = 'true';
        // 列数の更新
        this.updatePaletteColumn();
    }
    // パレット全体の生成
    updatePaletteColumn() {
        const length = this.currentPalette.palette.length;
        const column = this.currentPalette.column;
        const row = column !== 0 ? Math.ceil(length / column) : 1;
        //console.log(`length:${length} row:${row} columm:${column}`);

        let elementWindow = document.getElementById('axp_palette');
        let elementContainer = document.getElementById('axp_palette_div_container');
        let elementButtonBox = document.getElementById('axp_palette_div_buttons');
        let elementPaletteBox = document.getElementById('axp_palette_div_paletteBox');

        let newColumn;
        if (column === 0) {
            // 折り返し無しの時
            newColumn = length;
            elementContainer.style.flexDirection = 'row';
            elementButtonBox.style.flexWrap = 'nowrap';
        } else {
            newColumn = column;
            elementContainer.style.flexDirection = 'column';
            elementButtonBox.style.flexWrap = 'wrap';
        }
        let newWidthPalette = newColumn * 32;
        let newWidthWindow = newWidthPalette + 14;

        // パレットの幅
        elementPaletteBox.style.width = newWidthPalette + 'px';

        // 折り返し無しの時以外で、列数が２以下の場合、ウィンドウ幅も縮める
        if (column !== 0 && newColumn <= 2) {
            elementWindow.style.width = newWidthWindow + 'px';
        } else {
            elementWindow.style.width = 'auto';
        }
        this.currentPalette.height = 32 * row;

        // 列数スライダーの値更新
        let range_index = column;
        let value = column;
        if (column === 0) {
            // 折り返し無しの場合、数値の表示を変換する
            range_index = length + 1;
            value = '∞';
        }

        // 現在のパレット数＋１までスライダーを選択できるようにする
        // パレット側スライダー
        document.getElementById('axp_palette_range_column').max = length + 1;
        document.getElementById('axp_palette_range_column').value = range_index;
        document.getElementById('axp_palette_form_column').result.value = value;
        // 設定側スライダー
        document.getElementById('axp_config_form_paletteColumnValue').volume.max = length + 1;
        document.getElementById('axp_config_form_paletteColumnValue').volume.value = range_index;
        document.getElementById('axp_config_form_paletteColumnValue').result.value = value;

        // 設定用カラーパレット表示更新
        this.axpObj.configSystem.dispPalettebox(document.getElementById('axp_config_div_paletteBox'), this.currentPalette);
    }

    // カラーパレット（単体）のHTML生成
    createPaletteHTML(colorcode) {
        const newButton = document.createElement('button');
        newButton.setAttribute('class', 'axpc_palette_colorRect');
        newButton.dataset.color = colorcode;
        newButton.style.backgroundColor = colorcode;

        // パレットにカーソルを当てたとき
        newButton.addEventListener('pointerenter', (e) => {
            //console.log(e);
            //console.log(this);
            if (this.isEditMode) {
                // [編集モード] ドラッグで位置を入れ替え。カラーツール操作で選択中パレットの色を更新。
                this.axpObj.msg('@AXP3000');
            } else {
                //%drawingColorNameを指定色に変更します。RGB:(%1)
                this.axpObj.msg('@AXP3001', hex2rgb(e.target.dataset.color));
            }
        });
        // パレットがクリックされたとき
        newButton.addEventListener('pointerdown', (e) => {
            var colorcode = e.target.dataset.color;

            //　編集モード
            if (this.isEditMode) {
                this.drag_down(e);
            }

            // 透明色選択状態なら解除
            this.axpObj.colorMakerSystem.selectPalette();

            // 現在選択されているカラーパレットIDの更新
            this.elementCurrentPalette.dataset.selected = "";
            this.elementCurrentPalette = e.target;
            this.elementCurrentPalette.dataset.selected = "true";

            // 色を変更
            this.axpObj.colorMakerSystem.setMainColor(colorcode);
            // ペンツールの表示を更新
            this.axpObj.penSystem.changePenMode();

            // %drawingColorName RGB:(%1)
            this.axpObj.msg('@COL0001', hex2rgb(colorcode));
        });

        return newButton;
    }
}

// カラーパレットのドラッグ＆ドロップ制御
const palette_sorting = {
    index(el) {
        const parent = el.parentElement;
        const siblings = parent.children;
        const siblingsArr = [].slice.call(siblings);
        const idx = siblingsArr.indexOf(el);

        return idx;
    },
    insertClone(target, insertIdx) {
        // その場に非表示のクローンを置いて全体のレイアウトが崩れないようにする
        const cloneName = `ddItemClone_${Math.trunc(Math.random() * 10000)}`;
        const clone = target.cloneNode(true);
        const parent = target.parentElement;
        const siblings = parent.children;

        clone.classList.add('axpc_HIDDEN');
        clone.classList.add(cloneName);
        siblings[insertIdx].insertAdjacentElement('afterend', clone);

        return cloneName;
    },
    swap(target) {
        const selfIdx = palette_sorting.index(target);
        const cloneIdx = selfIdx + 1;
        const parent = target.parentElement;
        const siblings = parent.querySelectorAll(`:scope > *:not(.axpc_onGRAB):not(.${ps_data.cloneName})`);

        for (let thatIdx = 0, len = siblings.length; thatIdx < len; thatIdx++) {
            const targetW = target.offsetWidth;
            const targetH = target.offsetHeight;
            const targetRect = target.getBoundingClientRect();
            const targetRectX = targetRect.left;
            const targetRectY = targetRect.top;
            const that = siblings[thatIdx];
            const thatW = that.offsetWidth;
            const thatH = that.offsetHeight;
            const thatRect = that.getBoundingClientRect();
            const thatRectX = thatRect.left;
            const thatRectY = thatRect.top;
            const thatRectXHalf = thatRectX + (thatW / 2);
            const thatRectYHalf = thatRectY + (thatH / 2);
            const hitX = targetRectX <= thatRectXHalf && (targetRectX + targetW) >= thatRectXHalf;
            const hitY = targetRectY <= thatRectYHalf && (targetRectY + targetH) >= thatRectYHalf;
            const isHit = hitX && hitY;

            if (isHit) {
                const siblingsAll = parent.children;
                const clone = siblingsAll[cloneIdx];

                parent.insertBefore(clone, selfIdx > thatIdx ? that : that.nextSibling);
                parent.insertBefore(target, clone);

                break;
            }

        }
    }
};
let ps_data = {
    target: null,
    diffX: 0,
    diffY: 0,
    ofx: 0,
    ofy: 0,
    idx_source: null,
    idx_dest: null,
};
