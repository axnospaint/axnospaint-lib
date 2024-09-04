// @description ツールウィンドウ：親クラス＞ペンツール

import { ToolWindow } from './window.js';
import html_pen from '../html/window_pen.txt';
import html_pen_subwindow from '../html/penmode.txt';

// css適用
require('../css/window_pen.css');

import { createTonePattern, UTIL, rgb2hex, calcDistance } from './etc.js';
import { range_index, range_value } from './pendefine/rangeindex.js';

// メイン
import { Round } from './pendefine/round.js';
import { Eraser } from './pendefine/eraser.js';
import { EraserDot } from './pendefine/eraser_dot.js';

import { Fill } from './pendefine/fill.js';
import { Fillgradation } from './pendefine/fillgradation.js';

import { Hand } from './pendefine/hand.js';
import { Spuit } from './pendefine/spuit.js';

// サブ
import { Square } from './pendefine/square.js';
import { Move } from './pendefine/move.js';
import { Dot } from './pendefine/dot.js';

import { Fude } from './pendefine/fude.js';
import { Crayon } from './pendefine/crayon.js';
import { Brush } from './pendefine/brush.js';

// 共通処理：ペンモード変更時
export class PenSystem extends ToolWindow {
    pen_mode; // 選択中の機能
    exec_pen_mode; // 実行中の機能
    isTemporary = false;
    temporaryMode; // 一時的なモード変更（CTRL SPACE時）
    saveElement;
    saveMode;
    saveIcon;
    saveMsg;
    penObj = [];
    CONST = {
    }
    CANVAS = {
        // 描画内容を書き込む仮想キャンバス
        draw: null,
        draw_ctx: null,
        brush: null,
        brush_ctx: null,
        // スクリーントーン
        tone: null,
        tone_ctx: null,
        // スポイト拡大用キャンバス
        spuit: null,
        spuit_ctx: null,
        // ペンの太さプレビューキャンバス
        pensize: null,
        pensize_ctx: null,
    };

    base_index = null;
    old_x;
    old_y;
    preview_dragstart_x;
    preview_dragstart_y;

    stabilizerX = 0;
    stabilizerY = 0;

    constructor(axpObj) {
        super(axpObj);
    }
    // 初期ウィンドウ位置
    getDefaultPosition() {
        return {
            left: 10,
            top: 10,
        }
    }
    // 初期化
    init() {
        // HTML
        this.createHTML(
            'axp_pen',
            'PEN',
            this.axpObj._('@WINDOW.PEN_TOOL'),
            'axpc_icon_window_pen',
            html_pen
        );
        // ペン種別選択サブメニューのHTMLを展開
        document.getElementById('axp_canvas').insertAdjacentHTML('beforeend', this.axpObj.translateHTML(html_pen_subwindow));

        this.window_width = 180;
        // 初期座標設定
        const pos = this.getDefaultPosition();
        this.window_left = pos.left;
        this.window_top = pos.top;
        // 仮想キャンバス
        this.CANVAS.draw = document.createElement('canvas');
        this.CANVAS.draw_ctx = this.CANVAS.draw.getContext('2d', { willReadFrequently: true });
        // ブラシ用キャンバス
        this.CANVAS.brush = document.createElement('canvas');
        this.CANVAS.brush_ctx = this.CANVAS.brush.getContext('2d');
        // ペンの太さプレビューキャンバス
        this.CANVAS.pensize = document.getElementById('axp_pen_canvas_previewPenSize');
        this.CANVAS.pensize.width = 100;
        this.CANVAS.pensize.height = 100;
        this.CANVAS.pensize_ctx = this.CANVAS.pensize.getContext('2d');
        // スポイト用キャンバス
        this.CANVAS.spuit = document.getElementById('axp_pen_canvas_previewSpuit');
        this.CANVAS.spuit.width = 5;
        this.CANVAS.spuit.height = 5;
        this.CANVAS.spuit_ctx = this.CANVAS.spuit.getContext('2d');

        // メイン
        this.penObj['axp_penmode_round'] = new Round({ axpObj: this.axpObj, CANVAS: this.CANVAS });
        this.penObj['axp_penmode_eraser_round'] = new Eraser({ axpObj: this.axpObj, CANVAS: this.CANVAS });
        this.penObj['axp_penmode_eraser_dot'] = new EraserDot({ axpObj: this.axpObj, CANVAS: this.CANVAS });

        this.penObj['axp_penmode_fill'] = new Fill({ axpObj: this.axpObj, CANVAS: this.CANVAS });
        this.penObj['axp_penmode_fillgradation'] = new Fillgradation({ axpObj: this.axpObj, CANVAS: this.CANVAS });

        this.penObj['axp_penmode_hand'] = new Hand({ axpObj: this.axpObj, CANVAS: this.CANVAS });
        this.penObj['axp_penmode_spuit'] = new Spuit({ axpObj: this.axpObj, CANVAS: this.CANVAS });
        // サブ
        this.penObj['axp_penmode_square'] = new Square({ axpObj: this.axpObj, CANVAS: this.CANVAS });
        this.penObj['axp_penmode_move'] = new Move({ axpObj: this.axpObj, CANVAS: this.CANVAS });
        this.penObj['axp_penmode_dot'] = new Dot({ axpObj: this.axpObj, CANVAS: this.CANVAS });
        this.penObj['axp_penmode_fude'] = new Fude({ axpObj: this.axpObj, CANVAS: this.CANVAS });
        this.penObj['axp_penmode_crayon'] = new Crayon({ axpObj: this.axpObj, CANVAS: this.CANVAS });
        this.penObj['axp_penmode_brush'] = new Brush({ axpObj: this.axpObj, CANVAS: this.CANVAS });

        // サブメニューをメインメニューに反映
        let elementsButton = document.querySelectorAll('#axp_pen_div_rightSide>div>button');
        let elementsButtonSub = document.querySelectorAll('#axp_penmode>div>article>button:first-of-type');
        // メインメニューの初期割り当て（サブボタンの先頭を登録）
        elementsButton.forEach((element, index) => {
            // ガイドメッセージ（サブボタンのメインボタンのメッセージを結合）
            element.dataset.addmsg = elementsButtonSub[index].dataset.msg;
            // ID情報
            element.dataset.set = elementsButtonSub[index].id;
            // アイコン
            element.classList.add(this.getClassIcon(elementsButtonSub[index].id));
        });
        // 初期ペン
        this.pen_mode = elementsButtonSub[0].id;
    }
    // id名からアイコン用class名を取得
    getClassIcon(id) {
        return id.replace('axp_', 'axpc_');
    }
    resetCanvas() {
        // 描画用仮想キャンバスサイズ指定
        this.CANVAS.draw.width = this.axpObj.x_size;
        this.CANVAS.brush.width = this.axpObj.x_size * this.axpObj.CONST.DRAW_MULTI;

        this.CANVAS.draw.height = this.axpObj.y_size;
        this.CANVAS.brush.height = this.axpObj.y_size * this.axpObj.CONST.DRAW_MULTI;
    }
    // ペンツール変更（メインボタン）
    switchMainButton(element, caller = null) {
        if (!this.isSwitchable()) return;
        // メインボタン
        let target = element;
        // スポイト以外のボタンが再選択されたらサブメニューオープン（ショートカットで呼び出された場合caller!=null、サブメニューは開かない）
        if (target.dataset.idx !== '4' &&
            !caller &&
            target.dataset.selected === 'true') {

            let targetElements_button = document.querySelectorAll('#axp_pen_div_rightSide>div>button');
            for (const item of targetElements_button) {
                if (item !== target) {
                    item.style.opacity = '0.3';
                }
            }
            let idx = Number(target.dataset.idx);
            let targetElements_article = document.querySelectorAll('#axp_penmode>div>article');

            // 一旦全部非表示
            for (const item of targetElements_article) {
                UTIL.hide(item);
            }
            // 選択されたdata-idxに対応するサブウィンドウ要素
            let subwindow = targetElements_article[Number(idx)];
            // 種別名表示
            document.getElementById('axp_penmode_span_modeName').textContent = `${subwindow.dataset.name}${this.axpObj._('@PEN.TYPE')}`;
            // 選択されたメインボタンに対応するサブウィンドウだけ表示
            UTIL.show(subwindow);
            // キャンバスタブエリアの位置（左上座標調整用）
            const canvasRect = document.getElementById('axp_canvas').getBoundingClientRect();
            // サブボタンメニューの表示座標指定
            let rect = document.getElementById('axp_pen_div_leftSide').getBoundingClientRect();
            let elem = document.querySelector('#axp_penmode>div');
            elem.style.width = (rect.width + 5) + 'px';
            elem.style.height = (rect.height + 4) + 'px';
            elem.style.marginLeft = (rect.left - 4 - canvasRect.left) + 'px';
            elem.style.marginTop = (rect.top - 2 - canvasRect.top) + 'px';
            // サブウィンドウの表示
            this.axpObj.isModalOpen = true;
            // ペンツールの機能選択中です。
            this.axpObj.msg('@AXP5010');
            UTIL.show('axp_penmode');
        } else {
            this.switchButton(target);
        }
    }
    // ペン種別変更（サブボタン）
    switchSubButton(element) {
        if (!this.isSwitchable()) return;
        // 押されたボタン
        let target = element;
        // メインボタン（data-idxをキーに対応するメインボタンを特定する）
        const elementButtonMain = document.querySelector(`#axp_pen_div_rightSide>div>button[data-idx="${target.dataset.idx}"]`);
        // メインボタンにセットされているサブボタンclassを消去
        console.log(elementButtonMain);
        elementButtonMain.classList.remove(this.getClassIcon(elementButtonMain.dataset.set));
        // メインボタンに押されたサブボタンのid名のclassを付与（これによりメインボタンのアイコンが変更される）
        elementButtonMain.classList.add(this.getClassIcon(target.id));
        // メインボタンに選択されたサブボタンのidを格納（これによりメインボタンを押すことで、サブボタンのペンが呼び出される）
        elementButtonMain.dataset.set = target.id;
        // メインボタンにメッセージを格納
        elementButtonMain.dataset.addmsg = target.dataset.msg;
        let newMode = target.id;
        console.log('サブ選択:', newMode);
        // モード変更
        this.switchButton(elementButtonMain);
    }
    // メインボタンの選択状態切替
    switchButton(elementButton) {
        // 選択状態の全クリア
        const elems_penicon = document.querySelectorAll('#axp_pen_div_rightSide>div>button');
        for (const item of elems_penicon) {
            item.dataset.selected = 'false';
        }
        // ボタンを選択状態にする
        elementButton.dataset.selected = 'true';
        let newMode = elementButton.dataset.set;
        console.log('メイン選択:', newMode);
        // モード変更
        this.changePenMode(newMode);
    }
    // メインボタンが切り替え可能な状態であるかのチェック
    isSwitchable() {
        // ショートカットによるスポイト、ハンド使用時は、処理しない（状態を上書きしてしまうと元に戻せないため）
        if (this.axpObj.isCTRL) {
            // [ CTRL ]キーでスポイトに変化中です。別のペンは選択できません。
            this.axpObj.msg('@CAU5000');
            return false;
        }
        if (this.axpObj.isSPACE) {
            // [ SPACE ]キーでハンドに変化中です。別のペンは選択できません。
            this.axpObj.msg('@CAU5001');
            return false;
        }
        return true;
    }
    startEvent() {
        // スライダーの並び順序
        this.changeOrderSlider();

        // サブメニュー選択中メッセージ
        document.getElementById('axp_penmode').addEventListener('pointermove', (e) => {
            if (e.target.id === 'axp_penmode') {
                // ペンツールの機能選択中です。
                this.axpObj.msg('@AXP5010');
            }
        });

        // ペンツールのサブウィンドウ
        document.getElementById('axp_penmode').addEventListener('click',
            (e) => {
                // モーダルウィンドウを閉じる
                this.axpObj.isModalOpen = false;
                UTIL.hide(e.currentTarget);
                // ボタンの暗転を戻す
                let targetElements_button = document.querySelectorAll('#axp_pen_div_rightSide>div>button');
                for (const item of targetElements_button) {
                    item.style.opacity = '1';
                }
            }
        );
        // レンジスライダー：ペンの太さ
        document.getElementById('axp_pen_range_penSize').addEventListener('input',
            (e) => {
                const index = Number(e.target.value);
                const name = this.getName();
                // indexを更新し、sizeを受け取る
                const size = this.setIndex(index);
                document.getElementById('axp_pen_form_penSize').result.value = size; // スライダーの数値表示更新
                // %1の太さ：%2
                this.axpObj.msg('@AXP5000', name, size);
                // ペンの太さプレビュー
                this.previewPenSize();
                // コンフィグオブジェクトをDBに保存
                this.axpObj.configSystem.saveConfig('P-SIZ_' + this.pen_mode, size);
            }
        );
        // レンジスライダー：ペンの不透明度
        document.getElementById('axp_pen_range_alpha').addEventListener('input',
            (e) => {
                let alpha = Number(e.target.value);
                let name = this.getName();
                this.setAlpha(alpha);
                // %1の不透明度：%2
                this.axpObj.msg('@AXP5001', name, alpha);
                // ペンの太さプレビュー
                this.previewPenSize();
                // コンフィグオブジェクトをDBに保存
                this.axpObj.configSystem.saveConfig('P-ALP_' + this.pen_mode, alpha);
            }
        );

        // レンジスライダー：塗り残し補正
        document.getElementById('axp_pen_range_fillThreshold').addEventListener('input',
            (e) => {
                let threshold = Number(e.target.value);
                let name = this.getName();
                this.setThreshold(threshold);
                // %1の塗り残し補正：%2
                this.axpObj.msg('@AXP5002', name, threshold);
                // バケツ専用なのでプレビューは無し

                // コンフィグオブジェクトをDBに保存
                this.axpObj.configSystem.saveConfig('P-THR_' + this.pen_mode, threshold);
            }
        );
        // レンジスライダー：角度
        document.getElementById('axp_pen_range_fillGradationDeg').addEventListener('input',
            (e) => {
                const deg = Number(e.target.value);
                const name = this.getName();
                this.setGradation(deg);
                // %1の角度：%2
                this.axpObj.msg('@AXP5003', name, deg);
                // ペンの太さプレビュー
                this.previewPenSize();
                // コンフィグオブジェクトをDBに保存
                this.axpObj.configSystem.saveConfig('P-DEG_' + this.pen_mode, deg);
            }
        );

        // レンジスライダー：トーン濃度
        document.getElementById('axp_pen_range_toneLevel').addEventListener('input',
            (e) => {
                let tone_level = Number(e.target.value);
                let name = this.getName();
                this.setToneLevel(tone_level);
                // %1のトーン濃度：%2
                this.axpObj.msg('@AXP5004', name, tone_level);
                // ペンの太さプレビュー
                this.previewPenSize();
                // コンフィグオブジェクトをDBに保存
                this.axpObj.configSystem.saveConfig('P-TON_' + this.pen_mode, tone_level);
            }
        );
        // レンジスライダー：ぼかし度
        document.getElementById('axp_pen_range_blur').addEventListener('input',
            (e) => {
                let blur_level = Number(e.target.value);
                this.setBlurLevel(blur_level);
                // %1のぼかし度：%2
                this.axpObj.msg('@AXP5008', this.getName(), blur_level);
                // ペンの太さプレビュー
                this.previewPenSize();
                // コンフィグオブジェクトをDBに保存
                this.axpObj.configSystem.saveConfig('P-BLU_' + this.pen_mode, blur_level);
            }
        );
        // レンジスライダー：丸み
        document.getElementById('axp_pen_form_radius').addEventListener('input',
            (e) => {
                let radius = Number(e.target.value);
                this.setRadius(radius);
                // %1の丸み：%2
                this.axpObj.msg('@AXP5009', this.getName(), radius);
                // ペンの太さプレビュー
                this.previewPenSize();
                // コンフィグオブジェクトをDBに保存
                this.axpObj.configSystem.saveConfig('P-RAD_' + this.pen_mode, radius);
            }
        );

        // キャンバス：ペンの太さプレビュー
        // 原点からの座標に対する角度（0～359）を算出
        const calcDeg = (dy, dx) => {
            let r = Math.atan2(dy, dx);
            if (r < 0) {
                r = r + 2 * Math.PI;
            }
            return Math.round(r * 180 / Math.PI);
        };
        const setPenSizeByPreview = (e) => {
            if (e.type === 'pointerdown') {
                e.target.classList.add('axpc_onGRAB');
                // 初期位置保存
                this.preview_dragstart_x = e.offsetX;
                this.preview_dragstart_y = e.offsetY;
                //console.log(this.preview_dragstart_x, this.preview_dragstart_y);
            }
            if (e.target.classList.contains('axpc_onGRAB')) {

                let target = e.currentTarget;
                let name = this.getName();
                if (this.pen_mode === 'axp_penmode_fillgradation') {
                    // ドラッグ差分
                    let dx = e.offsetX - this.preview_dragstart_x;
                    let dy = e.offsetY - this.preview_dragstart_y;
                    let deg = calcDeg(dy, dx) - 270;
                    if (deg < 0) { deg = deg + 360 }
                    // %1の角度：%2
                    this.axpObj.msg('@AXP5003', name, deg);
                    this.setGradation(deg);
                    // スライダー更新
                    document.getElementById('axp_pen_range_fillGradationDeg').value = deg;
                    document.getElementById('axp_pen_form_fillGradationDeg').result.value = deg;
                    // ペンの太さプレビュー
                    this.previewPenSize();
                    // コンフィグオブジェクトをDBに保存
                    this.axpObj.configSystem.saveConfig('P-DEG_' + this.pen_mode, deg);
                    return;
                }


                var x0 = target.width / 2;
                var y0 = target.height / 2;
                var x1 = e.offsetX;
                var y1 = e.offsetY;
                var distance = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
                var basesize = distance * 2;
                // ペンの太さ（最小１、最大200）
                var size = Math.min(200, Math.max(1, parseInt(basesize * 100 / this.axpObj.scale)));


                // size更新とindex取得
                var index = this.setSize(size);
                if (!index) {
                    // %1の太さは変更できません。
                    this.axpObj.msg('@CAU0203', name);
                    return;
                }
                // ペンツール表示更新
                this.changePenMode();
                // %1の太さ：%2
                this.axpObj.msg('@AXP5000', name, size);

            }
        }

        this.CANVAS.pensize.addEventListener('pointerdown', setPenSizeByPreview);
        this.CANVAS.pensize.addEventListener('pointermove', setPenSizeByPreview);
        this.CANVAS.pensize.addEventListener('pointerleave', () => {
            this.axpObj.msg('');
        });

        const setPenSizeByPreview_end = (e) => {
            // ドラッグを終了したとき
            if (e.target.classList.contains('axpc_onGRAB')) {
                e.target.classList.remove('axpc_onGRAB');
                // 太さ変更可能なペン種のみ、変更された太さを保存する
                if (this.getSize()) {
                    // コンフィグオブジェクトをDBに保存
                    this.axpObj.configSystem.saveConfig('P-SIZ_' + this.pen_mode, this.getSize());
                }
            }
        }
        this.CANVAS.pensize.addEventListener('pointerup', setPenSizeByPreview_end);
        this.CANVAS.pensize.addEventListener('pointerleave', setPenSizeByPreview_end);
    }

    start(x, y, e, mode, option) {
        // ペンの太さ変更モード時、クリックされた初期座標を記憶
        if (this.axpObj.codeCHANGE_SIZE_KEY) {
            this.base_index = this.getIndex();
            this.old_x = e.clientX;
            this.old_y = e.clientY;
            //console.log('base_index:', typeof this.base_index, this.base_index);
            //console.log('old_x:', typeof this.old_x, this.old_x);
            //console.log('old_y:', typeof this.old_y, this.old_y);
            return;
        }
        //console.log('exec_mode:', mode);
        // 実行する処理のタイプを記憶
        this.exec_pen_mode = mode;
        this.penObj[this.exec_pen_mode].start(x, y, e, option);
        // 手ぶれ補正用記録
        this.stabilizerX = e.clientX;
        this.stabilizerY = e.clientY;
    }
    move(x, y, e) {
        let name = this.getName();
        // ペンの太さ変更モード時、初期座標との差異からindexを算出し、ペンの太さを変更する
        if (this.axpObj.codeCHANGE_SIZE_KEY) {
            if (this.base_index !== null) {
                let difference_x = e.clientX - this.old_x;
                //console.log('difference_x:', typeof difference_x, difference_x);
                // ※Mac環境の場合、入力値が小数点を含むため、整数化が必要
                let index = Math.trunc(Math.max(1, Math.min(100, Number(this.base_index) + difference_x)));
                //console.log('index:', typeof index, index);
                let size = this.setIndex(index);
                //console.log('size:', typeof size, size);
                // ペンツール表示更新
                this.changePenMode();
                // %1の太さ：%2
                this.axpObj.msg('@AXP5000', name, size);
            }
        }
        // 処理中は処理中のモードを継続、処理を行っていない場合は引数のモードの処理をする
        let exec_mode = this.exec_pen_mode || this.pen_mode;
        // ペンカーソル表示
        if (e.target.id === this.axpObj.CANVAS.main.id || e.target.id === this.axpObj.ELEMENT.view.id) {
            this.penObj[exec_mode].drawCursor(e);
        }
        //console.log('exec_mode:', exec_mode);
        // ペンと消しゴムの場合、手ぶれ補正を判定（描画開始を判定するため、ピンチズームにも影響する）
        if (this.penObj[exec_mode].type === 'draw' ||
            this.penObj[exec_mode].type === 'eraser'
        ) {
            const stabilizer_value = Number(document.getElementById('axp_config_form_stabilizerValue').volume.value);
            if (stabilizer_value !== 0) {
                // 手ぶれ補正あり
                // 前回の位置からの距離によって、入力を間引きする
                // ２点間の距離の算出（三平方の定理）
                const distance = calcDistance(
                    this.stabilizerX,
                    this.stabilizerY,
                    e.clientX,
                    e.clientY
                )
                if (distance < stabilizer_value) {
                    //console.log('補正', distance);
                    return;
                }
                this.stabilizerX = e.clientX;
                this.stabilizerY = e.clientY;
            }
        }
        this.penObj[exec_mode].move(x, y, e);

    }
    end(x, y, e) {
        if (this.axpObj.codeCHANGE_SIZE_KEY) {
            if (this.base_index !== null) {
                this.base_index = null;
                if (this.getSize()) {
                    // コンフィグオブジェクトをDBに保存
                    this.axpObj.configSystem.saveConfig('P-SIZ_' + this.pen_mode, this.getSize());
                }
            }
        }
        // 処理実行中でないなら、終了処理を行わない
        if (!this.exec_pen_mode) return;
        this.penObj[this.exec_pen_mode].end(x, y, e);
        // 実行中解除
        this.exec_pen_mode = null;
    }
    getSize() {
        return this.penObj[this.pen_mode].size;
    }
    setSize(size) {
        let index = null;
        // セット可能チェック
        if (this.penObj[this.pen_mode].size !== null) {
            // size更新
            this.penObj[this.pen_mode].size = size;
            // sizeに対応するindex（スライダーの添字）を配列走査で取得
            index = range_index(size);
            this.penObj[this.pen_mode].index = index;
        } else {
            // 太さを指定できないペンを、ショートカット等で設定しようとした場合はnullを返却
        }
        return index;
    }
    /**
     * キーボードショートカット＋機能割り当て用ペンの太さサイズ変更
     * @param {*} size ペンの太さ
     */
    setPenSize(size) {
        // size更新とindex取得
        let index = this.setSize(size);
        let name = this.getName();
        if (!index) {
            // %1の太さは変更できません。
            this.axpObj.msg('@CAU0203', name);
            return;
        }
        // %1の太さ：%2
        this.axpObj.msg('@AXP5000', name, size);
        // ペンツール表示更新
        this.changePenMode();
        // コンフィグオブジェクトをDBに保存
        this.axpObj.configSystem.saveConfig('P-SIZ_' + this.pen_mode, this.getSize());
    }
    getIndex() {
        return this.penObj[this.pen_mode].index;
    }
    setIndex(index) {
        let size;
        // セット可能チェック(sizeがnullではない事で判定)
        if (this.penObj[this.pen_mode].size !== null) {
            // 更新
            this.penObj[this.pen_mode].index = index;
            // indexに対応するsizeを取得
            size = range_value[index];
            //console.log('range_value_size:', typeof size, size);
            this.penObj[this.pen_mode].size = size;
        } else {
            throw new Error('内部エラー：不正な太さ指定です');
        }
        // sizeを返却
        return size;
    }
    getAlpha() {
        return this.penObj[this.pen_mode].alpha;
    }
    setAlpha(alpha) {
        // セット可能チェック
        if (this.penObj[this.pen_mode].alpha !== null) {
            // 更新
            this.penObj[this.pen_mode].alpha = alpha;
        } else {
            throw new Error('内部エラー：不正な不透明度指定です');
        }
    }
    getThreshold() {
        return this.penObj[this.pen_mode].threshold;
    }
    setThreshold(threshold) {
        // セット可能チェック
        if (this.penObj[this.pen_mode].threshold !== null) {
            // 更新
            this.penObj[this.pen_mode].threshold = threshold;
        } else {
            throw new Error('内部エラー：不正な塗り残し補正指定です');
        }
    }
    getGradation() {
        return this.penObj[this.pen_mode].gradation;
    }
    setGradation(gradation) {
        // セット可能チェック
        if (this.penObj[this.pen_mode].gradation !== null) {
            // 更新
            this.penObj[this.pen_mode].gradation = gradation;
        } else {
            throw new Error('内部エラー：不正な角度指定です');
        }
    }
    getToneLevel() {
        return (this.penObj[this.pen_mode].toneLevel !== undefined) ? this.penObj[this.pen_mode].toneLevel : null;
    }
    setToneLevel(toneLevel) {
        // セット可能チェック
        if (this.penObj[this.pen_mode].toneLevel !== null) {
            // 更新
            this.penObj[this.pen_mode].toneLevel = Number(toneLevel);
        } else {
            throw new Error('内部エラー：不正なトーン濃度指定です');
        }
    }
    getBlurLevel() {
        return (this.penObj[this.pen_mode].blurLevel !== undefined) ? this.penObj[this.pen_mode].blurLevel : null;
    }
    setBlurLevel(blurLevel) {
        // セット可能チェック
        if (this.penObj[this.pen_mode].blurLevel !== null) {
            // 更新
            this.penObj[this.pen_mode].blurLevel = Number(blurLevel);
        } else {
            throw new Error('内部エラー：不正なぼかし度指定です');
        }
    }
    getRadius() {
        return (this.penObj[this.pen_mode].radius !== undefined) ? this.penObj[this.pen_mode].radius : null;
    }
    setRadius(radius) {
        // セット可能チェック
        if (this.penObj[this.pen_mode].radius !== null) {
            // 更新
            this.penObj[this.pen_mode].radius = Number(radius);
            this.penObj[this.pen_mode].borderRadius = Number(radius);
        } else {
            throw new Error('内部エラー：不正な丸み指定です');
        }
    }
    getType() {
        return this.penObj[this.pen_mode].type;
    }
    getName() {
        return this.penObj[this.pen_mode].name;
    }
    resetPenStyle() {
        Object.keys(this.penObj).forEach(
            (key) => {
                console.log('key', key);
                this.penObj[key].init();
            }
        )
    }
    /**
     * 現在選択中のペン種別を返却する
     * @returns {String} ペン種別
     */
    getPenMode() {
        return this.pen_mode;
    }
    // 一時的モード更新（引数未指定の場合、変更無しで、ペンツールの再描画を行う）
    changePenModeTemporary(mode) {
        console.log('changePenModeTemporary:', mode);
        // 既に変更中の場合、重複処理しない
        if (this.isTemporary) {
            return;
        }
        this.isTemporary = true;
        this.temporaryMode = mode;
        this.saveMode = this.getPenMode();
        // 現在選択中の要素を記憶し、選択状態を解除
        const elems_penicon = document.querySelectorAll('#axp_pen_div_rightSide>div>button');
        for (const item of elems_penicon) {
            if (item.dataset.selected === 'true') {
                this.saveElement = item;
                item.dataset.selected = 'false';
            }
        }
        // アイコン変更
        switch (mode) {
            case 'axp_penmode_spuit':
                // マウスポインタ：スポイト
                this.axpObj.ELEMENT.view.style.cursor = 'crosshair';
                // ペンガイド線非表示
                this.axpObj.ELEMENT.cursor.style.visibility = 'hidden';
                // [ CTRL ]: 押している間、ペンがスポイトに変化します。
                this.axpObj.msg('@AXP5005');
                document.getElementById('axp_pen_button_spuitBase').dataset.selected = 'true';
                break;
            case 'axp_penmode_hand':
                // マウスポインタ：ハンド
                this.axpObj.ELEMENT.view.style.cursor = 'grab';
                // ペンガイド線非表示
                this.axpObj.ELEMENT.cursor.style.visibility = 'hidden';
                // [ SPACE ]: 押している間、ペンがハンドに変化します。
                this.axpObj.msg('@AXP5006');
                // ハンド以外（移動ツール）が選択されているとき、アイコンをハンドに変化
                let elementHand = document.getElementById('axp_pen_button_handBase');
                elementHand.dataset.selected = 'true';
                this.saveIcon = elementHand.dataset.set;
                elementHand.classList.remove(this.getClassIcon(this.saveIcon));
                elementHand.classList.add(this.getClassIcon(mode));
                this.saveMsg = elementHand.dataset.msg;
                elementHand.dataset.msg = document.getElementById(mode).dataset.msg;
                break;
        }
        this.changePenMode(mode);
    }
    restorePenModeTemporary(mode) {
        console.log('restorePenModeTemporary:', mode);
        // 変更中でなければ、処理しない
        if (!this.isTemporary) {
            return;
        }
        //console.log('比較:', this.temporaryMode, mode);
        // 変更中モードと一致した引数指定でなければ、処理しない（複数キーが押された時の競合回避）
        if (this.temporaryMode != mode) {
            console.log('処理しない');
            return;
        }
        this.isTemporary = false;
        // 一時的に選択していたモードの解除
        // アイコン変更
        switch (mode) {
            case 'axp_penmode_spuit':
                document.getElementById('axp_pen_button_spuitBase').dataset.selected = 'false';
                break;
            case 'axp_penmode_hand':
                // ハンド以外（移動ツール）が選択されていたとき、アイコンを元に戻す
                let elementHand = document.getElementById('axp_pen_button_handBase');
                elementHand.dataset.selected = 'false';
                elementHand.dataset.msg = this.saveMsg;
                elementHand.classList.remove(this.getClassIcon(mode));
                elementHand.classList.add(this.getClassIcon(this.saveIcon));
                break;
        }
        // 復元
        this.saveElement.dataset.selected = 'true';
        this.changePenMode(this.saveMode);
        this.temporaryMode = null;
        this.saveMode = null;
        this.saveElement = null;
        this.saveIcon = null;
        this.saveMsg = null;
        this.axpObj.msg('');
    }
    // モード更新（引数未指定の場合、変更無しで、ペンツールの再描画を行う）
    changePenMode(mode) {
        if (mode) {
            this.pen_mode = mode;
        }
        let type = this.getType();
        // 状態に応じてスライダーの表示／非表示を切り替える
        const displaySlider = (id, value, enabled = true) => {
            if (value === null || enabled === false) {
                UTIL.hide(id);
            } else {
                UTIL.show(id);
                // スライダーつまみ位置
                if (id === 'axp_pen_form_penSize') {
                    // 線の太さの時、レンジスケール補正をかけるためindexを参照
                    document.getElementById(id).volume.value = this.getIndex();
                } else {
                    document.getElementById(id).volume.value = value;
                }
                // スライダーの値
                document.getElementById(id).result.value = value;
            }
        }
        // ペンの太さ
        displaySlider(
            'axp_pen_form_penSize',
            this.getSize(),
        )
        // 不透明度
        displaySlider(
            'axp_pen_form_alpha',
            this.getAlpha(),
        )
        // バケツ閾値
        displaySlider(
            'axp_pen_form_fillThreshold',
            this.getThreshold(),
        )
        // バケツ角度
        displaySlider(
            'axp_pen_form_fillGradationDeg',
            this.getGradation(),
        )
        // クレヨンの丸み
        displaySlider(
            'axp_pen_form_radius',
            this.getRadius(),
        )
        // トーン濃度
        displaySlider(
            'axp_pen_form_toneLevel',
            this.getToneLevel(),
            this.axpObj.config('axp_config_form_ToneLevel') === 'on',
        )
        // ぼかし
        displaySlider(
            'axp_pen_form_blur',
            this.getBlurLevel(),
            this.axpObj.config('axp_config_form_blurLevel') === 'on',
        )
        // 手ぶれ
        displaySlider(
            'axp_pen_form_stabilizer',
            document.getElementById('axp_config_form_stabilizerValue').volume.value,
            type === 'draw' && document.getElementById('axp_config_checkbox_stabilize').checked,
        )


        // 描画セレクトボックス
        if (this.penObj[this.pen_mode].usePenStyle) {
            UTIL.show('axp_pen_select_drawMode');
        } else {
            UTIL.hide('axp_pen_select_drawMode');
        }
        // 塗り潰し判定セレクトボックス
        if (type === 'fill') {
            UTIL.show('axp_pen_select_fillMode');
        } else {
            UTIL.hide('axp_pen_select_fillMode');
        }
        // スポイトRGB表示
        if (type === 'spuit') {
            UTIL.show('axp_pen_div_spuitColorRGBA');
        } else {
            UTIL.hide('axp_pen_div_spuitColorRGBA');
        }
        // ペンの太さプレビュー
        if (this.penObj[this.pen_mode].usePenPreview) {
            document.getElementById('axp_pen_div_preview').style.visibility = 'visible';
        } else {
            document.getElementById('axp_pen_div_preview').style.visibility = 'hidden';
        }
        this.previewPenSize();

        // 選択されたペンの名称をウィンドウに表示
        document.getElementById('axp_pen_span_penName').textContent = this.getName();
    }
    previewPenSize() {
        this.penObj[this.pen_mode].previewPenSize();
    }
    spuit(e) {
        // キャンバス外の場合処理しない
        // console.log('spuit:', e.target.id, this.axpObj.CANVAS.main.id);
        if (e.target.id !== this.axpObj.CANVAS.main.id) {
            // スポイトを使用するにはキャンバス内を指定してください。
            this.axpObj.msg('@CAU5002');
            return;
        }
        var clientRect_draw = this.axpObj.CANVAS.main.getBoundingClientRect();
        var x = parseInt((e.clientX - clientRect_draw.left) * 100 / this.axpObj.scale);
        var y = parseInt((e.clientY - clientRect_draw.top) * 100 / this.axpObj.scale);
        // 座標のドットを読み取る
        var imagedata = this.axpObj.CANVAS.main_ctx.getImageData(x, y, 1, 1);
        // RGBAの取得
        var r = imagedata.data[0];
        var g = imagedata.data[1];
        var b = imagedata.data[2];

        // メインカラーに反映
        this.axpObj.colorMakerSystem.selectPalette();
        this.axpObj.colorMakerSystem.setMainColor('#' + rgb2hex([r, g, b]));

        // %drawingColorName RGB:(%1)
        this.axpObj.msg('@COL0001', this.axpObj.colorMakerSystem.getMainColorRGB());
    }
    autoChangePen() {
        // 自動ペン切換え有効
        if (this.axpObj.config('axp_config_form_autoChangeSpuitToPen') === 'on') {
            // スポイトが選択されているとき（ctrlの一時的なスポイトではない時）ペンに切り替える
            if (!this.axpObj.isCTRL) {
                this.switchMainButton(document.getElementById('axp_pen_button_penBase'), 'spuit');
            }
        }
    }
    fillAll() {
        // アンドゥ用記録
        const targetId = this.axpObj.layerSystem.getId();
        this.axpObj.undoSystem.setUndo({
            type: 'draw',
            detail: 'fillall',
            layerObj: this.axpObj.layerSystem.layerObj[this.axpObj.layerSystem.getLayerIndex(targetId)],
        });

        // 有色と透明の選択
        let type;
        // 透明色または消しゴムの場合は透明
        if (document.getElementById('axp_makecolor_div_transparent').dataset.selected === 'true' || this.getType() === 'eraser') {
            // 透明色
            type = 'destination-out';
        } else {
            if (this.axpObj.layerSystem.getMasked()) {
                // 透明部分の保護
                type = 'source-atop';
            } else {
                type = 'source-over';
            }
        }
        this.CANVAS.draw_ctx.globalCompositeOperation = type;

        this.CANVAS.draw_ctx.globalAlpha = this.getAlpha() / 100;
        this.CANVAS.draw_ctx.shadowBlur = 0; // ぼかし無効

        let toneLevel = this.getToneLevel();
        console.log(toneLevel);
        let adjustColor = this.axpObj.colorMakerSystem.getAdjustColor();
        if (this.axpObj.config('axp_config_form_ToneLevel') === 'on' &&
            toneLevel !== null &&
            toneLevel !== 16) {
            // トーン濃度使用時トーンパターン生成して色指定
            this.CANVAS.brush_ctx.fillStyle = createTonePattern(toneLevel, adjustColor);
        } else {
            // 通常時の色指定
            this.CANVAS.brush_ctx.fillStyle = adjustColor;
        }
        this.CANVAS.brush_ctx.globalAlpha = 1;
        this.CANVAS.brush_ctx.globalCompositeOperation = 'source-over';
        // 全面塗り潰しデータを作成
        this.CANVAS.brush_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
        this.CANVAS.brush_ctx.fillRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);

        // 現在のレイヤーの画像に、透明度を指定して合成
        this.CANVAS.draw_ctx.putImageData(this.axpObj.layerSystem.getImage(), 0, 0);
        this.CANVAS.draw_ctx.drawImage(this.CANVAS.brush, 0, 0);

        // レイヤー更新
        this.axpObj.layerSystem.write(
            this.CANVAS.draw_ctx.getImageData(0, 0, this.axpObj.x_size, this.axpObj.y_size)
        );
        this.axpObj.layerSystem.updateCanvas();
    }
    // 90°回転
    rotate90() {
        // アンドゥ用記録
        const targetId = this.axpObj.layerSystem.getId();
        this.axpObj.undoSystem.setUndo({
            type: 'draw',
            detail: 'rotate90',
            layerObj: this.axpObj.layerSystem.layerObj[this.axpObj.layerSystem.getLayerIndex(targetId)],
        });

        // 現在のレイヤーと同じ画像をもつ、新しいイメージを作成
        // （これを行わないと、アンドゥができなくなるため）
        this.CANVAS.draw_ctx.putImageData(this.axpObj.layerSystem.getImage(), 0, 0);
        this.axpObj.layerSystem.write(
            this.CANVAS.draw_ctx.getImageData(0, 0, this.axpObj.x_size, this.axpObj.y_size)
        );

        // キャンバスが正方形
        const rotate_square = (image) => {
            let width = image.width;
            let layer;
            let n = width;
            for (layer = 0; layer < n / 2; ++layer) {
                let first = layer;
                let last = n - 1 - layer;
                for (let i = first; i < last; i++) {

                    let j = last - i + first;

                    let idx_base = (first * width + i) * 4;
                    let idx_swap = (j * width + first) * 4;
                    let idx_last = (last * width + j) * 4;
                    let idx_las2 = (i * width + last) * 4;

                    var tmp0 = 0;
                    var tmp1 = 0;
                    var tmp2 = 0;
                    var tmp3 = 0;

                    tmp0 = image.data[idx_base + 0];
                    tmp1 = image.data[idx_base + 1];
                    tmp2 = image.data[idx_base + 2];
                    tmp3 = image.data[idx_base + 3];

                    image.data[idx_base + 0] = image.data[idx_swap + 0];
                    image.data[idx_base + 1] = image.data[idx_swap + 1];
                    image.data[idx_base + 2] = image.data[idx_swap + 2];
                    image.data[idx_base + 3] = image.data[idx_swap + 3];

                    image.data[idx_swap + 0] = image.data[idx_last + 0];
                    image.data[idx_swap + 1] = image.data[idx_last + 1];
                    image.data[idx_swap + 2] = image.data[idx_last + 2];
                    image.data[idx_swap + 3] = image.data[idx_last + 3];

                    image.data[idx_last + 0] = image.data[idx_las2 + 0];
                    image.data[idx_last + 1] = image.data[idx_las2 + 1];
                    image.data[idx_last + 2] = image.data[idx_las2 + 2];
                    image.data[idx_last + 3] = image.data[idx_las2 + 3];

                    image.data[idx_las2 + 0] = tmp0;
                    image.data[idx_las2 + 1] = tmp1;
                    image.data[idx_las2 + 2] = tmp2;
                    image.data[idx_las2 + 3] = tmp3;
                }
            }
        }
        // キャンバスの縦と横の長さが異なる場合
        const rotate_rectangle = (image) => {

            let width = image.width;
            let height = image.height;
            let shift_width = 0;
            let shift_height = 0;

            // センタリング用の補正値
            if (width > height) {
                shift_height = Math.trunc((width - height) / 2);
            } else {
                shift_width = Math.trunc((height - width) / 2);
            }

            // キャンバスが正方形ではない場合、サイズを拡張して一時的に正方形とみなす
            width = height = Math.max(width, height);

            // 描画内容を書き込む仮想キャンバス
            let canvas_rotate = document.createElement('canvas');
            let ctx_rotate = canvas_rotate.getContext('2d');
            canvas_rotate.width = width;
            canvas_rotate.height = height;
            ctx_rotate.clearRect(0, 0, width, height);
            ctx_rotate.putImageData(image, shift_width, shift_height);

            let tmp_image = ctx_rotate.getImageData(0, 0, width, height);

            let layer;
            let n = width;
            for (layer = 0; layer < n / 2; ++layer) {
                let first = layer;
                let last = n - 1 - layer;
                for (let i = first; i < last; i++) {

                    let j = last - i + first;

                    let idx_base = (first * width + i) * 4;
                    let idx_swap = (j * width + first) * 4;
                    let idx_last = (last * width + j) * 4;
                    let idx_las2 = (i * width + last) * 4;

                    var tmp0 = 0;
                    var tmp1 = 0;
                    var tmp2 = 0;
                    var tmp3 = 0;

                    tmp0 = tmp_image.data[idx_base + 0];
                    tmp1 = tmp_image.data[idx_base + 1];
                    tmp2 = tmp_image.data[idx_base + 2];
                    tmp3 = tmp_image.data[idx_base + 3];

                    tmp_image.data[idx_base + 0] = tmp_image.data[idx_swap + 0];
                    tmp_image.data[idx_base + 1] = tmp_image.data[idx_swap + 1];
                    tmp_image.data[idx_base + 2] = tmp_image.data[idx_swap + 2];
                    tmp_image.data[idx_base + 3] = tmp_image.data[idx_swap + 3];

                    tmp_image.data[idx_swap + 0] = tmp_image.data[idx_last + 0];
                    tmp_image.data[idx_swap + 1] = tmp_image.data[idx_last + 1];
                    tmp_image.data[idx_swap + 2] = tmp_image.data[idx_last + 2];
                    tmp_image.data[idx_swap + 3] = tmp_image.data[idx_last + 3];

                    tmp_image.data[idx_last + 0] = tmp_image.data[idx_las2 + 0];
                    tmp_image.data[idx_last + 1] = tmp_image.data[idx_las2 + 1];
                    tmp_image.data[idx_last + 2] = tmp_image.data[idx_las2 + 2];
                    tmp_image.data[idx_last + 3] = tmp_image.data[idx_las2 + 3];

                    tmp_image.data[idx_las2 + 0] = tmp0;
                    tmp_image.data[idx_las2 + 1] = tmp1;
                    tmp_image.data[idx_las2 + 2] = tmp2;
                    tmp_image.data[idx_las2 + 3] = tmp3;
                }
            }
            // 回転させたデータを書き込む
            ctx_rotate.putImageData(tmp_image, 0, 0);
            // 元のキャンバスサイズの範囲だけ画像を切り抜く
            this.axpObj.layerSystem.write(
                ctx_rotate.getImageData(shift_width, shift_height, image.width, image.height)
            );
        }
        if (this.axpObj.x_size === this.axpObj.y_size) {
            rotate_square(this.axpObj.layerSystem.getImage());
        } else {
            rotate_rectangle(this.axpObj.layerSystem.getImage());
        }
        this.axpObj.layerSystem.updateCanvas();
    }
    modeChangeSizeOn(inkey, code) {
        // 既に他のキーにより「ペンの太さ調整」中の場合は無効
        if (this.axpObj.codeCHANGE_SIZE_KEY) {
            return;
        }
        let name = this.getName();
        if (this.getSize() === null) {
            // %1の太さは変更できません。
            this.axpObj.msg('@CAU0203', name);
            return;
        }
        this.axpObj.codeCHANGE_SIZE_KEY = code;
        // %1押している間、その場でペンの太さレンジスライダーを操作できます。
        this.axpObj.msg('@AXP5007', `[ ${inkey} ]:`);
    }
    modeChangeSizeOff() {
        if (this.axpObj.codeCHANGE_SIZE_KEY) {
            this.axpObj.codeCHANGE_SIZE_KEY = null;
        }
        this.axpObj.msg('');
    }
    changeOrderSlider() {
        if (this.axpObj.config('axp_config_form_pentoolRangeOrder') === 'size') {
            document.getElementById('axp_pen_form_penSize').style.order = '-1';
        } else {
            document.getElementById('axp_pen_form_penSize').style.order = '0';
        }
    }
    upPenSize() {
        let name = this.getName();
        let size = this.getSize();
        // 太さを変更できないペンを変更したとき
        if (size === null) {
            // %1の太さは変更できません。
            this.axpObj.msg('@CAU0203', name);
            return
        } else {
            size = Number(size);
            if (size >= 200) {
                // %1の太さは200が最大値です。
                this.axpObj.msg('@CAU0204', name);
                return;
            }
            // 一つ上の大きさのサイズをサーチ
            var index = this.getIndex();
            while (range_value[index] === size) {
                index++;
            }
            size = range_value[index];
            // ペンサイズ更新（＋ペンツール表示更新、コンフィグ保存）
            this.setPenSize(size);
        }
    }
    downPenSize() {
        let name = this.getName();
        let size = this.getSize();
        // 太さを変更できないペンを変更したとき
        if (size === null) {
            // %1の太さは変更できません。
            this.axpObj.msg('@CAU0203', name);
            return
        } else {
            size = Number(size);
            if (size <= 1) {
                // %1の太さは1が最小値です。
                this.axpObj.msg('@CAU0205', name);
                return;
            }
            // 一つ下の大きさのサイズをサーチ
            var index = this.getIndex();
            while (range_value[index] === size) {
                index--;
            }
            size = range_value[index];
            // ペンサイズ更新（＋ペンツール表示更新、コンフィグ保存）
            this.setPenSize(size);
        }
    }
    changePenAlpha(type) {
        let name = this.getName();
        let alpha = this.getAlpha();
        // 不透明度を変更できないペンを変更したとき
        if (alpha === null) {
            // %1の不透明度は変更できません。
            this.axpObj.msg('@CAU0200', name);
            return;
        } else {
            alpha = Number(alpha);
            // 上キーなら不透明度を上げる、下キーなら下げる
            if (type === 'up') {
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
    }
}
