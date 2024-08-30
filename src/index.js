/*!
 * AXNOS Paint version 2.2.0
 * (c) 2022「悪の巣」部屋番号13番：「趣味の悪い大衆酒場[Mad end dance hall]」
 * Licensed under MPL 2.0
 */
"use strict";

import { AXPObj } from './js/axpobj.js';
import { createCustomAlert } from './js/alert.js';
import { getBrowserType, inRange } from './js/etc.js';
// htmlデータ
import htmldata from './html/main.txt';

// css適用
require('./css/axnospaint.css');
require('./css/common.css');
require('./css/icon.css');
require('./css/window.css');
require('./css/saveload.css');
require('./css/input_range.css');
require('./css/input_radio.css');
require('./css/input_checkbox.css');
require('./css/input_number.css');
require('./css/input_button.css');
require('./css/input_toggle.css');
require('./css/alert.css');

export default class {
    axpObj;
    constructor(option) {
        console.log('version:', PACKAGE_VERSION);
        console.log('build:', PACKAGE_DATE);
        this.axpObj = new AXPObj();

        // 起動オプションチェック
        if (typeof option.bodyId === 'undefined') {
            alert('ERROR:起動オプションbodyIdが指定されていません');
            return;
        }
        this.axpObj.paintBodyElement = document.getElementById(option.bodyId);
        if (this.axpObj.paintBodyElement === null) {
            alert('ERROR:起動オプションbodyIdの指定が正しくありません');
            return;
        }
        // スタイル設定
        this.axpObj.paintBodyElement.style.display = 'flex';
        this.axpObj.paintBodyElement.style.flexGrow = '1';
        this.axpObj.paintBodyElement.style.flexDirection = 'column';
        this.axpObj.paintBodyElement.style.overflow = 'hidden';

        // 投稿用プログラムの定義
        this.axpObj.FUNCTION.post = option.post || null;
        // 同一掲示板チェックの有効化
        this.axpObj.checkSameBBS = option.checkSameBBS || false;
        // お絵カキコデータ（基にしてお絵カキコする用）が存在するURL
        this.axpObj.oekakiURL = option.oekakiURL || null;
        // 下書き機能画像ファイル名
        this.axpObj.draftImageFile = option.draftImageFile || null;
        // お絵カキコデータ読込タイムアウト時間
        this.axpObj.oekakiTimeout = isNaN(option.oekakiTimeout) ? 15000 : option.oekakiTimeout;

        // 許容するキャンバスサイズ
        // 　起動オプション指定がある場合、コンストラクタで設定済みのデフォルト値を上書き
        if (typeof option.minWidth === 'number') {
            if (inRange(option.minWidth, this.axpObj.CONST.MIN_SYSTEM_WIDTH, this.axpObj.CONST.MAX_SYSTEM_WIDTH)) {
                this.axpObj.minWidth = option.minWidth;
            } else {
                alert(`ERROR:\n起動オプションminWidthの指定が正しくありません。\n有効範囲は${this.axpObj.CONST.MIN_SYSTEM_WIDTH}～${this.axpObj.CONST.MAX_SYSTEM_WIDTH}です。`);
                return;
            }
        }
        if (typeof option.minHeight === 'number') {
            if (inRange(option.minHeight, this.axpObj.CONST.MIN_SYSTEM_HEIGHT, this.axpObj.CONST.MAX_SYSTEM_HEIGHT)) {
                this.axpObj.minHeight = option.minHeight;
            } else {
                alert(`ERROR:\n起動オプションminHeightの指定が正しくありません。\n有効範囲は${this.axpObj.CONST.MIN_SYSTEM_HEIGHT}～${this.axpObj.CONST.MAX_SYSTEM_HEIGHT}です。`);
                return;
            }
        }
        if (typeof option.maxWidth === 'number') {
            if (inRange(option.maxWidth, this.axpObj.CONST.MIN_SYSTEM_WIDTH, this.axpObj.CONST.MAX_SYSTEM_WIDTH)) {
                this.axpObj.maxWidth = option.maxWidth;
            } else {
                alert(`ERROR:\n起動オプションmaxWidthの指定が正しくありません。\n有効範囲は${this.axpObj.CONST.MIN_SYSTEM_WIDTH}～${this.axpObj.CONST.MAX_SYSTEM_WIDTH}です。`);
                return;
            }
        }
        if (typeof option.maxHeight === 'number') {
            if (inRange(option.maxHeight, this.axpObj.CONST.MIN_SYSTEM_HEIGHT, this.axpObj.CONST.MAX_SYSTEM_HEIGHT)) {
                this.axpObj.maxHeight = option.maxHeight;
            } else {
                alert(`ERROR:\n起動オプションmaxHeightの指定が正しくありません。\n有効範囲は${this.axpObj.CONST.MIN_SYSTEM_HEIGHT}～${this.axpObj.CONST.MAX_SYSTEM_HEIGHT}です。`);
                return;
            }
        }
        // 　論理チェック
        console.log(
            this.axpObj.minWidth,
            this.axpObj.minHeight,
            this.axpObj.maxWidth,
            this.axpObj.maxHeight
        );
        if (this.axpObj.minWidth > this.axpObj.maxWidth || this.axpObj.minHeight > this.axpObj.maxHeight) {
            alert(`ERROR:\n起動オプションminWidth,minHeight,maxWidth,maxHeightの指定の組み合わせが正しくありません。`);
            return;
        }

        // お絵カキコサイズ
        this.axpObj.option_height = option.height || null;
        this.axpObj.option_width = option.width || null;

        // 投稿制限
        this.axpObj.restrictPost = option.restrictPost || false;

        // 拡張機能タブ
        this.axpObj.expansionTab = option.expansionTab || null;

        // htmlを生成
        this.axpObj.paintBodyElement.insertAdjacentHTML('afterbegin', htmldata);

        let targetElements_tab = document.querySelectorAll('#axp_main_div_tab > div > div');
        // 投稿制限ありなら投稿タブは非表示
        if (this.axpObj.restrictPost) {
            targetElements_tab[2].style.display = 'none';
        }

        // 拡張機能タブ生成
        if (this.axpObj.expansionTab !== null) {
            // タブの名前
            if (this.axpObj.expansionTab.name) {
                if (this.axpObj.expansionTab.link) {
                    // リンク生成
                    const anchor = document.createElement('a');
                    anchor.setAttribute('href', this.axpObj.expansionTab.link);
                    anchor.setAttribute('target', '_blank');
                    anchor.setAttribute('rel', 'noopener');
                    anchor.setAttribute('style', 'text-decoration: none;color:#fff');
                    const div = document.createElement('div');
                    div.textContent = this.axpObj.expansionTab.name;
                    anchor.appendChild(div);
                    targetElements_tab[3].appendChild(anchor);
                } else {
                    // 関数呼び出し
                    targetElements_tab[3].textContent = this.axpObj.expansionTab.name;
                }

            }
            // タブのヘルプ
            if (this.axpObj.expansionTab.msg) {
                targetElements_tab[3].dataset.msg = this.axpObj.expansionTab.msg;
            }
        } else {
            // 定義がない場合、拡張機能タブを非表示
            targetElements_tab[3].style.display = 'none';
        }

        // タブ横のテキスト表示エリア
        // 文字列か判定
        const isString = (value) => {
            if (typeof value === "string" || value instanceof String) {
                return true;
            } else {
                return false;
            }
        }
        let text;
        if (isString(option.headerText)) {
            // 最大1024文字まで）
            if (option.headerText.length > 1024) {
                text = option.headerText.slice(0, 1024);
            } else {
                text = option.headerText;
            }
        } else {
            text = '';
        }
        document.getElementById('axp_main_div_headerText').textContent = text;

        // 標準アラートのオーバーライド
        if (document.getElementById) {
            window.alert = function (txt) {
                createCustomAlert(txt);
            }
        }
        // ブラウザ
        this.axpObj.browser = getBrowserType();
        console.log('Browser:', this.axpObj.browser);
        if (this.axpObj.browser === 'Safari') {
            // safariの場合、キャンバス描画時の不具合回避用の処理を行う必要があるため、フラグを立てておく
            this.axpObj.ENV.multiCanvas = true;
        }
        // 本体起動
        this.axpObj.exec();
        // ロード中マスクの解除
        document.getElementById('axp_main').style.display = 'flex';

    }
    // バージョン
    version() {
        return `${this.axpObj.CONST.APP_TITLE} version ${PACKAGE_VERSION} (${PACKAGE_DATE})`;
    }
    // 画面の表示／非表示
    on() {
        this.axpObj.paintBodyElement.style.display = 'flex';
        this.axpObj.isClose = false;
    }
    off() {
        this.axpObj.paintBodyElement.style.display = 'none';
        this.axpObj.isClose = true;
    }
    static ver() {
        return `version ${PACKAGE_VERSION} (${PACKAGE_DATE})`;
    }
}

