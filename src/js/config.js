// @description 設定（ユーザーカスタマイズ機能）

import { confirmExPromise } from './alert.js';
import { dispDate, isColor, inRange, adjustInRange, UTIL } from './etc.js';
import htmldata from '../html/config.txt';
import { range_index } from './pendefine/rangeindex.js';
// css適用
require('../css/config.css');

// ショートカットキーバインド
const objButtonFunction = [
    ['1', '1', 'func_undo'],
    ['2', '2', 'none'],
    ['3', '3', 'none'],
]
const objKeyFunction = [
    ['*', 'ASTERISK', 'none'],
    ['+', 'PLUS', 'func_loupe_up'],
    [',', 'COMMA', 'none'],
    ['-', 'MINUS', 'func_loupe_down'],
    ['.', 'DOT', 'none'],
    ['/', 'SLASH', 'none'],
    ['1', '1', 'none'],
    ['2', '2', 'none'],
    ['3', '3', 'none'],
    ['4', '4', 'none'],
    ['5', '5', 'none'],
    ['6', '6', 'none'],
    ['7', '7', 'none'],
    ['8', '8', 'none'],
    ['9', '9', 'none'],
    ['0', '0', 'func_loupe_reset'],
    [':', 'COLON', 'none'],
    [';', 'SEMICOLON', 'func_loupe_up'],
    ['A', 'A', 'none'],
    ['B', 'B', 'func_backgroundimage'],
    ['C', 'C', 'func_swap_transparent'],
    ['D', 'D', 'none'],
    ['E', 'E', 'func_size_up'],
    ['F', 'F', 'none'],
    ['G', 'G', 'func_grid'],
    ['H', 'H', 'func_flip_h'],
    ['I', 'I', 'func_init_window_positon'],
    ['J', 'J', 'none'],
    ['K', 'K', 'func_rotate'],
    ['L', 'L', 'func_load'],
    ['M', 'M', 'func_flip_h'],
    ['N', 'N', 'none'],
    ['O', 'O', 'none'],
    ['P', 'P', 'func_swap_pixelated'],
    ['Q', 'Q', 'func_size_change'],
    ['R', 'R', 'func_restore'],
    ['S', 'S', 'func_save'],
    ['T', 'T', 'func_transparent'],
    ['U', 'U', 'func_fill_all'],
    ['V', 'V', 'func_flip_v'],
    ['W', 'W', 'func_size_down'],
    ['X', 'X', 'func_swap_maincolor'],
    ['Y', 'Y', 'func_redo'],
    ['Z', 'Z', 'func_undo'],
    ['Backspace', 'BACKSPACE', 'func_undo'],
    ['Enter', 'ENTER', 'none'],
    ['↑', 'ARROWUP', 'func_scroll_up'],
    ['↓', 'ARROWDOWN', 'func_scroll_down'],
    ['←', 'ARROWLEFT', 'func_scroll_left'],
    ['→', 'ARROWRIGHT', 'func_scroll_right'],
];

const mapFunction = new Map();

// 設定機能制御オブジェクト
export class ConfigSystem {
    axpObj;
    CONST = {
        // キャンバスサイズの過去履歴保存数
        CANVAS_SIZE_HISTORY_MAX: 8,
    }
    // ユーザー設定を保存する連想配列
    configObj;
    // キャンバスサイズ履歴
    configCanvasSizeHistory = [];
    // 数字キーのカスタマイズ用セレクトボックスのオプション定義
    optionlist = [
        { value: 'optgroup', name: '機能無し' },
        { value: 'none', name: '---' },
        { value: '/optgroup' },
        { value: 'optgroup', name: 'ペンツール選択' },
        { value: 'func_switch_pen', name: '選択:ペン' },
        { value: 'func_switch_eraser', name: '選択:消しゴム' },
        { value: 'func_switch_fill', name: '選択:バケツ' },
        { value: 'func_switch_hand', name: '選択:ツール' },
        { value: 'func_switch_spuit', name: '選択:スポイト' },
        { value: 'func_switch_toggle', name: '選択:ペン／消しゴム切替' },
        { value: '/optgroup' },
        { value: 'optgroup', name: 'ペン種別' },
        { value: 'func_switch_axp_penmode_round', name: 'ペン種別:丸ペン' },
        { value: 'func_switch_axp_penmode_square', name: 'ペン種別:角ペン' },
        { value: 'func_switch_axp_penmode_dot', name: 'ペン種別:ドットペン' },
        { value: 'func_switch_axp_penmode_fude', name: 'ペン種別:筆ペン' },
        { value: 'func_switch_axp_penmode_crayon', name: 'ペン種別:クレヨン' },
        { value: 'func_switch_axp_penmode_brush', name: 'ペン種別:エアブラシ' },
        { value: '/optgroup' },
        { value: 'optgroup', name: '消しゴム種別' },
        { value: 'func_switch_axp_penmode_eraser_round', name: '消しゴム種別:消しゴム' },
        { value: 'func_switch_axp_penmode_eraser_dot', name: '消しゴム種別:角消しゴム' },
        { value: '/optgroup' },
        { value: 'optgroup', name: 'バケツ種別' },
        { value: 'func_switch_axp_penmode_fill', name: 'バケツ種別:バケツ' },
        { value: 'func_switch_axp_penmode_fillgradation', name: 'バケツ種別:階調バケツ' },
        { value: '/optgroup' },
        { value: 'optgroup', name: 'ツール種別' },
        { value: 'func_switch_axp_penmode_hand', name: 'ツール種別:ハンド' },
        { value: 'func_switch_axp_penmode_move', name: 'ツール種別:移動ツール' },
        { value: '/optgroup' },
        { value: 'optgroup', name: 'ペンの太さ' },
        { value: 'func_size', name: 'ペンの太さ（値指定）' },
        { value: 'func_size_change', name: 'ペンの太さ調整' },
        { value: 'func_size_up', name: 'ペンの太さを１段階上げる' },
        { value: 'func_size_down', name: 'ペンの太さを１段階下げる' },
        { value: '/optgroup' },
        { value: 'optgroup', name: 'ペンの不透明度' },
        { value: 'func_alpha_up', name: 'ペンの不透明度を１段階上げる' },
        { value: 'func_alpha_down', name: 'ペンの不透明度を１段階下げる' },
        { value: '/optgroup' },
        { value: 'optgroup', name: '描画色の選択' },
        { value: 'func_switch_maincolor', name: 'メインカラーを選択' },
        { value: 'func_switch_subcolor', name: 'サブカラーを選択' },
        { value: 'func_switch_transparent', name: '透明色を選択' },
        { value: 'func_swap_maincolor', name: 'メイン／サブカラー切替' },
        { value: 'func_swap_transparent', name: 'メイン／透過色切替' },
        { value: '/optgroup' },
        { value: 'optgroup', name: 'レイヤー操作' },
        { value: 'func_layer_create', name: 'レイヤーの新規作成' },
        { value: 'func_layer_integrate', name: 'レイヤーの統合' },
        { value: 'func_layer_copy', name: 'レイヤーのコピー' },
        { value: 'func_layer_delete', name: 'レイヤーの削除' },
        { value: 'func_layer_clear', name: 'レイヤーのクリア' },
        { value: 'func_fill_all', name: '全面塗り潰し' },
        { value: 'func_rotate', name: '90°回転' },
        { value: '/optgroup' },
        { value: 'optgroup', name: '補助ツール' },
        { value: 'func_undo', name: 'アンドゥ' },
        { value: 'func_redo', name: 'リドゥ' },
        { value: 'func_restore', name: '自動保存から復元' },
        { value: 'func_save', name: 'セーブ' },
        { value: 'func_load', name: 'ロード' },
        { value: 'func_flip_h', name: '全レイヤー左右反転' },
        { value: 'func_flip_v', name: '全レイヤー上下反転' },
        { value: 'func_transparent', name: '背景透過' },
        { value: 'func_grid', name: '補助線' },
        { value: '/optgroup' },
        { value: 'optgroup', name: '拡大率' },
        { value: 'func_loupe', name: '拡大率（値指定）' },
        { value: 'func_loupe_down', name: '拡大率を１段階縮小' },
        { value: 'func_loupe_reset', name: '拡大率とキャンバス位置のリセット' },
        { value: 'func_loupe_up', name: '拡大率を１段階拡大' },
        { value: '/optgroup' },
        { value: 'optgroup', name: '画面スクロール' },
        { value: 'func_scroll_up', name: '画面を上スクロール' },
        { value: 'func_scroll_down', name: '画面を下スクロール' },
        { value: 'func_scroll_left', name: '画面を左スクロール' },
        { value: 'func_scroll_right', name: '画面を右スクロール' },
        { value: '/optgroup' },
        { value: 'optgroup', name: '補助線分割数' },
        { value: 'func_grid_up_h', name: '分割数:横を増やす' },
        { value: 'func_grid_down_h', name: '分割数:横を減らす' },
        { value: 'func_grid_up_v', name: '分割数:縦を増やす' },
        { value: 'func_grid_down_v', name: '分割数:縦を減らす' },
        { value: '/optgroup' },
        { value: 'optgroup', name: 'その他' },
        { value: 'func_init_window_positon', name: 'ツールウィンドウの位置初期化' },
        { value: 'func_swap_pixelated', name: 'キャンバス全体のぼかし切替' },
        { value: 'func_backgroundimage', name: '背景タイルプレビュー' },
        { value: 'func_download', name: '画像をPNG形式でファイルに保存' },
        { value: '/optgroup' },
    ];
    constructor(axpObj) {
        this.axpObj = axpObj;
        this.configObj = new Map();
    }
    // 初期化
    init() {
        // HTML生成
        let targetElement = document.getElementById('axp_config');
        targetElement.insertAdjacentHTML('afterbegin', this.axpObj.translateHTML(htmldata));
        // バージョン情報の表示
        document.getElementById('axp_config_div_versionInfo').textContent = `${this.axpObj.CONST.APP_TITLE} version ${PACKAGE_VERSION} (${PACKAGE_DATE})`
    }
    // HTML展開
    deployHTML() {
        // カテゴリヘッダ生成
        const elementsHeader = document.querySelectorAll('.axpc_config_section');
        for (const div of elementsHeader) {
            // ヘッダdiv
            const newDiv = document.createElement('div');
            newDiv.setAttribute('class', 'axpc_config_sectionHeader');
            // アイコン表示部
            const newSpanIcon = document.createElement('span');
            if (div.dataset.icon) {
                newSpanIcon.classList.add('axpc_icon_span');
                newSpanIcon.classList.add(div.dataset.icon);
            }
            // タイトル表示部
            const newSpanTitle = document.createElement('span');
            newSpanTitle.textContent = div.dataset.title;
            newDiv.appendChild(newSpanIcon);
            newDiv.appendChild(newSpanTitle);

            // 直下（最初の子の前）に挿入
            div.insertAdjacentElement('afterbegin', newDiv);
        }

        // カテゴリ内グループヘッダ生成
        const elementsGroupHeader = document.querySelectorAll('.axpc_config_group');
        for (const div of elementsGroupHeader) {
            // header
            const newDiv = document.createElement('div');
            newDiv.setAttribute('class', 'axpc_config_groupHeader');
            newDiv.textContent = div.dataset.title;
            // 要素自体の前
            div.insertAdjacentElement('beforebegin', newDiv);
        }

        // ラジオボタン生成
        const elementsRadioForm = document.querySelectorAll('.axpc_radio');
        for (const form of elementsRadioForm) {
            //console.log(form.id);
            form.classList.add('axpc_SAVE');
            // form内部のspanをラジオボタンに変換する
            const elementsSpan = form.querySelectorAll('span');
            for (let idx = 0; idx < elementsSpan.length; idx++) {
                // input
                const newInput = document.createElement('input');
                const id = `${form.id}${idx}`;
                //console.log(id);
                newInput.setAttribute('type', 'radio');
                newInput.setAttribute('id', id);
                newInput.setAttribute('name', form.id);
                newInput.setAttribute('value', elementsSpan[idx].dataset.value);
                if (elementsSpan[idx].dataset.default) {
                    newInput.checked = true;
                }
                form.appendChild(newInput);
                // label
                const newLabel = document.createElement('label');
                newLabel.setAttribute('for', id);
                newLabel.setAttribute('class', 'axpc_MSG');
                newLabel.dataset.msg = elementsSpan[idx].dataset.msg;
                newLabel.textContent = elementsSpan[idx].textContent;
                form.appendChild(newLabel);
            }
        }
        // カスタムボタン用セレクトボックスの生成
        const elementsTbodyCustom = document.querySelector('#axp_config_table_customButton>tbody');
        for (let idx = 0; idx < objButtonFunction.length; idx++) {
            let tr = this.createKeyConfigHTML('button', objButtonFunction[idx]);
            // 連動するカスタムボタンのindexを指定（表示オン／オフ用）
            tr.dataset.linkIndex = idx + 1;
            elementsTbodyCustom.appendChild(tr);
            this.selectCustom(tr.id);
        }
        // キーボードショートカット用セレクトボックスの生成
        const elementsTbody = document.querySelector('#axp_config_table_shortcutKey>tbody');
        for (let idx = 0; idx < objKeyFunction.length; idx++) {
            let tr = this.createKeyConfigHTML('key', objKeyFunction[idx]);
            elementsTbody.appendChild(tr);
            this.selectCustom(tr.id);
        }
    }

    startEvent() {
        // ◆共通 ----------------------------------------------------------------
        // スクロール時のナビボタン連動
        // ボタン色変更共通
        const activateButton = (element) => {
            // すでにアクティブになっている目次を選択
            const currentActiveIndex = document.querySelector('#axp_config_div_navButton .axpc_ACTIVE');
            // すでにアクティブになっているものが0個の時（=null）以外は、axpc_ACTIVEクラスを除去
            if (currentActiveIndex !== null) {
                currentActiveIndex.classList.remove('axpc_ACTIVE');
            }
            // 引数で渡されたbutton要素に、axpc_ACTIVEクラスを付与
            element.classList.add('axpc_ACTIVE');
        }
        // 交差検知共通
        const doWhenIntersect = (entries) => {
            // 交差検知をしたもののなかで、isIntersectingがtrueのDOMを色を変える関数に渡す
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // console.log('考査検知:', entry.target.dataset.title);
                    // ボタンの点灯を連動させる
                    const elementButton = document.querySelector(`#axp_config_div_navButton > button:nth-of-type(${entry.target.dataset.idx})`);
                    activateButton(elementButton);
                }
            });
        }
        const options = {
            root: document.querySelector('#axp_config_div_pageMain'),// 対象ルート要素
            rootMargin: "0px 0px -100% 0px", // 一番上を判定基準にする
            threshold: 0 // 閾値は0
        };
        const observer = new IntersectionObserver(doWhenIntersect, options);
        // 交差監視する要素（各セクション）
        const boxes = document.querySelectorAll('.axpc_config_section');
        // それぞれのboxを監視する（ページ末端の１件は除く）
        for (let idx = 0; idx < boxes.length - 1; idx++) {
            //console.log(idx, boxes[idx].dataset.title);
            // ボタンとのペアリング添え字（cssセレクタを使用するため開始添え字１）
            boxes[idx].dataset.idx = idx + 1;
            observer.observe(boxes[idx]);
        };
        /*
        // 慣性監視（廃止）
        let isScrolling = false;
        const callbackScrollEnd = () => { isScrolling = false; }
        document.getElementById('axp_config_div_pageMain').addEventListener('scroll', () => {
            isScrolling = true;
            clearTimeout(window.scrollEndTimer);
            window.scrollEndTimer = setTimeout(callbackScrollEnd, 200);
        });
        */
        // ボタンによるページジャンプ
        const elementsNavButton = document.querySelectorAll('#axp_config_div_navButton button');
        const elementsSection = document.querySelectorAll('.axpc_config_section');
        for (let i = 0; i < elementsNavButton.length; i++) {
            elementsNavButton[i].addEventListener('click', (e) => {
                // 要素の位置までスクロール
                if (this.axpObj.browser === 'Safari') {
                    // safariの場合、スムーススクロールにしないと表示バグ
                    elementsSection[i].scrollIntoView({ behavior: "smooth" });
                } else {
                    elementsSection[i].scrollIntoView();
                    // firefoxの場合連動にずれが生じるため、押されたボタンにaxpc_ACTIVE強制設定
                    activateButton(e.target);
                }
            });
        }

        // ユーザーが設定を変更したとき、変更内容をコンフィグオブジェクトへ保存する
        // classに'axpc_SAVE'を指定されている要素を対象とする
        const elems_config = document.getElementsByClassName('axpc_SAVE');
        for (const item of elems_config) {
            // 値が変更されると呼び出される関数を登録する
            item.addEventListener('change', (e) => {
                //console.log('操作された要素', e.target.id, e.target.type);
                //console.log('登録する要素', e.currentTarget.id);

                // コンフィグオブジェクトの更新
                switch (e.target.type) {
                    case 'range':
                        // レンジスライダー
                        this.saveConfig(`RANGE_${e.currentTarget.id}`, e.target.value);
                        break;
                    case 'checkbox':
                        // チェックボックス
                        this.saveConfig(`CHECK_${e.currentTarget.id}`, e.target.checked);
                        break;
                    case 'radio':
                        // ラジオボックス
                        this.saveConfig(`RADIO_${e.currentTarget.id}`, e.target.value);
                        break;
                    case 'number':
                        // 数値入力
                        // 共通処理
                        let value = Number(e.target.value);
                        // 数値以外(空白や指数表現eなど)が入力されていたら、最小値に置き換え
                        if (isNaN(value)) {
                            value = e.target.min;
                        }
                        // 既定の範囲内から外れる場合、範囲内に補正
                        value =
                            adjustInRange(
                                Number(value),
                                e.target.min,
                                e.target.max
                            );
                        // 要素の値を補正後の値に更新
                        e.target.value = value;
                        this.saveConfig(`VALUE_${e.target.id}`, value);
                        break;
                }
            })
        };

        // ◆キャンバス ----------------------------------------------------------------

        document.getElementById('axp_config_span_canvasSizeLimit').textContent =
            `(※最小${this.axpObj.minWidth}×${this.axpObj.minHeight} ～ 最大${this.axpObj.maxWidth}×${this.axpObj.maxHeight})`;

        const inputWidth = document.getElementById('axp_config_number_oekakiWidth');
        inputWidth.min = this.axpObj.minWidth;
        inputWidth.max = this.axpObj.maxWidth;
        inputWidth.value = this.axpObj.x_size;

        const inputHeight = document.getElementById('axp_config_number_oekakiHeight');
        inputHeight.min = this.axpObj.minHeight;
        inputHeight.max = this.axpObj.maxHeight;
        inputHeight.value = this.axpObj.y_size;

        // テキストボックス：お絵カキコのサイズ数値変更
        inputWidth.onchange = (e) => {
            // キャンバスサイズの範囲チェック
            inputWidth.value = this.axpObj.checkCanvasSize_x(inputWidth.value);
        }
        inputHeight.onchange = (e) => {
            // キャンバスサイズの範囲チェック
            inputHeight.value = this.axpObj.checkCanvasSize_y(inputHeight.value);
        }
        // ボタン：新規キャンバス
        document.getElementById('axp_config_button_newCanvas').onclick = (e) => {
            // キャンバスサイズの範囲チェック
            let x = inputWidth.value = this.axpObj.checkCanvasSize_x(inputWidth.value);
            let y = inputHeight.value = this.axpObj.checkCanvasSize_y(inputHeight.value);

            // 確認ダイアログ表示
            confirmExPromise(`現在の描画内容を破棄して新規キャンバス（${x}×${y}）を作成します。\nよろしいですか？\n（※この処理はアンドゥできません）`)
                .then(() => {
                    // ※OK時の処理
                    // タブをキャンバスに変更
                    this.axpObj.selectTab('0');
                    // キャンバス初期化
                    this.axpObj.setCanvasSize(x, y);
                    this.axpObj.resetCanvas();
                    // 初期レイヤー作成
                    this.axpObj.layerSystem.newLayer();
                    // 表示更新
                    this.axpObj.layerSystem.updateCanvas();

                    // キャンバスサイズ履歴への追加と表示更新
                    this.addCanvasSizeHistory(x, y);
                    this.updateCanvasSizeHistory();

                    // 「基にしてお絵カキコ」情報のリセット
                    this.axpObj.oekaki_id = null;
                    this.axpObj.draftImageFile = null;
                    this.axpObj.oekaki_bbs_pageno = null;
                    this.axpObj.oekaki_bbs_title = null;

                    alert(`新規キャンバスを作成しました。横:${x} 縦:${y}`);
                })
                .catch(() => {
                    // ※Cancel時の処理
                    // 処理なし
                });
        }
        // ボタン：お絵カキコのサイズ変更
        document.getElementById('axp_config_button_changeCanvasSize').onpointerdown = (e) => {

            // 起動オプションで、下書き機能使用時のキャンバスサイズの変更が制限されている場合
            if (this.axpObj.restrictDraftCanvasResizing) {
                if (this.axpObj.oekaki_id !== null || this.axpObj.draftImageFile !== null) {
                    alert('下書き機能を利用したキャンバスは、サイズの変更ができません。');
                    return;
                }
            }

            // キャンバスサイズの範囲チェック
            let x = inputWidth.value = this.axpObj.checkCanvasSize_x(inputWidth.value);
            let y = inputHeight.value = this.axpObj.checkCanvasSize_y(inputHeight.value);

            // 確認ダイアログ表示
            confirmExPromise(`キャンバスサイズを${x}×${y}に変更します。\nよろしいですか？\n（※この処理はアンドゥできません）`)
                .then(() => {
                    // ※OK時の処理
                    // タブをキャンバスに変更
                    this.axpObj.selectTab('0');
                    // レイヤーオブジェクトをコピーして一時保存
                    let obj = this.axpObj.layerSystem.layerObj;
                    var copy_layerOBJ = obj.map(obj => ({ ...obj }));

                    // キャンバスサイズ設定
                    this.axpObj.setCanvasSize(x, y);

                    // レイヤーオブジェクトのimagedataサイズを新しいサイズに変更する（全レイヤー分繰り返す）
                    const newCanvas = document.createElement('canvas');
                    newCanvas.width = x;
                    newCanvas.height = y;
                    const newCanvas_ctx = newCanvas.getContext('2d', { willReadFrequently: true });

                    for (let item of copy_layerOBJ) {
                        newCanvas_ctx.clearRect(0, 0, x, y);
                        newCanvas_ctx.putImageData(item.image, 0, 0);
                        item.image = newCanvas_ctx.getImageData(0, 0, x, y);
                    }

                    var data = {
                        version: this.axpObj.saveSystem.CONST.DATA_VERSION,
                        id: null,
                        created: null,
                        src: null,
                        x_max: x,
                        y_max: y,
                        counter: this.axpObj.layerSystem.layer_counter,
                        layer: copy_layerOBJ,
                        transparent: this.axpObj.assistToolSystem.getIsTransparent(),
                    }
                    // 復元処理
                    this.axpObj.saveSystem.restoreData(data);

                    copy_layerOBJ = null;
                    data = null;

                    // キャンバスサイズ履歴への追加と表示更新
                    this.addCanvasSizeHistory(x, y);
                    this.updateCanvasSizeHistory();

                    alert(`キャンバスサイズを変更しました。横:${x} 縦:${y}`);
                })
                .catch(() => {
                    // ※Cancel時の処理
                    // 処理なし
                });
        }
        // ラジオボタン：キャンバスぼかし
        document.getElementById('axp_config_form_antialiasing').onchange = (e) => {
            this.set_canvas_antialiasing();
        }
        // 画像をダウンロード
        document.getElementById('axp_config_button_pngDownload').onmousedown = (e) => {
            this.axpObj.TASK['func_download']();
        }

        // ラジオボタン：ポインタ座標表示
        document.getElementById('axp_config_form_displayPosition').onchange = (e) => {
            this.set_display_position();
        }

        // ◆ツールウィンドウ ----------------------------------------------------------------
        // ウィンドウ位置リセット
        document.getElementById('axp_config_button_resetWindow').addEventListener('click', (e) => {
            this.axpObj.dragWindow.resetPosition();
            alert('全ウィンドウ位置を初期化しました。');
        })

        // ツールウィンドウ位置の自動調整
        document.getElementById('axp_config_form_windowAutoAdjust').onchange = (e) => {
            // 全ツールウィンドウのcss（left,top）を更新
            this.axpObj.dragWindow.changeAutoAdjustPosition();
        };
        // 最小化アイコン配置
        document.getElementById('axp_config_form_minimizeType').onchange = (e) => {
            this.axpObj.dragWindow.setMinimizeType();
        };

        // ◆ペンツール ----------------------------------------------------------------
        // ラジオボタン：トーン濃度レンジスライダー
        document.getElementById('axp_config_form_ToneLevel').onchange = (e) => {
            this.axpObj.penSystem.changePenMode();
        }
        // ラジオボタン：ぼかし度レンジスライダー
        document.getElementById('axp_config_form_blurLevel').onchange = (e) => {
            this.axpObj.penSystem.changePenMode();
        }
        // ラジオボタン：不透明度と太さの表示順序
        document.getElementById('axp_config_form_pentoolRangeOrder').onchange = (e) => {
            this.axpObj.penSystem.changeOrderSlider();
        }
        // チェックボックス：手ぶれ補正　ペンツールウィンドウ内で変更可能にする
        document.getElementById('axp_config_checkbox_stabilize').onchange = (e) => {
            this.axpObj.penSystem.changePenMode();
        }
        // レンジスライダー：手ぶれ補正　連動
        // 設定タブ側
        document.getElementById('axp_config_form_stabilizerValue').onchange = (e) => {
            document.getElementById('axp_pen_form_stabilizer').volume.value = e.target.value;
            document.getElementById('axp_pen_form_stabilizer').result.value = e.target.value;
        }
        // ペンツール側
        document.getElementById('axp_pen_form_stabilizer').onchange = (e) => {
            document.getElementById('axp_config_form_stabilizerValue').volume.value = e.target.value;
            document.getElementById('axp_config_form_stabilizerValue').result.value = e.target.value;
            this.saveConfig('RANGE_axp_config_form_stabilizerValue', e.target.value);
        }

        // ラジオボタン：長押しスポイト
        document.getElementById('axp_config_form_useLongtap').onchange = (e) => {
            this.set_longtap_use();
        }
        // 初回リセット用
        this.set_longtap_use();

        // ◆色作成ツール ----------------------------------------------------------------
        // 使用する色作成ツール
        document.getElementById('axp_config_form_makeColorTypeRGB').addEventListener('change', () => {
            this.axpObj.colorMakerSystem.updateMakeColorType();
        });
        document.getElementById('axp_config_form_makeColorTypePicker').addEventListener('change', () => {
            this.axpObj.colorMakerSystem.updateMakeColorType();
        });
        document.getElementById('axp_config_form_makeColorTypeMixed').addEventListener('change', () => {
            this.axpObj.colorMakerSystem.updateMakeColorType();
        });
        // ◆カラーパレット ----------------------------------------------------------------

        // カラーパレットの列数
        document.getElementById('axp_config_form_paletteColumnValue').addEventListener('input', (e) => {
            this.axpObj.colorPaletteSystem.setPaletteColumn(e.target.value);
        });

        // カラーパレットのファイル保存
        document.getElementById('axp_config_button_saveColor').onclick = (e) => {
            // カラーパレットのテキストデータを生成
            let colortext = new Array();
            // 列数
            colortext.push(
                'column,' + this.axpObj.colorPaletteSystem.currentPalette.column + '\n');
            // パレット配列の中身（#付きカラーコード）を１色ずつテキストに書き出す
            for (const color of this.axpObj.colorPaletteSystem.currentPalette.palette) {
                colortext.push(color + '\n');
            }
            var filename = "ap_color" + dispDate(new Date(), 'YYYYMMDD_hhmmss') + ".txt"
            var blob = new Blob(colortext, { type: 'text/plain' });
            var link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        }
        // カラーパレットのファイル読込
        document.getElementById('axp_config_button_loadColor').onclick = (e) => {
            // ファイルオープンダイアログを開く
            document.getElementById('axp_config_file_loadColor').click();
        }
        // ダイアログオープン時
        document.getElementById('axp_config_file_loadColor').onclick = (e) => {
            // ２度同じファイルを選択したとき、onchangeが発火しない不具合を回避するため値を初期化する
            e.target.value = '';
        }
        //ダイアログでファイルが選択された時
        document.getElementById('axp_config_file_loadColor').onchange = (e) => {
            var file = e.target.files;
            // ファイルが選択されていない場合（キャンセル）
            if (file.length === 0) return;

            //FileReaderの作成
            var reader = new FileReader();
            //テキスト形式で読み込む
            reader.readAsText(file[0]);

            //読込終了後の処理
            reader.onload = () => {
                // 読み込んだテキストを配列に分割
                var arr = reader.result.split(/\r\n|\n/);
                var loopend = arr.length - 1;
                if (loopend === 0) {
                    // データなし
                    alert("有効なデータファイルではありません。");
                    return;
                }
                let newPalette = {
                    column: 5,
                    palette: [],
                }

                for (var i = 0; i < loopend; i++) {
                    let data = arr[i];

                    // 列データの場合
                    if (data.substr(0, 6) === 'column') {
                        let column = data.split(',')[1];
                        if (isNaN(column) ||
                            !inRange(Number(column), 0, this.axpObj.colorPaletteSystem.CONST.COLOR_MAX)) {
                            alert("columnが不正な値のため、読込を中止しました。\n行数:" + (i + 1) + " 内容:" + data);
                            return;
                        }
                        console.log('column:', column);
                        newPalette.column = Number(column);
                        continue;

                    }
                    // 横ボタンデータの場合スキップ（廃止項目）
                    if (data.substr(0, 4) === 'side') {
                        continue;
                    }
                    // 最大パレット数を超えるデータは無視する
                    if (newPalette.palette.length >= this.axpObj.colorPaletteSystem.CONST.COLOR_MAX) break;
                    let code = data;
                    //if (code.slice(0, 1) == "#") code = code.slice(1); //先頭の#を外す
                    if (isColor(code)) {
                        // 正常なカラーコードであれば、パレットオブジェクトに格納
                        newPalette.palette.push(code);
                    } else {
                        alert("カラーコードに誤りがあるため、読込を中止しました。\n行数:" + (i + 1) + " 内容:" + data);
                        return;
                    }
                }

                if (newPalette.palette.length === 0) {
                    // 有効な色データなし
                    alert("パレットデータが１色もありません。");
                    return;
                }

                // 処理正常
                // カラーパレットデータ更新
                this.axpObj.colorPaletteSystem.setPaletteArray(newPalette.palette);
                this.axpObj.colorPaletteSystem.currentPalette.column = newPalette.column;
                // カラーパレット生成
                this.axpObj.colorPaletteSystem.createPalette();
                // 設定用カラーパレット表示更新
                this.dispPalettebox(document.getElementById('axp_config_div_paletteBox'), newPalette);
                // DBへ保存
                this.axpObj.saveSystem.save_palette(newPalette.palette);
                this.axpObj.configSystem.saveConfig('PLTCO', newPalette.column);
                alert("カラーパレットを正常に読み込みました。\nパレット数:" + newPalette.palette.length);
            }
        }
        // カラーパレットの初期化
        document.getElementById('axp_config_button_resetColor').onclick = (e) => {
            // 確認ダイアログ表示
            confirmExPromise(`カラーパレットを初期状態に戻します。\nよろしいですか？\n（※この処理はアンドゥできません）`)
                .then(() => {
                    // ※OK時の処理
                    // カラーパレットデータ更新
                    this.axpObj.colorPaletteSystem.setPaletteArray();
                    // カラーパレット更新
                    this.axpObj.colorPaletteSystem.createPalette();
                    // 設定用カラーパレット表示更新
                    this.dispPalettebox(document.getElementById('axp_config_div_paletteBox'), this.axpObj.colorPaletteSystem.currentPalette);
                    // DBへ保存
                    this.axpObj.saveSystem.save_palette(this.axpObj.colorPaletteSystem.currentPalette.palette);
                    this.axpObj.configSystem.saveConfig('PLTCO', this.axpObj.colorPaletteSystem.currentPalette.column);
                    alert("カラーパレットを初期化しました。");
                })
                .catch(() => {
                    // ※Cancel時の処理
                    // 処理なし
                });
        }

        // ◆レイヤー ----------------------------------------------------------------
        // 合成モードの表示
        document.getElementById('axp_config_form_blendModeDisplayType').onchange = (e) => {
            this.axpObj.layerSystem.updateBlendModeDisplayAll();
        }
        // カラータグ名の初期化
        document.getElementById('axp_config_button_resetColorTag').onclick = (e) => {
            // 確認ダイアログ表示
            confirmExPromise(`カラータグ名を初期状態に戻します。\nよろしいですか？\n（※この処理はアンドゥできません）`)
                .then(() => {
                    // ※OK時の処理
                    // カラータグリスト初期化
                    this.axpObj.layerSystem.resetColorTagList();
                    // レイヤー名変更サブウィンドウのボタン表示、設定タブのテキストに反映
                    this.axpObj.layerSystem.updateAllColorTag();
                    // コンフィグ保存
                    this.axpObj.configSystem.deleteConfig('COTAG');
                    alert('カラータグ名を初期化しました。');
                })
                .catch(() => {
                    // ※Cancel時の処理
                    // 処理なし
                });
        }

        // ◆補助ツール ----------------------------------------------------------------
        // 拡大率テーブル変更
        const setCurrentScaleTable = () => {
            const elements_li = document.querySelectorAll('#axp_config_ul_scale>li');
            this.axpObj.currentScaleTable = [];
            for (const item of elements_li) {
                this.axpObj.currentScaleTable.push(Number(item.dataset.value));
            }
            // キーカスタマイズ連動
            this.updateKeyCustomizationScaleTable(this.axpObj.currentScaleTable);
        }
        // 拡大率追加
        document.getElementById('axp_config_button_addScale').addEventListener('click', (e) => {
            const inputValue = Number(document.getElementById('axp_config_number_scale').value);
            const min = this.axpObj.CONST.SCALE_MIN;
            const max = this.axpObj.CONST.SCALE_MAX;
            const tableMax = this.axpObj.CONST.SCALE_TABLE_MAX;
            if (inRange(inputValue, min, max)) {
                // 挿入位置をサーチ
                const elements_li = document.querySelectorAll('#axp_config_ul_scale>li');
                if (elements_li.length >= tableMax) {
                    this.axpObj.msg('@CAU0100', tableMax);
                    return;
                }
                let index = -1;
                for (let idx = 0; idx < elements_li.length; idx++) {
                    if (inputValue === Number(elements_li[idx].dataset.value)) {
                        index = -999;
                        break;
                    }
                    if (inputValue < Number(elements_li[idx].dataset.value)) {
                        index = idx;
                        break;
                    }
                }

                if (index === -999) {
                    // 拡大率%1%は既に追加されています。
                    this.axpObj.msg('@CAU0101', inputValue);
                } else {
                    // 要素追加
                    const element = document.getElementById('axp_config_ul_scale');
                    const list = document.createElement('li');
                    list.dataset.value = String(inputValue);
                    list.textContent = `${inputValue}%`;
                    if (index === -1) {
                        // 集合の中で最も大きい値の場合、最後尾
                        element.appendChild(this.createHTMLListScale(inputValue));
                    } else {
                        // 集合の間に挿入
                        element.insertBefore(
                            this.createHTMLListScale(inputValue),
                            elements_li[index]
                        );
                    }
                    // 拡大率テーブル更新
                    setCurrentScaleTable();
                    // コンフィグ保存
                    this.saveConfig('SCALE', this.axpObj.currentScaleTable);
                    // 拡大率%1%を追加しました。
                    this.axpObj.msg('@INF0100', inputValue);
                }
            } else {
                // 追加できる拡大率は%1～%2%です。
                this.axpObj.msg('@CAU0102', min, max);
            }
        });
        // 拡大率削除
        document.getElementById('axp_config_button_deleteScale').addEventListener('click', (e) => {
            const elements_li = document.querySelectorAll('#axp_config_ul_scale>li');
            let target = null;
            for (const item of elements_li) {
                if (item.dataset.selected === 'true') {
                    target = item;
                    break;
                }
            }
            if (target) {
                if (target.dataset.value === '100') {
                    // ※拡大率100%は選択できないので、正常ケースでは実行されない
                } else {
                    // 要素の削除
                    target.remove();
                    // 拡大率テーブル更新
                    setCurrentScaleTable();
                    // コンフィグ保存
                    this.saveConfig('SCALE', this.axpObj.currentScaleTable);
                    // 拡大率%1%を削除しました。
                    this.axpObj.msg('@INF0101', target.dataset.value);
                }
            } else {
                // 削除する拡大率が選択されていません。
                this.axpObj.msg('@CAU0103');
            }
        });
        // 拡大率初期化
        document.getElementById('axp_config_button_resetScale').addEventListener('click', (e) => {
            // 確認ダイアログ表示
            confirmExPromise('拡大率の設定を初期状態に戻します。\nよろしいですか？')
                .then(() => {
                    // ※OK時の処理
                    // テーブル初期化
                    this.axpObj.currentScaleTable = this.axpObj.CONST.SCALE_VALUE;
                    // 設定画面表示用テーブルの作成
                    this.createConfigScaleTable(this.axpObj.currentScaleTable);
                    // キーカスタマイズセレクトボックス連動
                    this.updateKeyCustomizationScaleTable(this.axpObj.currentScaleTable);
                    // コンフィグ保存
                    this.saveConfig('SCALE', this.axpObj.currentScaleTable);
                    alert('拡大率の設定を初期化しました。');
                })
                .catch(() => {
                    // ※Cancel時の処理
                    // 処理なし
                });
        });

        // ◆カスタムボタン --------------------------------------------------------------
        // カスタムボタンの使用の変更
        document.getElementById('axp_config_form_useCustomButton').onchange = (e) => {
            this.axpObj.dispCustomButton();
        }

        // ◆マウス ----------------------------------------------------------------

        // ◆キーボード ----------------------------------------------------------------

        // 割り当て無しのキーを非表示にする
        document.getElementById('axp_config_checkbox_shortcutKeyHiddenNofunc').addEventListener('change', (e) => {
            this.switchNofuncKeytable();
        });
        // ショートカットのファイル保存
        document.getElementById('axp_config_button_saveShortcut').addEventListener('click', (e) => {
            // セーブテキスト
            const saveText = new Array();
            saveText.push('// @name\tAXNOSPaintSHORTCUT\n');
            saveText.push(`// @version\t${PACKAGE_VERSION}\n`);
            // キーコンフィグ要素の取得
            const elementsTr = document.querySelectorAll('.axpc_config_custom_key');
            for (const tr of elementsTr) {
                let text = tr.id.slice('axp_config_custom_key'.length) + ':' + this.getSaveCustomText(tr.id);
                saveText.push(text + '\n');
            }
            const filename = "ap_shortcut" + dispDate(new Date(), 'YYYYMMDD_hhmmss') + ".txt"
            const blob = new Blob(saveText, { type: 'text/plain' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        });
        // カラーパレットのファイル読込
        document.getElementById('axp_config_button_loadShortcut').onclick = (e) => {
            // ２度同じファイルを選択したとき、onchangeが発火しない不具合を回避するため値を初期化する
            document.getElementById('axp_config_file_loadShortcut').value = '';
            // ファイルオープンダイアログを開く
            document.getElementById('axp_config_file_loadShortcut').click();
        }
        //ダイアログでファイルが選択された時
        document.getElementById('axp_config_file_loadShortcut').onchange = (e) => {
            const file = e.target.files;
            // ファイルが選択されていない場合（キャンセル）
            if (file.length === 0) return;
            //FileReaderの作成
            const reader = new FileReader();
            //テキスト形式で読み込む
            reader.readAsText(file[0]);

            //読込終了後の処理
            reader.onload = () => {
                // 読み込んだテキストを配列に分割
                const arr = reader.result.split(/\r\n|\n/);
                const loopend = arr.length - 1;
                let isErrorFile = false;
                if (loopend === 0) {
                    isErrorFile = true;
                } else {
                    const dataname = arr[0].split(/\t/)[1];
                    if (dataname !== 'AXNOSPaintSHORTCUT') {
                        isErrorFile = true;
                    }
                }
                if (isErrorFile) {
                    alert('AXNOS Paintのショートカットファイルではありません。');
                    return;
                }

                // ヘッダを読み飛ばし、３行目から１行ずつ処理
                for (let i = 2; i < loopend; i++) {
                    const data = arr[i].split(':');
                    const elememtId = 'axp_config_custom_key' + data[0];
                    const key = 'CFUNC_' + elememtId;
                    const value = data[1];
                    if (document.getElementById(elememtId)) {
                        // 親セレクトボックス要素を取得
                        const elemSelectParent = document.querySelector(`#${elememtId} select:nth-of-type(1)`);
                        // valueの値を分解
                        let valueAry = value.split(',');
                        // 親セレクトボックスを、コンフィグ値の機能種別に変更
                        const found = this.optionlist.find(e => e.value === valueAry[0]);
                        if (typeof found === 'undefined') {
                            // 対応機能が廃止などの理由で見つからなかった場合、機能なしを強制設定
                            elemSelectParent.value = 'none';
                        } else {
                            // 対応機能を選択
                            elemSelectParent.value = valueAry[0];
                        }
                        // サブオプションの生成と設定
                        if (valueAry.length > 1) {
                            // 値指定あり
                            this.selectCustom(elememtId, valueAry[1]);
                        } else {
                            // 値指定なし
                            this.selectCustom(elememtId, null);
                        }
                    } else {
                        alert("ショートカットファイルの内容に誤りがあるため、読込を中止しました。\n行数:" + (i + 1) + " 内容:" + arr[i]);
                        return;
                    }
                    this.configObj.set(key, value);
                }
                // コンフィグオブジェクトをDBに保存
                this.saveConfig();
                this.switchNofuncKeytable();
                this.updateShortcutMessage();
                alert('ショートカットファイルを正常に読み込みました。');
            }
        }
        // ショートカットの初期化
        document.getElementById('axp_config_button_resetShortcut').onclick = (e) => {
            // 確認ダイアログ表示
            confirmExPromise(`ショートカットを初期状態に戻します。\nよろしいですか？\n（※この処理はアンドゥできません）`)
                .then(() => {
                    // キーコンフィグ要素の初期化
                    for (let i = 0; i < objKeyFunction.length; i++) {
                        const id = `axp_config_custom_key${objKeyFunction[i][1]}`;
                        const key = `CFUNC_${id}`;
                        const value = objKeyFunction[i][2];
                        const selectMain = document.querySelector(`#${id} select:nth-of-type(1)`);
                        selectMain.value = value;
                        this.selectCustom(id);
                        this.configObj.delete(key);
                    }
                    // コンフィグオブジェクトをDBに保存
                    this.saveConfig();
                    this.switchNofuncKeytable();
                    this.updateShortcutMessage();
                    alert('ショートカットを初期化しました。');
                })
                .catch(() => {
                    console.log('NG');
                    // ※Cancel時の処理
                    // 処理なし
                });
        }
        // デバッグ情報表示チェックボックス
        document.getElementById('axp_config_checkbox_useDebugMode').onchange = (e) => {
            this.axpObj.debugLog.isDebugMode = e.target.checked;
        }
    }

    // キーコンフィグ用メソッド --------------------------------------------------------
    // キーコンフィグのDB保存用textを取得する
    getSaveCustomText(id) {
        let result;
        // 要素の取得
        const elem = document.getElementById(id);
        const selectMain = elem.querySelector('select:nth-of-type(1)');
        const inputSizeValue = elem.querySelector('.axpc_config_number_sizeValue');
        const inputScaleValue = elem.querySelector('.axpc_config_number_scaleValue');
        // コンフィグオブジェクトの更新
        switch (selectMain.value) {
            case 'func_loupe':
                // 拡大率
                inputScaleValue.value =
                    adjustInRange(
                        Number(inputScaleValue.value),
                        Number(inputScaleValue.min),
                        Number(inputScaleValue.max)
                    );
                // 機能種別＋選択中の拡大率indexを加えて保存
                result = selectMain.value + ',' + inputScaleValue.value;
                break;
            case 'func_size':
                // ペンの太さ
                // 数値範囲丸め
                inputSizeValue.value =
                    adjustInRange(
                        Number(inputSizeValue.value),
                        Number(inputSizeValue.min),
                        Number(inputSizeValue.max)
                    );
                // 機能種別＋ペンの太さの数字を加えて保存
                result = selectMain.value + ',' + inputSizeValue.value;
                break;
            default:
                // その他
                // 機能種別のみを保存
                result = selectMain.value;
        }
        return result;
    }
    // キーコンフィグが変更されたとき、変更内容に応じたコンフィグ設定のDB保存を行う
    saveCustom(id) {
        this.saveConfig(`CFUNC_${id}`, this.getSaveCustomText(id));
    }
    // 選択（changeイベント、設定復元時に呼び出し）
    // 指定された値(setvalue)を設定する
    // setvalue=null（初期化の場合）、初期値を設定する
    selectCustom(id, setValue = null) {
        // 要素の取得
        const elem = document.getElementById(id);
        const selectMain = elem.querySelector('select:nth-of-type(1)');
        const selectScale = elem.querySelector('.axpc_config_select_scaleTable');
        const inputSizeValue = elem.querySelector('.axpc_config_number_sizeValue');
        const inputScaleValue = elem.querySelector('.axpc_config_number_scaleValue');
        //console.log(id, selectMain.value, setValue);
        // 選択された機能セレクトボックスのオプションに応じて、必要な処理を行う
        switch (selectMain.value) {
            // 拡大率
            case 'func_loupe':
                // 初期値未選択
                selectScale.selectedIndex = -1;
                if (setValue !== null) {
                    inputScaleValue.value = setValue;
                } else {
                    // 初期値100%
                    inputScaleValue.value = 100;
                }
                // 各要素の表示設定
                UTIL.show(selectScale);
                UTIL.hide(inputSizeValue);
                UTIL.show(inputScaleValue);
                break;

            // ペンの太さ
            case 'func_size':
                if (setValue !== null) {
                    inputSizeValue.value = setValue;
                } else {
                    // 初期値1
                    inputSizeValue.value = 1;
                }
                // 各要素の表示設定
                UTIL.hide(selectScale);
                UTIL.show(inputSizeValue);
                UTIL.hide(inputScaleValue);
                break;
            default:
                // 各要素の表示設定
                UTIL.hide(selectScale);
                UTIL.hide(inputSizeValue);
                UTIL.hide(inputScaleValue);
        }

        // カスタムボタンの場合、ボタンの表示オン／オフ切り替え
        if (elem.dataset.linkIndex) {
            // index番目のボタン要素を取得
            const elementButton = document.querySelector(`#axp_custom_div_buttons>button:nth-of-type(${elem.dataset.linkIndex})`);
            if (selectMain.value === 'none') {
                UTIL.hide(elementButton);
            } else {
                UTIL.show(elementButton);
            }
            const found = this.optionlist.find(e => e.value === selectMain.value);
            elementButton.dataset.msg = `カスタムボタン：[ ${found.name} ]`;
        }
    };
    // 機能なしを非表示
    switchNofuncKeytable() {
        const checked = document.getElementById('axp_config_checkbox_shortcutKeyHiddenNofunc').checked;
        const elementTable = document.getElementById('axp_config_table_shortcutKey');
        const elementsTr = elementTable.querySelectorAll('.axpc_config_custom_key');
        for (const tr of elementsTr) {
            const elementSelectbox = tr.querySelector('select');
            if (checked && elementSelectbox.value === 'none') {
                tr.classList.add('axpc_NONE');
            } else {
                tr.classList.remove('axpc_NONE');
            }
        }
    }
    // ガイドメッセージに表示するショートカット表示用データの更新
    updateShortcutMessage() {
        // 機能に対応するショートカットキーのMAPを作成
        mapFunction.clear();
        const elementsTr = document.querySelectorAll('.axpc_config_custom_key');
        for (const tr of elementsTr) {
            const selectMain = tr.querySelector('select:nth-of-type(1)');
            if (!mapFunction.has(selectMain.value)) {
                mapFunction.set(selectMain.value, tr.querySelector('td').textContent);
            }
        }
        // ショートカット表示用データの更新
        const messagesFunction = document.querySelectorAll('.axpc_FUNC');
        for (const item of messagesFunction) {
            if (mapFunction.has(item.dataset.function)) {
                item.dataset.key = mapFunction.get(item.dataset.function);
            } else {
                item.dataset.key = '';
            }
        }
    }
    // 指定した機能IDのショートカットを取得
    getShortcutFunction(func_id) {
        let result = null;
        if (mapFunction.has(func_id)) {
            result = mapFunction.get(func_id);
        }
        return result;
    }
    createKeyConfigHTML(id, keybind) {
        const name = keybind[0];
        const idx = keybind[1];
        const func = keybind[2];

        const tr = document.createElement('tr');
        tr.setAttribute('id', `axp_config_custom_${id}${idx}`);
        // キーボードショートカット用class
        if (id === 'key') {
            tr.setAttribute('class', 'axpc_config_custom_key');
        }

        // キーの名前
        const td_name = document.createElement('td');
        td_name.textContent = `[ ${name} ]`;

        // 機能セレクトボックス
        const td_func = document.createElement('td');

        const selectMain = document.createElement('select');
        selectMain.setAttribute('id', `axp_config_select_main_${id}${idx}`);
        let isGroup = false;
        let optgroup = null;
        // 機能セレクトボックスにoption要素を追加する
        for (const item of this.optionlist) {
            if (item.value === 'optgroup') {
                optgroup = document.createElement('optgroup');
                optgroup.setAttribute('label', item.name);
                isGroup = true;
            } else if (item.value === '/optgroup') {
                selectMain.appendChild(optgroup);
                isGroup = false;
            } else {
                // ペンの太さ調整はカスタムボタンでは使用不可とするため、登録をスキップする
                if (id === 'button' && item.value === 'func_size_change') {
                    continue;
                }
                const option = document.createElement('option');
                option.value = item.value;
                option.textContent = item.name;
                if (isGroup) {
                    optgroup.appendChild(option);
                } else {
                    selectMain.appendChild(option);
                }
            }
        }
        selectMain.value = func;

        // 機能セレクトボックスが変更された時
        selectMain.addEventListener('change', (e) => {
            this.selectCustom(tr.id);
            this.saveCustom(tr.id);
            this.updateShortcutMessage();
        })

        // 描画サイズテキストエリア
        const inputSizeValue = document.createElement('input');
        inputSizeValue.setAttribute('id', `axpc_config_number_sizeValue_${id}${idx}`);
        inputSizeValue.classList.add('axpc_config_number_sizeValue');
        inputSizeValue.setAttribute('type', 'number');
        inputSizeValue.setAttribute('maxlength', '3');
        inputSizeValue.setAttribute('min', '1');
        inputSizeValue.setAttribute('max', '200');
        inputSizeValue.setAttribute('size', '3');
        // 描画サイズテキストエリアが変更された時
        inputSizeValue.addEventListener('change', (e) => {
            this.saveCustom(tr.id);
        })

        // 拡大率テキストエリア
        const inputScaleValue = document.createElement('input');
        inputScaleValue.setAttribute('id', `axpc_config_number_scaleValue_${id}${idx}`);
        inputScaleValue.classList.add('axpc_config_number_scaleValue');
        inputScaleValue.setAttribute('type', 'number');
        inputScaleValue.setAttribute('maxlength', '4');
        inputScaleValue.setAttribute('min', '25');
        inputScaleValue.setAttribute('max', '1600');
        inputScaleValue.setAttribute('size', '4');
        // 拡大率テキストエリアが変更された時
        inputScaleValue.addEventListener('change', (e) => {
            this.saveCustom(tr.id);
        })

        // 拡大率セレクトボックス（この時点では中身のoptionは設定しない）
        const selectScale = document.createElement('select');
        selectScale.setAttribute('id', `axpc_config_select_scaleTable_${id}${idx}`);
        selectScale.classList.add('axpc_config_select_scaleTable');
        // 拡大率セレクトボックスが変更された時
        selectScale.addEventListener('change', (e) => {
            inputScaleValue.value = e.target.value;
            this.saveCustom(tr.id);
        })

        td_func.appendChild(selectMain);
        td_func.appendChild(inputSizeValue);
        td_func.appendChild(inputScaleValue);
        td_func.appendChild(selectScale);

        tr.appendChild(td_name);
        tr.appendChild(td_func);

        return tr;
    }

    // --------------------------------------------------------
    // キャンバスサイズ履歴の追加
    addCanvasSizeHistory(x, y) {
        let history = `${x},${y}`;
        // 既に同一のサイズが履歴に存在する場合、先頭へ移動するために、その履歴を削除
        for (let i = 0; i < this.configCanvasSizeHistory.length; i++) {
            if (this.configCanvasSizeHistory[i] == history) {
                this.configCanvasSizeHistory.splice(i, 1);

            }
        }
        // 配列の先頭に追加
        this.configCanvasSizeHistory.unshift(history);
        // 最大件数を超える場合、末尾１件削除
        if (this.configCanvasSizeHistory.length > this.CONST.CANVAS_SIZE_HISTORY_MAX) {
            this.configCanvasSizeHistory.pop();
        }
        // コンフィグ保存
        this.saveConfig('CHIST', this.configCanvasSizeHistory);
    }
    // キャンバスサイズ履歴の表示更新
    updateCanvasSizeHistory() {
        let element = document.getElementById('axp_config_ul_canvasSizeHistory');
        // 全クリア
        while (element.lastChild) {
            element.onclick = null;
            element.removeChild(element.lastChild);
        }
        // 履歴データからli要素を作成する
        for (const item of this.configCanvasSizeHistory) {
            element.appendChild(this.createHTMLListCanvasSizeHistory(item));
        }
    }
    // 拡大率テーブルの作成（HTML生成）
    createHTMLListCanvasSizeHistory(value) {
        const list = document.createElement('li');
        list.dataset.value = String(value);
        let sizeStrings = value.split(',');
        let x = sizeStrings[0];
        let y = sizeStrings[1];
        list.textContent = `${x} × ${y}`;
        list.onclick = (e) => {
            const elements_li = document.querySelectorAll('#axp_config_ul_canvasSizeHistory>li');
            for (const item of elements_li) {
                item.dataset.selected = '';
            }
            e.target.dataset.selected = 'true';

            const value = list.dataset.value;
            let sizeStrings = value.split(',');
            let x = sizeStrings[0];
            let y = sizeStrings[1];
            // テキストエリアにキャンバスサイズの値を復元
            document.getElementById('axp_config_number_oekakiWidth').value = Number(x);
            document.getElementById('axp_config_number_oekakiHeight').value = Number(y);
        }
        return list;
    }
    // キャンバスぼかし
    set_canvas_antialiasing() {
        if (this.axpObj.config('axp_config_form_antialiasing') === 'on') {
            // ぼかしあり
            this.axpObj.CANVAS.main.style.imageRendering = 'auto';
        } else {
            // ぼかしなし
            this.axpObj.CANVAS.main.style.imageRendering = 'pixelated';
        }
    }
    // 座標表示
    set_display_position() {
        const targetElement = document.getElementById('axp_canvas_div_pointerPosition');
        switch (this.axpObj.config('axp_config_form_displayPosition')) {
            case 'off':
                // 表示しない
                UTIL.hide(targetElement);
                break;
            case 'upperleft':
                // 左上
                UTIL.show(targetElement);
                targetElement.style.right = 'auto';
                targetElement.style.bottom = 'auto';
                break;
            case 'lowerleft':
                // 左下
                UTIL.show(targetElement);
                targetElement.style.right = 'auto';
                targetElement.style.bottom = '0';
                break;
            case 'upperright':
                // 右上
                UTIL.show(targetElement);
                targetElement.style.right = '0';
                targetElement.style.bottom = 'auto';
                break;
            case 'lowerright':
                // 右下
                UTIL.show(targetElement);
                targetElement.style.right = '0';
                targetElement.style.bottom = '0';
                break;
        }
    }
    // 長押しスポイトのスライダ切り替え
    set_longtap_use() {
        if (this.axpObj.config('axp_config_form_useLongtap') === 'on') {
            // 補正の強さレンジスライダー有効
            document.getElementById('axp_config_form_longtapDurationValue').volume.disabled = false;
            document.getElementById('axp_config_form_longtapDurationValue').style.opacity = '1';
            document.getElementById('axp_config_form_longtapStabilizerValue').volume.disabled = false;
            document.getElementById('axp_config_form_longtapStabilizerValue').style.opacity = '1';
        } else {
            // 補正の強さレンジスライダー無効
            document.getElementById('axp_config_form_longtapDurationValue').volume.disabled = true;
            document.getElementById('axp_config_form_longtapDurationValue').style.opacity = '0.3';
            document.getElementById('axp_config_form_longtapStabilizerValue').volume.disabled = true;
            document.getElementById('axp_config_form_longtapStabilizerValue').style.opacity = '0.3';
        }
    }
    // ユーザー設定の保存
    saveConfig(key, value) {
        // key指定ありなら、コンフィグオブジェクトを更新（指定なしだとDBへの書き込みのみ行う）
        if (key !== undefined) {
            console.log('設定保存:', key, value);
            // Map更新
            this.configObj.set(key, value);
        }
        //console.log(this.configObj);
        // DBに保存
        this.axpObj.saveSystem.save_config(this.configObj);
    }
    // ユーザー設定から指定したkeyを削除
    deleteConfig(key) {
        this.configObj.delete(key);
        console.log('設定削除:', key);
        // DBに保存
        this.axpObj.saveSystem.save_config(this.configObj);
    }
    // ユーザー設定の復元
    restoreConfig(map) {
        // 共通処理
        // ラジオボタン設定共通
        const setRadioValue = (id, value) => {
            //console.log('id', id);
            //console.log('value', value);
            let isFound = false;
            const elementsRadio = document.querySelectorAll(`#${id} input[type="radio"]`);
            for (const item of elementsRadio) {
                //console.log(item.value);
                // valueが一致しているコントロールを有効化する
                if (item.value === value) {
                    item.checked = true;
                    isFound = true;
                    break;
                }
            }
            return isFound;
        }
        // 先行処理用ラジオボタン設定共通
        const setRadio = (key) => {
            if (map.has(key)) {
                const value = map.get(key);
                const elememtId = key.substring(6);
                if (setRadioValue(elememtId, value)) {
                    // 後続の処理で二重処理しないためにmapから削除
                    map.delete(key);
                    // コンフィグオブジェクトに格納（有効なデータのみ残して引き継ぐ）
                    this.configObj.set(key, value);
                    //console.log('復元成功:', key, value);
                } else {
                    console.log('無効なconfig:', key, value);
                }
            } else {
                //console.log('存在せず:', key);
            }
        }
        // ペンツールの各種値設定共通
        const setPenValue = (dataType, elememtId, value) => {
            const pObj = this.axpObj.penSystem.penObj;
            let isFound = false;
            if (elememtId in pObj) {
                isFound = true;
                switch (dataType) {
                    // ペンの太さ
                    case 'P-SIZ':
                        pObj[elememtId].size = Number(value);
                        pObj[elememtId].index = range_index(Number(value));
                        break;
                    // ペンの不透明度
                    case 'P-ALP':
                        pObj[elememtId].alpha = Number(value);
                        break;
                    // 塗り残し補正
                    case 'P-THR':
                        pObj[elememtId].threshold = Number(value);
                        break;
                    // ぼかし
                    case 'P-BLU':
                        pObj[elememtId].blurLevel = Number(value);
                        break;
                    // トーン濃度
                    case 'P-TON':
                        pObj[elememtId].toneLevel = Number(value);
                        break;
                    // グラデーション角度
                    case 'P-DEG':
                        pObj[elememtId].gradation = Number(value);
                        break;
                    // 丸み
                    case 'P-RAD':
                        pObj[elememtId].radius = Number(value);
                        pObj[elememtId].borderRadius = Number(value);
                        break;
                }
            }
            return isFound;
        }

        // 先行して復元する必要がある項目
        setRadio('RADIO_axp_config_form_saveLastWindowPosition');
        setRadio('RADIO_axp_config_form_saveLastPenValue');

        // 連想配列から順番に値を取り出す
        map.forEach((value, key) => {
            //console.log('config_data:' + key, value);
            // 読み込んだデータの異常を検知した場合、falseにする
            let isAvailable = true;
            // 条件により読み込んだデータを使用せずスキップする場合、trueにする
            let isSkiped = false;
            // データタイプ
            const dataType = key.substring(0, 5);
            const elememtId = key.substring(6);
            switch (dataType) {
                // レンジスライダー（ペンツールを除く）
                case 'RANGE':
                    if (document.getElementById(elememtId)) {
                        document.getElementById(elememtId).volume.value = value;
                        document.getElementById(elememtId).result.value = value;
                    } else {
                        isAvailable = false;
                    }
                    break;
                // チェックボックス
                case 'CHECK':
                    if (document.getElementById(elememtId)) {
                        document.getElementById(elememtId).checked = value;
                    } else {
                        isAvailable = false;
                    }
                    break;
                // ラジオボタン
                case 'RADIO':
                    if (!setRadioValue(elememtId, value)) {
                        // 設定失敗時
                        isAvailable = false;
                    }
                    break;
                // トグルスイッチ
                case 'TOGSW':
                    if (document.getElementById(elememtId)) {
                        document.getElementById(elememtId).querySelector('input').checked = value;
                    } else {
                        isAvailable = false;
                    }
                    break;
                // テキストボックスなど（valueの単純代入で処理できるもの）
                case 'VALUE':
                    if (document.getElementById(elememtId)) {
                        document.getElementById(elememtId).value = value;
                    } else {
                        isAvailable = false;
                    }
                    break;
                // 補助線カラーコード
                case 'GRIDC':
                    if (document.getElementById(elememtId)) {
                        document.getElementById(elememtId).dataset.colorcode = value;
                        document.getElementById(elememtId).style.backgroundColor = value.substring(0, 7);
                    } else {
                        isAvailable = false;
                    }
                    break;
                // 拡大率テーブル
                case 'SCALE':
                    this.axpObj.currentScaleTable = value;
                    break;
                // キャンバスサイズ履歴
                case 'CHIST':
                    this.configCanvasSizeHistory = value;
                    // 表示更新
                    this.updateCanvasSizeHistory();
                    break;
                // ツールウィンドウ座標
                case 'WDPOS':
                    // 初期化する設定の場合、復元を行わない
                    if (this.axpObj.config('axp_config_form_saveLastWindowPosition') === 'off') {
                        // スキップしたことを記憶
                        isSkiped = true;
                    } else {
                        // 復元処理
                        // データ値を分割
                        const wdpos = value.split(',');
                        // wdpos[0]:left
                        // wdpos[1]:top
                        if (!this.axpObj.dragWindow.setInitPosition(elememtId, wdpos[0], wdpos[1])) {
                            // 座標の設定に失敗（無効なID）した場合、データを無効とする
                            isAvailable = false;
                        }
                    }
                    break
                // ペンツールの各種値
                case 'P-SIZ':
                case 'P-ALP':
                case 'P-THR':
                case 'P-BLU':
                case 'P-TON':
                case 'P-DEG':
                case 'P-RAD':
                    // 初期化する設定の場合、復元を行わない
                    if (this.axpObj.config('axp_config_form_saveLastPenValue') === 'off') {
                        // スキップしたことを記憶
                        isSkiped = true;
                    } else {
                        // 復元処理
                        if (!setPenValue(dataType, elememtId, value)) {
                            isAvailable = false;
                        }
                    }
                    break;
                // 機能割り当て
                case 'CFUNC':
                    if (document.getElementById(elememtId)) {
                        // 親セレクトボックス要素を取得
                        const elemSelectParent = document.querySelector(`#${elememtId} select:nth-of-type(1)`);
                        // valueの値を分解
                        let valueAry = value.split(',');
                        // 親セレクトボックスを、コンフィグ値の機能種別に変更
                        const found = this.optionlist.find(e => e.value === valueAry[0]);
                        if (typeof found === 'undefined') {
                            // 対応機能が廃止などの理由で見つからなかった場合、機能なしを強制設定
                            elemSelectParent.value = 'none';
                        } else {
                            // 対応機能を選択
                            elemSelectParent.value = valueAry[0];
                        }
                        // サブオプションの生成と設定
                        if (valueAry.length > 1) {
                            // 値指定あり
                            this.selectCustom(elememtId, valueAry[1]);
                        } else {
                            // 値指定なし
                            this.selectCustom(elememtId, null);
                        }
                    } else {
                        isAvailable = false;
                    }
                    break;
                // パレット列数
                case 'PLTCO':
                    // ※0:無制限
                    if (typeof value === 'number') {
                        this.axpObj.colorPaletteSystem.currentPalette.column = Number(value);
                    } else {
                        isAvailable = false;
                    }
                    break;
                // カラータグリスト
                case 'COTAG':
                    this.axpObj.layerSystem.resetColorTagList(value);
                    break;
                // その他
                default:
                    isAvailable = false;
            }
            // コンフィグオブジェクトに格納（有効なデータのみ残して引き継ぐ）
            if (isAvailable) {
                if (isSkiped) {
                    //console.log('復元スキップ:', key, value);
                } else {
                    this.configObj.set(key, value);
                    //console.log('復元成功:', key, value);
                }
            } else {
                console.log('無効なconfig:', key, value);
            }
        })
    }
    /**
     * 設定のカラーパレット表示用HTMLを、カラーパレット配列を基に生成する
     * @param {HTMLElement} elementPaletteBox 生成先DOM要素
     * @param {Object} objPalette カラーパレットオブジェクト
     */
    dispPalettebox(elementPaletteBox, objPalette) {
        // パレットボックスの要素の全削除
        while (elementPaletteBox.firstChild) {
            elementPaletteBox.removeChild(elementPaletteBox.firstChild);
        }
        const length = objPalette.palette.length;
        const column = objPalette.column !== 0 ? objPalette.column : length;

        // 列数に応じた幅を設定
        let palette_size = 22;
        elementPaletteBox.style.width = 8 + column * palette_size + 'px';

        // 色数、列数、行数のテキスト表示
        let row = Math.ceil(length / column);
        let text = `${length}色（${column}列×${row}行）`;
        if (objPalette.column === 0) {
            text = text + ' ※常に１行を維持';
        }
        document.getElementById('axp_config_div_paletteText').textContent = text;

        // カラーパレット（単体）のHTML生成
        const createPaletteHTML = (colorcode) => {
            var newDiv = document.createElement('div');
            newDiv.setAttribute('class', 'axpc_config_colorRect');
            newDiv.style.backgroundColor = colorcode;
            return newDiv;
        }
        for (const item of objPalette.palette) {
            // 画面に作成したカラーパレットを追加
            elementPaletteBox.appendChild(createPaletteHTML(item));
        }
    }
    // 拡大率テーブルの作成
    createConfigScaleTable(table) {
        const element = document.getElementById('axp_config_ul_scale');
        // 対象のオプションを全クリア
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        for (let idx = 0; idx < table.length; idx++) {
            const value = table[idx];
            element.appendChild(this.createHTMLListScale(value));
        }
    }
    // 拡大率テーブルの作成（HTML生成）
    createHTMLListScale(value) {
        const list = document.createElement('li');
        list.dataset.value = String(value);
        list.textContent = `${value}%`;
        list.addEventListener('click', (e) => {
            if (e.target.dataset.value === '100') {
                // 拡大率100%は変更できません。
                this.axpObj.msg(`@CAU0104`);
                return;
            }
            const elements_li = document.querySelectorAll('#axp_config_ul_scale>li');
            for (const item of elements_li) {
                item.dataset.selected = '';
            }
            e.target.dataset.selected = 'true';
        })
        return list;
    }
    // 拡大率テーブルの変更をキーカスタマイズのセレクトボックスに反映させる
    updateKeyCustomizationScaleTable(table) {
        const elementsSelectScaleTable = document.querySelectorAll('.axpc_config_select_scaleTable');
        for (const selectbox of elementsSelectScaleTable) {
            // 対象のオプションを全クリア
            while (selectbox.firstChild) {
                selectbox.removeChild(selectbox.firstChild);
            }
            for (const value of table) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = `${value}%`;
                selectbox.appendChild(option);
            }
            // 無指定を選択
            selectbox.selectedIndex = -1;
        }
    }
}
