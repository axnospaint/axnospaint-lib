// @description ツールウィンドウ：親クラス＞カスタムボタン

import { ToolWindow } from './window.js';
import htmldata from '../html/window_custom.txt';
// css適用
require('../css/window_custom.css');

// カスタムボタンクラス
export class CustomButtonSystem extends ToolWindow {
    constructor(axpObj) {
        super(axpObj);
    }
    // 初期ウィンドウ位置
    getDefaultPosition() {
        return {
            left: 200,
            top: 10,
        }
    }
    // 初期化（＆キャンバスリセット時の再初期化）
    init() {
        // HTML
        this.createHTML(
            'axp_custom',
            'CSM',
            'ｶｽﾀﾑ',
            null,
            htmldata,
            false
        );
        this.window_width = 40;
        // 初期座標設定
        const pos = this.getDefaultPosition();
        this.window_left = pos.left;
        this.window_top = pos.top;
    }
    //　イベント受付開始
    startEvent() {
        const buttons = document.querySelectorAll('#axp_custom button');
        for (const item of buttons) {
            item.addEventListener('click', (e) => {
                this.axpObj.callTask(`axp_config_custom_button${item.dataset.index}`, null);
            });
        }
    }
}
