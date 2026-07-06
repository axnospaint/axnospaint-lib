// @description ツールウィンドウ：親クラス＞補助ツール

import { ToolWindow } from './window.js';
import htmldata from '../html/window_tool.txt';
import { UTIL, adjustInRange } from './etc.js';
import { confirmExPromise } from './alert.js';
import { defaultSymmetryConfig } from './symmetrydraw.js';
// css適用
import '../css/window_tool.css';

// カラーピッカーライブラリ
import ReinventedColorWheel from './reinvented-color-wheel.js';
import '../css/reinvented-color-wheel.css';

// 補助ツール制御オブジェクト
export class AssistToolSystem extends ToolWindow {
    isDragingMap = false;
    isGrid = false;
    isTransparent = false;
    elementProcessingColor = null;
    // キャンバスサイズ・プリセット（E-1b）。configから復元し、無ければ既定値を使う
    sizePresets = [];
    // 対称・回転描画（曼荼羅/雪結晶）設定。中心点は常にキャンバス中央固定（v1）
    symmetryConfig = defaultSymmetryConfig();
    constructor(axpObj) {
        super(axpObj);
    }
    CANVAS = {
        // 補助ツールのサムネイル表示
        thumbnail: null,
        thumbnail_ctx: null,
    }
    CONST = {
        // 補助ツールのサムネイル表示のサイズ
        X_LOUPE_MAX: 120,
        Y_LOUPE_MAX: 120,
    }
    // 初期ウィンドウ位置
    getDefaultPosition() {
        return {
            left: this.axpObj.paintBodyElement.clientWidth - this.window_width - 10,
            top: 10,
        }
    }
    // 初期化
    init() {
        // HTML
        this.createHTML(
            'axp_tool',
            'AST',
            this.axpObj._('@WINDOW.MISC'),
            'axpc_icon_window_subtool',
            htmldata,
        );
        this.window_width = 300;
        // 初期座標設定
        const pos = this.getDefaultPosition();
        this.window_left = pos.left;
        this.window_top = pos.top;
        //ルーペツールのサムネ表示用キャンバス
        this.CANVAS.thumbnail = document.getElementById('axp_tool_canvas_minimap');
        this.CANVAS.thumbnail_ctx = this.CANVAS.thumbnail.getContext('2d');

        // カラーピッカー：使用定義
        this.colorWheel_subwindow = new ReinventedColorWheel({
            appendTo: document.getElementById('axp_gridconfig_div_colorPicker'),
            rgb: [0, 0, 0],
            wheelDiameter: 166,
            wheelThickness: 20,
            handleDiameter: 16,
            wheelReflectsSaturation: false,
            // handler
            onChange: () => {
                this.changeGridColor();
            },
        });
    }
    resetCanvas() {
        // キャンバスサイズ表示
        document.getElementById('axp_tool_span_canvasSize').textContent =
            `${this.axpObj._('@COMMON.WIDTH')}:${this.axpObj.x_size} ${this.axpObj._('@COMMON.HEIGHT')}:${this.axpObj.y_size}`;

        // 投稿キャンバス サムネイル
        let x = Number(this.axpObj.x_size);
        let y = Number(this.axpObj.y_size);
        let thumbnail_x;
        let thumbnail_y;

        // 縦横どちらかが最大120pxになるように縮小率を計算してキャンバスサイズに反映
        const sc = this.CONST.X_LOUPE_MAX / Math.max(x, y);
        thumbnail_x = Math.round(x * sc);
        thumbnail_y = Math.round(y * sc);
        this.CANVAS.thumbnail.width = thumbnail_x;
        this.CANVAS.thumbnail.height = thumbnail_y;
        this.CANVAS.thumbnail_ctx.clearRect(0, 0, thumbnail_x, thumbnail_y);

        // 表示位置の補正（レイヤーサムネイル用）
        this.axpObj.ctx_map_shift_x = 0;
        this.axpObj.ctx_map_shift_y = 0;
        if (x > y) {
            this.axpObj.ctx_map_shift_y = (x - y) / 2;
        }
        if (x < y) {
            this.axpObj.ctx_map_shift_x = (y - x) / 2;
        }
    }
    // イベント受付開始
    startEvent() {
        // サムネイルをドラッグによるハンド機能
        // 注意：赤線が表示されるとキャンバスがイベントを受け取れなくなるので、外側のDIVでイベントを受け取る
        const thumbnailHandMove = (e) => {
            // サムネイル内の入力座標を取得
            const rectThumbnail = this.CANVAS.thumbnail.getBoundingClientRect();
            const curX = adjustInRange(e.clientX - rectThumbnail.left - 6, 4, this.CONST.X_LOUPE_MAX - 4 - 1);
            const curY = adjustInRange(e.clientY - rectThumbnail.top - 6, 4, this.CONST.Y_LOUPE_MAX - 4 - 1);

            // 可動範囲を算出
            const rectView = this.axpObj.ELEMENT.view.getBoundingClientRect();
            const rectCanvas = this.axpObj.CANVAS.main.getBoundingClientRect();
            const rangeWidth = rectView.width + rectCanvas.width;
            const rangeHeight = rectView.height + rectCanvas.height;

            // 入力座標に対応するカメラ座標を算出 ※画面中央の時[0,0]とする
            const dx = curX * rangeWidth / this.CONST.X_LOUPE_MAX - rangeWidth / 2;
            const dy = curY * rangeHeight / this.CONST.Y_LOUPE_MAX - rangeHeight / 2;
            this.axpObj.cameraX = Math.round(dx * 100 / this.axpObj.scale);
            this.axpObj.cameraY = Math.round(dy * 100 / this.axpObj.scale);

            // キャンバス表示更新
            this.axpObj.refreshCanvas();
        }
        // ドラッグ開始
        document.getElementById('axp_tool_div_minimap_outer').onpointerdown = (e) => {
            this.isDragingMap = true;
            thumbnailHandMove(e);
        }
        // ドラッグ中
        document.getElementById('axp_tool_div_minimap_outer').onpointermove = (e) => {
            if (this.isDragingMap) {
                thumbnailHandMove(e);
            }
        }
        // ドラッグ終了
        document.getElementById('axp_tool_div_minimap_outer').onpointercancel =
            document.getElementById('axp_tool_div_minimap_outer').onpointerleave =
            document.getElementById('axp_tool_div_minimap_outer').onpointerup = () => {
                this.isDragingMap = false;
            }


        // 補助線スライダー
        const inputRangeGridVH = (e) => {
            //console.log(e.target.id, e.target.value);
            const newValue = e.target.value;
            const elementFormGridH = document.getElementById('axp_tool_form_gridH');
            const elementFormGridV = document.getElementById('axp_tool_form_gridV');
            // 縦横連動
            if (document.getElementById('axp_tool_checkbox_gridVHLink').checked) {
                elementFormGridH.volume.value = newValue;
                elementFormGridH.result.value = newValue;
                elementFormGridV.volume.value = newValue;
                elementFormGridV.result.value = newValue;
            }
            this.axpObj.updateGrid();
            this.axpObj.configSystem.saveConfig('RANGE_axp_tool_form_gridH', elementFormGridH.volume.value);
            this.axpObj.configSystem.saveConfig('RANGE_axp_tool_form_gridV', elementFormGridV.volume.value);
        };
        document.getElementById('axp_tool_range_gridH').addEventListener('input', inputRangeGridVH);
        document.getElementById('axp_tool_range_gridV').addEventListener('input', inputRangeGridVH);

        // 縦横連動チェックボックス
        document.getElementById('axp_tool_checkbox_gridVHLink').addEventListener('change', (e) => {
            // チェックした時、横と縦の値を同値にする
            if (e.target.checked) {
                const newValue = document.getElementById('axp_tool_range_gridH').value;
                document.getElementById('axp_tool_form_gridV').volume.value = newValue;
                document.getElementById('axp_tool_form_gridV').result.value = newValue;
                this.axpObj.updateGrid();
                this.axpObj.configSystem.saveConfig('RANGE_axp_tool_form_gridV', newValue);
            }
        });

        // 補助線スライダー（px指定）
        const inputRangeGridPX = (e) => {
            let inputValue = e.target.value;
            // 入力値を範囲内に補正
            let newValue = adjustInRange(Number(inputValue), 1, 100);
            e.target.value = newValue;
            this.axpObj.updateGrid();
            this.axpObj.configSystem.saveConfig(`VALUE_${e.target.id}`, newValue);
        };
        document.getElementById('axp_tool_number_gridPixel1').addEventListener('change', inputRangeGridPX);
        document.getElementById('axp_tool_number_gridPixel2').addEventListener('change', inputRangeGridPX);

        // 共通部品トグル式スイッチ
        const elementTogglebuttons = document.querySelectorAll('.axpc_toggle_switch');
        for (const elem of elementTogglebuttons) {
            const input = elem.querySelector('input');
            // 初期設定（配下のチェックボックスのcheckedの値を要素のdata-checkedに転記）
            if (input.checked) {
                elem.dataset.checked = 'true';
            } else {
                elem.dataset.checked = 'false';
            }
            elem.addEventListener('click', () => {

                if (input.checked) {
                    input.checked = false;
                    elem.dataset.checked = 'false';
                } else {
                    input.checked = true;
                    elem.dataset.checked = 'true';
                }
                // コンフィグ保存
                this.axpObj.configSystem.saveConfig(`TOGSW_${elem.id}`, input.checked);
            });
        }
        // 補助線ON/OFF切り替えボタン
        const elementButtons = document.querySelectorAll('.axp_grid_switch');
        for (const elem of elementButtons) {
            elem.addEventListener('click', () => {
                this.axpObj.updateGrid();
            });
        }
        // 補助線サブメニュー表示切替
        document.getElementById('axp_tool_button_gridConfig').addEventListener('click', (e) => {
            // ボタンの属性を更新することで、適用CSSを変更し、ボタンを凹ませる
            let isOpenConfig = (e.target.dataset.selected === 'true');
            e.target.dataset.selected = isOpenConfig ? 'false' : 'true';
            if (isOpenConfig) {
                UTIL.hide('axp_tool_div_gridConfig');
            } else {
                UTIL.show('axp_tool_div_gridConfig');
            }
        });

        // 色選択
        const elementInputColor = document.querySelectorAll('.axp_common_inputcolor');
        for (const elem of elementInputColor) {
            elem.addEventListener('click', (e) => {
                console.log('open:', e.target.id, e.pageX, e.pageY);
                // 押されたボタン要素を記憶
                this.elementProcessingColor = e.target;

                // カラーピッカーと不透明度スライダーを押されたボタンの色に更新
                let colorcode = this.elementProcessingColor.dataset.colorcode;
                let hex = colorcode.substring(0, 7);
                let alpha = Math.round(100 * parseInt(colorcode.substring(7, 9), 16) / 255);
                const elementRange = document.getElementById('axp_gridconfig_form_gridColor');
                elementRange.volume.value = alpha;
                elementRange.result.value = alpha;
                this.colorWheel_subwindow.hex = hex;
                // サブウィンドウオープン
                this.axpObj.openSubwindow('axp_gridconfig', e.target);
            });
        }

        // 不透明度
        document.getElementById('axp_gridconfig_range_gridColor').addEventListener('input', () => {
            this.changeGridColor();
        });

        document.getElementById('axp_gridconfig').addEventListener('click', () => {
            // 操作中ボタン要素をリセット
            this.elementProcessingColor = null;
            this.axpObj.closeSubwindow('axp_gridconfig');
        });
        document.querySelector('#axp_gridconfig>div').addEventListener('click', (e) => {
            // サブウィンドウ内クリックでウィンドウが閉じないように、親へのイベント伝播を中止
            e.stopPropagation();
        });
        document.getElementById('axp_gridconfig_button_confirm').addEventListener('click', () => {
            // 操作中ボタン要素をリセット
            this.elementProcessingColor = null;
            this.axpObj.closeSubwindow('axp_gridconfig');
        });

        // キャンバスサイズ・プリセット（E-1b）
        this.initSizePresets();

        // 背景色トグル（肌色/白）（E-1c）
        // ※トグルのON/OFF・data-checked・config(TOGSW)保存は共通トグル処理が担う。
        //   ここでは切替後の状態を読み、背景の地色を更新して再描画する。
        const bgToggle = document.getElementById('axp_tool_toggle_bgColor');
        if (bgToggle) {
            const updateBgToggleLabel = () => {
                const isWhite = bgToggle.querySelector('input').checked;
                bgToggle.dataset.label = isWhite
                    ? this.axpObj._('@MISC.BG_WHITE_SHORT')
                    : this.axpObj._('@MISC.BG_SKIN_SHORT');
            };
            updateBgToggleLabel();
            bgToggle.addEventListener('click', () => {
                // 共通トグル処理（input.checked/data-checkedの更新）がこのリスナーより先に
                // 登録されている前提に依存しないよう、同期処理完了後（次のマイクロタスク）に読む
                setTimeout(() => {
                    const isWhite = bgToggle.querySelector('input').checked;
                    updateBgToggleLabel();
                    this.axpObj.backgroundColor = isWhite ? '#ffffff' : this.axpObj.skinBackgroundColor;
                    this.axpObj.layerSystem.updateCanvas();
                }, 0);
            });
        }

        // 対称・回転描画（曼荼羅/雪結晶）
        const symEnabled = document.getElementById('axp_tool_checkbox_symmetryEnabled');
        const symMode = document.getElementById('axp_tool_select_symmetryMode');
        const symCount = document.getElementById('axp_tool_range_symmetryCount');
        const symCountRow = document.getElementById('axp_tool_div_symmetryCountRow');
        this.symmetryConfig.enabled = symEnabled.checked;
        this.symmetryConfig.mode = symMode.value;
        this.symmetryConfig.radialCount = Number(symCount.value);
        const updateCountRowVisibility = () => {
            symCountRow.style.display = (symMode.value === 'radial') ? '' : 'none';
        };
        symEnabled.addEventListener('change', () => {
            this.symmetryConfig.enabled = symEnabled.checked;
            this.axpObj.configSystem.saveConfig('CHECK_axp_tool_checkbox_symmetryEnabled', symEnabled.checked);
        });
        symMode.addEventListener('change', () => {
            this.symmetryConfig.mode = symMode.value;
            this.axpObj.configSystem.saveConfig('VALUE_axp_tool_select_symmetryMode', symMode.value);
            updateCountRowVisibility();
        });
        symCount.addEventListener('input', () => {
            this.symmetryConfig.radialCount = Number(symCount.value);
            document.getElementById('axp_tool_span_symmetryCountValue').textContent = symCount.value;
            this.axpObj.configSystem.saveConfig('VALUE_axp_tool_range_symmetryCount', symCount.value);
        });
        document.getElementById('axp_tool_span_symmetryCountValue').textContent = symCount.value;
        updateCountRowVisibility();
    }
    // プリセット登録値をシステム上限(1000)内へ丸める。環境上限(maxWidth/Height)ではなくシステム上限で
    // 丸めることで、狭い環境（例:dev=600）で復元しても登録値そのものは保持され、無効表示のみで扱える。
    // 不正値（NaN・最小未満等）はnullを返す。
    clampPresetW(v) {
        v = Number(v);
        if (!Number.isFinite(v) || v < this.axpObj.minWidth) return null;
        return Math.min(this.axpObj.CONST.MAX_SYSTEM_WIDTH, Math.round(v));
    }
    clampPresetH(v) {
        v = Number(v);
        if (!Number.isFinite(v) || v < this.axpObj.minHeight) return null;
        return Math.min(this.axpObj.CONST.MAX_SYSTEM_HEIGHT, Math.round(v));
    }
    // キャンバスサイズ・プリセットの既定値（E-1b）
    getDefaultSizePresets() {
        return [
            { w: 600, h: 424 },
            { w: 400, h: 282 },
            { w: 424, h: 600 },
            { w: 1000, h: 1000 },
        ];
    }
    // プリセットの復元・ラベル描画・クリックイベント配線
    initSizePresets() {
        const defaults = this.getDefaultSizePresets();
        this.sizePresets = defaults.map((d, i) => {
            // ※キー名はconfig.jsのrestoreConfigが前提とする「5文字プレフィックス+_」規約に合わせる
            //  （5文字以外にするとrestoreConfig側で復元されず永続化が失敗する）
            const saved = this.axpObj.configSystem.getConfig('AUXSZ_' + i);
            if (typeof saved === 'string') {
                try {
                    const obj = JSON.parse(saved);
                    const w = this.clampPresetW(obj.w);
                    const h = this.clampPresetH(obj.h);
                    if (w !== null && h !== null) {
                        return { w, h };
                    }
                } catch {
                    // 破損データは既定値のまま
                }
            }
            return { w: d.w, h: d.h };
        });
        // 単/複クリック判別（混色ペンプリセットに準拠）
        document.querySelectorAll('.axpc_tool_sizePreset').forEach((btn) => {
            const idx = Number(btn.dataset.sidx);
            let clickTimerID = null; // 適用待機タイマー
            btn.addEventListener('pointerup', () => {
                if (clickTimerID !== null) {
                    // 待機中の再クリック: 適用せず登録サイズを編集
                    clearTimeout(clickTimerID);
                    clickTimerID = null;
                    this.editSizePreset(idx);
                } else {
                    // 0.3秒待機し、再クリックがなければ適用
                    clickTimerID = setTimeout(() => {
                        clickTimerID = null;
                        this.applySizePreset(idx);
                    }, 300);
                }
            });
        });
        this.updateSizePresetDisplay();
    }
    // ボタンラベルと無効表示（この環境の上限超）の更新
    updateSizePresetDisplay() {
        document.querySelectorAll('.axpc_tool_sizePreset').forEach((btn) => {
            const idx = Number(btn.dataset.sidx);
            const p = this.sizePresets[idx];
            if (!p) return;
            btn.textContent = `${p.w}×${p.h}`;
            // この環境の上限を超えるプリセットは無効表示（適用不可・ダブルクリック編集は可能）
            const overLimit = (p.w > this.axpObj.maxWidth || p.h > this.axpObj.maxHeight);
            btn.classList.toggle('axpc_tool_sizePreset_disabled', overLimit);
        });
    }
    // プリセット適用（シングルクリック）
    applySizePreset(idx) {
        const p = this.sizePresets[idx];
        if (!p) return;
        // 起動オプションで、下書き機能使用時のキャンバスサイズの変更が制限されている場合
        // （既存の「お絵カキコのサイズ変更」ボタンと同じガード。config.jsのchangeCanvasSizeKeepImage
        //  内にも同等チェックがあるが、確認ダイアログを出す前にここで早期リターンする）
        if (this.axpObj.restrictDraftCanvasResizing) {
            if (this.axpObj.oekaki_id !== null || this.axpObj.draftImageFile !== null) {
                alert('下書き機能を利用したキャンバスは、サイズの変更ができません。');
                return;
            }
        }
        // この環境の上限を超える場合は適用しない
        if (p.w > this.axpObj.maxWidth || p.h > this.axpObj.maxHeight) {
            alert(`このサイズ（${p.w}×${p.h}）はこの環境の上限（${this.axpObj.maxWidth}×${this.axpObj.maxHeight}）を超えるため適用できません。\nすばやく2回クリックで登録サイズを変更できます。`);
            return;
        }
        const x = this.axpObj.checkCanvasSize_x(p.w);
        const y = this.axpObj.checkCanvasSize_y(p.h);
        // 現在と同じサイズなら何もしない
        if (x === this.axpObj.x_size && y === this.axpObj.y_size) {
            return;
        }
        // 縮小時のみ警告（拡大・同サイズは無警告で即適用）
        if (x < this.axpObj.x_size || y < this.axpObj.y_size) {
            confirmExPromise('キャンバスを縮小すると、はみ出した部分の画像が失われる可能性があります。\n続行しますか？')
                .then(() => {
                    this.axpObj.configSystem.changeCanvasSizeKeepImage(x, y);
                })
                .catch(() => {
                    // キャンセル時は何もしない
                });
        } else {
            this.axpObj.configSystem.changeCanvasSizeKeepImage(x, y);
        }
    }
    // 登録サイズの編集（ダブルクリック相当）
    editSizePreset(idx) {
        const p = this.sizePresets[idx];
        if (!p) return;
        const input = prompt(
            `登録するキャンバスサイズを入力してください（幅×高さ）\n例: 600x424\n（システム上限 ${this.axpObj.CONST.MAX_SYSTEM_WIDTH}×${this.axpObj.CONST.MAX_SYSTEM_HEIGHT}）`,
            `${p.w}x${p.h}`
        );
        if (input === null) return;
        // 全角数字・大文字X・全角×等をIME入力でも受け付けられるよう正規化してから解析
        const normalized = input.trim()
            .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
            .toLowerCase();
        const m = normalized.match(/^(\d+)[\sx×,]+(\d+)$/);
        if (!m) {
            alert('入力の形式が正しくありません。「幅x高さ」（例: 600x424）の形式で入力してください。');
            return;
        }
        const w = this.clampPresetW(m[1]);
        const h = this.clampPresetH(m[2]);
        if (w === null || h === null) {
            alert(`入力値が正しくありません。${this.axpObj.minWidth}以上、システム上限${this.axpObj.CONST.MAX_SYSTEM_WIDTH}×${this.axpObj.CONST.MAX_SYSTEM_HEIGHT}以内の数値を入力してください。`);
            return;
        }
        this.sizePresets[idx] = { w, h };
        // ※キー名はconfig.jsのrestoreConfigが前提とする「5文字プレフィックス+_」規約に合わせる
        this.axpObj.configSystem.saveConfig('AUXSZ_' + idx, JSON.stringify({ w, h }));
        this.updateSizePresetDisplay();
    }
    changeGridColor() {
        // カラーピッカーと不透明度スライダーからカラーコード（アルファ含む）を生成
        let hex = this.colorWheel_subwindow.hex;
        let alpha = Math.trunc(255 * document.getElementById('axp_gridconfig_range_gridColor').value / 100);
        let colorcode = `${hex}${alpha.toString(16)}`;
        // 操作中のボタン要素の色を変更（※重要：アルファを含まない色を背景色に指定する）
        this.elementProcessingColor.style.backgroundColor = hex;
        // カラーコードをdatasetに保存（※重要：アルファを含む色を保存する）
        this.elementProcessingColor.dataset.colorcode = colorcode;
        // 補助線表示一活更新
        this.axpObj.updateGrid();
        // コンフィグ保存
        this.axpObj.configSystem.saveConfig(`GRIDC_${this.elementProcessingColor.id}`, colorcode);
    }

    // 左右反転
    flip_h() {
        // なげなわ変形中は確定してから処理する（未確定のまま反転すると、次の再描画で反転が上書きされるため）
        this.axpObj.finalizeNagenawaSelection();
        // 全体
        this.axpObj.layerSystem.flip_h('all');
        // 全レイヤーの左右を反転しました。
        this.axpObj.msg('@INF1000');
        // アンドゥ用記録
        this.axpObj.undoSystem.setUndo({
            type: 'flip_h',
            id: 'all',
        });
    }
    // 上下反転
    flip_v() {
        // なげなわ変形中は確定してから処理する（未確定のまま反転すると、次の再描画で反転が上書きされるため）
        this.axpObj.finalizeNagenawaSelection();
        // 全体
        this.axpObj.layerSystem.flip_v('all');
        // 全レイヤーの上下を反転しました。
        this.axpObj.msg('@INF1002');
        // アンドゥ用記録
        this.axpObj.undoSystem.setUndo({
            type: 'flip_v',
            id: 'all',
        });
    }
    grid() {
        this.isGrid = !this.isGrid;
        // ボタンの属性を更新することで、適用CSSを変更し、ボタンを凹ませる
        document.getElementById('axp_tool_button_grid').dataset.selected = this.isGrid ? 'true' : 'false';
        if (this.isGrid) {
            // 表示
            UTIL.show('axp_canvas_div_grid');
            // キャンバス表示更新
            this.axpObj.refreshCanvas();
        } else {
            // 非表示
            UTIL.hide('axp_canvas_div_grid');
        }
        var msgtext = this.isGrid ? "表示" : "非表示";
        // 補助線の表示を切り替えました。（現在の状態:%1）
        this.axpObj.msg('@INF1004', msgtext);
    }
    transparent() {
        // なげなわ変形中は確定してから処理する（レイヤー再合成で選択物が一時消失するため）
        this.axpObj.finalizeNagenawaSelection();
        this.isTransparent = !this.isTransparent;
        document.getElementById('axp_tool_button_transparent').dataset.selected = this.isTransparent ? 'true' : 'false';
        this.axpObj.layerSystem.draw();
        var msgtext = this.isTransparent ? "透過" : "白地";
        // 背景を切り替えました。（現在の状態:%1）
        this.axpObj.msg('@INF1005', msgtext);
        this.axpObj.layerSystem.updateCanvas();

        // 投稿フォーム連動
        let input_transparent = document.querySelectorAll("input[name=axp_post_radio_bg]");
        for (let element of input_transparent) {
            if (element.value === 'transparent') {
                element.checked = this.isTransparent;
            } else {
                element.checked = !this.isTransparent;
            }
        }
    }
    getIsTransparent() {
        return this.isTransparent;
    }
    setIsTransparent(flag) {
        this.isTransparent = flag;
        // 補助ツールのボタン
        document.getElementById('axp_tool_button_transparent').dataset.selected = this.isTransparent ? 'true' : 'false';
        // 投稿画面のラジオボタン
        if (flag) {
            document.getElementById('axp_post_radio_bgTransparent').checked = true;
        } else {
            document.getElementById('axp_post_radio_bgWhite').checked = true;
        }
    }
    // サムネイル：キャンバス表示範囲線
    mapguide() {
        var b_rect = this.axpObj.ELEMENT.view.getBoundingClientRect();
        var c_rect = this.axpObj.CANVAS.main.getBoundingClientRect();

        var sub_w = 0;
        var sub_h = 0;

        var sub_top = 0;
        var sub_left = 0;

        var overflow = false;
        var isDisplay = false;

        if (c_rect.top < 0) {
            //console.log('上はみ出し');
            const dy = Math.abs(c_rect.top);
            const dy_sc = (1 - ((c_rect.height - dy) / c_rect.height)) * 120;
            sub_top = dy_sc;
            sub_h = sub_h + parseInt(dy_sc);
            overflow = true;
        }

        var v_down = c_rect.top + c_rect.height;
        if (b_rect.height < v_down) {
            //console.log('下はみ出し');
            const dy = v_down - b_rect.height;
            const dy_sc = (1 - ((c_rect.height - dy) / c_rect.height)) * 120;
            sub_h = sub_h + parseInt(dy_sc);
            overflow = true;
        }

        if (c_rect.left < 0) {
            //console.log('左はみ出し');
            const dx = Math.abs(c_rect.left);
            const dx_sc = (1 - ((c_rect.width - dx) / c_rect.width)) * 120;
            sub_left = dx_sc;
            sub_w = sub_w + parseInt(dx_sc);
            overflow = true;
        }

        var v_left = c_rect.left + c_rect.width;
        if (b_rect.width < v_left) {
            //console.log('右はみ出し');
            const dx = v_left - b_rect.width;
            const dx_sc = (1 - ((c_rect.width - dx) / c_rect.width)) * 120;
            sub_w = sub_w + parseInt(dx_sc);
            overflow = true;
        }

        if (overflow) {
            // キャンバスが表示領域からはみ出した時に表示
            isDisplay = true;

            // ただし、キャンバス全体が完全に表示範囲からはみ出している場合は非表示
            if (sub_left > 120 || sub_top > 120) {
                isDisplay = false;
            }
            if (120 - sub_w < 1 || 120 - sub_h < 1) {
                isDisplay = false;
            }
        }

        const elementRedLine = document.getElementById('axp_tool_div_minimap_line');
        if (isDisplay) {
            UTIL.show(elementRedLine);
            elementRedLine.style.left = -1 + sub_left + "px";
            elementRedLine.style.top = -1 + sub_top + "px";
            elementRedLine.style.width = 1 + 120 - sub_w + "px";
            elementRedLine.style.height = 1 + 120 - sub_h + "px";
        } else {
            UTIL.hide(elementRedLine);
        }
    }
}



