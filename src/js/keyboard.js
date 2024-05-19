// @description キーボード入力処理

import { range_value } from './pendefine/rangeindex.js';

export class KeyboardSystem {
    axpObj;
    constructor(axpObj) {
        this.axpObj = axpObj;
    }
    // 初期化
    init() {
    }
    startEvent() {
        // ウィンドウ非アクティブの時、強制的に押しているキーを解除
        window.addEventListener('blur', (e) => {
            if (this.axpObj.isSPACE) {
                this.axpObj.penSystem.restorePenModeTemporary('axp_penmode_hand');
                this.axpObj.isSPACE = false;
            }
            if (this.axpObj.isCTRL) {
                this.axpObj.penSystem.restorePenModeTemporary('axp_penmode_spuit');
                this.axpObj.isCTRL = false;
            }
            if (this.axpObj.isSHIFT) {
                this.axpObj.isSHIFT = false;
            }
        });

        // キーが離された時
        window.addEventListener('keyup', (e) => {
            // e.keyが有効の場合のみ処理する（オートコンプリートによるイベントを無視）
            if (!e.key) return;

            let inkey = e.key.toUpperCase();
            switch (inkey) {
                case ' ':
                    this.axpObj.penSystem.restorePenModeTemporary('axp_penmode_hand');
                    this.axpObj.isSPACE = false;
                    break;
                case 'CONTROL':
                    this.axpObj.penSystem.restorePenModeTemporary('axp_penmode_spuit');
                    this.axpObj.isCTRL = false;
                    break;
                case 'SHIFT':
                    this.axpObj.isSHIFT = false;
                    break;
                case 'Q':
                    this.axpObj.penSystem.modeChangeSizeOff();
                    break;
            }
        });
        // キーが押された時（キーボードショートカット）
        window.addEventListener('keydown', (e) => {

            // 非表示時は無効
            if (this.axpObj.isClose) { return };

            // キャンバスタブ以外の画面（設定、投稿）は無効
            if (!this.axpObj.isCanvasOpen) { return; }

            // モーダルウィンドウ表示中（セーブロード、レイヤー名変更入力時）は無効
            if (this.axpObj.isModalOpen) { return; }

            // キー入力可能な要素にフォーカス中の場合は無効
            if (document.activeElement.type === 'number' || document.activeElement.type === 'text') {
                return;
            }

            // OS本来の操作を抑止
            e.preventDefault();

            let inkey = e.key.toUpperCase(); // 入力されたキーを大文字に変換
            // 描画中は無効
            if (this.axpObj.isDrawing) {
                if (inkey === 'SHIFT') {
                    // SHIFTキーで描画途中からでも直線描画モードに移行
                    this.axpObj.isLine = true;
                }
                return;
            }

            // 押しっぱなしを有効とするキー
            switch (inkey) {
                case 'ARROWUP':
                case 'ARROWDOWN':
                case 'ARROWLEFT':
                case 'ARROWRIGHT':
                    this.pressArrowkey(inkey);
                    break;
            }

            // その他のキーは押しっぱなし状態のとき、それ以上は処理しない
            if (e.repeat) { return }

            console.log('keyboard:', e.key);

            switch (inkey) {
                case ' ':
                    this.axpObj.isSPACE = true;
                    this.axpObj.penSystem.changePenModeTemporary('axp_penmode_hand');
                    break;
                case 'CONTROL':
                    this.axpObj.isCTRL = true;
                    this.axpObj.penSystem.changePenModeTemporary('axp_penmode_spuit');
                    break;
                case 'ALT':
                    break;
                case 'SHIFT':
                    this.axpObj.isSHIFT = true;
                    break;
                case 'BACKSPACE':
                    this.axpObj.TASK['func_undo']();
                    break;
                case 'Q':
                    this.axpObj.penSystem.modeChangeSizeOn();
                    break;
                case 'P':
                    this.axpObj.TASK['func_swap_pixelated']();
                    break;
                case 'I':
                    this.axpObj.TASK['func_init_window_positon']();
                    break;
                case 'U':
                    this.axpObj.TASK['func_fill_all']();
                    break;
                case 'C':
                    this.axpObj.TASK['func_swap_transparent']();
                    break;
                case 'X':
                    this.axpObj.TASK['func_swap_maincolor']();
                    break;
                case 'B':
                    this.axpObj.TASK['func_backgroundimage']();
                    break;
                case 'M':
                    this.axpObj.TASK['func_flip_h']();
                    break;
                case 'K':
                    this.axpObj.TASK['func_rotate']();
                    break;
                case ';':
                    this.axpObj.TASK['func_loupe_up']();
                    break;
                case 'W':
                    this.axpObj.TASK['func_size_down']();
                    break;
                case 'E':
                    this.axpObj.TASK['func_size_up']();
                    break;
                // 数字キー（設定でキーカスタマイズ）
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                    this.axpObj.callTask(`axp_config_custom_key${inkey}`, inkey);
                    break;
                // その他、ショートカットキーと1:1で対応しているボタン機能
                default:
                    // 一致する機能ボタンを検索
                    let exec_function = null;
                    const function_buttons = document.getElementsByClassName('axpc_FUNC');
                    for (const item of function_buttons) {
                        // HTMLのdata-key定義と、入力されたキーが一致しているか判定
                        if (item.dataset.key === inkey) {
                            exec_function = item.dataset.function;
                            break;
                        }
                    }
                    console.log('Task呼び出し:', exec_function);
                    // 一致した機能を実行
                    if (exec_function != null) {
                        this.axpObj.TASK[exec_function]();
                    }
                    break;
            }
        }, { passive: false });
    }
    // 矢印キーの処理
    pressArrowkey(inkey) {
        // ユーザー設定で割り当てられている処理を実行
        switch (this.axpObj.config('axp_config_form_keyCustomArrow')) {
            case 'none':
                break;
            case 'move':
                // 移動量
                const move_size = parseInt(document.getElementById('axp_config_number_moveSize').value);
                // 方向（設定で反転がチェックされている場合、移動方向を反転させる）
                const move_vector = document.getElementById('axp_config_checkbox_moveDirection').checked ? -1 : 1;
                switch (inkey) {
                    case 'ARROWUP':
                        this.axpObj.moveCanvas(0, -move_size * move_vector);
                        break;
                    case 'ARROWDOWN':
                        this.axpObj.moveCanvas(0, move_size * move_vector);
                        break;
                    case 'ARROWLEFT':
                        this.axpObj.moveCanvas(-move_size * move_vector, 0);
                        break;
                    case 'ARROWRIGHT':
                        this.axpObj.moveCanvas(move_size * move_vector, 0);
                        break;
                }
                break;
            case 'size':
                let name = this.axpObj.penSystem.getName();
                let alpha = this.axpObj.penSystem.getAlpha();
                let size = this.axpObj.penSystem.getSize();
                switch (inkey) {
                    case 'ARROWUP':
                    case 'ARROWDOWN':
                        // 不透明度を変更できないペンを変更したとき
                        if (alpha === null) {
                            // %1の不透明度は変更できません。
                            this.axpObj.msg('@CAU0200', name);
                            return;
                        } else {
                            alpha = Number(alpha);
                            // 上キーなら不透明度を上げる、下キーなら下げる
                            if (inkey === 'ARROWUP') {
                                if (alpha >= 100) {
                                    // %1の不透明度は100が最大値です。
                                    this.axpObj.msg('@CAU0201,', name);
                                    return;
                                }
                                alpha = alpha + 5;
                            } else {
                                if (alpha <= 5) {
                                    // %1の不透明度は5が最小値です。
                                    this.axpObj.msg('@CAU0202', name);
                                    return;
                                }
                                alpha = alpha - 5;
                            }
                            // %1の不透明度：%2
                            this.axpObj.msg('@AXP0003', name, alpha);
                            this.axpObj.penSystem.setAlpha(alpha);
                            // ペンの太さプレビュー
                            this.axpObj.penSystem.previewPenSize();
                            // 変更をレンジスライダーにも反映
                            document.getElementById('axp_pen_form_alpha').result.value = alpha;
                            document.getElementById('axp_pen_range_alpha').value = alpha;
                            // コンフィグオブジェクトをDBに保存
                            this.axpObj.configSystem.saveConfig('P-ALP_' + this.axpObj.penSystem.pen_mode, alpha);
                        }
                        break;
                    case 'ARROWLEFT':
                        this.axpObj.TASK['func_size_down']();
                        break;
                    case 'ARROWRIGHT':
                        this.axpObj.TASK['func_size_up']();
                        break;
                }
                break;
            case 'grid':
                // 補助線分割数
                if (this.axpObj.assistToolSystem.isGrid) {
                    let div_h = document.getElementById('axp_tool_form_gridH').volume.value;
                    let div_v = document.getElementById('axp_tool_form_gridV').volume.value;
                    switch (inkey) {
                        // 縦
                        case 'ARROWUP':
                            if (div_v < 16) div_v++;
                            // 連動
                            if (document.getElementById('axp_tool_checkbox_gridVHLink').checked) {
                                div_h = div_v;
                            }
                            break;
                        case 'ARROWDOWN':
                            if (div_v > 2) div_v--;
                            // 連動
                            if (document.getElementById('axp_tool_checkbox_gridVHLink').checked) {
                                div_h = div_v;
                            }
                            break;
                        // 横
                        case 'ARROWRIGHT':
                            if (div_h < 16) div_h++;
                            // 連動
                            if (document.getElementById('axp_tool_checkbox_gridVHLink').checked) {
                                div_v = div_h;
                            }
                            break;
                        case 'ARROWLEFT':
                            if (div_h > 2) div_h--;
                            // 連動
                            if (document.getElementById('axp_tool_checkbox_gridVHLink').checked) {
                                div_v = div_h;
                            }
                            break;
                    }
                    // スライダー更新
                    document.getElementById('axp_tool_form_gridH').volume.value = div_h;
                    document.getElementById('axp_tool_form_gridH').result.value = div_h;
                    document.getElementById('axp_tool_form_gridV').volume.value = div_v;
                    document.getElementById('axp_tool_form_gridV').result.value = div_v;
                    this.axpObj.updateGrid();
                    // コンフィグ保存
                    this.axpObj.configSystem.saveConfig('RANGE_axp_form_grid_h', div_h);
                    this.axpObj.configSystem.saveConfig('RANGE_axp_form_grid_v', div_v);
                    // 補助線分割数 横：%1 / 縦：%2
                    this.axpObj.msg('@AXP0004', div_h, div_v);
                } else {
                    // 補助線が表示されているときに有効なショートカットです。
                    this.axpObj.msg('@CAU0206');
                }
                break;
        }
    }
}
