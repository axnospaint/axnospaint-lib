// @description 投稿処理

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
        targetElement.insertAdjacentHTML('afterbegin', htmldata);
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
        document.getElementById('axp_post_span_imageSize').textContent = `横:${x} 縦:${y}`;
    }
    startEvent() {
        document.getElementById('axp_post_text_title').oninput = (e) => {
            let text = e.target.value;
            document.getElementById('axp_post_div_thumbnailTitle').textContent = text;
        }
        // ボタン：お絵カキコする！
        document.getElementById("axp_post_button_upload").onclick = (e) => {

            // 本文が一文字以上入力されていなければ処理を中断してメッセージを表示する
            let message = document.getElementById('axp_post_textarea_message').value.trim();
            if (message.length < 1) {
                document.getElementById('axp_post_span_message').textContent = '※本文を入力してください';
                return;
            }

            // ボタン表示変更（投稿中）
            document.getElementById("axp_post_button_upload").textContent = '投稿中です………';
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
                strMessage: message,
                strWatchList: (document.getElementById('axp_post_checkbox_watchList').checked) ? 't' : '',
                oekaki_id: this.axpObj.oekaki_id,
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
                    document.getElementById("axp_post_button_upload").textContent = document.getElementById("axp_post_button_upload").dataset.buttontext;
                    document.getElementById("axp_post_button_upload").disabled = false;
                }
            })();
        }
    }
}