// @description AXNOS Paint基幹

// AXPObjは、ペイントツールの機能やデータを一元管理する親オブジェクト
// ユーザーからの入力をイベントとして受け取り、対応する子システムの処理を呼び出す

import { DragWindow } from './dragwindow.js';
import { PenSystem } from './window_pen.js';
import { LayerSystem } from './window_layer.js';
import { ColorPaletteSystem } from './window_palette.js';
import { ColorMakerSystem } from './window_makecolor.js';
import { AssistToolSystem } from './window_tool.js';
import { CustomButtonSystem } from './window_custom.js';
import { UndoSystem } from './undo.js';
import { ConfigSystem } from './config.js';
import { PostSystem } from './post.js';
import { SaveSystem } from './saveload.js';
import { KeyboardSystem } from './keyboard.js';
import { UTIL, loadImageWithTimeout, calcDistance, adjustInRange } from './etc.js';
import { Message } from './message.js';
import { DebugLog } from './debuglog.js';

// 拡張機能インポート
import * as extensions from '@extensions';

export class AXPObj {
    // AXNOS Paint全体で使用する定数。（システム単位で完全に独立している定数は、システム毎に定義する）
    CONST = {
        APP_TITLE: 'AXNOS Paint',
        CANVAS_X_MAX: 600,
        CANVAS_Y_MAX: 600,
        CANVAS_X_MIN: 8,
        CANVAS_Y_MIN: 8,
        CANVAS_X_DEFAULT: 317,
        CANVAS_Y_DEFAULT: 317,
        // 描画時のステータス
        DRAW_FREEHAND: Symbol(),
        DRAW_LINE: Symbol(),
        DRAW_RECT: Symbol(),
        DRAW_CIRCLE: Symbol(),
        // 拡大率
        SCALE_MAX: 1600,
        SCALE_MIN: 25,
        SCALE_VALUE: [25, 33, 50, 66, 100, 150, 200, 250, 300, 400, 600, 800, 1200, 1600],
        SCALE_TABLE_MAX: 50,
        MESSAGE_KEEP_TIME: 2000,
        DRAW_MULTI: 1,
    }
    // 画面表示用キャンバス（※メモリ上のみで使用するcanvasは使用する各クラスで定義）
    CANVAS = {
        // 表示用キャンバス
        main: null,
        main_ctx: null,
    };
    // DOM要素
    ELEMENT = {
        view: null,
        cursor: null,
        info: null,
        base: null,
        grid: null,
        grid_dot: null,
    };
    // 関数定義
    FUNCTION = {
        // 投稿用プログラム（ユーザー定義）
        post: null,
    };
    // タスク呼び出し（ボタンやショートカットで起動できる処理のまとまり）
    TASK = [];
    // ツールウィンドウ
    dragWindow;
    toolWindow = [];
    layerSystem;
    colorPaletteSystem;
    colorMakerSystem;
    penSystem;
    assistToolSystem;
    customButtonSystem;

    // ステータス -----------------------------------------
    isModalOpen; // モーダルウィンドウが開かれている
    isCanvasOpen; // キャンバスのタブが開かれている
    isClose;//ユーザーにより非表示状態
    isBackgroundimage; // 背景タイルプレビューが有効である
    isSPACE = false; // スペースが押されている
    isCTRL = false; // CTRLが押されている
    isSHIFT = false; // シフトキーが押されている
    isDrawing = false; // 描画中である
    isDrawn = false; // 描画処理が行われた
    isDrawCancel = false; // 描画処理がキャンセルされた
    isLine;
    isRect;
    // ----------------------------------------------------
    codeCHANGE_SIZE_KEY = null; // ショートカット「ペンの太さ調整」で押されたキー

    // 実行環境系
    ENV = {
        multiCanvas: false,
    }

    // AXNOS Paint親要素ID
    paintBodyElement;
    // 使用ブラウザ
    browser;

    checkSameBBS;
    option_height;
    option_width;

    // GETパラメーター記憶用
    oekaki_id = null; // 基にするお絵カキコの画像id
    oekaki_width;       // （起動時に指定された）キャンバスの幅
    oekaki_height;      // （起動時に指定された）キャンバスの高さ

    // お絵カキコのpng画像が存在するurl
    oekakiURL;
    oekakiTimeout;
    // 基にしてお絵カキコ用Image
    oekaki_base;

    post_bbs_pageno;    // 投稿する掲示板のurl.pathname
    post_bbs_title;     // 投稿する掲示板のページタイトル
    // セーブデータの刻印となる情報
    oekaki_bbs_pageno = null; // 基にするお絵カキコの掲示板のページ番号（ロード制限の判定に使用）
    oekaki_bbs_title = null; // 基にするお絵カキコの掲示板のページタイトル（ロード制限時のエラーメッセージ用）

    // 現在のキャンバスサイズ
    x_size;
    y_size;

    // 画像の縦横サイズが異なる時のサムネイルのセンタリング用
    ctx_map_shift_x;
    ctx_map_shift_y;
    scale = 100;

    // カメラ座標（ハンドツールでキャンバスを移動させた差分）
    cameraX = 0;
    cameraY = 0;

    // 背景タイルプレビュー表示用
    url_backgroundimage;

    // キャンバス座標
    base_x;
    base_y;

    // 入力座標
    baseClientX;
    baseClientY;

    // イベント状態キャッシュ
    evCache = [];

    baseTouchX = -1;
    baseTouchY = -1;
    baseDiff = -1;
    baseScale = -1;
    baseCameraX = -1;
    baseCameraY = -1;

    longPressTimerID = null;
    touchTimerID = null;
    fingerCount = 0;

    // ホイールタイマー
    wheelTimeStamp = Date.now();

    // アンドゥ使用可能最大数
    undo_max;

    // 拡張機能
    exTool = null;

    // 拡大率テーブル
    currentScaleTable = this.CONST.SCALE_VALUE;

    // デバッグモード（デバッグ用）
    debugLog = null;

    constructor() {

        // ツールウィンドウシステム
        this.toolWindow.push(this.layerSystem = new LayerSystem(this));
        this.toolWindow.push(this.colorPaletteSystem = new ColorPaletteSystem(this));
        this.toolWindow.push(this.colorMakerSystem = new ColorMakerSystem(this));
        this.toolWindow.push(this.penSystem = new PenSystem(this));
        this.toolWindow.push(this.assistToolSystem = new AssistToolSystem(this));
        this.toolWindow.push(this.customButtonSystem = new CustomButtonSystem(this));

        // サブシステム
        this.keyboardSystem = new KeyboardSystem(this);
        this.undoSystem = new UndoSystem(this);
        this.configSystem = new ConfigSystem(this);
        this.saveSystem = new SaveSystem(this);
        this.postSystem = new PostSystem(this);
    }
    // 起動時に１回だけ必要な処理
    init() {
        //実際に表示されるキャンバス（ルーペによる拡大縮小が適用される）
        this.CANVAS.main = document.getElementById('axp_canvas_canvas_main');
        this.CANVAS.main_ctx = this.CANVAS.main.getContext('2d', { willReadFrequently: true });
        //this.CANVAS.main_ctx = this.CANVAS.main.getContext('2d');

        this.ELEMENT.base = document.getElementById('axp_canvas');
        this.ELEMENT.view = document.getElementById('axp_canvas_div_grayBackground');
        this.ELEMENT.cursor = document.getElementById('axp_canvas_div_penCursor');
        this.ELEMENT.info = document.getElementById('axp_footer_div_message');

        // 注意：
        // 初期化が完了していないシステムを呼び出してエラーになるのを避けるため、
        // 各init内で他システムの要素を参照する処理を行わないこと
        // ツールウィンドウシステム
        for (const item of this.toolWindow) {
            item.init();
        }

        // ツールウィンドウのドラッグ制御
        this.dragWindow = new DragWindow(this);
        for (const item of this.toolWindow) {
            this.dragWindow.add(item);
        }
        // サブシステム
        this.keyboardSystem.init();
        this.undoSystem.init();
        this.configSystem.init();
        this.saveSystem.init();
        this.postSystem.init();

        this.initTask();

        // イベントリスナ設定（機能ボタン）
        const function_buttons = document.querySelectorAll('.axpc_FUNC');
        for (const item of function_buttons) {
            item.addEventListener('click', (e) => {
                this.TASK[item.dataset.function]();
            });
        }
    }
    // キャンバスの初期化（新規キャンバス、ロード、自動保存から復元時などに行う処理）
    resetCanvas() {
        this.CANVAS.main.style.width = this.x_size + 'px';
        this.CANVAS.main.style.height = this.y_size + 'px';
        this.CANVAS.main.width = this.x_size;
        this.CANVAS.main.height = this.y_size;

        this.updateGrid();

        // キャンバス表示位置の初期化
        this.zoomReset();
        this.refreshCanvas();

        this.layerSystem.resetCanvas();
        this.penSystem.resetCanvas();
        this.assistToolSystem.resetCanvas();
        this.undoSystem.resetCanvas();
        this.postSystem.resetCanvas();
    }
    // イベント受付開始
    startEvent() {
        // デバッグ情報
        this.debugLog = new DebugLog('axp_canvas_div_debugInfo', document.getElementById('axp_config_checkbox_useDebugMode').checked);

        // ツールウィンドウシステム
        for (const item of this.toolWindow) {
            item.startEvent();
        }
        // サブシステム
        this.keyboardSystem.startEvent();
        this.configSystem.startEvent();
        this.saveSystem.startEvent();
        this.postSystem.startEvent();

        // iPad safari
        // ダブルタップを抑止
        document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
        // 長押し時のルーペ表示を抑止
        this.ELEMENT.view.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });
        // ピンチインによるページ拡大抑止
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });

        // 描画領域を離れた時、ペンの太さガイドを非表示
        this.ELEMENT.base.addEventListener('pointerleave', () => { this.ELEMENT.cursor.style.visibility = 'hidden'; });

        /**
         * ポインタが押された時の処理
         */
        this.ELEMENT.base.addEventListener('pointerdown', (e) => {
            // 描画処理に受け渡すオプション情報
            const option = {};

            // モーダルウィンドウ表示中は無効
            if (this.isModalOpen) { return; }

            // キャンバス座標計算
            let pos = this.calcScaleCoordinates(e);

            // 新たなポインタダウンイベントが発生した時点で、それまでのタイマーはリセット
            if (this.longPressTimerID) {
                // タッチタイマー終了
                this.debugLog.log(`[TIMER] longPressTimerID:${this.longPressTimerID} -> CANCEL(DOWN)`);
                // 長押しキャンセル
                clearTimeout(this.longPressTimerID);
                this.longPressTimerID = null;
            }

            // タッチ処理
            if (e.pointerType === 'touch') {

                // ０→１に変化したとき、タッチタイマースタート
                if (this.evCache.length === 0) {
                    const time = Number(document.getElementById('axp_config_form_touchDurationValue').volume.value);
                    // タイマーセット
                    this.touchTimerID = setTimeout(() => {
                        this.debugLog.log(
                            `[TIMER] touchTimerID:${this.touchTimerID} -> TIMEOUT(${time}ミリ秒経過)`);
                        this.touchTimerID = null;
                    }, time)

                    this.debugLog.log(`[TIMER] touchTimerID:${this.touchTimerID} -> SET`);

                    // 初期カメラ位置記憶
                    this.baseCameraX = this.cameraX;
                    this.baseCameraY = this.cameraY;
                    // 初期入力座標
                    this.baseTouchX = e.clientX;
                    this.baseTouchY = e.clientY;
                    // 初期拡大率
                    this.baseScale = this.scale;
                }
                // タッチ情報記憶
                this.evCache.push(e);
                // 最大タッチ数更新
                if (this.fingerCount < this.evCache.length) {
                    this.fingerCount = this.evCache.length;
                };

                // ２点がタッチされている場合、ピンチジェスチャー処理
                if (this.evCache.length === 2) {
                    // 描画確定済みでなければ描画終了
                    if (!this.isDrawn) {
                        this.isDrawCancel = true;
                    }
                    // 初期距離差分
                    this.baseDiff = calcDistance(this.evCache[0].clientX, this.evCache[0].clientY, this.evCache[1].clientX, this.evCache[1].clientY);
                };
            }

            let mode = this.penSystem.getPenMode();
            // プライマリーポインタ
            if (e.isPrimary) {
                // メッセージリセット
                //this.msg('');
                //右ボタンまたはホイールボタンに割り当てられた機能を実行
                if (e.buttons === 2 || e.buttons === 4) {
                    // OS本来の操作を抑止
                    e.preventDefault();
                    const task = e.buttons === 2 ? this.config('axp_config_form_mouseRightButton') : this.config('axp_config_form_mouseWheelButton');
                    switch (task) {
                        case 'undo':
                            this.TASK['func_undo']();
                            break;
                        case 'spuit':
                            this.penSystem.spuit(e);
                            this.penSystem.autoChangePen();
                            break;
                        case 'hand':
                            mode = 'axp_penmode_hand';
                            break;
                        case 'loupe':
                            this.TASK['func_loupe_reset']();
                            break;
                        case 'swapcolor':
                            this.TASK['func_swap_maincolor']();
                            break;
                        case 'swaptrans':
                            this.TASK['func_swap_transparent']();
                            break;
                        case 'transdraw':
                            option.task = 'transdraw';
                            break;
                    }
                    // ハンド以外の場合、ここで処理終了
                    if (task !== 'hand' && task !== 'transdraw') return;
                }

                // 入力座標記録
                this.baseClientX = e.clientX;
                this.baseClientY = e.clientY;

                if (this.config('axp_config_form_touchDrawType') === 'none' && e.pointerType === 'touch') {
                    // タッチ無効時は描画しない
                } else {
                    if (this.config('axp_config_form_touchDrawType') === 'hand' && e.pointerType === 'touch') {
                        mode = 'axp_penmode_hand';
                    }
                    this.base_x = pos.x;
                    this.base_y = pos.y;
                    // 機能呼び出し
                    this.penSystem.start(pos.x, pos.y, e, mode, option);
                    //console.log('描画準備:', mode);
                }

                // 長押しスポイトが有効の時、タイマーセット
                if (this.config('axp_config_form_useLongtap') === 'on') {
                    const time = Number(document.getElementById('axp_config_form_longtapDurationValue').volume.value);
                    this.longPressTimerID = setTimeout(() => {
                        // 描画中強制終了
                        this.isDrawCancel = true;
                        // [DEBUG]
                        this.debugStatus();
                        this.debugLog.log(`[TIMER] longPressTimerID:${this.longPressTimerID} -> TIMEOUT(${time}ミリ秒長押し)`);
                        this.debugLog.log(`[EXEC_] スポイト実行`);
                        this.longPressTimerID = null;
                        this.penSystem.spuit(e);
                        this.penSystem.autoChangePen();
                    }, time)
                    this.debugLog.log(`[TIMER] longPressTimerID:${this.longPressTimerID} -> SET`);
                }
            }
            // [DEBUG]
            this.debugStatus();
            const text =
                `[DOWN_] ID:${e.pointerId}(${e.pointerType}) P:${e.isPrimary ? 'O' : '-'} (${Math.trunc(e.clientX)},${Math.trunc(e.clientY)})`;
            this.debugLog.log(text);
        });

        /**
         * ポインタが移動した時の処理
         */
        this.ELEMENT.base.addEventListener('pointermove', (e) => {
            // モーダルウィンドウ表示中は無効
            if (this.isModalOpen) return;

            // プライマリーポインタ
            if (e.isPrimary) {
                // 長押し中判定
                if (this.longPressTimerID) {
                    let distance = calcDistance(
                        this.baseClientX,
                        this.baseClientY,
                        e.clientX,
                        e.clientY
                    );
                    // 手ぶれの許容範囲内の場合は入力を無視する
                    if (distance < Number(document.getElementById('axp_config_form_longtapStabilizerValue').volume.value)) return;
                    this.debugLog.log(`[TIMER] longPressTimerID:${this.longPressTimerID} -> CANCEL(MOVE)`);
                    // 長押しキャンセル
                    clearTimeout(this.longPressTimerID);
                    this.longPressTimerID = null;
                }

                // キャンバス座標計算
                let pos = this.calcScaleCoordinates(e);
                const target = e.target;
                if (target === this.CANVAS.main || target === this.ELEMENT.view) {
                    // キャンバス内部

                    const name = this.layerSystem.getName();

                    // レイヤーが書き込み禁止の状態のとき、注意メッセージを表示する
                    const reasonText = this.layerSystem.getReasonTextForWriteProtection();
                    if (reasonText !== null) {
                        // 優先順位：１
                        // %1が%2のため、描画を禁止しています。
                        this.msg('@CAU0001', name, reasonText);
                    } else {
                        let isInvalid = false;
                        let isCliping = false;
                        // レイヤーの合成モードがクリッピング かつ 適切な親が存在しないとき、注意メッセージを表示する
                        if (this.layerSystem.getMode() === 'source-atop') {
                            if (this.layerSystem.getClupMode() === 'invalid') {
                                // 優先順位：２
                                // %1の下層に親レイヤーが存在しないため、クリッピングが無効になっています。
                                this.msg('@CAU0006', name);
                                isInvalid = true;
                            } else {
                                isCliping = true;
                            }
                        }
                        // 透明部分のロックのとき、情報メッセージを表示する
                        if (!isInvalid && this.layerSystem.getMasked()) {
                            // 優先順位：３
                            // %1は透明部分をロックしています。既に描画されている部分のみ上書き描画できます。
                            this.msg('@INF0001', name);
                        } else {
                            if (isCliping) {
                                // 優先順位：４
                                // %1はクリッピングです。描画内容は%2の形に切り抜かれます。
                                this.msg('@INF0008', name, this.layerSystem.getClupParentName());
                            }
                        }
                    }
                }
                // 座標表示
                // 座標の絶対値が1000以上の場合、表示形式を変える
                let textDisplayPositon;
                // 座標数値を文字列に書式変換
                const formatPositon = (num) => {
                    // -1000~1000にする
                    let num0 = Math.max(Math.min(num, 1000), -1000);
                    // 絶対値が1000ならNaN
                    let str0 = (Math.abs(num0) < 1000) ? num0.toString() : 'NaN';
                    // 桁揃え
                    let str1 = ('    ' + str0).slice(-4);
                    return str1;
                };
                // 直線または長方形描画中
                if (this.isLine || this.isRect) {
                    textDisplayPositon = `(${formatPositon(this.base_x)},${formatPositon(this.base_y)})→(${formatPositon(pos.x)},${formatPositon(pos.y)})`;
                } else {
                    textDisplayPositon = `(${formatPositon(pos.x)},${formatPositon(pos.y)})`;
                }

                // 座標表示
                document.getElementById('axp_canvas_div_pointerPosition').textContent = textDisplayPositon;
                // 機能呼び出し
                this.penSystem.move(pos.x, pos.y, e);
            }

            // タッチ処理
            if (e.pointerType === 'touch') {
                // キャッシュ内でこのイベントを見つけ、このイベントの記録を更新
                const index = this.evCache.findIndex(
                    (item) => item.pointerId === e.pointerId
                );
                if (index !== -1) {
                    this.evCache[index] = e;
                }
                // 描画が行われていた時
                if (this.touchTimerID && this.isDrawn) {
                    // タッチタイマー終了
                    this.debugLog.log(`[TIMER] touchTimerID:${this.touchTimerID} -> CANCEL(描画済み)`);
                    clearTimeout(this.touchTimerID);
                    this.touchTimerID = null;
                }

                // ２点がタッチされている場合、ピンチジェスチャー処理
                if (this.evCache.length === 2) {
                    if (this.isDrawCancel) {
                        // ２点間の距離を求める
                        const curDiff = calcDistance(this.evCache[0].clientX, this.evCache[0].clientY, this.evCache[1].clientX, this.evCache[1].clientY);
                        // ２点間の距離（初期値）からの差分を求める
                        const diffDistance = Math.round(curDiff - this.baseDiff);
                        // 初期座標からの差分
                        const diffX = this.baseTouchX - this.evCache[0].clientX;
                        const diffY = this.baseTouchY - this.evCache[0].clientY;
                        // 座標の変化がある入力があったか？
                        const isMoveing = (Math.abs(diffDistance) + Math.abs(diffX) + Math.abs(diffY) >
                            Number(document.getElementById('axp_config_form_touchThresholdValue').volume.value));

                        // タイマー起動中（まだタップとスワイプが確定していない状態）
                        if (this.touchTimerID) {
                            // 座標の変化があれば、タイマーキャンセル（スワイプが確定）
                            if (isMoveing) {
                                this.debugLog.log(`[TIMER] touchTimerID:${this.touchTimerID} -> CANCEL(スワイプ開始)`);
                                clearTimeout(this.touchTimerID);
                                this.touchTimerID = null;
                            }
                        }
                        // スワイプが確定していれば、スワイプ処理を行う
                        if (this.touchTimerID === null) {
                            // ピンチによる拡大／縮小
                            if (this.config('axp_config_form_touchZoom') === 'on') {
                                // 拡大率（初期値）に差分を加算する（指定可能範囲を超える場合は補正する）
                                this.scale = adjustInRange(this.baseScale + diffDistance, this.CONST.SCALE_MIN, this.CONST.SCALE_MAX);
                            };
                            // カメラ位置移動
                            if (this.config('axp_config_form_touchHand') === 'on') {

                                this.cameraX = Math.round(this.baseCameraX + (diffX * 100 / this.scale));
                                this.cameraY = Math.round(this.baseCameraY + (diffY * 100 / this.scale));
                            };
                            // キャンバス表示更新
                            this.refreshCanvas();
                        }
                    }
                }
            }
            // [DEBUG]
            this.debugStatus();
            let action = '';
            if (this.isDrawing && !this.isDrawCancel) {
                action = '[DRAW_]';
            } else {
                action = '[MOVE_]';
            }
            const text = action +
                ` ID:${e.pointerId}(${e.pointerType}) P:${e.isPrimary ? 'O' : '-'} (${Math.trunc(e.clientX)},${Math.trunc(e.clientY)})`;
            this.debugLog.log(text);
        });

        const removeEvent = (e) => {
            // 長押しキャンセル
            if (this.longPressTimerID) {
                this.debugLog.log(`[TIMER] longPressTimerID:${this.longPressTimerID} -> CANCEL(UP)`);
                clearTimeout(this.longPressTimerID);
                this.longPressTimerID = null;
            }
            // タッチ処理
            if (e.pointerType === 'touch') {
                // このイベントをターゲットのキャッシュから削除する
                const index = this.evCache.findIndex(
                    (item) => item.pointerId === e.pointerId
                );
                if (index !== -1) {
                    this.evCache.splice(index, 1);
                } else {
                    //console.log('認識されていないポインタIDを検出');
                    //this.evCache.splice(0);
                }
            }
            if (e.isPrimary) {
                // キャンバス座標計算
                let pos = this.calcScaleCoordinates(e);
                // 機能呼び出し
                this.penSystem.end(pos.x, pos.y, e);
            }
        };
        /**
        * ポインタが離された時の処理
        */
        this.ELEMENT.base.addEventListener('pointerup', (e) => {
            // タッチ処理
            if (e.pointerType === 'touch') {
                // このイベントをターゲットのキャッシュから削除する
                const index = this.evCache.findIndex(
                    (item) => item.pointerId === e.pointerId
                );
                if (index !== -1) {
                    this.evCache.splice(index, 1);
                }
                // 描画が行われていた時
                if (this.touchTimerID && this.isDrawn) {
                    // タッチタイマー終了
                    this.debugLog.log(`[TIMER] touchTimerID:${this.touchTimerID} -> CANCEL(描画済み)`);
                    clearTimeout(this.touchTimerID);
                    this.touchTimerID = null;
                }
                // すべてのタッチが離された時
                if (this.evCache.length === 0) {
                    if (this.touchTimerID) {
                        this.debugLog.log(`[TIMER] touchTimerID:${this.touchTimerID} -> CANCEL(タッチ数=0)`);
                        // タッチタイマー終了
                        clearTimeout(this.touchTimerID);
                        this.touchTimerID = null;
                        switch (this.fingerCount) {
                            case 2:
                                if (this.config('axp_config_form_touchUndo') === 'on') {
                                    this.debugLog.log(`[EXEC_] アンドゥ実行(最大タッチ数=${this.fingerCount})`);
                                    this.isDrawCancel = true;
                                    this.TASK['func_undo']();
                                }
                                break;
                            case 3:
                                if (this.config('axp_config_form_touchRedo') === 'on') {
                                    this.debugLog.log(`[EXEC_] リドゥ実行(最大タッチ数=${this.fingerCount})`);
                                    this.isDrawCancel = true;
                                    this.TASK['func_redo']();
                                }
                                break;
                        }
                    }
                    this.fingerCount = 0;
                }
            }
            removeEvent(e);
            // [DEBUG]
            this.debugStatus();
            const text =
                `[UP___] ID:${e.pointerId}(${e.pointerType}) P:${e.isPrimary ? 'O' : '-'} (${Math.trunc(e.clientX)},${Math.trunc(e.clientY)})`;
            this.debugLog.log(text);
        });
        // ポインタが無効になった時の処理
        this.ELEMENT.base.addEventListener('pointercancel', (e) => {
            //console.log('pointercancel');
            removeEvent(e);
        });
        this.ELEMENT.base.addEventListener('pointerout', (e) => {
            //console.log('pointerout');
            //removeEvent(e);
        });
        this.ELEMENT.base.addEventListener('pointerleave', (e) => {
            //console.log('pointerleave');
            removeEvent(e);
        });

        // マウスホイール
        document.addEventListener('wheel', (e) => { this.mouseWheel(e) }, { passive: false });
        //非推奨
        //document.addEventListener('mousewheel', (e) => { this.mouseWheel(e) }, { passive: false });
        //非推奨
        //document.addEventListener('DOMMouseScroll', (e) => { this.mouseWheel(e) }, { passive: false });

        // コンテキストメニュー抑止
        document.oncontextmenu = (e) => {
            // キー入力可能な要素にフォーカス中の場合は有効
            if (document.activeElement.type === 'number' || document.activeElement.type === 'text' || document.activeElement.type === 'textarea') {
                return true;
            }
            // 右クリックに機能が割り当てられているなら無効
            if (this.config('axp_config_form_mouseRightButton') !== 'none') {
                return false;
            }
        };

        // ボタンにカーソルをあてたときにメッセージを表示
        const messages = document.querySelectorAll('.axpc_MSG');
        for (const item of messages) {
            // 要素に入ったとき
            item.addEventListener('pointerenter', (e) => {
                let text = e.currentTarget.dataset.msg;
                this.msg(text);
            });
        }
        // ボタンにカーソルをあてたときにメッセージを表示（ショートカット機能専用）
        const messagesFunction = document.querySelectorAll('.axpc_FUNC');
        for (const item of messagesFunction) {
            // 要素に入ったとき
            item.addEventListener('pointerenter', (e) => {
                let text = e.currentTarget.dataset.msg;
                let shortcut = '';
                if (e.currentTarget.dataset.key) {
                    // ショートカットキーが定義されている場合、表示テキストに付与する
                    shortcut = `${e.currentTarget.dataset.key}:`;
                }
                let additionalInfo = '';
                let key;
                switch (e.currentTarget.dataset.function) {
                    // ペンツールのボタン専用処理
                    case 'func_switch_pen':
                    case 'func_switch_eraser':
                    case 'func_switch_fill':
                    case 'func_switch_hand':
                        // メッセージIDの文章を取得し、先頭の%1を除外する
                        additionalInfo = Message.getMessage(e.currentTarget.dataset.addmsg).slice(2);
                        this.msg(text, shortcut, additionalInfo);
                        break;
                    // 色作成のサブカラー専用処理
                    case 'func_switch_subcolor':
                        key = this.configSystem.getShortcutFunction('func_swap_maincolor');
                        if (key) {
                            additionalInfo = `${key}:メイン／サブカラー切替`;
                        }
                        this.msg(text, shortcut, additionalInfo);
                        break;
                    // 色作成の透明色専用処理
                    case 'func_switch_transparent':
                        key = this.configSystem.getShortcutFunction('func_swap_transparent');
                        if (key) {
                            additionalInfo = `${key}:メイン／透明色切替`;
                        }
                        this.msg(text, shortcut, additionalInfo);
                        break;
                    // 通常の機能ボタン
                    default:
                        this.msg(text, shortcut);
                }
            });
        }

        // メインのタブ制御
        this.selectTab('0');
        const elementsTab = document.querySelectorAll('#axp_main_div_tab > div > div');
        elementsTab.forEach((element) => {
            element.addEventListener('click', (e) => {
                //console.log(e.currentTarget.dataset.idx);
                this.selectTab(e.currentTarget.dataset.idx);
            });
        });

        // Chromeの「メモリセーバー」によるcanvas消去の対応
        document.addEventListener('visibilitychange', () => {
            //console.log('document.visibilityState:', document.visibilityState);
            if (document.visibilityState === 'visible') {
                // タブが表示されたとき
                this.layerSystem.updateCanvas();
                this.colorMakerSystem.colorWheel.redraw();
                this.penSystem.previewPenSize();
                this.drawPostCanvas();
            }
        });
    }
    /**
     * キャンバス表示更新
     */
    refreshCanvas() {
        // 表示エリアの中央座標
        const rectView = this.ELEMENT.view.getBoundingClientRect();
        const centerX = rectView.width / 2;
        const centerY = rectView.height / 2;
        const width = Math.round(this.x_size * (this.scale / 100));
        const height = Math.round(this.y_size * (this.scale / 100));
        // キャンバスの表示座標更新
        this.CANVAS.main.style.left = Math.round(centerX - (this.x_size / 2 + this.cameraX) * this.scale / 100) + "px";
        this.CANVAS.main.style.top = Math.round(centerY - (this.y_size / 2 + this.cameraY) * this.scale / 100) + "px";
        // 拡大率に応じたキャンバズサイズ更新
        this.CANVAS.main.style.width = width + "px";
        this.CANVAS.main.style.height = height + "px";

        // 補助線表示座標更新
        const grid = document.getElementById('axp_canvas_div_grid');
        grid.style.left = this.CANVAS.main.style.left;
        grid.style.top = this.CANVAS.main.style.top;
        grid.style.width = this.CANVAS.main.style.width;
        grid.style.height = this.CANVAS.main.style.height;
        const svg = document.getElementById('axp_canvas_svg_grid');
        svg.setAttribute("viewBox", `-0.5, -0.5, ${width}, ${height}`);

        this.updateGrid();

        // 拡大率数値表示
        document.getElementById('axp_tool_button_loupeReset').textContent = `${Math.round(this.scale)}%`;

        // ペンの太さプレビュー更新
        this.penSystem.previewPenSize();
        // サムネイルのガイド線更新
        this.assistToolSystem.mapguide();
    }
    // 補助線更新
    updateGrid() {
        const gridRect = document.getElementById('axp_canvas_div_grid').getBoundingClientRect();
        const svg = document.getElementById('axp_canvas_svg_grid');

        // 作成済み補助線の消去
        const elementsRect = svg.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'rect');
        while (elementsRect.length) {
            elementsRect[0].remove();
        }

        const createRect = (id) => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', '100%');
            rect.setAttribute('height', '100%');
            rect.setAttribute('fill', `url(#${id})`);
            return rect;
        }

        // pattern作成（格子）
        const updatePatternVH = (element, h, v, color) => {
            const div_width = gridRect.width / h;
            const div_height = gridRect.height / v;
            element.setAttribute('viewBox', `0 0 ${div_width} ${div_height}`);
            element.setAttribute('width', `${div_width}`);
            element.setAttribute('height', `${div_height}`);
            const path = element.querySelector('path');
            path.setAttribute('d', `M ${div_width} 0 L ${div_width} ${div_height} L 0 ${div_height}`);
            path.setAttribute('stroke', color);
        }
        // 主線
        if (document.getElementById('axp_tool_checkbox_gridVH').dataset.checked === 'true') {
            updatePatternVH(
                document.getElementById('axp_canvas_pattern_gridVH'),
                parseInt(document.getElementById('axp_tool_range_gridH').value),
                parseInt(document.getElementById('axp_tool_range_gridV').value),
                document.getElementById('axp_tool_color_gridVH').dataset.colorcode
            );
            svg.appendChild(
                createRect('axp_canvas_pattern_gridVH')
            );
        }
        // 副線
        if (document.getElementById('axp_tool_checkbox_gridSubDivision').dataset.checked === 'true') {
            updatePatternVH(
                document.getElementById('axp_canvas_pattern_gridSubDivision'),
                parseInt(document.getElementById('axp_tool_range_gridH').value) * 2,
                parseInt(document.getElementById('axp_tool_range_gridV').value) * 2,
                document.getElementById('axp_tool_color_gridSubDivision').dataset.colorcode
            );
            svg.appendChild(
                createRect('axp_canvas_pattern_gridSubDivision')
            );
        }

        // pattern作成（斜め）
        const updatePatternDiagonal = (element, h, v, color) => {
            const div_width = gridRect.width / h;
            const div_height = gridRect.height / v;
            element.setAttribute('viewBox', `0 0 ${div_width} ${div_height}`);
            element.setAttribute('width', `${div_width}`);
            element.setAttribute('height', `${div_height}`);
            const path = element.querySelector('path');
            path.setAttribute('d', `M 0 0 L ${div_width} ${div_height} M ${div_width} 0 L 0 ${div_height}`);
            path.setAttribute('stroke', color);
        }
        // 斜線
        if (document.getElementById('axp_tool_checkbox_gridDiagonal').dataset.checked === 'true') {
            updatePatternDiagonal(
                document.getElementById('axp_canvas_pattern_gridDiagonal'),
                parseInt(document.getElementById('axp_tool_range_gridH').value),
                parseInt(document.getElementById('axp_tool_range_gridV').value),
                document.getElementById('axp_tool_color_gridDiagonal').dataset.colorcode
            );
            svg.appendChild(
                createRect('axp_canvas_pattern_gridDiagonal')
            );
        }

        // pattern作成（格子）
        const updatePatternPX = (element, scalePx, color) => {
            element.setAttribute('viewBox', `0 0 ${scalePx} ${scalePx}`);
            element.setAttribute('width', `${scalePx}`);
            element.setAttribute('height', `${scalePx}`);
            const path = element.querySelector('path');
            path.setAttribute('d', `M ${scalePx} 0 L ${scalePx} ${scalePx} L 0 ${scalePx}`);
            path.setAttribute('stroke', color);
        }
        // ピクセル指定１
        if (document.getElementById('axp_tool_checkbox_gridPixel1').dataset.checked === 'true') {
            // 補助線の細かさに対して、表示に十分な拡大率である場合表示する
            if (this.scale / 800 * document.getElementById('axp_tool_number_gridPixel1').value >= 1) {
                updatePatternPX(
                    document.getElementById('axp_canvas_pattern_gridPixel1'),
                    parseInt(document.getElementById('axp_tool_number_gridPixel1').value) * this.scale / 100,
                    document.getElementById('axp_tool_color_gridPixel1').dataset.colorcode
                );
                svg.appendChild(
                    createRect('axp_canvas_pattern_gridPixel1')
                );
            }
        }
        // ピクセル指定２
        if (document.getElementById('axp_tool_checkbox_gridPixel2').dataset.checked === 'true') {
            // 補助線の細かさに対して、表示に十分な拡大率である場合表示する
            if (this.scale / 800 * document.getElementById('axp_tool_number_gridPixel2').value >= 1) {
                updatePatternPX(
                    document.getElementById('axp_canvas_pattern_gridPixel2'),
                    parseInt(document.getElementById('axp_tool_number_gridPixel2').value) * this.scale / 100,
                    document.getElementById('axp_tool_color_gridPixel2').dataset.colorcode
                );
                svg.appendChild(
                    createRect('axp_canvas_pattern_gridPixel2')
                );
            }
        }

    }
    // 拡大率変更
    setScale(value) {
        this.scale = adjustInRange(value, this.CONST.SCALE_MIN, this.CONST.SCALE_MAX);
        this.refreshCanvas();
        // 拡大率：%1
        this.msg('@AXP0001', this.scale);
    }
    /**
     * キャンバスの縮小
     */
    zoomOutCanvas() {
        if (this.scale <= this.CONST.SCALE_MIN) return;
        // 現在の拡大率より一つ下のvalueのindexをサーチ
        let index = 0;
        for (let idx = 1; idx < this.currentScaleTable.length; idx++) {
            if (this.scale <= this.currentScaleTable[idx]) {
                index = idx - 1;
                break;
            }
        }
        this.scale = this.currentScaleTable[index];
    }
    /**
    * キャンバスの拡大
    */
    zoomInCanvas() {
        if (this.scale >= this.CONST.SCALE_MAX) return;
        // 現在の拡大率より一つ上のvalueのindexをサーチ
        let index = 0;
        for (let idx = this.currentScaleTable.length - 2; idx >= 0; idx--) {
            if (this.scale >= this.currentScaleTable[idx]) {
                index = idx + 1;
                break;
            }
        }
        this.scale = this.currentScaleTable[index];
    }
    /**
    * キャンバスの拡大率リセット
    */
    zoomReset() {
        // 拡大率100%
        this.scale = 100;
        // カメラ座標（キャンバス表示位置）を中央にリセット
        this.cameraX = 0;
        this.cameraY = 0;
    }
    /**
     * ポインタイベントを受け取り、入力の実座標からscale(尺度)を適用したキャンバス上のx,y座標を計算し、返却する
     * @param {Event} e イベント
     * @returns {{x:Number,y:Number}} 座標(x,y)
     */
    calcScaleCoordinates(e) {
        let clientRect_draw = this.CANVAS.main.getBoundingClientRect();
        let calcX = Math.floor((e.clientX - clientRect_draw.left) * 100 / this.scale);
        let calcY = Math.floor((e.clientY - clientRect_draw.top) * 100 / this.scale);
        return {
            x: calcX,
            y: calcY,
        };
    }
    /**
     * マウスホイールイベントを受け取り、設定で割り当てられた機能を呼び出す
     * @param {Event} e イベント
     */
    mouseWheel(e) {
        // 非表示時は無効
        if (this.isClose) { return };
        // キャンバスタブ以外は無効
        if (!this.isCanvasOpen) { return; }

        // モーダルウィンドウ表示中は無効
        if (this.isModalOpen) { return; }

        // 標準の動作（スクロールなど）は無効にする
        // ※判定順序注意：設定、投稿タブでは、上記ifにてこのコードに到達しないため、スクロールが有効になる）
        e.preventDefault();

        // ホイールをサポートしていない環境は無効
        if (e.type !== "wheel") { return; }

        // 回転の向き (< 0 → up, > 0 → down)
        let deltaX = e.deltaX;
        let deltaY = e.deltaY;
        // 回転方向反転反転が設定されている場合
        if (document.getElementById('axp_config_checkbox_mouseWheelDirection').checked) {
            deltaX = -deltaX;
            deltaY = -deltaY;
        }
        const isPinch = !!(e.deltaY % 1);
        //console.log(isPinch ? 'pinch' : 'wheel', deltaX, deltaY, e.deltaX, e.deltaY);
        if (isPinch) {
            if (this.config('axp_config_form_mouseWheelZoom') === 'on') {
                // 拡大率（初期値）に差分を加算する（指定可能範囲を超える場合は補正する）
                this.scale = adjustInRange(this.scale - e.deltaY * 10, this.CONST.SCALE_MIN, this.CONST.SCALE_MAX);
                // キャンバス表示更新
                this.refreshCanvas();
                return;
            }
        }

        const sleepTime = Number(document.getElementById('axp_config_number_mouseWheelSleepTime').value);
        // トラックパッド用の感度補正（一定時間内の連続入力を無視する）
        if (sleepTime) {
            const nowTimeStamp = Date.now();
            if (!e.wheelDelta) {
                this.wheelTimeStamp = nowTimeStamp;
                return;
            }

            const deltaTimeStamp = nowTimeStamp - this.wheelTimeStamp;
            if (deltaTimeStamp < sleepTime) {
                return;
            }
            this.wheelTimeStamp = nowTimeStamp;
        }

        // キャンバス座標計算
        let pos = this.calcScaleCoordinates(e);
        let currentScale = this.scale;

        // ポインタ位置を拡大（カメラ位置調整）
        const adjustCamera = () => {
            if (this.scale !== currentScale) {
                // 表示エリアの中央座標
                const rectView = this.ELEMENT.view.getBoundingClientRect();
                const centerX = rectView.width / 2;
                const centerY = rectView.height / 2;

                // ポインタ座標が原点からどれだけ離れているか
                let pointerDX = e.clientX - centerX;
                let pointerDY = e.clientY - centerY - rectView.top;

                // キャンバス座標が原点からどれだけ離れているか（ポインタがキャンバス外の場合はキャンバス内に補正）
                let canvasX = adjustInRange(pos.x, 0, this.x_size - 1);
                let canvasDX = (canvasX - this.x_size / 2) * this.scale / 100;
                let canvasY = adjustInRange(pos.y, 0, this.y_size - 1);
                let canvasDY = (canvasY - this.y_size / 2) * this.scale / 100;

                // 新しいカメラ位置
                let cameraX = (canvasDX - pointerDX) * 100 / this.scale;
                let cameraY = (canvasDY - pointerDY) * 100 / this.scale;
                this.cameraX = cameraX;
                this.cameraY = cameraY;
                //console.log('cameraX:', pointerDX, canvasDX, cameraX);
                //console.log('cameraY:', pointerDY, canvasDY, cameraY);
            }
        };
        switch (this.config('axp_config_form_mouseWheelRotate')) {
            case 'none':
                break;
            case 'loupe':
                // 拡大／縮小
                if (deltaY < 0) { //奥回転
                    this.zoomOutCanvas();
                }
                if (deltaY > 0) { //手前回転
                    this.zoomInCanvas();
                }
                // ポインタ位置を拡大
                if (document.getElementById('axp_config_checkbox_mouseWheelPointerTracking').checked) {
                    adjustCamera();
                }
                // 拡大率：%1
                this.msg('@AXP0001', this.scale);
                this.refreshCanvas();
                // ペンカーソル表示
                if (e.target.id === this.CANVAS.main.id || e.target.id === this.ELEMENT.view.id) {
                    this.penSystem.penObj[this.penSystem.pen_mode].drawCursor(e);
                }
                break;
            case 'scroll':
                // スクロール（スクロール移動量に設定されている値を加減算）
                const move_size = Number(document.getElementById('axp_config_number_mouseWheelMoveSize').value);
                if (deltaY < 0) { //奥回転
                    this.moveCanvas(0, move_size);
                }
                if (deltaY > 0) { //手前回転
                    this.moveCanvas(0, -move_size);
                }
                if (deltaX < 0) {
                    this.moveCanvas(move_size, 0);
                }
                if (deltaX > 0) {
                    this.moveCanvas(-move_size, 0);
                }
                break;
        }
    }
    setCanvasSize(x_size, y_size) {
        let x = Number(x_size);
        let y = Number(y_size);
        if (isNaN(x)) {
            x = this.CONST.CANVAS_X_DEFAULT;
        } else {
            if (x < this.CONST.CANVAS_X_MIN) x = this.CONST.CANVAS_X_MIN;
            if (x > this.CONST.CANVAS_X_MAX) x = this.CONST.CANVAS_X_MAX;
        }
        if (isNaN(y)) {
            y = this.CONST.CANVAS_Y_DEFAULT;
        } else {
            if (y < this.CONST.CANVAS_Y_MIN) y = this.CONST.CANVAS_Y_MIN;
            if (y > this.CONST.CANVAS_Y_MAX) y = this.CONST.CANVAS_Y_MAX;
        }
        this.x_size = x;
        this.y_size = y;
        console.log(`キャンバスサイズ更新:${x} x ${y}`);
    }
    checkCanvasSize_x(x_size) {
        let x = Number(x_size);
        if (x < this.CONST.CANVAS_X_MIN) x = this.CONST.CANVAS_X_MIN;
        if (x > this.CONST.CANVAS_X_MAX) x = this.CONST.CANVAS_X_MAX;
        return x;
    }
    checkCanvasSize_y(y_size) {
        let y = Number(y_size);
        if (y < this.CONST.CANVAS_Y_MIN) y = this.CONST.CANVAS_Y_MIN;
        if (y > this.CONST.CANVAS_Y_MAX) y = this.CONST.CANVAS_Y_MAX;
        return y;
    }
    getCanvasSize_X() {
        return this.x_size;
    }
    getCanvasSize_Y() {
        return this.y_size;
    }
    // 投稿タブのキャンバスの描画（ブラウザタブ切り替え時の再描画にも使用する）
    drawPostCanvas() {
        let isTrans = this.assistToolSystem.getIsTransparent();
        if (isTrans) {
            // 画像
            this.postSystem.CANVAS.post_ctx.clearRect(0, 0, this.x_size, this.y_size);
            this.postSystem.CANVAS.post_ctx.drawImage(this.layerSystem.CANVAS.backscreen_trans, 0, 0);
            // サムネ
            this.postSystem.CANVAS.thumbnail_ctx.clearRect(0, 0, this.postSystem.CANVAS.thumbnail.width, this.postSystem.CANVAS.thumbnail.height);
            this.postSystem.CANVAS.thumbnail_ctx.drawImage(
                this.layerSystem.CANVAS.backscreen_trans,
                0,
                0,
                this.postSystem.CANVAS.thumbnail.width,
                this.postSystem.CANVAS.thumbnail.height);
        } else {
            // 画像
            this.postSystem.CANVAS.post_ctx.drawImage(this.layerSystem.CANVAS.backscreen_white, 0, 0);
            // サムネ
            this.postSystem.CANVAS.thumbnail_ctx.fillStyle = '#ffffff';
            this.postSystem.CANVAS.thumbnail_ctx.fillRect(0, 0, this.postSystem.CANVAS.thumbnail.width, this.postSystem.CANVAS.thumbnail.height);
            this.postSystem.CANVAS.thumbnail_ctx.drawImage(
                this.layerSystem.CANVAS.backscreen_white,
                0,
                0,
                this.postSystem.CANVAS.thumbnail.width,
                this.postSystem.CANVAS.thumbnail.height);
        }
    }
    /**
     * 指定の番号のタブに切り替える
     * @param {String} idx タブの番号 '0':キャンバス,'1':設定,'2':投稿,'3':拡張機能
     */
    selectTab(idx) {
        // 起動オプションで登録されている拡張機能
        if (idx == '3') {
            // link設定の時は処理しない
            if (this.expansionTab.link) {
                return;
            }
            // function設定の時、正しく関数定義されていない場合はエラー
            if (!this.expansionTab.function) {
                alert('ユーザー拡張機能のプログラムが正しく設定されていません。');
                return;
            };
            // ユーザー定義されたファンクションを呼び出す
            this.expansionTab.function();
            return;
        }

        // 起動オプションで投稿が禁止されている場合は、投稿タブ選択不可
        if (idx == '2') {
            if (this.restrictPost) {
                alert('投稿先掲示板が指定されていないため、投稿することができません。');
                return;
            }
            if (!this.FUNCTION.post) {
                alert('投稿用プログラムが正しく設定されていないため、投稿することができません。');
                return;
            };
        }

        // 全タブの選択状態解除
        var targetElements_tab = document.querySelectorAll('#axp_main_div_tab > div > div');
        targetElements_tab.forEach(element => {
            if (element.dataset.idx === idx) {
                // idxで指定されたタブを選択状態
                element.dataset.selected = 'true';
            } else {
                // それ以外は選択解除
                element.dataset.selected = 'false';
            }
        });

        var targetElements_article = document.querySelectorAll('#axp_main_div_tabContent > article');
        targetElements_article.forEach(element => {
            element.style.display = 'none';
        });
        targetElements_article[Number(idx)].style.display = 'flex';

        switch (idx) {
            // キャンバス
            case '0':
                this.isCanvasOpen = true;
                // 最小化アイコンの位置更新
                this.dragWindow.updateIconPosition();
                // 最小化アイコンアニメ停止
                this.stopIconAnime();
                break;
            // 設定
            case '1':
                this.isCanvasOpen = false;
                // 設定タブ内のカラーパレット表示更新
                this.configSystem.dispPalettebox(document.getElementById('axp_config_div_paletteBox'), this.colorPaletteSystem.currentPalette);
                break;
            // 投稿
            case '2':
                this.isCanvasOpen = false;
                // 投稿タブ内の情報更新
                let isTrans = this.assistToolSystem.getIsTransparent();
                document.getElementById('axp_post_span_transparent').textContent = isTrans ? 'する' : 'しない';
                this.drawPostCanvas();

                // ボタン表示初期化（お絵カキコする！）
                document.getElementById("axp_post_button_upload").textContent = document.getElementById("axp_post_button_upload").dataset.buttontext;
                document.getElementById("axp_post_button_upload").disabled = false;

                // 基にしてお絵カキコ
                let elemRef = document.getElementById('axp_post_span_referenceOekakiType');
                let elemRefId = document.getElementById('axp_post_a_referenceOekakiId');
                if (this.oekaki_id !== null) {
                    elemRef.textContent = 'もとの絵あるよ';
                    elemRefId.textContent = this.oekaki_id + '.png';
                    elemRefId.href = this.oekakiURL + this.oekaki_id + '.png';
                } else {
                    elemRef.textContent = 'なし（いちから描いた）';
                    elemRefId.textContent = '';
                    elemRefId.href = '';
                }
                break;
        }
        //console.log('main select:', idx, this.isCanvasOpen);
    }
    // 選択されているタブのindexを取得
    get selectedTab() {
        let result = null;
        const targetElements_tab = document.querySelectorAll('#axp_main_div_tab > div > div');
        for (let element of targetElements_tab) {
            if (element.dataset.selected === 'true') {
                result = element.dataset.idx;
                break;
            }
        }
        return result;
    }
    // キャンバス移動
    moveCanvas(dx, dy) {
        this.cameraX += -dx;
        this.cameraY += -dy;
        this.refreshCanvas();
    }
    // タスク呼び出し（キーボードショートカット、カスタムボタン）
    callTask(id, inkey, repeat = false, code = null) {
        // キーカスタマイズ情報を記憶している設定メニューの要素の取得
        const elem = document.getElementById(id);
        if (!elem) {
            // 要素が存在しないキー（対応していないキー）は無効
            console.log('無効なキー:', id);
            return;
        }
        const selectMain = elem.querySelector('select:nth-of-type(1)');
        const inputSizeValue = elem.querySelector('.axpc_config_number_sizeValue');
        const inputScaleValue = elem.querySelector('.axpc_config_number_scaleValue');

        // リピート判定
        if (repeat) {
            if (
                selectMain.value === 'func_scroll_up' ||
                selectMain.value === 'func_scroll_down' ||
                selectMain.value === 'func_scroll_left' ||
                selectMain.value === 'func_scroll_right'
            ) {
                // 上記の機能は、押しっぱなし入力を受け付ける
            } else {
                // その他の機能は、押しっぱなし状態のとき、それ以上は処理しない
                return;
            }
        }

        // 割り当てられている機能を実行
        switch (selectMain.value) {
            case 'func_loupe':
                // 拡大率
                this.setScale(Number(inputScaleValue.value));
                break;
            case 'func_size':
                // ペンの太さ
                this.penSystem.setPenSize(Number(inputSizeValue.value));
                break;
            case 'none':
                // 機能無し
                // [%1]キーには機能が割り当てられていません。（※設定で変更可能）
                this.msg('@CAU0002', inkey);
                break;
            default:
                console.log('カスタマイズTask呼び出し:', selectMain.value);
                // その他の機能
                this.TASK[selectMain.value](inkey, code);
                break;
        }
    }
    initTask() {
        // キャンバスの拡大率
        this.TASK['func_loupe_down'] = () => {
            this.zoomOutCanvas();
            // 拡大率：%1
            this.msg('@AXP0001', this.scale);
            this.refreshCanvas();
        }

        this.TASK['func_loupe_up'] = () => {
            this.zoomInCanvas();
            // 拡大率：%1
            this.msg('@AXP0001', this.scale);
            this.refreshCanvas();
        }

        this.TASK['func_loupe_reset'] = () => {
            this.zoomReset();
            // 拡大率とキャンバスの位置をリセットしました。
            this.msg('@INF0002');
            this.refreshCanvas();
        }

        // ペンツール選択
        const switchPenMain = (id, inkey) => {
            const element = document.getElementById(id);
            this.penSystem.switchMainButton(element, inkey);
            this.msg(
                element.dataset.msg,
                element.dataset.key ? `${element.dataset.key}:` : '',
                // サブボタンのメッセージIDの文章を取得し、先頭の%1を除外する
                Message.getMessage(element.dataset.addmsg).slice(2),
            );
        }
        this.TASK['func_switch_pen'] = (inkey) => {
            switchPenMain('axp_pen_button_penBase', inkey);
        }
        this.TASK['func_switch_eraser'] = (inkey) => {
            switchPenMain('axp_pen_button_eraserBase', inkey);
        }
        this.TASK['func_switch_fill'] = (inkey) => {
            switchPenMain('axp_pen_button_fillBase', inkey);
        }
        this.TASK['func_switch_hand'] = (inkey) => {
            switchPenMain('axp_pen_button_handBase', inkey);
        }
        this.TASK['func_switch_spuit'] = (inkey) => {
            switchPenMain('axp_pen_button_spuitBase', inkey);
        }
        this.TASK['func_switch_toggle'] = (inkey) => {
            const isNotPen = document.getElementById('axp_pen_button_penBase').dataset.selected !== 'true';
            // ペン以外が選択されている時はペンに、ペンが選択されているときは消しゴムに切り替え
            if (isNotPen) {
                this.penSystem.switchMainButton(document.getElementById('axp_pen_button_penBase'), inkey);
            } else {
                this.penSystem.switchMainButton(document.getElementById('axp_pen_button_eraserBase'), inkey);
            }
            let shortcut = '';
            const key = this.configSystem.getShortcutFunction('func_switch_toggle');
            if (key) {
                shortcut = `${key}:`;
            }
            // @AXP0010,%1ペン／消しゴム切替(%2)
            this.msg('@AXP0010', shortcut, isNotPen ? 'ペン' : '消しゴム');
        }

        // 種別選択
        const switchPenSub = (id) => {
            const element = document.getElementById(id);
            this.penSystem.switchSubButton(element);
            this.msg(
                element.dataset.msg,
                element.dataset.key ? `${element.dataset.key}:` : '',
            );
        }
        this.TASK['func_switch_axp_penmode_round'] = () => {
            switchPenSub('axp_penmode_round');
        }
        this.TASK['func_switch_axp_penmode_square'] = () => {
            switchPenSub('axp_penmode_square');
        }
        this.TASK['func_switch_axp_penmode_dot'] = () => {
            switchPenSub('axp_penmode_dot');
        }
        this.TASK['func_switch_axp_penmode_fude'] = () => {
            switchPenSub('axp_penmode_fude');
        }
        this.TASK['func_switch_axp_penmode_crayon'] = () => {
            switchPenSub('axp_penmode_crayon');
        }
        this.TASK['func_switch_axp_penmode_brush'] = () => {
            switchPenSub('axp_penmode_brush');
        }
        this.TASK['func_switch_axp_penmode_eraser_round'] = () => {
            switchPenSub('axp_penmode_eraser_round');
        }
        this.TASK['func_switch_axp_penmode_eraser_dot'] = () => {
            switchPenSub('axp_penmode_eraser_dot');
        }
        this.TASK['func_switch_axp_penmode_fill'] = () => {
            switchPenSub('axp_penmode_fill');
        }
        this.TASK['func_switch_axp_penmode_fillgradation'] = () => {
            switchPenSub('axp_penmode_fillgradation');
        }
        this.TASK['func_switch_axp_penmode_hand'] = () => {
            switchPenSub('axp_penmode_hand');
        }
        this.TASK['func_switch_axp_penmode_move'] = () => {
            switchPenSub('axp_penmode_move');
        }

        // アンドゥ
        this.TASK['func_undo'] = () => {
            this.undoSystem.undo();
        }
        // リドゥ
        this.TASK['func_redo'] = () => {
            this.undoSystem.redo();
        }
        // 自動保存から復元
        this.TASK['func_restore'] = () => {
            this.saveSystem.restore();
        }
        // セーブ
        this.TASK['func_save'] = () => {
            this.saveSystem.save();
        }
        // ロード
        this.TASK['func_load'] = () => {
            this.saveSystem.load();
        }
        // 左右反転
        this.TASK['func_flip_h'] = () => {
            this.assistToolSystem.flip_h();
        }
        // 上下反転
        this.TASK['func_flip_v'] = () => {
            this.assistToolSystem.flip_v();
        }
        // 背景透過
        this.TASK['func_transparent'] = () => {
            this.assistToolSystem.transparent();
        }
        // 補助線
        this.TASK['func_grid'] = () => {
            this.assistToolSystem.grid();
        }
        // ツールウィンドウ位置の初期化
        this.TASK['func_init_window_positon'] = () => {
            this.dragWindow.resetPosition();
            // ツールウィンドウの位置を初期化しました。
            this.msg('@INF0003');
        }
        // 背景タイル表示（キーボードショートカット専用）
        this.TASK['func_backgroundimage'] = () => {
            this.isBackgroundimage = !this.isBackgroundimage;
            if (this.isBackgroundimage) {
                this.url_backgroundimage = this.layerSystem.CANVAS.backscreen_white.toDataURL("image/png");
                this.ELEMENT.view.style.backgroundImage = "url(" + this.url_backgroundimage + ")";
            } else {
                this.ELEMENT.view.style.backgroundImage = null;
            }
            // ガイド
            var msgtext = this.isBackgroundimage ? "表示" : "非表示";
            // 背景のタイルプレビューを切り替えました。（現在の状態:%1）
            this.msg('@INF0005', msgtext);
        }

        // 画像をpngファイルとしてダウンロード
        this.TASK['func_download'] = () => {
            this.layerSystem.downloadImage();
        }

        // メインカラーを選択
        this.TASK['func_switch_maincolor'] = () => {
            this.colorMakerSystem.selectMainColor();
        }
        // サブカラーを選択
        this.TASK['func_switch_subcolor'] = () => {
            this.colorMakerSystem.selectSubColor();
        }
        // 透明色を選択
        this.TASK['func_switch_transparent'] = () => {
            this.colorMakerSystem.selectTransparent();
        }

        // メインとサブの色をスワップ
        this.TASK['func_swap_maincolor'] = () => {
            this.colorMakerSystem.swap_maincolor();
        }

        // 透明色とメインカラーを切替
        this.TASK['func_swap_transparent'] = () => {
            this.colorMakerSystem.swap_transparent();
        }

        // レイヤーの新規作成
        this.TASK['func_layer_create'] = () => {
            this.layerSystem.buttonCreateLayer()
        }
        // レイヤーの統合
        this.TASK['func_layer_integrate'] = () => {
            this.layerSystem.buttonIntegrateLayer()
        }
        // レイヤーのコピー
        this.TASK['func_layer_copy'] = () => {
            this.layerSystem.buttonCopyLayer()
        }
        // レイヤーの削除
        this.TASK['func_layer_delete'] = () => {
            this.layerSystem.buttonDeleteLayer()
        }
        // レイヤーのクリア
        this.TASK['func_layer_clear'] = () => {
            this.layerSystem.buttonClearLayer()
        }

        // キャンバス全塗り潰し
        this.TASK['func_fill_all'] = () => {
            // 書き込み不可状態チェック
            if (this.layerSystem.isWriteProtection()) {
                let layerName = this.layerSystem.getName();
                let reasonText = this.layerSystem.getReasonTextForWriteProtection();
                // %1が%2のため、全面塗り潰しできません。
                this.msg('@CAU0003', layerName, reasonText);
                return;
            }
            // ペンモードのチェック（ペンまたは消しゴム以外のときは、不透明度が参照できないため処理しない）
            switch (this.penSystem.getType()) {
                case 'draw':
                case 'eraser':
                case 'fill':
                    break;
                default:
                    // 全面塗り潰しを使用する際は、ペン、消しゴム、バケツのいずれかを選択した状態にしてください。
                    this.msg('@CAU0004');
                    return
            }
            this.penSystem.fillAll();
            let layerName = this.layerSystem.getName();
            // %1を全面塗り潰ししました。
            this.msg('@INF0006', layerName);
        }

        // 90°回転
        this.TASK['func_rotate'] = () => {
            // 書き込み不可状態チェック
            if (this.layerSystem.isWriteProtection()) {
                let layerName = this.layerSystem.getName();
                let reasonText = this.layerSystem.getReasonTextForWriteProtection();
                // %1が%2のため、90°回転できません。
                this.msg('@CAU0005', layerName, reasonText);
                return;
            }
            this.penSystem.rotate90();
            let layerName = this.layerSystem.getName();
            // %1を90°回転しました。
            this.msg('@INF0007', layerName);
        }
        // ペンの太さを１段階下げる
        this.TASK['func_size_down'] = () => {
            this.penSystem.downPenSize();
        }
        // ペンの太さを１段階上げる
        this.TASK['func_size_up'] = () => {
            this.penSystem.upPenSize();
        }
        // ペンの不透明度を１段階下げる
        this.TASK['func_alpha_down'] = () => {
            this.penSystem.changePenAlpha('down');
        }
        // ペンの不透明度を１段階上げる
        this.TASK['func_alpha_up'] = () => {
            this.penSystem.changePenAlpha('up');
        }

        // キャンバス全体のぼかしの切り替え
        this.TASK['func_swap_pixelated'] = () => {
            const radioForm = document.getElementById('axp_config_form_antialiasing');
            const isTurnON = this.config('axp_config_form_antialiasing') !== 'on';
            if (isTurnON) {
                radioForm.elements[1].checked = true;
            } else {
                radioForm.elements[0].checked = true;
            }
            // 状態変更
            this.configSystem.set_canvas_antialiasing();
            // コンフィグ保存
            this.configSystem.saveConfig(`RADIO_axp_config_form_antialiasing`, isTurnON ? 'on' : 'off');
            // キャンバス全体のぼかしを切り替えました。(現在の状態:%1)
            this.msg('@INF0009', isTurnON ? 'あり' : 'なし');
        }

        const func_scroll = (x, y) => {
            const move_size = Number(document.getElementById('axp_config_number_moveSize').value);
            // 方向（設定で反転がチェックされている場合、移動方向を反転させる）
            const move_vector = document.getElementById('axp_config_checkbox_moveDirection').checked ? -1 : 1;
            this.moveCanvas(
                x * move_size * move_vector,
                y * move_size * move_vector
            );
        }
        // 画面の上スクロール
        this.TASK['func_scroll_up'] = () => {
            func_scroll(0, 1);
        }
        // 画面の下スクロール
        this.TASK['func_scroll_down'] = () => {
            func_scroll(0, -1);
        }
        // 画面の左スクロール
        this.TASK['func_scroll_left'] = () => {
            func_scroll(1, 0);
        }
        // 画面の右スクロール
        this.TASK['func_scroll_right'] = () => {
            func_scroll(-1, 0);
        }

        const func_grid = (inkey) => {
            // 補助線分割数
            if (this.assistToolSystem.isGrid) {
                let div_h = document.getElementById('axp_tool_form_gridH').volume.value;
                let div_v = document.getElementById('axp_tool_form_gridV').volume.value;
                switch (inkey) {
                    // 縦
                    case 'up_v':
                        if (div_v < 16) div_v++;
                        // 連動
                        if (document.getElementById('axp_tool_checkbox_gridVHLink').checked) {
                            div_h = div_v;
                        }
                        break;
                    case 'down_v':
                        if (div_v > 2) div_v--;
                        // 連動
                        if (document.getElementById('axp_tool_checkbox_gridVHLink').checked) {
                            div_h = div_v;
                        }
                        break;
                    // 横
                    case 'up_h':
                        if (div_h < 16) div_h++;
                        // 連動
                        if (document.getElementById('axp_tool_checkbox_gridVHLink').checked) {
                            div_v = div_h;
                        }
                        break;
                    case 'down_h':
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
                this.updateGrid();
                // コンフィグ保存
                this.configSystem.saveConfig('RANGE_axp_tool_form_gridH', div_h);
                this.configSystem.saveConfig('RANGE_axp_tool_form_gridV', div_v);
                // 補助線分割数 横：%1 / 縦：%2
                this.msg('@AXP0004', div_h, div_v);
            } else {
                // 補助線が表示されているときに有効なショートカットです。
                this.msg('@CAU0206');
            }
        }
        // 分割数:横を増やす
        this.TASK['func_grid_up_h'] = () => {
            func_grid('up_h');
        }
        // 分割数:横を減らす
        this.TASK['func_grid_down_h'] = () => {
            func_grid('down_h');
        }
        // 分割数:縦を増やす
        this.TASK['func_grid_up_v'] = () => {
            func_grid('up_v');
        }
        // 分割数:縦を減らす
        this.TASK['func_grid_down_v'] = () => {
            func_grid('down_v');
        }

        // ペンの太さ調整
        this.TASK['func_size_change'] = (inkey, code) => {
            if (!inkey) {
                throw new Error('内部エラー：引数にキーが指定されていません（キーボード専用機能です）');
            }
            this.penSystem.modeChangeSizeOn(inkey, code);
        }

    }
    // 表示系メソッド
    /**
     * 画面下部のメッセージエリアに引数で指定されたIDに対応するメッセージテキストを表示する。
     * IDの種類に応じてアイコンを表示する
     * INF:information
     * CAU:caution
     * COL:colormaker
     * ERR:ng
     * @param {String} text 表示するメッセージID（または文字列）
     * @param {String} addText 任意の数の追加テキスト。元メッセージの%nの部分を追加テキストで順番に置換する。
     */
    msg(text, ...addText) {
        let msgType = text.substring(0, 4);
        // 重要なメッセージ
        let isImportantMessage = false;
        switch (msgType) {
            case '@INF':
            case '@CAU':
            case '@ERR':
                isImportantMessage = true;
                break;
        }
        // 重要なメッセージの表示継続中（タイマー起動中）は、通常メッセージの表示をスキップする。
        if (!isImportantMessage && this.messageTimerID) {
            //console.log('メッセージスキップ:', text);
            return;
        }

        // アイコン表示
        let iconElement = document.getElementById('axp_footer_div_icon');
        iconElement.classList.remove(...iconElement.classList);
        switch (msgType) {
            case '@INF':
                iconElement.classList.add('axpc_icon_msg_information');
                break;
            case '@CAU':
                iconElement.classList.add('axpc_icon_msg_caution');
                break;
            case '@COL':
                iconElement.classList.add('axpc_icon_msg_color');
                break;
            case '@ERR':
                iconElement.classList.add('axpc_icon_msg_ng');
                break;
        }
        let replaceText;
        if (text.substring(0, 1) === '@') {
            const id = text.substring(0, 8);
            //console.log('変換対象のメッセージ', id);
            replaceText = Message.getMessage(id);
        } else {
            replaceText = text;
        }
        // 特殊ワード時のメッセージリダイレクト
        if (replaceText === '%penPreviewGuide') {
            let name = this.penSystem.getName();
            // 描画タイプに対応したメッセージ変動
            switch (this.penSystem.getType()) {
                case 'draw':
                case 'eraser':
                    this.msg('@PEN0201', name);
                    break;
                case 'fill':
                    if (this.penSystem.pen_mode === 'axp_penmode_fillgradation') {
                        this.msg('@PEN0203', name);
                    } else {
                        this.msg('@PEN0202', name);
                    }
                    break;
                case 'spuit':
                    this.msg('@PEN0204');
                    break;
            }
            return;
        }
        // 特殊ワードの置換
        replaceText = replaceText.replace('%drawingColorName', this.colorMakerSystem.drawingColorName);
        replaceText = replaceText.replace('%addPaletteName', this.colorMakerSystem.addPaletteName);

        // 追加テキストの置換
        for (let idx = 0; idx < addText.length; idx++) {
            if (replaceText.indexOf(`%${idx + 1}`) !== -1) {
                //console.log(`%${idx + 1}を置換`);
                replaceText = replaceText.replace(`%${idx + 1}`, addText[idx]);
            }
        }

        // テキスト表示
        this.ELEMENT.info.textContent = replaceText;

        // 重要なメッセージのタイマーセット
        if (isImportantMessage) {
            // タイマーセット
            this.messageTimerID = setTimeout(() => {
                this.messageTimerID = null;
            }, this.CONST.MESSAGE_KEEP_TIME);
        }
    }
    /**
     * 背景タイルプレビューを表示する
     */
    drawBackground() {
        // Firefoxだと更新時にちらつきが発生するため、１つ前の状態の画像と重ねて指定する
        // 新旧の画像で透過状態が異なると、描画に不具合が発生するため、常に白地背景とする。
        let url_newimage = this.layerSystem.CANVAS.backscreen_white.toDataURL("image/png");
        this.ELEMENT.view.style.backgroundImage = "url(" + url_newimage + ")" + ",url(" + this.url_backgroundimage + ")";
        this.url_backgroundimage = url_newimage;
    }
    // GETパラメータ取得
    getURLParms() {
        const url = new URL(window.location.href);
        let params = url.searchParams;
        this.oekaki_id = params.get('oekaki_id');
        this.oekaki_width = params.get('oekaki_width');
        this.oekaki_height = params.get('oekaki_height');

        // 実行環境URL
        console.log('exec_URL:', url.href);
        // メモ: url.href にはGETパラメータが含まれる（url.pathnameには含まれない）
        //console.log('url.origin:', url.origin);
        //console.log('url.pathname:', url.pathname);
        //console.log('url.href:', url.href);
        // 同一掲示板チェックのため、url.pathnameとHTMLの<title>を保存する
        this.post_bbs_pageno = url.pathname;
        this.post_bbs_title = document.getElementsByTagName('title')[0].innerText;

        console.log('url.pathname:', this.post_bbs_pageno);
        console.log('ページタイトル:', this.post_bbs_title);
    }
    exec() {
        //console.log('devicePixelRatio:', window.devicePixelRatio);

        // 各種初期化（非同期処理を含むため、処理順序を厳密にする）
        (async () => {
            this.getURLParms();

            // キャンバスサイズ初期値
            // 起動オプションでデフォルト値が指定されている場合はその値を使う
            if (this.option_width) {
                this.x_size = Number(this.option_width);
            } else {
                this.x_size = this.CONST.CANVAS_X_DEFAULT;
            }
            if (this.option_height) {
                this.y_size = Number(this.option_height);
            } else {
                this.y_size = this.CONST.CANVAS_Y_DEFAULT;
            }

            let isDraftLoaded = false;
            // 基にしてお絵カキコする場合の判定
            if (this.oekaki_id) {
                let imageload_src = this.oekakiURL + this.oekaki_id + '.png';
                // テキスト表示（※初期化前なので、this.msg()はまだ使用できない）
                document.getElementById('axp_footer_div_message').textContent = `[${this.oekaki_id}.png]を読み込みしています...`;
                // 基にしてお絵カキコする画像のロード
                await loadImageWithTimeout(imageload_src, this.oekakiTimeout)
                    .then(image => {
                        // 読み込み成功
                        this.oekaki_base = image;
                        // キャンバス汚染確認（ローカルファイルを読み込ませた場合getImageDataで例外が発生する）
                        // 汚染されたキャンバスは廃棄する
                        const checkTaintCanvas = document.createElement('canvas');
                        const checkTaintCanvas_ctx = checkTaintCanvas.getContext('2d');
                        checkTaintCanvas_ctx.drawImage(this.oekaki_base, 0, 0);
                        checkTaintCanvas_ctx.getImageData(0, 0, 1, 1);
                        // キャンバス情報更新
                        this.x_size = this.oekaki_base.naturalWidth;
                        this.y_size = this.oekaki_base.naturalHeight;
                        this.oekaki_bbs_pageno = this.post_bbs_pageno;
                        this.oekaki_bbs_title = this.post_bbs_title;
                        console.log('基にしてお絵カキコ:', this.x_size, this.y_size, this.oekaki_id);
                        // 下書きロード済
                        isDraftLoaded = true;
                    })
                    .catch(error => {
                        // 画像読み込みエラー
                        console.error(error);
                        alert(`「基にしてお絵カキコする」画像の読み込みに失敗しました。\n新規キャンバスを作成します。\n${error}`);
                        // テキスト表示クリア
                        document.getElementById('axp_footer_div_message').textContent = '';
                        this.oekaki_id = null;
                    });
            } else {
                // 新規描画（通常時）
                // URLパラメータでキャンバスサイズが指定されている場合はその値を優先して使う
                if (this.oekaki_width) {
                    this.x_size = Number(this.oekaki_width);
                }
                if (this.oekaki_height) {
                    this.y_size = Number(this.oekaki_height);
                }
            }

            // キャンバスサイズチェック
            this.setCanvasSize(this.x_size, this.y_size);
            // ここで最終的なキャンバスサイズが確定

            // 起動後に１度だけ行う初期化処理
            this.init();

            // 拡張機能
            if (extensions.isExtenstions) {
                this.exTool = new extensions.ExTool(this);
                this.exTool.init();
            }

            // 設定のHTMLを展開（ユーザー設定を受け取る準備）
            this.configSystem.deployHTML();

            // キャンバス初期化
            this.resetCanvas();

            // DB初期処理(indexedDBは非同期で動作するため、awaitで実行完了を待つ)
            if (await this.saveSystem.initDB()) {
                //console.log('1:コンフィグ読込');
                // ユーザー設定読込
                let result;
                try {
                    result = await this.saveSystem.load_config();
                    if (result) {
                        this.configSystem.restoreConfig(result);
                    }
                } catch (error) {
                    console.log(error);
                    alert('エラー:ユーザー設定の読み込みに失敗しました。デフォルト設定で起動します。');
                }
                //console.log('2:パレット初期化');
                // カラーパレット初期化
                if (this.config('axp_config_form_saveLastPalleteColor') === 'off') {
                    // 設定で、パレット情報初期化が指定されている場合は、パレット情報読込をスキップ
                } else {
                    // ユーザー設定パレット情報読込
                    let result;
                    try {
                        result = await this.saveSystem.load_palette();
                        if (result) {
                            this.colorPaletteSystem.setPaletteArray(result);
                        }
                        // 保存されているパレット情報がない場合は更新しない（デフォルトパレット使用）
                    } catch (error) {
                        console.log(error);
                        alert('エラー:ユーザーパレットの読み込みに失敗しました。デフォルト設定で起動します。');
                    }
                }
            }
            // ユーザー設定の復元が完了した後に行う処理 ------------------------------------------------

            // URLパラメータでキャンバスサイズの指定がされていた場合、補正後のキャンバスサイズを登録する
            if (this.oekaki_width || this.oekaki_height) {
                // キャンバスサイズ履歴への追加と表示更新
                this.configSystem.addCanvasSizeHistory(this.x_size, this.y_size);
                this.configSystem.updateCanvasSizeHistory();
            }

            // 初期レイヤー作成（※合成モード表示の設定があるため、設定復元完了後に行う必要がある）
            this.layerSystem.newLayer();

            // アンドゥ使用可能最大数
            this.undo_max = document.getElementById('axp_config_form_undoMaxValue').result.value;
            //　カスタムボタンツールウィンドウ表示切替
            this.dispCustomButton();
            // 色作成ツールウィンドウ表示切替
            this.colorMakerSystem.updateMakeColorType();
            //console.log('3:パレット作成');
            this.colorPaletteSystem.createPalette();

            // 設定に拡大率テーブルを作成
            this.configSystem.createConfigScaleTable(this.currentScaleTable);
            // キーカスタマイズに拡大率テーブルを反映
            this.configSystem.updateKeyCustomizationScaleTable(this.currentScaleTable);
            // キーカスタマイズの折りたたみ
            this.configSystem.switchNofuncKeytable();
            this.configSystem.updateShortcutMessage();
            // キャンバスぼかし
            this.configSystem.set_canvas_antialiasing();
            // 座標表示
            this.configSystem.set_display_position();
            // 長押しスポイト
            this.configSystem.set_longtap_use();
            // ツールウィンドウ位置初期化
            this.dragWindow.initPosition();
            // 最小化アイコン配置
            this.dragWindow.setMinimizeType();
            // ユーザー設定が復元された後のペンツールの再描画
            this.penSystem.changePenMode();

            // 下書き読込
            if (isDraftLoaded) {
                // 基にしてお絵カキコ
                this.layerSystem.CANVAS.tmp_ctx.drawImage(this.oekaki_base, 0, 0);
                // レイヤー更新
                this.layerSystem.write(this.layerSystem.CANVAS.tmp_ctx.getImageData(0, 0, this.x_size, this.y_size));
                //　[%1.png]を読み込みました。(画像サイズ 横:%2 × 縦:%3)
                this.msg('@INF0050', this.oekaki_id, this.x_size, this.y_size);
            }

            // キャンバス更新
            this.layerSystem.updateCanvas();

            // キャンバス座標センタリング（起動時限定の処理）
            let base_x = this.paintBodyElement.clientWidth;
            let etc_y = 30 + 32;
            let base_y = this.paintBodyElement.clientHeight - etc_y; // ヘッダとフッターのサイズを引く
            let center_x = base_x / 2 - this.x_size / 2;
            let center_y = base_y / 2 - this.y_size / 2;
            this.CANVAS.main.style.left = center_x + 'px';
            this.CANVAS.main.style.top = center_y + 'px';

            // イベント受付開始
            this.startEvent();
            // 拡張機能イベント受付開始
            if (this.exTool) {
                this.exTool.startEvent();
            }
        })();
    }
    stopIconAnime() {
        for (const element of this.toolWindow) {
            element.taskIconElement.classList.remove('axpc_window_minimizeAnime');
            element.windowElement.classList.remove('axpc_window_minimizeAnime');
        };
    }
    config(id) {
        let element = document.getElementById(id);
        if (element) {
            return element.elements[id].value;
        }
        return;
    }
    // カスタムボタンの表示切替
    dispCustomButton() {
        const list = document.querySelectorAll('#axp_config_div_customButtonFunction > select,#axp_config_div_customButtonFunction > input');
        if (this.config('axp_config_form_useCustomButton') === 'on') {
            this.customButtonSystem.windowElement.style.display = '';
            for (const item of list) {
                item.disabled = false;
            }
            document.getElementById('axp_config_div_customButtonFunction').style.opacity = '1';
        } else {
            this.customButtonSystem.windowElement.style.display = 'none';
            for (const item of list) {
                item.disabled = true;
            }
            document.getElementById('axp_config_div_customButtonFunction').style.opacity = '0.5';
        }
    }
    // サブウィンドウクローズ
    closeSubwindow = (id) => {
        this.isModalOpen = false;
        UTIL.hide(id);
    }
    // サブウィンドウオープン
    openSubwindow = (id, baseElement) => {
        this.isModalOpen = true;
        // 非表示だとwindowHeightが取得できないため、先にshowを行う
        UTIL.show(id);
        const elementSubwindow = document.querySelector(`#${id}>div`);
        // キャンバスタブエリア
        const canvasRect = document.getElementById('axp_canvas').getBoundingClientRect();
        // サブウィンドウの高さ
        const windowHeight = elementSubwindow.getBoundingClientRect().height;
        // 押されたボタンの矩形情報
        const baseElementRect = baseElement.getBoundingClientRect();
        let x, y;
        x = baseElementRect.left - canvasRect.left;
        // キャンバスタブエリアのトップ＋キャンバスタブエリアの高さから、baseElement要素のボトム座標を引いた残りが、
        // サブウィンドウの高さ以上ならば、下側にはみ出すことなく表示可能
        if (canvasRect.top + canvasRect.height - baseElementRect.bottom > windowHeight) {
            // 要素の下側
            y = baseElementRect.bottom - canvasRect.top;
        } else {
            // 要素の上側
            y = baseElementRect.top - windowHeight - canvasRect.top;
        }
        elementSubwindow.style.marginLeft = `${x}px`;
        elementSubwindow.style.marginTop = `${y}px`;
    }
    debugStatus() {
        this.debugLog.status(
            this.evCache.length,
            this.fingerCount,
            this.isDrawing, this.isDrawn, this.isDrawCancel,
        );
    }
}
