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
import { FilterSystem } from './window_filter.js';
import { Launcher } from './window_launcher.js';
import { UndoSystem } from './undo.js';
import { ConfigSystem } from './config.js';
import { PostSystem } from './post.js';
import { SaveSystem } from './saveload.js';
import { KeyboardSystem } from './keyboard.js';
import { InteropSystem } from './interop.js';
import { DockSystem } from './dock.js';
import { MobileSystem } from './mobile.js';
import { UTIL, loadImageWithTimeout, calcDistance, adjustInRange, getFileNameFromURL, rotateVector, normalizeDeg180 } from './etc.js';
import { Message } from './message.js';
import { DebugLog } from './debuglog.js';
import { combineSelectionMask, buildSelectionOverlayCanvas, countSelectedPixels } from './selectionutil.js';

// 辞書データ（日本語のみデフォルトでバンドルする）
import dictionaryJSON_ja from '../text/ja.json';

// 拡張機能インポート
import * as extensions from '@extensions';

export class AXPObj {
    // AXNOS Paint全体で使用する定数。（システム単位で完全に独立している定数は、システム毎に定義する）
    CONST = {
        APP_TITLE: 'AXNOS Paint あいもげカスタム',
        MIN_SYSTEM_WIDTH: 8,
        MIN_SYSTEM_HEIGHT: 8,
        MAX_SYSTEM_WIDTH: 1000,
        MAX_SYSTEM_HEIGHT: 1000,
        CANVAS_X_MAX: 600,
        CANVAS_Y_MAX: 600,
        CANVAS_X_MIN: 8,
        CANVAS_Y_MIN: 8,
        CANVAS_X_DEFAULT: 317,
        CANVAS_Y_DEFAULT: 317,
        // デフォルト背景色（肌色）。起動オプションdefaultColor.sub未指定時のフォールバック（E-1c）
        SKIN_BG_DEFAULT: '#f0e0d6',
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
        // 回転ジェスチャ
        ROTATE_WALL_VELOCITY: 0.18,     // 0/90/180/270°の壁を突破するのに必要な角速度（度/ミリ秒）
        ROTATE_DRAG_SENSITIVITY: 0.5,   // PC回転操作子の左右ドラッグ感度（度/px）
        ROTATE_TWIST_NOISE: 4,          // ネジレ判定に使う速度ベクトルの最小長（px）
        TWIST_HISTORY_LEN: 3,           // 速度ベクトル算出に使うフレーム数
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
    isLineMod = false; // 直線モード修飾キーが押されている
    isALT = false; // ALTが押されている
    isDrawing = false; // 描画中である
    isDrawn = false; // 描画処理が行われた
    isDrawCancel = false; // 描画処理がキャンセルされた
    // pointermove 内で coalesced events をループ処理する際に、最終要素のみ true となるフラグ。
    // 共通描画経路（PenObj.write）はこのフラグを見て、サブフレームイベントでの重い layer 反映を遅延させる。
    lastEventInFrame = true;
    // PenObj.write が lastEventInFrame=false で早期 return した場合に立つフラグ。
    // 最終イベントが stabilizer 等で弾かれた場合でも、pointermove 末尾で確実に commit するための保険。
    pendingPenFlush = false;
    isLine;
    isRect;
    // ----------------------------------------------------
    codeCHANGE_SIZE_KEY = null; // ショートカット「ペンの太さ調整」で押されたキー

    // 選択範囲（マジックワンド／多角形選択、Phase2-6） -----
    // ⚠️ なげなわ（nagenawa.js）の選択とは全く別の概念。なげなわは「切り取って移動・
    // 変形する」フローティングクリップ（canvas/ImageDataベース、Nagenawaインスタンス内に
    // 閉じた状態）だが、こちらは「バケツ塗り（fill.js/fillAll）の適用範囲を制約するだけ」の
    // 軽量なブールマスク（Uint8Array、0=非選択/255=選択、axpObj直下のグローバル状態）。
    // レイヤーのimageデータには一切書き込まない。両者は独立して共存し、互いを
    // 感知・連携しない（なげなわで変形中でも、このselectionMaskは無関係に有効なまま）
    selectionMask = null;
    selectionOverlayCanvas = null; // 可視化用オフスクリーンcanvas（マスク変更時に再生成）
    // ----------------------------------------------------

    // 実行環境系
    ENV = {
        // ブラウザがsafari系か
        multiCanvas: false,
        // 画面幅が狭いデバイスか
        isMobileWidth: false,
        // 初回起動か
        isFirstLaunch: false,
    }

    // AXNOS Paint親要素ID
    paintBodyElement;
    // 使用ブラウザ
    browser;

    // 起動オプションで指定される変数
    checkSameBBS;
    restrictDraftCanvasResizing;
    restrictPost;
    expansionTab;
    option_height;
    option_width;

    // GETパラメーター記憶用
    oekaki_id = null; // 基にするお絵カキコの画像id
    oekaki_width;       // （起動時に指定された）キャンバスの幅
    oekaki_height;      // （起動時に指定された）キャンバスの高さ

    // お絵カキコのpng画像が存在するurl
    oekakiURL;
    oekakiTimeout;
    // 下書き機能画像ファイル名
    draftImageFile;
    // 基にしてお絵カキコ用Image
    oekaki_base;

    post_bbs_pageno;    // 投稿する掲示板のurl.pathname
    post_bbs_title;     // 投稿する掲示板のページタイトル
    // セーブデータの刻印となる情報
    oekaki_bbs_pageno = null; // 基にするお絵カキコの掲示板のページ番号（ロード制限の判定に使用）
    oekaki_bbs_title = null; // 基にするお絵カキコの掲示板のページタイトル（ロード制限時のエラーメッセージ用）

    // 許容するキャンバスサイズ
    minWidth;
    minHeight;
    maxWidth;
    maxHeight;

    // 現在のキャンバスサイズ
    x_size;
    y_size;

    // 背景の地色（肌色/白トグル、E-1c）。skinBackgroundColorは肌色の実値を保持
    backgroundColor;
    skinBackgroundColor;

    // 画像の縦横サイズが異なる時のサムネイルのセンタリング用
    ctx_map_shift_x;
    ctx_map_shift_y;
    scale = 100;

    // カメラ座標（ハンドツールでキャンバスを移動させた差分）
    cameraX = 0;
    cameraY = 0;

    // 回転表示角度（度数、[0,360)。あくまで表示の回転であり画像編集ではない）
    rotation = 0;

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

    // 回転ジェスチャ（ネジレ操作）用
    twistHistA = [];        // 指A(evCache[0])の直近座標履歴（速度ベクトル算出用）
    twistHistB = [];        // 指B(evCache[1])の直近座標履歴
    prevLineAngle = 0;      // 直近フレームのA→B線分角度（度）
    prevGestureTime = 0;    // 角速度算出用のタイムスタンプ
    isTwisting = false;     // ジェスチャ中の回転ロックフラグ

    longPressTimerID = null;
    touchTimerID = null;
    fingerCount = 0;

    // ホイールタイマー
    wheelTimeStamp = Date.now();
    isMouseWheelPanActive = false;
    isMouseWheelPanConsumed = false;
    mouseWheelPanPointerId = null;
    mouseWheelPanStartClientX = 0;
    mouseWheelPanStartClientY = 0;
    mouseWheelPanStartCameraX = 0;
    mouseWheelPanStartCameraY = 0;

    // アンドゥ使用可能最大数
    undo_max;

    // 拡張機能
    exTool = null;

    // 拡大率テーブル
    currentScaleTable = this.CONST.SCALE_VALUE;

    // デバッグモード（デバッグ用）
    debugLog = null;

    // 使用する追加辞書
    additionalDictionaryJSON;

    // 投稿フォームカスタマイズ（デフォルト値）
    postForm = {
        // 投稿フォーム
        input: {
            isDisplay: true,
            // 投稿者名
            strName: {
                isDisplay: true,
                isInputRequired: false,
                maxLength: 32,
                placeholder: '',
            },
            // タイトル
            strTitle: {
                isDisplay: true,
                isInputRequired: false,
                maxLength: 32,
                placeholder: '',
            },
            // 本文
            strMessage: {
                isDisplay: true,
                isInputRequired: false,
                maxLength: 1024,
                placeholder: '',
            },
            // ウォッチリスト登録
            strWatchList: {
                isDisplay: true,
            },
        },
        // 注意事項
        notice: {
            isDisplay: true,
            // 文章はユーザー辞書を使用して書き換えが可能 
        },
    }

    constructor(additionalDictionaryJSON) {
        this.additionalDictionaryJSON = additionalDictionaryJSON;

        // ツールウィンドウシステム
        // 重要：ランチャーを最初に作成する必要あり
        this.toolWindow.push(this.launcher = new Launcher(this));

        // 重要：生成順がランチャーのボタンの順番になる
        this.toolWindow.push(this.penSystem = new PenSystem(this));
        this.toolWindow.push(this.colorMakerSystem = new ColorMakerSystem(this));
        this.toolWindow.push(this.colorPaletteSystem = new ColorPaletteSystem(this));
        this.toolWindow.push(this.layerSystem = new LayerSystem(this));
        this.toolWindow.push(this.assistToolSystem = new AssistToolSystem(this));
        this.toolWindow.push(this.filterSystem = new FilterSystem(this));

        // カスタムボタンは別枠
        this.toolWindow.push(this.customButtonSystem = new CustomButtonSystem(this));

        // サブシステム
        this.keyboardSystem = new KeyboardSystem(this);
        this.undoSystem = new UndoSystem(this);
        this.configSystem = new ConfigSystem(this);
        this.saveSystem = new SaveSystem(this);
        this.postSystem = new PostSystem(this);
        this.interopSystem = new InteropSystem(this);
        this.dockSystem = new DockSystem(this);
        this.mobileSystem = new MobileSystem(this);

        // デフォルト値設定
        this.minWidth = this.CONST.CANVAS_X_MIN;
        this.minHeight = this.CONST.CANVAS_Y_MIN;
        this.maxWidth = this.CONST.CANVAS_X_MAX;
        this.maxHeight = this.CONST.CANVAS_Y_MAX;

    }
    // 単語の辞書変換
    _(preTranslationText) {
        // 追加辞書が使える場合は優先して使う
        if (this.additionalDictionaryJSON) {
            if (preTranslationText in this.additionalDictionaryJSON) {
                return this.additionalDictionaryJSON[preTranslationText];
            }
        }
        // 日本語辞書
        if (preTranslationText in dictionaryJSON_ja) {
            return dictionaryJSON_ja[preTranslationText];
        }
        // 見つからなければ原文を返却
        return preTranslationText;
    }
    // htmlの辞書変換
    translateHTML(preTranslationHTML) {
        // ${で始まり、}で終わる文字列を検索して、置換する
        const resultHTML = preTranslationHTML.replace(/\$\{.*?\}/g, match => {
            // トークン部分だけを抜き出す
            // （例） ${_("@CANVAS")} => @CANVAS
            const token = match.slice(5, -3);
            // トークンを辞書変換
            const transWords = this._(token);
            // 変換チェック用
            // console.log(token, '=>', transWords);
            return transWords;
        });
        return resultHTML;
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
        this.interopSystem.init();

        this.initTask();

        // イベントリスナ設定（機能ボタン）
        const function_buttons = document.querySelectorAll('.axpc_FUNC');
        for (const item of function_buttons) {
            item.addEventListener('click', () => {
                this.TASK[item.dataset.function]();
            });
        }
    }
    // なげなわ変形中の選択内容を確定する（キャンバス全体に影響する操作の前処理用）
    finalizeNagenawaSelection(options = {}) {
        const nagenawa = this.penSystem?.penObj?.['axp_penmode_nagenawa'];
        if (nagenawa && nagenawa.state === 'transforming') {
            return nagenawa.finalizeSelection(options) === true;
        }
        return false;
    }
    // 歪みツールの未確定セッションを確定する（キャンバス全体に影響する操作の前処理用）
    finalizeLiquifySession(options = {}) {
        const liquify = this.penSystem?.penObj?.['axp_penmode_liquify'];
        if (liquify && liquify.session === 'active') {
            return liquify.finalizeLiquifySession(options) === true;
        }
        return false;
    }
    // 選択範囲（マジックワンド／多角形選択）の適用。なげなわの「切り取って移動」とは
    // 独立した、レイヤーのimageデータを一切変更しない範囲情報として保持する
    applySelectionMask(newMask) {
        const mode = document.getElementById('axp_pen_select_selectionMode')?.value || 'option_replace';
        const modeKey = { option_replace: 'replace', option_add: 'add', option_subtract: 'subtract', option_intersect: 'intersect' }[mode] || 'replace';
        const existing = this.getValidSelectionMask();
        const combined = combineSelectionMask(existing, newMask, modeKey, this.x_size, this.y_size);
        // 結果が全画素非選択（例: 差し引き/交差で選択範囲が消滅、色域選択で候補0件）の場合、
        // 「選択されているが何も含まない」という紛らわしい状態にせず、選択解除として扱う
        if (countSelectedPixels(combined) === 0) {
            this.clearSelection();
            return;
        }
        this.setSelectionMask(combined);
    }
    setSelectionMask(mask) {
        this.selectionMask = mask;
        this.selectionOverlayCanvas = buildSelectionOverlayCanvas(mask, this.x_size, this.y_size);
        this._updateSelectionStatusUI();
        this.layerSystem.updateCanvas();
    }
    clearSelection() {
        if (!this.selectionMask) return;
        this.selectionMask = null;
        this.selectionOverlayCanvas = null;
        this._updateSelectionStatusUI();
        this.layerSystem.updateCanvas();
    }
    // 寸法不一致（キャンバスサイズ変更等で無効化された残留マスク）を検知し、
    // 検出時は自動的に選択解除して null を返す（防御的チェック）。
    // 長さ一致だけでは縦横が入れ替わるリサイズ（面積が同一）を検知できないため、
    // オーバーレイキャンバスの width/height も併せて照合する
    getValidSelectionMask() {
        if (!this.selectionMask) return null;
        const dimensionMismatch = this.selectionMask.length !== this.x_size * this.y_size ||
            (this.selectionOverlayCanvas &&
                (this.selectionOverlayCanvas.width !== this.x_size || this.selectionOverlayCanvas.height !== this.y_size));
        if (dimensionMismatch) {
            this.selectionMask = null;
            this.selectionOverlayCanvas = null;
            this._updateSelectionStatusUI();
            return null;
        }
        return this.selectionMask;
    }
    _updateSelectionStatusUI() {
        const elem = document.getElementById('axp_pen_div_selectionStatus');
        if (!elem) return;
        if (this.selectionMask) {
            UTIL.show(elem);
            const countElem = document.getElementById('axp_pen_span_selectionCount');
            if (countElem) countElem.textContent = countSelectedPixels(this.selectionMask);
        } else {
            UTIL.hide(elem);
        }
    }
    applyFirstLaunchWindowMinimize() {
        for (const item of this.dragWindow.windowSystems) {
            if (!item.isCanMinimize) continue;
            this.dragWindow.minimize(item.id);
            this.launcher.minimizeButton(item.id);
            this.configSystem.saveConfig('WDMIN_' + item.id, true);
        }
    }
    // キャンバスの初期化（新規キャンバス、ロード、自動保存から復元時などに行う処理）
    resetCanvas() {
        // なげなわの変形状態が残留していれば破棄する（レイヤーが作り直されるため、
        // 選択内容の確定は各操作の入口の責務。ここでは状態破棄のみ行う）
        this.penSystem?.penObj?.['axp_penmode_nagenawa']?.forceIdle();
        // 多角形選択の途中状態（頂点未確定）も同様に破棄する
        this.penSystem?.penObj?.['axp_penmode_polygonselect']?.forceIdle();
        // 歪みツールの途中ストロークも旧キャンバス寸法を保持するため破棄する
        this.penSystem?.penObj?.['axp_penmode_liquify']?.forceIdle();
        // キャンバス寸法が変わるため、残留した選択範囲は無効化する
        this.selectionMask = null;
        this.selectionOverlayCanvas = null;
        this._updateSelectionStatusUI();
        this.interopSystem?.beforeCanvasReset(this.x_size, this.y_size);
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
        this.interopSystem.syncToCanvas();
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
        this.interopSystem.startEvent();
        this.dockSystem.startEvent();
        this.mobileSystem.startEvent();
        this._guardCanvasChromePointerEvents();

        // a11y: アイコンのみのボタン（テキストラベルを持たない）へ、既存のホバー説明文
        // （data-msg、msg.txt辞書）からaria-labelを自動付与する。スクリーンリーダー利用時に
        // 「名前のないボタン」として読み上げられる問題への対応。全ツールウィンドウの
        // startEvent()完了後（DOM構築完了後）に一括で行う。
        this._assignAriaLabelsFromDataMsg();

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
                    // 回転ジェスチャ用の初期状態（A=evCache[0], B=evCache[1]）
                    this.twistHistA = [{ x: this.evCache[0].clientX, y: this.evCache[0].clientY }];
                    this.twistHistB = [{ x: this.evCache[1].clientX, y: this.evCache[1].clientY }];
                    this.prevLineAngle = Math.atan2(
                        this.evCache[1].clientY - this.evCache[0].clientY,
                        this.evCache[1].clientX - this.evCache[0].clientX
                    ) * 180 / Math.PI;
                    this.prevGestureTime = e.timeStamp;
                    this.isTwisting = false;
                };
            }

            let mode = this.penSystem.getPenMode();
            // プライマリーポインタ
            if (e.isPrimary) {
                // メッセージリセット
                //this.msg('');
                if (e.pointerType === 'mouse' && (e.button === 1 || e.buttons === 4)) {
                    e.preventDefault();
                    this.beginMouseWheelPan(e);
                    return;
                }
                //右ボタンまたはホイールボタンに割り当てられた機能を実行
                if (e.buttons === 2) {
                    // OS本来の操作を抑止
                    e.preventDefault();
                    const buttonTask = this.runMouseButtonTask(this.config('axp_config_form_mouseRightButton'), e);
                    if (buttonTask.mode) {
                        mode = buttonTask.mode;
                    }
                    if (buttonTask.optionTask) {
                        option.task = buttonTask.optionTask;
                    }
                    // ハンド以外の場合、ここで処理終了
                    if (!buttonTask.continueInput) return;
                }

                // 入力座標記録
                this.baseClientX = e.clientX;
                this.baseClientY = e.clientY;

                if (this.config('axp_config_form_touchDrawType') === 'none' && e.pointerType === 'touch') {
                    // タッチ無効時は描画しない
                } else if (this.layerSystem.maskEditMode
                    && (e.target === this.CANVAS.main || e.target === this.ELEMENT.view)) {
                    // 透明マスク編集モード中は専用のマスクブラシへ委譲する（キャンバス内のみ対象）。
                    // タッチジェスチャ判定（evCache等）はここより前段の共通処理で既に完了しているため、
                    // ここで分岐しても多指ジェスチャの追跡は壊れない
                    this.layerSystem.maskBrushStart(pos.x, pos.y);
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

                // 長押しスポイトが有効の時、タイマーセット。
                // 透明マスク編集モード中は対象外（マスクブラシは通常の描画パイプラインを
                // 経由しないため、長押し後のスポイト発火・自動ペン切替えは意図しない
                // 副作用になる）
                if (this.config('axp_config_form_useLongtap') === 'on' && !this.layerSystem.maskEditMode) {
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

            if (this.isMouseWheelPanActive && (e.buttons & 4)) {
                e.preventDefault();
                this.moveMouseWheelPan(e);
                return;
            }

            // 透明マスク編集モード中はマスクブラシへ委譲する（通常の描画パイプラインと同様、
            // キャンバス内のポインタ操作のみを対象とし、それ以外はホバー表示等の既存処理に委ねる）
            if (this.layerSystem.maskEditMode && e.isPrimary
                && (e.target === this.CANVAS.main || e.target === this.ELEMENT.view)) {
                const maskPos = this.calcScaleCoordinates(e);
                this.layerSystem.maskBrushMove(maskPos.x, maskPos.y);
                return;
            }

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
                // フレーム落ち時の中間点欠落を防ぐため、coalescedEvents があれば全て処理する
                // （フレーム落ちが起きないライト負荷時は要素1つのみとなり挙動は従来と同等）
                let coalescedEvents = null;
                if (typeof e.getCoalescedEvents === 'function') {
                    try {
                        coalescedEvents = e.getCoalescedEvents();
                    } catch {
                        coalescedEvents = null;
                    }
                }
                if (coalescedEvents && coalescedEvents.length > 1) {
                    // 最終イベントだけ lastEventInFrame=true にして共通描画経路で layer 反映を行う。
                    // 中間イベントは入力点の蓄積とブラシ path 累積のみ行い、重い getImageData は行わない。
                    const last = coalescedEvents.length - 1;
                    for (let i = 0; i <= last; i++) {
                        const ce = coalescedEvents[i];
                        const cpos = this.calcScaleCoordinates(ce);
                        this.lastEventInFrame = (i === last);
                        this.penSystem.move(cpos.x, cpos.y, ce);
                    }
                } else {
                    this.lastEventInFrame = true;
                    this.penSystem.move(pos.x, pos.y, e);
                }
                // 最終イベントが stabilizer フィルタなどで早期 return された場合、
                // 中間イベントで遅延された write() が commit されないままになる。
                // pendingPenFlush が立っていれば、ここで強制 flush して 1 pointermove に必ず 1 回は commit する。
                if (this.pendingPenFlush && this.isDrawing && !this.isDrawCancel && this.penSystem.exec_pen_mode) {
                    const pen = this.penSystem.penObj[this.penSystem.exec_pen_mode];
                    if (pen && typeof pen.write === 'function') {
                        this.lastEventInFrame = true;
                        pen.write();
                    }
                }
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
                            // 現在のA→B線分角度（度）
                            const ax = this.evCache[0].clientX, ay = this.evCache[0].clientY;
                            const bx = this.evCache[1].clientX, by = this.evCache[1].clientY;
                            const lineAngle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
                            // 各指の座標履歴を更新（速度ベクトル算出用）
                            this.twistHistA.push({ x: ax, y: ay });
                            if (this.twistHistA.length > this.CONST.TWIST_HISTORY_LEN) this.twistHistA.shift();
                            this.twistHistB.push({ x: bx, y: by });
                            if (this.twistHistB.length > this.CONST.TWIST_HISTORY_LEN) this.twistHistB.shift();
                            // ネジレ判定（一度ネジレと判定したらジェスチャ終了まで維持）
                            if (!this.isTwisting && this.twistHistA.length >= this.CONST.TWIST_HISTORY_LEN) {
                                // 直近数フレームの速度ベクトル（累積変位ではなくフレーム間差分）
                                const oldA = this.twistHistA[0], oldB = this.twistHistB[0];
                                const vax = ax - oldA.x, vay = ay - oldA.y;
                                const vbx = bx - oldB.x, vby = by - oldB.y;
                                const lenA = Math.sqrt(vax * vax + vay * vay);
                                const lenB = Math.sqrt(vbx * vbx + vby * vby);
                                if (lenA >= this.CONST.ROTATE_TWIST_NOISE && lenB >= this.CONST.ROTATE_TWIST_NOISE) {
                                    // 線分方向θに対する各点の移動方向の相対角
                                    const relA = normalizeDeg180(Math.atan2(vay, vax) * 180 / Math.PI - lineAngle);
                                    const relB = normalizeDeg180(Math.atan2(vby, vbx) * 180 / Math.PI - lineAngle);
                                    const inPos = (v) => v >= 45 && v <= 135;
                                    const inNeg = (v) => v >= -135 && v <= -45;
                                    if ((inPos(relA) && inNeg(relB)) || (inPos(relB) && inNeg(relA))) {
                                        this.isTwisting = true;
                                    }
                                }
                            }
                            if (this.isTwisting) {
                                // ネジレ操作中：拡縮・パンをキャンセルし回転のみ適用
                                const deltaLine = normalizeDeg180(lineAngle - this.prevLineAngle);
                                const dt = e.timeStamp - this.prevGestureTime;
                                this.applyRotationDelta(deltaLine, dt);
                            } else {
                                // ピンチによる拡大／縮小
                                if (this.config('axp_config_form_touchZoom') === 'on') {
                                    // 拡大率（初期値）に差分を加算する（指定可能範囲を超える場合は補正する）
                                    this.scale = adjustInRange(this.baseScale + diffDistance, this.CONST.SCALE_MIN, this.CONST.SCALE_MAX);
                                };
                                // カメラ位置移動
                                if (this.config('axp_config_form_touchHand') === 'on') {
                                    // 画面上のドラッグ差分を -rotation だけ回し、カメラ（非回転）座標系へ変換
                                    const r = rotateVector(diffX, diffY, -this.rotation * Math.PI / 180);
                                    this.cameraX = Math.round(this.baseCameraX + (r.x * 100 / this.scale));
                                    this.cameraY = Math.round(this.baseCameraY + (r.y * 100 / this.scale));
                                };
                                // キャンバス表示更新
                                this.refreshCanvas();
                            }
                            // 角速度算出のため毎フレーム更新
                            this.prevLineAngle = lineAngle;
                            this.prevGestureTime = e.timeStamp;
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
                // 2点未満になったらネジレ回転ロックを解除
                if (this.evCache.length < 2) {
                    this.isTwisting = false;
                    this.twistHistA = [];
                    this.twistHistB = [];
                }
            }
            if (this.endMouseWheelPan(e, { runClickTask: false })) {
                return;
            }
            if (e.isPrimary) {
                // 透明マスク編集モード中はマスクブラシのストロークを終了する。
                // pointerup/pointercancel/pointerleaveのいずれからもここを通るため、
                // キャンバス外へドラッグして離した場合等も含め確実に後始末される
                if (this.layerSystem.maskEditMode) {
                    this.layerSystem.maskBrushEnd();
                } else {
                    // キャンバス座標計算
                    let pos = this.calcScaleCoordinates(e);
                    // 機能呼び出し
                    this.penSystem.end(pos.x, pos.y, e);
                }
            }
        };
        /**
        * ポインタが離された時の処理
        */
        this.ELEMENT.base.addEventListener('pointerup', (e) => {
            if (this.endMouseWheelPan(e, { runClickTask: true })) {
                return;
            }
            // タッチ処理
            if (e.pointerType === 'touch') {
                // このイベントをターゲットのキャッシュから削除する
                const index = this.evCache.findIndex(
                    (item) => item.pointerId === e.pointerId
                );
                if (index !== -1) {
                    this.evCache.splice(index, 1);
                }
                // 2点未満になったらネジレ回転ロックを解除
                if (this.evCache.length < 2) {
                    this.isTwisting = false;
                    this.twistHistA = [];
                    this.twistHistB = [];
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
        this.ELEMENT.base.addEventListener('pointerleave', (e) => {
            //console.log('pointerleave');
            removeEvent(e);
        });

        // 回転操作子（PC/タブレット）：中央＝押して左右ドラッグで回転、左右＝タップで45度回転
        const rotateHandle = document.getElementById('axp_canvas_div_rotateHandle');
        if (rotateHandle) {
            rotateHandle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                let prevX = e.clientX;
                let prevTime = e.timeStamp;
                const onMove = (ev) => {
                    const dx = ev.clientX - prevX;
                    const deltaDeg = dx * this.CONST.ROTATE_DRAG_SENSITIVITY;
                    const dt = ev.timeStamp - prevTime;
                    this.applyRotationDelta(deltaDeg, dt);
                    prevX = ev.clientX;
                    prevTime = ev.timeStamp;
                };
                const cleanup = () => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', cleanup);
                    window.removeEventListener('pointercancel', cleanup);
                    window.removeEventListener('blur', cleanup);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', cleanup);
                window.addEventListener('pointercancel', cleanup);
                window.addEventListener('blur', cleanup);
            });
        }

        const rotateLeft = document.getElementById('axp_canvas_div_rotateLeft');
        if (rotateLeft) {
            rotateLeft.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            rotateLeft.addEventListener('click', () => {
                this.rotateView45(-1);
            });
        }

        const rotateRight = document.getElementById('axp_canvas_div_rotateRight');
        if (rotateRight) {
            rotateRight.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            rotateRight.addEventListener('click', () => {
                this.rotateView45(+1);
            });
        }

        // マウスホイール
        document.addEventListener('wheel', (e) => { this.mouseWheel(e) }, { passive: false });
        //非推奨
        //document.addEventListener('mousewheel', (e) => { this.mouseWheel(e) }, { passive: false });
        //非推奨
        //document.addEventListener('DOMMouseScroll', (e) => { this.mouseWheel(e) }, { passive: false });

        // コンテキストメニュー抑止
        document.oncontextmenu = () => {
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
        const elementsTab = document.querySelectorAll('#axp_main_div_tab_menu > div');
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
            } else if (document.visibilityState === 'hidden') {
                // タブが非表示になったとき（離脱の可能性）：未保存の編集内容を即座に保存する。
                // モバイル（特にiOS）はタブを予告なく破棄することがあり、
                // beforeunload/pagehideが発火しない場合があるため、visibilitychange:hiddenが
                // 確実な保存機会として最後になる。
                const finalizedNagenawa = this.finalizeNagenawaSelection({ autoSave: false });
                const finalizedLiquify = this.finalizeLiquifySession({ autoSave: false });
                this.saveSystem.autoSave(true, { forceWrite: finalizedNagenawa || finalizedLiquify });
            }
        });
        // 上記の保険。pagehideが発火する環境ではこちらでも確実に保存する
        // （force指定のため、既にvisibilitychange:hiddenで保存済みなら未保存分が無く何もしない）
        window.addEventListener('pagehide', () => {
            const finalizedNagenawa = this.finalizeNagenawaSelection({ autoSave: false });
            const finalizedLiquify = this.finalizeLiquifySession({ autoSave: false });
            this.saveSystem.autoSave(true, { forceWrite: finalizedNagenawa || finalizedLiquify });
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

        // 回転表示（ビューポート中心を不動点とする）
        // transform-originをキャンバス要素ローカルでビュー中心に一致させる
        const originX = (this.x_size / 2 + this.cameraX) * this.scale / 100;
        const originY = (this.y_size / 2 + this.cameraY) * this.scale / 100;
        const transformOrigin = `${originX}px ${originY}px`;
        const transform = this.rotation ? `rotate(${this.rotation}deg)` : '';
        this.CANVAS.main.style.transformOrigin = transformOrigin;
        this.CANVAS.main.style.transform = transform;
        grid.style.transformOrigin = transformOrigin;
        grid.style.transform = transform;
        this.interopSystem?.syncToCanvas();

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
        // 回転表示中はgetBoundingClientRectが外接矩形を返し格子セルが歪むため、
        // 非回転の表示サイズ（拡大率適用後）を用いる。
        const gridRect = {
            width: Math.round(this.x_size * this.scale / 100),
            height: Math.round(this.y_size * this.scale / 100),
        };
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
        // 回転表示もリセット
        this.rotation = 0;
    }
    /**
     * 表示の回転角度を相対的に変更する（あくまで表示の回転であり画像編集ではない）
     * @param {Number} delta 変化量（度数）
     */
    rotateView(delta) {
        this.rotation = ((this.rotation + delta) % 360 + 360) % 360;
        this.refreshCanvas();
    }
    /**
     * 45度グリッドにスナップする回転（左右回転ボタン用）
     * @param {Number} direction +1 で右回転（時計回り）、-1 で左回転（反時計回り）
     */
    rotateView45(direction) {
        const a = this.rotation;
        let result;
        if (direction > 0) {
            result = Math.floor((a + 45) / 45) * 45;
        } else {
            result = Math.ceil((a - 45) / 45) * 45;
        }
        this.rotation = ((result % 360) + 360) % 360;
        this.refreshCanvas();
    }
    /**
     * 回転ジェスチャの角度変化を、0/90/180/270°の「角速度の壁」スナップを掛けて適用する。
     * ゆっくりした回転は壁を越えられずその90°に落ち着き、速い回転は壁を突破する。
     * @param {Number} deltaDeg 今回フレームの角度変化（度）
     * @param {Number} dt 前回フレームからの経過時間（ミリ秒）
     */
    applyRotationDelta(deltaDeg, dt) {
        if (!deltaDeg) { return; }
        const a0 = this.rotation;
        const candidate = a0 + deltaDeg;
        // 角速度（度/ミリ秒）
        const velocity = Math.abs(deltaDeg) / Math.max(dt, 1);
        const fast = velocity >= this.CONST.ROTATE_WALL_VELOCITY;
        const normalize = (x) => ((x % 360) + 360) % 360;
        // 最寄りの90°境界
        const nearest = Math.round(a0 / 90) * 90;
        let result;
        if (Math.abs(a0 - nearest) < 0.5) {
            // ちょうど境界上にいる：脱出には角速度が必要（低速なら留まる）
            result = fast ? candidate : nearest;
        } else {
            // 象限内：進行方向側の境界を跨ぐか判定
            const boundary = (deltaDeg > 0) ? Math.ceil(a0 / 90) * 90 : Math.floor(a0 / 90) * 90;
            const crossing = (deltaDeg > 0) ? (candidate >= boundary) : (candidate <= boundary);
            if (crossing && !fast) {
                // 低速で境界に到達：壁で停止
                result = boundary;
            } else {
                // 高速で突破、または境界に達しない象限内移動
                result = candidate;
            }
        }
        this.rotation = normalize(result);
        this.refreshCanvas();
    }
    /**
     * 回転操作子（PC/タブレット用）の表示／非表示を現在のペンモードに合わせて更新する
     */
    updateRotateHandle() {
        const group = document.getElementById('axp_canvas_div_rotateGroup');
        const mode = this.penSystem.getPenMode();
        if (!group) { return; }
        const nagenawa = this.penSystem.penObj['axp_penmode_nagenawa'];
        const nagenawaTransforming = nagenawa && nagenawa.state === 'transforming';
        if (mode === 'axp_penmode_hand' && !nagenawaTransforming) {
            UTIL.show(group);
        } else {
            UTIL.hide(group);
        }
    }
    /**
     * ポインタイベントを受け取り、入力の実座標からscale(尺度)を適用したキャンバス上のx,y座標を計算し、返却する
     * @param {Event} e イベント
     * @returns {{x:Number,y:Number}} 座標(x,y)
     */
    calcScaleCoordinates(e) {
        // 回転表示に対応するため、キャンバス要素のgetBoundingClientRect（回転時は外接矩形になりズレる）に
        // 依存せず、非回転の表示エリア(view)中心を不動点として状態から逆算する。
        const rectView = this.ELEMENT.view.getBoundingClientRect();
        // ビューポート中心（回転のピボット）
        const vx = rectView.left + rectView.width / 2;
        const vy = rectView.top + rectView.height / 2;
        // ポインタのビュー中心からの相対ベクトルを -rotation だけ回し、非回転状態の座標系に戻す
        const r = rotateVector(e.clientX - vx, e.clientY - vy, -this.rotation * Math.PI / 180);
        // 非回転状態でのキャンバス左上からの表示px距離
        const localX = r.x + (this.x_size / 2 + this.cameraX) * this.scale / 100;
        const localY = r.y + (this.y_size / 2 + this.cameraY) * this.scale / 100;
        return {
            x: Math.floor(localX * 100 / this.scale),
            y: Math.floor(localY * 100 / this.scale),
        };
    }
    runMouseButtonTask(task, e, { allowTransDraw = true } = {}) {
        const result = {
            mode: null,
            optionTask: null,
            continueInput: false,
        };
        switch (task) {
            case 'undo':
                this.TASK['func_undo']();
                break;
            case 'spuit':
                this.penSystem.spuit(e);
                this.penSystem.autoChangePen();
                break;
            case 'hand':
                result.mode = 'axp_penmode_hand';
                result.continueInput = true;
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
                if (allowTransDraw) {
                    result.optionTask = 'transdraw';
                    result.continueInput = true;
                }
                break;
        }
        return result;
    }
    beginMouseWheelPan(e) {
        this.isMouseWheelPanActive = true;
        this.isMouseWheelPanConsumed = false;
        this.mouseWheelPanPointerId = e.pointerId;
        this.mouseWheelPanStartClientX = e.clientX;
        this.mouseWheelPanStartClientY = e.clientY;
        this.mouseWheelPanStartCameraX = this.cameraX;
        this.mouseWheelPanStartCameraY = this.cameraY;
        if (this.ELEMENT.base.setPointerCapture) {
            this.ELEMENT.base.setPointerCapture(e.pointerId);
        }
    }
    moveMouseWheelPan(e) {
        if (!this.isMouseWheelPanActive || this.mouseWheelPanPointerId !== e.pointerId) {
            return false;
        }
        const diffX = this.mouseWheelPanStartClientX - e.clientX;
        const diffY = this.mouseWheelPanStartClientY - e.clientY;
        const hasMoved = Math.abs(diffX) + Math.abs(diffY) > 1;
        if (!hasMoved && !this.isMouseWheelPanConsumed) {
            return true;
        }
        this.isMouseWheelPanConsumed = true;
        const r = rotateVector(diffX, diffY, -this.rotation * Math.PI / 180);
        this.cameraX = Math.round(this.mouseWheelPanStartCameraX + (r.x * 100 / this.scale));
        this.cameraY = Math.round(this.mouseWheelPanStartCameraY + (r.y * 100 / this.scale));
        this.refreshCanvas();
        return true;
    }
    scrollMouseWheelPan(deltaX, deltaY) {
        const move_size = Number(document.getElementById('axp_config_number_mouseWheelMoveSize').value);
        let moved = false;
        if (deltaY < 0) {
            this.moveCanvas(0, move_size);
            moved = true;
        }
        if (deltaY > 0) {
            this.moveCanvas(0, -move_size);
            moved = true;
        }
        if (deltaX < 0) {
            this.moveCanvas(move_size, 0);
            moved = true;
        }
        if (deltaX > 0) {
            this.moveCanvas(-move_size, 0);
            moved = true;
        }
        if (moved) {
            this.isMouseWheelPanConsumed = true;
        }
    }
    endMouseWheelPan(e, { runClickTask = false } = {}) {
        if (!this.isMouseWheelPanActive || this.mouseWheelPanPointerId !== e.pointerId) {
            return false;
        }
        const shouldRunClickTask = runClickTask && !this.isMouseWheelPanConsumed;
        if (this.ELEMENT.base.hasPointerCapture?.(e.pointerId)) {
            this.ELEMENT.base.releasePointerCapture(e.pointerId);
        }
        this.isMouseWheelPanActive = false;
        this.isMouseWheelPanConsumed = false;
        this.mouseWheelPanPointerId = null;
        if (shouldRunClickTask) {
            this.runMouseButtonTask(this.config('axp_config_form_mouseWheelButton'), e, { allowTransDraw: false });
        }
        return true;
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
        if (this.isMouseWheelPanActive && (e.buttons & 4)) {
            this.scrollMouseWheelPan(deltaX, deltaY);
            return;
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
                // 表示エリア（ビューポート）中心：回転の不動点
                const rectView = this.ELEMENT.view.getBoundingClientRect();
                const vx = rectView.left + rectView.width / 2;
                const vy = rectView.top + rectView.height / 2;

                // ポインタのビュー中心からの相対ベクトルを -rotation だけ回し、非回転座標系に戻す
                const r = rotateVector(e.clientX - vx, e.clientY - vy, -this.rotation * Math.PI / 180);

                // キャンバス座標が原点からどれだけ離れているか（ポインタがキャンバス外の場合はキャンバス内に補正）
                let canvasX = adjustInRange(pos.x, 0, this.x_size - 1);
                let canvasDX = (canvasX - this.x_size / 2) * this.scale / 100;
                let canvasY = adjustInRange(pos.y, 0, this.y_size - 1);
                let canvasDY = (canvasY - this.y_size / 2) * this.scale / 100;

                // 拡大後もポインタ下のキャンバス画素が同じ画面位置に残るようカメラ位置を求める
                this.cameraX = (canvasDX - r.x) * 100 / this.scale;
                this.cameraY = (canvasDY - r.y) * 100 / this.scale;
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
            case 'scroll': {
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
    }
    setCanvasSize(x_size, y_size) {
        let x = Number(x_size);
        let y = Number(y_size);
        if (isNaN(x)) {
            x = this.CONST.CANVAS_X_DEFAULT;
        }
        x = adjustInRange(x, this.minWidth, this.maxWidth);
        if (isNaN(y)) {
            y = this.CONST.CANVAS_Y_DEFAULT;
        }
        y = adjustInRange(y, this.minHeight, this.maxHeight);
        this.x_size = x;
        this.y_size = y;
        console.log(`キャンバスサイズ更新:${x} x ${y}`);
    }
    checkCanvasSize_x(x_size) {
        let x = Number(x_size);
        x = adjustInRange(x, this.minWidth, this.maxWidth);
        return x;
    }
    checkCanvasSize_y(y_size) {
        let y = Number(y_size);
        y = adjustInRange(y, this.minHeight, this.maxHeight);
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
        // ハンバーガーメニューを開いている場合、メニューを閉じる
        const elemHamburger = document.getElementById('axp_main_checkbox_hamburger');
        if (elemHamburger.checked) {
            elemHamburger.checked = false;
        }

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
        var targetElements_tab = document.querySelectorAll('#axp_main_div_tab_menu > div');
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
                break;
            // 設定
            case '1':
                this.isCanvasOpen = false;
                // 設定タブ内のカラーパレット表示更新
                this.configSystem.dispPalettebox(document.getElementById('axp_config_div_paletteBox'), this.colorPaletteSystem.currentPalette);
                break;
            // 投稿
            case '2': {
                this.isCanvasOpen = false;
                // なげなわ変形中は確定してから投稿画像を生成する（点線プレビューの混入防止）
                this.finalizeNagenawaSelection();
                this.finalizeLiquifySession();
                // 投稿タブ内の情報更新
                this.drawPostCanvas();

                // 投稿ボタン有効化
                UTIL.show('axp_post_button_upload_label');
                UTIL.hide('axp_post_button_upload_loading');
                document.getElementById("axp_post_button_upload").disabled = false;

                // 基にしてお絵カキコ
                let elemRefId = document.getElementById('axp_post_span_referenceOekakiId');

                console.log(this.oekaki_id, this.draftImageFile);
                if (this.draftImageFile !== null) {
                    elemRefId.textContent = `${this._('@COMMON.DRAW_BASED')}:${getFileNameFromURL(this.draftImageFile)}`;
                } else if (this.oekaki_id !== null) {
                    elemRefId.textContent = `${this._('@COMMON.DRAW_BASED')}:${this.oekaki_id}.png`;
                } else {
                    elemRefId.textContent = `${this._('@COMMON.DRAW_NEW')}`;
                }
                break;
            }
        }
        //console.log('main select:', idx, this.isCanvasOpen);
    }
    // 選択されているタブのindexを取得
    get selectedTab() {
        let result = null;
        const targetElements_tab = document.querySelectorAll('#axp_main_div_tab_menu > div');
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

        // 表示回転
        this.TASK['func_rotate_view_left'] = () => {
            this.rotateView(-15);
            this.msg('@INF5000');
        }
        this.TASK['func_rotate_view_right'] = () => {
            this.rotateView(15);
            this.msg('@INF5001');
        }
        this.TASK['func_rotate_view_left_45'] = () => {
            this.rotateView45(-1);
            this.msg('@INF5002');
        }
        this.TASK['func_rotate_view_right_45'] = () => {
            this.rotateView45(+1);
            this.msg('@INF5003');
        }
        this.TASK['func_rotate_view_reset'] = () => {
            this.rotation = 0;
            this.refreshCanvas();
            this.msg('@INF5004');
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
        this.TASK['func_switch_axp_penmode_diffusion'] = () => {
            switchPenSub('axp_penmode_diffusion');
        }
        this.TASK['func_switch_axp_penmode_marker'] = () => {
            switchPenSub('axp_penmode_marker');
        }
        this.TASK['func_switch_axp_penmode_curve'] = () => {
            switchPenSub('axp_penmode_curve');
        }
        this.TASK['func_switch_axp_penmode_hatching'] = () => {
            switchPenSub('axp_penmode_hatching');
        }
        this.TASK['func_switch_axp_penmode_sketch'] = () => {
            switchPenSub('axp_penmode_sketch');
        }
        this.TASK['func_switch_axp_penmode_texturebrush'] = () => {
            switchPenSub('axp_penmode_texturebrush');
        }
        this.TASK['func_switch_axp_penmode_smoothpen'] = () => {
            switchPenSub('axp_penmode_smoothpen');
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
        this.TASK['func_switch_axp_penmode_nagenawa'] = () => {
            switchPenSub('axp_penmode_nagenawa');
        }
        this.TASK['func_switch_axp_penmode_magicwand'] = () => {
            switchPenSub('axp_penmode_magicwand');
        }
        this.TASK['func_switch_axp_penmode_polygonselect'] = () => {
            switchPenSub('axp_penmode_polygonselect');
        }
        this.TASK['func_switch_axp_penmode_liquify'] = () => {
            switchPenSub('axp_penmode_liquify');
        }
        // 選択解除
        this.TASK['func_deselect'] = () => {
            this.clearSelection();
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
            // なげなわ変形中は確定してから処理する
            this.finalizeNagenawaSelection();
            this.finalizeLiquifySession();
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
    // a11y: アイコンのみのボタン（テキストラベルを持たない）に、既存のホバー説明文
    // （data-msg属性、msg.txt辞書）からaria-labelを自動生成して付与する。
    // 説明文の先頭にある「%1」等のプレースホルダ（ショートカットキー表示用）は
    // aria-labelとしては不要なため除去する。既にaria-labelやテキストラベルを
    // 持つ要素はスキップする（上書きしない）。
    _assignAriaLabelsFromDataMsg() {
        const elements = document.querySelectorAll('button[data-msg]');
        for (const el of elements) {
            if (el.hasAttribute('aria-label') || el.textContent.trim() !== '') continue;
            const key = el.dataset.msg;
            if (!key) continue;
            // data-msgは辞書キー（@から始まる）と、動的生成ボタン（window.js）が
            // 直接設定する生テキストの両方があり得る（msg()メソッドと同じ分岐）。
            const raw = (key.charAt(0) === '@') ? Message.getMessage(key) : key;
            if (!raw) continue;
            const text = raw.replace(/%\d+/g, '').trim();
            if (text) el.setAttribute('aria-label', text);
        }
    }
    // キャンバス上に重ねたUIのポインター入力を、描画面のpointerdown/move/upへ伝播させない。
    // 右上ヘッダーボタンはキャンバス外だが、ドック・クイックバー・タッチバーはキャンバス内にあるため、
    // この境界が無いとUndo/Redoボタンの押下でも描画開始やタッチジェスチャー判定が走る。
    _guardCanvasChromePointerEvents() {
        const stopCanvasPointer = (event) => {
            event.stopPropagation();
        };
        const guardElement = (element) => {
            if (!element) return;
            element.addEventListener('pointerdown', stopCanvasPointer);
            element.addEventListener('pointermove', stopCanvasPointer);
            element.addEventListener('pointerup', stopCanvasPointer);
            element.addEventListener('pointercancel', stopCanvasPointer);
        };
        const selectors = [
            '#axp_canvas_div_touchBar',
            '#axp_dock_left',
            '#axp_dock_right',
            '#axp_quickbar',
            '#axp_mobile_topbar',
            '#axp_mobile_sheet',
        ];
        for (const selector of selectors) {
            guardElement(document.querySelector(selector));
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
                // ※この後に範囲チェックでサイズ修整を行うため、最大最小が変更されていた場合も一旦デフォルト値を設定しておく
                this.x_size = this.CONST.CANVAS_X_DEFAULT;
            }
            if (this.option_height) {
                this.y_size = Number(this.option_height);
            } else {
                this.y_size = this.CONST.CANVAS_Y_DEFAULT;
            }

            // 下書き機能を使用する場合の判定
            let isDraftLoaded = false;
            let imageload_src = null;
            let imageload_filename = null;
            // 読み込み画像ファイル名の決定
            if (this.draftImageFile !== null) {
                // 起動オプション指定時（優先）
                imageload_src = this.draftImageFile;
                // URLパラメータ指定があっても無効にする
                this.oekaki_id = null;
            } else if (this.oekakiURL !== null && this.oekaki_id !== null) {
                // URLパラメータ指定時
                imageload_src = this.oekakiURL + this.oekaki_id + '.png';
            } else {
                // 起動オプションoekakiURLが指定されていない場合は、URLパラメータ無効
                this.oekaki_id = null;
            }
            // 画像読み込み
            if (imageload_src !== null) {
                // パスを除いたファイル名だけを取り出す
                imageload_filename = getFileNameFromURL(imageload_src);
                // テキスト表示（※初期化前なので、this.msg()はまだ使用できない）
                document.getElementById('axp_footer_div_message').textContent = `[${imageload_filename}]を読み込みしています...`;
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
                        // 下書き情報保存
                        this.oekaki_bbs_pageno = this.post_bbs_pageno;
                        this.oekaki_bbs_title = this.post_bbs_title;
                        console.log('下書き画像:', this.x_size, this.y_size, this.oekaki_id, this.draftImageFile);
                        // 下書きロード済
                        isDraftLoaded = true;
                    })
                    .catch(error => {
                        // 画像読み込みエラー
                        console.error(error);
                        alert(`下書き画像の読み込みに失敗しました。\n新規キャンバスを作成します。\n${error}`);
                        // テキスト表示クリア
                        document.getElementById('axp_footer_div_message').textContent = '';
                        this.oekaki_id = null;
                        this.draftImageFile = null;
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
                    } else {
                        // ユーザー設定データが存在しない場合、初回起動と判定する
                        this.ENV.isFirstLaunch = true;
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

            // 背景の地色（肌色/白）を確定する（E-1c）。初回updateCanvasの前に反映する必要がある。
            // 肌色の実値は起動オプションdefaultColor.sub（あいもげ既定）、無指定時はSKIN_BG_DEFAULT。
            this.skinBackgroundColor = (this.defaultColor && this.defaultColor.sub) ? this.defaultColor.sub : this.CONST.SKIN_BG_DEFAULT;
            // トグルの保存状態（TOGSW）はrestoreConfigでcheckboxへ復元済み。白=checked。
            const bgToggleInput = document.getElementById('axp_tool_toggle_bgColor')?.querySelector('input');
            this.backgroundColor = (bgToggleInput && bgToggleInput.checked) ? '#ffffff' : this.skinBackgroundColor;

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
            // カスタムボタンツールウィンドウ表示切替
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
            if (this.ENV.isFirstLaunch) {
                this.applyFirstLaunchWindowMinimize();
            }
            // ユーザー設定が復元された後のペンツールの再描画
            this.penSystem.changePenMode();
            // 初回起動かつモバイル端末の場合、単一ウィンドウモードを強制設定
            if (this.ENV.isFirstLaunch && this.ENV.isMobileWidth) {
                document.getElementById('axp_config_checkbox_singleWindowMode').checked = true;
                this.configSystem.saveConfig('CHECK_axp_config_checkbox_singleWindowMode', true);
                // 単一ウィンドウモード
                this.launcher.setSingleWindowMode(true, false);
                alert('* 初回起動設定 *\n画面幅が600px未満のため、単一ウィンドウモードに設定しました。[設定]-[ツールウィンドウ]で変更が可能です。');
            } else {
                if (document.getElementById('axp_config_checkbox_singleWindowMode').checked) {
                    // 単一ウィンドウモード、復元時
                    this.launcher.setSingleWindowMode(true, true);
                }
            }

            // 下書き読込
            if (isDraftLoaded) {
                // 基にする画像は作品レイヤーへ書き込まず、参照オーバーレイとして表示する。
                this.interopSystem.referenceImageSystem.loadBitmap(this.oekaki_base, 0);
                this.interopSystem.syncReferenceControls();
                // [%1.png]を読み込みました。(画像サイズ 横:%2 × 縦:%3)
                this.msg('@INF0050', imageload_filename, this.x_size, this.y_size);
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
            this.interopSystem.syncToCanvas();

            // イベント受付開始
            this.startEvent();
            // 拡張機能イベント受付開始
            if (this.exTool) {
                this.exTool.startEvent();
            }
        })();
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
