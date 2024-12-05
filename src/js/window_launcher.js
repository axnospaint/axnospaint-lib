// @description ツールウィンドウ：親クラス＞ランチャー

import { ToolWindow } from './window.js';
import htmldata from '../html/window_launcher.txt';
import { UTIL } from './etc.js';
// css適用
require('../css/window_launcher.css');

// ランチャークラス
export class Launcher extends ToolWindow {
    constructor(axpObj) {
        super(axpObj);
    }
    minimizeWindowStack = [];
    // 初期ウィンドウ位置
    getDefaultPosition() {
        return {
            left: 0,
            top: 0,
        }
    }
    // 初期化（＆キャンバスリセット時の再初期化）
    init() {
        // HTML
        this.createHTML(
            'axp_launcher',
            'LAU',
            this.axpObj._('@WINDOW.LAUNCHER'),
            null,
            htmldata,
            false
        );
        this.window_width = 54;
        // 初期座標設定
        const pos = this.getDefaultPosition();
        this.window_left = pos.left;
        this.window_top = pos.top;
    }
    //　イベント受付開始
    startEvent() {
        // 個別のウィンドウボタン
        const personalButtons = document.querySelectorAll('.axpc_launcher_personalButton');
        for (const item of personalButtons) {
            // クリック時、ウィンドウ開閉
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('axpc_launcher_minimize')) {
                    // オープン
                    e.target.classList.remove('axpc_launcher_minimize');
                    this.axpObj.dragWindow.unminimize(e.target.dataset.id);
                    // 状態リセット
                    this.axpObj.configSystem.deleteConfig('WDMIN_' + e.target.dataset.id);
                    // 単一ウィンドウモードなら、他のウィンドウを最小化
                    if (document.getElementById('axp_config_checkbox_singleWindowMode').checked) {
                        for (const buttons of personalButtons) {
                            if (buttons.dataset.id !== item.dataset.id) {
                                if (!buttons.classList.contains('axpc_launcher_minimize')) {
                                    buttons.classList.add('axpc_launcher_minimize');
                                    this.axpObj.dragWindow.minimize(buttons.dataset.id);
                                    this.axpObj.configSystem.saveConfig('WDMIN_' + buttons.dataset.id, true);
                                }
                            }
                        }
                    }
                } else {
                    // 最小化
                    e.target.classList.add('axpc_launcher_minimize');
                    this.axpObj.dragWindow.minimize(e.target.dataset.id);
                    this.axpObj.configSystem.saveConfig('WDMIN_' + e.target.dataset.id, true);
                }
            });
        }
        // 全体ウィンドウボタン
        const allButton = document.querySelector('.axpc_launcher_allButton');
        allButton.addEventListener('click', (e) => {
            if (e.target.classList.contains('axpc_launcher_minimize')) {
                // ボタン変化
                e.target.classList.remove('axpc_launcher_minimize');
                e.target.querySelector('div').classList.remove('axpc_icon_window_all_up');
                UTIL.show('axp_launcher_div_personalButtons');
                // 全体表示化
                this.axpObj.dragWindow.allVisible();
                // 状態リセット
                this.axpObj.configSystem.deleteConfig('WDMIN_' + allButton.dataset.id);
            } else {
                // ボタン変化
                e.target.classList.add('axpc_launcher_minimize');
                e.target.querySelector('div').classList.add('axpc_icon_window_all_up');
                UTIL.hide('axp_launcher_div_personalButtons');
                // 全体非表示化
                this.axpObj.dragWindow.allHidden();
                // 状態保存
                this.axpObj.configSystem.saveConfig('WDMIN_' + allButton.dataset.id, true);
            }
        });
        // ボタンサイズ
        this.setButtonSize(this.axpObj.config('axp_config_form_minimizeButtonType'));
    }
    // ツールウィンドウのIDに対応するボタンを最小化状態にする
    minimizeButton(id) {
        const buttons = document.querySelectorAll('.axpc_launcher_personalButton,.axpc_launcher_allButton');
        for (const item of buttons) {
            if (item.dataset.id === id) {
                item.classList.add('axpc_launcher_minimize');
                // 一括ボタンの場合はアイコン変化
                if (id === 'axp_all') {
                    item.querySelector('div').classList.add('axpc_icon_window_all_up');
                    UTIL.hide('axp_launcher_div_personalButtons');
                }
            }
        }
    }
    // ツールウィンドウのIDに対応するボタンをオープン状態にする
    unminimizeButton(id) {
        const buttons = document.querySelectorAll('.axpc_launcher_personalButton');
        for (const item of buttons) {
            if (item.dataset.id === id) {
                item.classList.remove('axpc_launcher_minimize');
            }
        }
    }
    // ボタンサイズの変更
    setButtonSize(value) {
        const buttons = document.querySelectorAll('.axpc_launcher_personalButton,.axpc_launcher_allButton');
        for (const item of buttons) {
            item.classList.remove('axpc_launcher_sizeSmall');
            item.classList.remove('axpc_launcher_sizeBig');
            switch (value) {
                case 'small':
                    item.classList.add('axpc_launcher_sizeSmall');
                    break;
                case 'big':
                    item.classList.add('axpc_launcher_sizeBig');
                    break;
            }
        }
    }
    // 単一ウィンドウモード
    setSingleWindowMode(value, isRestore = false) {
        const button = document.querySelector('.axpc_launcher_allButton');
        // 全体非表示ボタンの強制リセット
        if (button.classList.contains('axpc_launcher_minimize')) {
            // ボタン変化
            button.classList.remove('axpc_launcher_minimize');
            button.querySelector('div').classList.remove('axpc_icon_window_all_up');
            UTIL.show('axp_launcher_div_personalButtons');
            // 全体表示化
            this.axpObj.dragWindow.allVisible();
            // 状態リセット
            this.axpObj.configSystem.deleteConfig('WDMIN_' + button.dataset.id);
        }
        if (value) {
            UTIL.hide(button);
            UTIL.hide('axp_launcher_separator');
            if (isRestore) {
                // 復元時は最小化スキップ
            } else {
                // 個別ウィンドウをすべて最小化
                const personalButtons = document.querySelectorAll('.axpc_launcher_personalButton');
                for (const item of personalButtons) {
                    if (!item.classList.contains('axpc_launcher_minimize')) {
                        item.classList.add('axpc_launcher_minimize');
                        this.axpObj.dragWindow.minimize(item.dataset.id);
                        this.axpObj.configSystem.saveConfig('WDMIN_' + item.dataset.id, true);
                    }
                }
            }
        } else {
            UTIL.show(button);
            UTIL.show('axp_launcher_separator');
            // 個別ウィンドウをすべて最小化解除
            const personalButtons = document.querySelectorAll('.axpc_launcher_personalButton');
            for (const item of personalButtons) {
                if (item.classList.contains('axpc_launcher_minimize')) {
                    item.classList.remove('axpc_launcher_minimize');
                    this.axpObj.dragWindow.unminimize(item.dataset.id);
                    this.axpObj.configSystem.deleteConfig('WDMIN_' + item.dataset.id);
                }
            }
        }
    }
}
