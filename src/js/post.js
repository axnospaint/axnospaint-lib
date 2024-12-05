// @description 投稿処理

import { UTIL } from './etc.js';
import htmldata from '../html/post.txt';
// css適用
require('../css/post.css');

// 設定機能制御オブジェクト
export class PostSystem {
    axpObj;
    // 投稿メニューのサムネイル表示のサイズ
    CONST = {
        X_POST_MAX: 120,
        Y_POST_MAX: 120,
    }
    CANVAS = {
        post: null,
        post_ctx: null,
        thumbnail: null,
        thumbnail_ctx: null,
    }
    constructor(axpObj) {
        this.axpObj = axpObj;
    }
    // 初期化
    init() {
        // HTML
        let targetElement = document.getElementById('axp_post');
        targetElement.insertAdjacentHTML('afterbegin', this.axpObj.translateHTML(htmldata));
        // CANVAS
        this.CANVAS.post = document.getElementById('axp_post_canvas_postingImage');
        this.CANVAS.post_ctx = this.CANVAS.post.getContext('2d');
        this.CANVAS.thumbnail = document.getElementById('axp_post_canvas_thumbnail');
        this.CANVAS.thumbnail_ctx = this.CANVAS.thumbnail.getContext('2d');
    }
    resetCanvas() {
        // キャンバスサイズの表示
        let x = this.axpObj.x_size;
        let y = this.axpObj.y_size;

        // 投稿キャンバス
        this.CANVAS.post.width = x;
        this.CANVAS.post.height = y;
        this.CANVAS.post_ctx.clearRect(0, 0, x, y);

        let thumbnail_x;
        let thumbnail_y;
        // 投稿キャンバス サムネイル
        if (x > 120 || y > 120) {
            // 縮小率を計算してキャンバスサイズに反映
            const sc = this.CONST.X_POST_MAX / Math.max(x, y);
            thumbnail_x = Math.round(x * sc);
            thumbnail_y = Math.round(y * sc);
        } else {
            thumbnail_x = x;
            thumbnail_y = y;
        }
        this.CANVAS.thumbnail.width = thumbnail_x;
        this.CANVAS.thumbnail.height = thumbnail_y;
        this.CANVAS.thumbnail_ctx.clearRect(0, 0, thumbnail_x, thumbnail_y);

        // キャンバスサイズの表示
        document.getElementById('axp_post_span_imageSize').textContent = `${this.axpObj._('@COMMON.WIDTH')}:${x} ${this.axpObj._('@COMMON.HEIGHT')}:${y}`;
    }
    startEvent() {
        // 投稿フォームのカスタマイズ
        // 投稿フォーム
        if (!this.axpObj.postForm.input.isDisplay) {
            UTIL.hide('axp_post_div_input');
            // 入力必須の無効化
            this.axpObj.postForm.input.strName.isInputRequired = false;
            this.axpObj.postForm.input.strTitle.isInputRequired = false;
            this.axpObj.postForm.input.strMessage.isInputRequired = false;
        } else {
            // 投稿者名
            if (!this.axpObj.postForm.input.strName.isDisplay) {
                UTIL.hide(document.querySelector('.axpc_post_name_property'));
                UTIL.hide('axp_post_text_name');
                this.axpObj.postForm.input.strName.isInputRequired = false;
            } else {
                // 最大文字数設定
                document.getElementById('axp_post_text_name').maxLength = this.axpObj.postForm.input.strName.maxLength;
                // プレースホルダー設定
                document.getElementById('axp_post_text_name').placeholder = this.axpObj.postForm.input.strName.placeholder;
                // 必須の文字表示
                if (this.axpObj.postForm.input.strName.isInputRequired) {
                    UTIL.show(document.querySelector('.axpc_post_name_required'));
                }
            }
            // タイトル
            if (!this.axpObj.postForm.input.strTitle.isDisplay) {
                UTIL.hide(document.querySelector('.axpc_post_title_property'));
                UTIL.hide('axp_post_text_title');
                this.axpObj.postForm.input.strTitle.isInputRequired = false;
            } else {
                // 最大文字数設定
                document.getElementById('axp_post_text_title').maxLength = this.axpObj.postForm.input.strTitle.maxLength;
                // プレースホルダー設定
                document.getElementById('axp_post_text_title').placeholder = this.axpObj.postForm.input.strTitle.placeholder;
                // 必須の文字表示
                if (this.axpObj.postForm.input.strTitle.isInputRequired) {
                    UTIL.show(document.querySelector('.axpc_post_title_required'));
                }
            }
            // 本文
            if (!this.axpObj.postForm.input.strMessage.isDisplay) {
                UTIL.hide(document.querySelector('.axpc_post_message_property'));
                UTIL.hide('axp_post_textarea_message');
                this.axpObj.postForm.input.strMessage.isInputRequired = false;
            } else {
                // 最大文字数設定
                document.getElementById('axp_post_textarea_message').maxLength = this.axpObj.postForm.input.strMessage.maxLength;
                // プレースホルダー設定
                document.getElementById('axp_post_textarea_message').placeholder = this.axpObj.postForm.input.strMessage.placeholder;
                // 必須の文字表示
                if (this.axpObj.postForm.input.strMessage.isInputRequired) {
                    UTIL.show(document.querySelector('.axpc_post_message_required'));
                }
            }
            // ウォッチリスト登録
            if (!this.axpObj.postForm.input.strWatchList.isDisplay) {
                UTIL.hide(document.querySelector('.axpc_post_watchList'));
            }
        }
        // 注意事項
        if (!this.axpObj.postForm.notice.isDisplay) {
            UTIL.hide('axp_post_div_notice');
        }

        // 透過
        let input_transparent = document.querySelectorAll("input[name=axp_post_radio_bg]");
        for (let element of input_transparent) {
            element.onchange = () => {
                this.axpObj.assistToolSystem.transparent();
                this.axpObj.drawPostCanvas();
            }
        }
        document.getElementById('axp_post_text_title').oninput = (e) => {
            let text = e.target.value;
            document.getElementById('axp_post_div_thumbnailTitle').textContent = text;
        }

        document.getElementById('axp_post_text_title').oninput = (e) => {
            let text = e.target.value;
            document.getElementById('axp_post_div_thumbnailTitle').textContent = text;
        }
        // ボタン：お絵カキコする！
        document.getElementById("axp_post_button_upload").onclick = (e) => {

            // 入力必須項目のチェック（起動オプションで必須項目に指定されている場合、一文字以上入力されていなければ処理を中断してメッセージを表示する）
            // 投稿者名
            if (this.axpObj.postForm.input.strName.isInputRequired) {
                if (document.getElementById('axp_post_text_name').value.trim().length < 1) {
                    document.getElementById('axp_post_span_message').textContent = `${this.axpObj._('@POST.INFO_REQUIRED')} ( ${this.axpObj._('@POST.NAME')} )`;
                    return;
                }
            }
            // タイトル
            if (this.axpObj.postForm.input.strTitle.isInputRequired) {
                if (document.getElementById('axp_post_text_title').value.trim().length < 1) {
                    document.getElementById('axp_post_span_message').textContent = `${this.axpObj._('@POST.INFO_REQUIRED')} ( ${this.axpObj._('@POST.TITLE')} )`;
                    return;
                }
            }
            // 本文
            if (this.axpObj.postForm.input.strMessage.isInputRequired) {
                if (document.getElementById('axp_post_textarea_message').value.trim().length < 1) {
                    document.getElementById('axp_post_span_message').textContent = `${this.axpObj._('@POST.INFO_REQUIRED')} ( ${this.axpObj._('@POST.MESSAGE')} )`;
                    return;
                }
            }

            // ボタン表示変更（投稿中）
            UTIL.hide('axp_post_button_upload_label');
            UTIL.show('axp_post_button_upload_loading');
            document.getElementById("axp_post_button_upload").disabled = true;

            // 長さのチェックはユーザー側が任意で行う仕様とする（AXNOS Paint側では行わない）
            // 画像のURLエンコーディング
            let strEncodeImg = this.CANVAS.post.toDataURL('image/png');

            // 送信用にヘッダ部分を削除
            strEncodeImg = strEncodeImg.replace('data:image/png;base64,', '');

            // 送信データオブジェクト
            let objPostData = {
                strName: document.getElementById('axp_post_text_name').value.trim(),
                strTitle: document.getElementById('axp_post_text_title').value.trim(),
                strMessage: document.getElementById('axp_post_textarea_message').value.trim(),
                strWatchList: (document.getElementById('axp_post_checkbox_watchList').checked) ? 't' : '',
                oekaki_id: this.axpObj.oekaki_id,
                draftImageFile: this.axpObj.draftImageFile,
                strEncodeImg: strEncodeImg,
            };

            (async () => {
                let result;
                try {
                    // 外部で定義された投稿用スクリプトを呼び出す
                    result = await this.axpObj.FUNCTION.post(objPostData);
                    if (result) {
                        console.log('お絵カキコ投稿情報送信');
                    }
                } catch (error) {
                    console.log('error:', error);
                } finally {
                    // ボタン表示変更（初期化）
                    UTIL.show('axp_post_button_upload_label');
                    UTIL.hide('axp_post_button_upload_loading');
                    document.getElementById("axp_post_button_upload").disabled = false;
                }
            })();
        }

        // ボタンラベル初期設定
        document.getElementById('axp_post_button_upload_label').textContent = this.axpObj._('@POST.BUTTON_SUBMIT');
    }
}