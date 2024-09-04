/*
 * AXNOS Paint
 * (c) 2022「悪の巣」部屋番号13番：「趣味の悪い大衆酒場[Mad end dance hall]」
 * Licensed under MPL 2.0
 */
"use strict";

import { AXPObj } from './js/axpobj.js';
import { getDictionaryJSON } from './js/lang.js';
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
        (async () => {
            // 追加辞書オプションチェック
            let additionalDictionaryJSON = null;
            if (typeof option.dictionary !== 'undefined') {
                // 辞書オプションにnull以外の値が指定されている場合、そのファイルのfetchを試みる。
                if (option.dictionary !== null) {
                    let result = await getDictionaryJSON(option.dictionary);
                    if (result === 'NOT_FOUND') {
                        alert(`ERROR:起動オプションdictionaryで指定されたファイル\n[ ${option.dictionary} ] が見つかりません。\n通常辞書で起動します。`);
                    } else if (result === 'SYNTAX_ERROR') {
                        alert(`ERROR:起動オプションdictionaryで指定されたファイル\n[ ${option.dictionary} ] に問題があります。\n通常辞書で起動します。`);
                    } else {
                        additionalDictionaryJSON = result;
                    }
                }
            }

            // ツール基幹インスタンス作成
            this.axpObj = new AXPObj(additionalDictionaryJSON);

            // 使用辞書情報表示
            console.log('Dictionary:', this.axpObj._('@LANGUAGE'));

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

            // 下書き機能使用時のキャンバスサイズ変更制限
            this.axpObj.restrictDraftCanvasResizing = option.restrictDraftCanvasResizing || false;

            // 投稿制限
            this.axpObj.restrictPost = option.restrictPost || false;

            // 拡張機能タブ
            this.axpObj.expansionTab = option.expansionTab || null;

            // 投稿フォームカスタマイズ
            let isErrorDetected = false;
            let errorMessage = null;
            // 判定関数
            const isBoolean = (value) => typeof value === 'boolean';
            const isRangeLength = (value) => typeof value === 'number' && inRange(value, 1, 1024);
            const checkOptionValue = (value, condition, message) => {
                // 正しい値が指定されているか判定
                if (condition(value)) {
                    return true;
                } else {
                    isErrorDetected = true;
                    errorMessage = `ERROR:\n起動オプションの指定が正しくありません。\nキー: ${message}\n値: ${value}`;
                    return false;
                }
            }
            if (typeof option.postForm !== 'undefined') {
                // 投稿フォーム
                if ('input' in option.postForm && !isErrorDetected) {
                    if ('isDisplay' in option.postForm.input && !isErrorDetected) {
                        if (checkOptionValue(
                            option.postForm.input.isDisplay,
                            isBoolean,
                            'postForm.input.isDisplay')) {
                            this.axpObj.postForm.input.isDisplay = option.postForm.input.isDisplay;
                        }
                    }
                    // 投稿者名
                    if ('strName' in option.postForm.input && !isErrorDetected) {
                        if ('isDisplay' in option.postForm.input.strName && !isErrorDetected) {
                            if (checkOptionValue(
                                option.postForm.input.strName.isDisplay,
                                isBoolean,
                                'postForm.input.strName.isDisplay')) {
                                this.axpObj.postForm.input.strName.isDisplay = option.postForm.input.strName.isDisplay;
                            }
                        }
                        if ('isInputRequired' in option.postForm.input.strName && !isErrorDetected) {
                            if (checkOptionValue(
                                option.postForm.input.strName.isInputRequired,
                                isBoolean,
                                'postForm.input.strName.isInputRequired')) {
                                this.axpObj.postForm.input.strName.isInputRequired = option.postForm.input.strName.isInputRequired;
                            }
                        }
                        if ('maxLength' in option.postForm.input.strName && !isErrorDetected) {
                            if (checkOptionValue(
                                option.postForm.input.strName.maxLength,
                                isRangeLength,
                                'postForm.input.strName.maxLength')) {
                                this.axpObj.postForm.input.strName.maxLength = option.postForm.input.strName.maxLength;
                            }
                        }
                    }
                    // タイトル
                    if ('strTitle' in option.postForm.input && !isErrorDetected) {
                        if ('isDisplay' in option.postForm.input.strTitle && !isErrorDetected) {
                            if (checkOptionValue(
                                option.postForm.input.strTitle.isDisplay,
                                isBoolean,
                                'postForm.input.strTitle.isDisplay')) {
                                this.axpObj.postForm.input.strTitle.isDisplay = option.postForm.input.strTitle.isDisplay;
                            }
                        }
                        if ('isInputRequired' in option.postForm.input.strTitle && !isErrorDetected) {
                            if (checkOptionValue(
                                option.postForm.input.strTitle.isInputRequired,
                                isBoolean,
                                'postForm.input.strTitle.input.isInputRequired')) {
                                this.axpObj.postForm.input.strTitle.isInputRequired = option.postForm.input.strTitle.isInputRequired;
                            }
                        }
                        if ('maxLength' in option.postForm.input.strTitle && !isErrorDetected) {
                            if (checkOptionValue(
                                option.postForm.input.strTitle.maxLength,
                                isRangeLength,
                                'postForm.input.strTitle.maxLength')) {
                                this.axpObj.postForm.input.strTitle.maxLength = option.postForm.input.strTitle.maxLength;
                            }
                        }
                    }
                    // 本文
                    if ('strMessage' in option.postForm.input && !isErrorDetected) {
                        if ('isDisplay' in option.postForm.input.strMessage && !isErrorDetected) {
                            if (checkOptionValue(
                                option.postForm.input.strMessage.isDisplay,
                                isBoolean,
                                'postForm.input.strMessage.isDisplay')) {
                                this.axpObj.postForm.input.strMessage.isDisplay = option.postForm.input.strMessage.isDisplay;
                            }
                        }
                        if ('isInputRequired' in option.postForm.input.strMessage && !isErrorDetected) {
                            if (checkOptionValue(
                                option.postForm.input.strMessage.isInputRequired,
                                isBoolean,
                                'postForm.input.strMessage.isInputRequired')) {
                                this.axpObj.postForm.input.strMessage.isInputRequired = option.postForm.input.strMessage.isInputRequired;
                            }
                        }
                        if ('maxLength' in option.postForm.input.strMessage && !isErrorDetected) {
                            if (checkOptionValue(
                                option.postForm.input.strMessage.maxLength,
                                isRangeLength,
                                'postForm.input.strMessage.maxLength')) {
                                this.axpObj.postForm.input.strMessage.maxLength = option.postForm.input.strMessage.maxLength;
                            }
                        }
                    }
                    // ウォッチリスト登録
                    if ('strWatchList' in option.postForm.input && !isErrorDetected) {
                        if ('isDisplay' in option.postForm.input.strWatchList && !isErrorDetected) {
                            if (checkOptionValue(
                                option.postForm.input.strWatchList.isDisplay,
                                isBoolean,
                                'postForm.input.strWatchList.isDisplay')) {
                                this.axpObj.postForm.input.strWatchList.isDisplay = option.postForm.input.strWatchList.isDisplay;
                            }
                        }
                    }
                }
                // 注意事項
                if ('notice' in option.postForm && !isErrorDetected) {
                    if ('isDisplay' in option.postForm.notice && !isErrorDetected) {
                        if (checkOptionValue(
                            option.postForm.notice.isDisplay,
                            isBoolean,
                            'postForm.notice.isDisplay')) {
                            this.axpObj.postForm.notice.isDisplay = option.postForm.notice.isDisplay;
                        }
                    }
                }
            }
            // 起動オプションに誤りがある場合はエラーメッセージを表示して強制終了
            if (isErrorDetected) {
                alert(errorMessage);
                return;
            }

            // htmlを生成
            this.axpObj.paintBodyElement.insertAdjacentHTML('afterbegin', this.axpObj.translateHTML(htmldata));

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
        })();
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

