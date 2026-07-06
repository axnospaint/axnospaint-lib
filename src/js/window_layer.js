// @description ツールウィンドウ：親クラス＞レイヤー

import { ToolWindow } from './window.js';
import htmldata from '../html/window_layer.txt';
import { isBlankImage, flip_horizontal, flip_vertical, dispDate, compareImages } from './etc.js';
import { defaultLayerStyle, hasActiveLayerStyle, applyLayerStyle } from './layerstyle.js';
import { defaultMaskImage, hasActiveMask, applyLayerMask } from './layermask.js';
// css適用
import '../css/window_layer.css';

const colorTagListDefault = [
    { name: '下描き', color: '#f33' },
    { name: '線画', color: '#fa3' },
    { name: '下塗り', color: '#ff3' },
    { name: '彩色', color: '#5f5' },
    { name: '陰影', color: '#5ff' },
    { name: 'ハイライト', color: '#55f' },
    { name: '背景', color: '#faf' },
    { name: 'その他', color: '#fff' },
];

/*
const colorTagListDefault = [
    { name: '下描き', color: '#aaf' },
    { name: '線画', color: '#aff' },
    { name: '下塗り', color: '#5f5' },
    { name: '彩色', color: '#ff0' },
    { name: '陰影', color: '#f33' },
    { name: 'ハイライト', color: '#fda' },
    { name: '背景', color: '#f5f' },
    { name: 'その他', color: '#fff' },
];
*/

export class Layerdata {
    constructor(layerData) {
        this.id = layerData.id; // レイヤーのID、レイヤー要素を操作するときの紐づけに使用。重複がないように生成時に連番が振られる
        this.index = layerData.index; // 配列格納時の自身の添字（＝レイヤー表示順）アンドゥ時の復元処理で参照
        this.mode = layerData.mode; // 合成モード
        this.alpha = layerData.alpha; // 不透明度
        this.checked = layerData.checked; // 表示／非表示のチェック状態
        this.locked = layerData.locked; // ロック状態
        this.masked = layerData.masked; // 透明部分の保護状態
        this.name = layerData.name; // レイヤー名
        this.tag = layerData.tag; // カラータグ
        this.image = layerData.image; // 画像データ（imageData）
        // 描画スキップ用キャッシュ（true: 全画素が透明であることが既知。誤って true を設定すると描画抜けが起きるため、保守的に false 寄りに保つ）
        this.isBlank = layerData.isBlank === true;
        // 非破壊レイヤースタイル（フチ取り・ドロップシャドウ）。ピクセルデータ(image)は変更せず、
        // 合成のたびに一時的に重ねて表示する（layerstyle.js）。未指定時は既定値（両効果とも無効）
        this.layerStyle = layerData.layerStyle || defaultLayerStyle();
        // 透明マスク（非破壊消しゴム）。null = マスク無し。{enabled, image} 形式（layermask.js）
        this.mask = layerData.mask || null;
    }
}

export class LayerSystem extends ToolWindow {
    // レイヤーの名前番号に使用するカウンタ
    layer_counter = 0;
    // 選択しているレイヤー要素
    currentLayer = null;
    // 透明マスク編集モードのon/off（特定レイヤーIDには紐付けない。常に選択中レイヤーに対して働く）
    maskEditMode = false;
    // レイヤー情報管理用配列（内部的に添え字０を最上位レイヤーとし、添え字順により下位のレイヤーとする）
    layerObj = [];
    // 合成背景
    CANVAS = {
        // 透過背景用仮想キャンバス
        backscreen_trans: null,
        backscreen_trans_ctx: null,
        // 白地背景用仮想キャンバス
        backscreen_white: null,
        backscreen_white_ctx: null,
        // 一時作業用
        tmp: null,
        tmp_ctx: null,
        merge: null,
        merge_ctx: null,
        thumbnail_ctx: [],
        clip: null,
        clip_ctx: null,
        // safariの場合、描画時にレイヤーの枚数分のcanvasをワークエリアとして使用する
        layer_ctx: [],
    };
    CONST = {
        // 最大レイヤー数
        LAYER_MAX: 100,
        // レイヤーのサムネイル表示のサイズ
        X_LAYER_MAX: 40,
        Y_LAYER_MAX: 40,
        // スクロールバーを表示する閾値（このレイヤー数を超えるとスクロールバー表示）
        LAYER_SCROLL_THRESHOLD: 8,
        // スクロールバーつまみの最小高さ（px）：視覚幅32pxと一致
        SCROLL_THUMB_MIN_HEIGHT: 32,
    }
    // レイヤーUIの内部スクロール位置
    layerScrollY = 0;
    // レイヤーUIスクロール用のDOM参照（initLayerScrollで設定）
    layerScrollEl = null;
    // 描画処理用の一時保存イメージ
    imageForUndo;
    // stroke active flag: suppresses thumbnail updates during drawing
    isStrokeActive = false;
    // composite layer cache for fast drawing path
    compositeFastPathActive = false;
    // カラータグリスト
    colorTagList = null;
    constructor(axpObj) {
        super(axpObj);
    }
    // 初期ウィンドウ位置
    getDefaultPosition() {
        return {
            left: 0,
            top: 400,
        }
    }
    init() {
        this.createHTML(
            'axp_layer',
            'LAY',
            this.axpObj._('@WINDOW.LAYER'),
            'axpc_icon_window_layer',
            htmldata
        );
        this.window_width = 180;
        // 初期座標設定
        const pos = this.getDefaultPosition();
        this.window_left = pos.left;
        this.window_top = pos.top;
        // 合成背景
        this.CANVAS.backscreen_white = document.createElement('canvas');
        //this.CANVAS.backscreen_white_ctx = this.CANVAS.backscreen_white.getContext('2d', { willReadFrequently: true });
        this.CANVAS.backscreen_white_ctx = this.CANVAS.backscreen_white.getContext('2d');
        this.CANVAS.backscreen_trans = document.createElement('canvas');
        //this.CANVAS.backscreen_trans_ctx = this.CANVAS.backscreen_trans.getContext('2d', { willReadFrequently: true });
        this.CANVAS.backscreen_trans_ctx = this.CANVAS.backscreen_trans.getContext('2d');
        // ワークエリア
        this.CANVAS.tmp = document.createElement('canvas');
        //this.CANVAS.tmp_ctx = this.CANVAS.tmp.getContext('2d', { willReadFrequently: true });
        this.CANVAS.tmp_ctx = this.CANVAS.tmp.getContext('2d');
        // マージ用
        this.CANVAS.merge = document.createElement('canvas');
        this.CANVAS.merge_ctx = this.CANVAS.merge.getContext('2d');
        // クリッピング用
        this.CANVAS.clip = document.createElement('canvas');
        this.CANVAS.clip_ctx = this.CANVAS.clip.getContext('2d');
        // composite layer cache
        this.CANVAS.compositeBelow = document.createElement('canvas');
        this.CANVAS.compositeBelowCtx = this.CANVAS.compositeBelow.getContext('2d');
        this.CANVAS.compositeAbove = document.createElement('canvas');
        this.CANVAS.compositeAboveCtx = this.CANVAS.compositeAbove.getContext('2d');
    }
    resetCanvas() {
        this.x_size = this.axpObj.x_size;
        this.y_size = this.axpObj.y_size;

        this.CANVAS.backscreen_white.width = this.x_size;
        this.CANVAS.backscreen_white.height = this.y_size;
        this.CANVAS.backscreen_trans.width = this.x_size;
        this.CANVAS.backscreen_trans.height = this.y_size;
        this.CANVAS.tmp.width = this.x_size;
        this.CANVAS.tmp.height = this.y_size;
        this.CANVAS.merge.width = this.x_size;
        this.CANVAS.merge.height = this.y_size;
        this.CANVAS.clip.width = this.x_size;
        this.CANVAS.clip.height = this.y_size;
        this.CANVAS.compositeBelow.width = this.x_size;
        this.CANVAS.compositeBelow.height = this.y_size;
        this.CANVAS.compositeAbove.width = this.x_size;
        this.CANVAS.compositeAbove.height = this.y_size;

        this.layer_counter = 0;
        this.currentLayer = null;
        this.layerObj.splice(0);
        this.CANVAS.thumbnail_ctx.splice(0);
        // safari
        if (this.axpObj.ENV.multiCanvas) {
            this.CANVAS.layer_ctx.splice(0);
        }
        // レイヤー表示の削除
        const elem_layerbox = document.getElementById('axp_layer_ul_layerBox');
        while (elem_layerbox.firstChild) {
            elem_layerbox.removeChild(elem_layerbox.firstChild);
        }
        // スクロール状態リセット
        this.layerScrollY = 0;
        this.updateLayerScrollbar();
    }
    // イベント受付開始
    startEvent() {
        // セレクトボックス：レイヤー合成モード
        document.getElementById('axp_layer_select_blendMode').addEventListener('change', (e) => {
            // なげなわ変形中は確定してから処理する
            this.axpObj.finalizeNagenawaSelection();
            // レイヤー合成モード変更
            this.setBlendMode(e.target.value);
            this.updateCanvas();
            // ポインタが移動して他のenterイベントを発生させてしまうため、メッセージ表示なし
        });

        // レンジスライダー：レイヤー不透明度
        document.getElementById('axp_layer_range_alpha').addEventListener('input', (e) => {
            // 透明度を変更
            const alpha = Number(e.target.value);
            this.setAlpha(alpha);
            this.updateCanvas();
            // %1の不透明度：%2
            this.axpObj.msg('@AXP0003', this.getName(), alpha);
        });

        // カラータグリストのユーザー設定データがない場合デフォルト値を使用する
        if (this.colorTagList === null) {
            this.resetColorTagList();
        }

        // 画面のレイヤー名更新
        const updateLayerName = (nameText) => {
            this.currentLayer.querySelector('.axpc_layer_span_cellName').textContent = nameText;
        }
        // 画面のタグ色更新
        const updateTagColor = (color) => {
            this.currentLayer.querySelector('.axpc_layer_div_cellColorTag').style.backgroundColor = color;
        }
        const cancelRename = () => {
            // サブウィンドウクローズ
            this.axpObj.closeSubwindow('axp_renamelayer');
        }
        // サブウィンドウ
        document.getElementById('axp_renamelayer').addEventListener('click', () => {
            cancelRename();
        });
        document.querySelector('#axp_renamelayer>div').addEventListener('click', (e) => {
            // サブウィンドウ内クリックでウィンドウが閉じないように、親へのイベント伝播を中止
            e.stopPropagation();
        });
        // キャンセルボタン
        document.getElementById('axp_renamelayer_button_close').addEventListener('click', () => {
            cancelRename();
        });

        const confirmRename = () => {
            // 入力された新レイヤー名（内部的に20文字以内※入力は10文字までしかできない）
            let newName =
                this.normalizeLayerName(
                    document.getElementById('axp_renamelayer_text_newLayerName').value,
                    20
                );
            if (newName === '') {
                // レイヤー名を空白にすることはできません。
                this.axpObj.msg('@CAU4007');
            } else {
                // 画面上のレイヤー名の更新
                updateLayerName(newName);
                // レイヤーオブジェクトの更新
                this.setName(newName);
                // レイヤー名を%1に変更しました。
                this.axpObj.msg('@INF4005', newName);
                this.axpObj.closeSubwindow('axp_renamelayer');
            }
        }
        // 決定ボタン
        document.getElementById('axp_renamelayer_button_confirm').addEventListener('click', (e) => {
            // ボタン有効時のみ処理
            if (e.target.dataset.enabled === 'true') {
                confirmRename();
            }
        });
        document.getElementById('axp_renamelayer_button_confirm').addEventListener('pointerenter', (e) => {
            // 状態に応じてメッセージを変える
            if (e.target.dataset.enabled === 'true') {
                this.axpObj.msg('@AXP4010');
            } else {
                this.axpObj.msg('@AXP4013');
            }
        });
        // エンターキーで決定
        document.getElementById('axp_renamelayer_text_newLayerName').addEventListener('keydown', (e) => {
            // e.keyが有効の場合のみ処理する（オートコンプリートによるイベントを無視）
            if (!e.key) return;
            if (e.key === 'Enter') {
                // 状態（レイヤー名に変更があったか）に応じて決定とキャンセルを分岐
                if (document.getElementById('axp_renamelayer_button_confirm').dataset.enabled === 'true') {
                    confirmRename();
                } else {
                    cancelRename();
                }
            }
        });
        // テキスト入力時
        document.getElementById('axp_renamelayer_text_newLayerName').addEventListener('input', () => {
            // 決定ボタン有効化
            document.getElementById('axp_renamelayer_button_confirm').dataset.enabled = 'true';
        });
        // 色解除
        document.getElementById('axp_renamelayer_button_colorReset').addEventListener('click', () => {
            this.setTag(-1);
            updateTagColor(this.getTagBackground(-1));
            // レイヤーに付与した色を解除しました。
            this.axpObj.msg('@INF4009');
        });

        // カラータグ
        const elementColorTagButton = document.getElementById('axp_renamelayer_div_colorTag');
        const elementColorTagButtonConfig = document.getElementById('axp_config_div_colorTag');

        for (let idx = 0; idx < this.colorTagList.length; idx++) {
            const newButton = elementColorTagButton.appendChild(
                this.createTagHTML(this.colorTagList[idx])
            );
            newButton.addEventListener('click', () => {
                const name = this.colorTagList[idx].name;
                // 登録されている単語を新しい名前とする
                // 既に同じ名前が使用されている場合、(2)、(3)と番号をつける
                const newName = this.replaceDuplicateLayerName(name);
                const newColor = this.colorTagList[idx].color;
                // 画面上のレイヤー名、タグ色の更新
                updateLayerName(newName);
                updateTagColor(newColor);
                // レイヤーオブジェクトの更新
                this.setName(newName);
                this.setTag(idx);
                // レイヤー名を%1に変更しました。
                this.axpObj.msg('@INF4005', newName);
                this.axpObj.closeSubwindow('axp_renamelayer');
            });
            newButton.addEventListener('pointerenter', () => {
                // 登録された名前に変更し、色を付与します。
                this.axpObj.msg('@AXP4012');
            });

            // 設定タブ用UI
            const newConfig = elementColorTagButtonConfig.appendChild(
                this.createTagConfigHTML(this.colorTagList[idx], idx)
            );
            // タグ名変更時の処理
            newConfig.querySelector('input').addEventListener('change', (e) => {
                // ８文字以内
                let newName = this.normalizeLayerName(e.target.value, 8);
                if (newName === '') {
                    e.target.value = this.colorTagList[idx].name;
                    // カラータグ名を空白にすることはできません。
                    this.axpObj.msg('@CAU4008');
                } else {
                    // 正規化した名前を自身に反映
                    e.target.value = newName;
                    // カラータグリスト更新
                    this.colorTagList[idx].name = newName;
                    // レイヤー名変更サブウィンドウのボタン表示に反映
                    document.querySelectorAll('.axpc_renamelayer_button_colorTag')[idx].textContent = newName;
                    // コンフィグ保存
                    this.axpObj.configSystem.saveConfig('COTAG', this.colorTagList);
                    // カラータグ名を%1に変更しました。
                    this.axpObj.msg('@INF4008', newName);
                }
            });
        }

        document.getElementById('axp_renamelayer_button_flipH').addEventListener('click', () => {
            this.flip_h();
            // 選択中レイヤーの左右を反転しました。
            this.axpObj.msg('@INF1001');
            // アンドゥ用記録
            this.axpObj.undoSystem.setUndo({
                type: 'flip_h',
                id: this.axpObj.layerSystem.getId(),
            });
        });
        document.getElementById('axp_renamelayer_button_flipV').addEventListener('click', () => {
            this.flip_v();
            // 選択中レイヤーの上下を反転しました。
            this.axpObj.msg('@INF1003');
            // アンドゥ用記録
            this.axpObj.undoSystem.setUndo({
                type: 'flip_v',
                id: this.axpObj.layerSystem.getId(),
            });
        });

        // 非破壊レイヤースタイル（フチ取り・ドロップシャドウ）UI配線
        this._wireLayerStyleControls();
        // 透明マスク（非破壊消しゴム）UI配線
        this._wireMaskControls();

        // レイヤーUIの内部スクロール（カスタムスクロールバー）
        this.initLayerScroll();
    }
    // 非破壊レイヤースタイル（フチ取り・ドロップシャドウ）コントロールの配線。
    // ライブプレビュー(input)は都度即時反映、アンドゥ登録(change)は編集開始時の値との
    // 差分が確定した時点で1件のみ記録する（スライダーの途中経過を逐一記録しない）。
    _wireLayerStyleControls() {
        const els = {
            strokeEnabled: document.getElementById('axp_layerstyle_checkbox_strokeEnabled'),
            strokeRadius: document.getElementById('axp_layerstyle_range_strokeRadius'),
            strokeColor: document.getElementById('axp_layerstyle_color_stroke'),
            shadowEnabled: document.getElementById('axp_layerstyle_checkbox_shadowEnabled'),
            shadowOffsetX: document.getElementById('axp_layerstyle_range_shadowOffsetX'),
            shadowOffsetY: document.getElementById('axp_layerstyle_range_shadowOffsetY'),
            shadowBlur: document.getElementById('axp_layerstyle_range_shadowBlur'),
            shadowOpacity: document.getElementById('axp_layerstyle_range_shadowOpacity'),
            shadowColor: document.getElementById('axp_layerstyle_color_shadow'),
        };
        this._layerStyleBeforeEdit = null;
        const currentLayerId = () => Number(this.currentLayer.dataset.id);
        const beginEdit = () => {
            if (this._layerStyleBeforeEdit === null) {
                this._layerStyleBeforeEdit = JSON.parse(JSON.stringify(this.getLayerStyle(currentLayerId())));
            }
        };
        const readStyleFromControls = () => ({
            stroke: {
                enabled: els.strokeEnabled.checked,
                radius: Number(els.strokeRadius.value),
                color: els.strokeColor.value,
            },
            dropShadow: {
                enabled: els.shadowEnabled.checked,
                offsetX: Number(els.shadowOffsetX.value),
                offsetY: Number(els.shadowOffsetY.value),
                blur: Number(els.shadowBlur.value),
                opacity: Number(els.shadowOpacity.value),
                color: els.shadowColor.value,
            },
        });
        const applyLive = () => {
            const id = currentLayerId();
            this.setLayerStyle(id, readStyleFromControls());
            this.updateCanvas(id);
        };
        const commitEdit = () => {
            if (this._layerStyleBeforeEdit === null) return;
            const id = currentLayerId();
            const before = this._layerStyleBeforeEdit;
            const after = JSON.parse(JSON.stringify(this.getLayerStyle(id)));
            this._layerStyleBeforeEdit = null;
            // 変化がなければアンドゥ登録しない（開いただけ・値を戻して閉じた等）
            if (JSON.stringify(before) === JSON.stringify(after)) return;
            this.axpObj.undoSystem.setUndo({
                type: 'layer-style',
                id,
                styleBefore: before,
                styleAfter: after,
            });
            // レイヤースタイルを変更しました。
            this.axpObj.msg('@INF1012');
            this.axpObj.saveSystem.autoSave();
        };
        for (const el of Object.values(els)) {
            el.addEventListener('pointerdown', beginEdit);
            el.addEventListener('focus', beginEdit);
            el.addEventListener('input', applyLive);
            el.addEventListener('change', commitEdit);
        }
    }
    // レイヤースタイルUIコントロールへ、指定レイヤーの現在値を反映する
    _populateLayerStyleControls(id) {
        this._layerStyleBeforeEdit = null;
        const style = this.getLayerStyle(id);
        document.getElementById('axp_layerstyle_checkbox_strokeEnabled').checked = style.stroke.enabled;
        document.getElementById('axp_layerstyle_range_strokeRadius').value = style.stroke.radius;
        document.getElementById('axp_layerstyle_color_stroke').value = style.stroke.color;
        document.getElementById('axp_layerstyle_checkbox_shadowEnabled').checked = style.dropShadow.enabled;
        document.getElementById('axp_layerstyle_range_shadowOffsetX').value = style.dropShadow.offsetX;
        document.getElementById('axp_layerstyle_range_shadowOffsetY').value = style.dropShadow.offsetY;
        document.getElementById('axp_layerstyle_range_shadowBlur').value = style.dropShadow.blur;
        document.getElementById('axp_layerstyle_range_shadowOpacity').value = style.dropShadow.opacity;
        document.getElementById('axp_layerstyle_color_shadow').value = style.dropShadow.color;
    }
    // 透明マスク（非破壊消しゴム）：追加・削除・有効/無効はメタ情報の切替であり、
    // rename/blendMode/alpha/lock/visibility等の既存の切替系と同じくアンドゥ非対応とする
    // （既存踏襲。ピクセルを直接書き換えるマスクブラシのストロークのみアンドゥ対象とする）。
    // mask.image / mask全体は常に「新しいオブジェクトで置き換える」方式とし、既存オブジェクトの
    // プロパティを直接書き換えない（copyLayer/undoスナップショットは参照コピーのため、直接書き換える
    // と後からの編集がスナップショット側にも波及してしまう＝アンドゥ履歴が静かに壊れる不具合を防ぐ）。
    addMask(id = null) {
        const targetId = id ?? this.getId();
        const idx = this.getLayerIndex(targetId);
        if (this.layerObj[idx].mask) return;
        this.layerObj[idx].mask = { enabled: true, image: defaultMaskImage(this.x_size, this.y_size) };
        this.updateCanvas(targetId);
    }
    removeMask(id = null) {
        const targetId = id ?? this.getId();
        const idx = this.getLayerIndex(targetId);
        if (!this.layerObj[idx].mask) return;
        this.layerObj[idx].mask = null;
        // このレイヤーのマスクに対する未実行のundo/redo（'mask-edit'）は、対象マスクが
        // 消滅した以上意味を持たない（再追加された無関係な新しいマスクを誤って上書きする
        // 事故を防ぐため、残さず破棄する）
        this.axpObj.undoSystem.undoObj = this.axpObj.undoSystem.undoObj.filter(
            (a) => !(a.type === 'mask-edit' && a.id === targetId)
        );
        this.axpObj.undoSystem.redoObj = this.axpObj.undoSystem.redoObj.filter(
            (a) => !(a.type === 'mask-edit' && a.id === targetId)
        );
        this.updateCanvas(targetId);
    }
    toggleMaskEnabled(id = null) {
        const targetId = id ?? this.getId();
        const idx = this.getLayerIndex(targetId);
        if (!this.layerObj[idx].mask) return;
        this.layerObj[idx].mask = { ...this.layerObj[idx].mask, enabled: !this.layerObj[idx].mask.enabled };
        this.updateCanvas(targetId);
    }
    // マスク編集コントロールの配線
    _wireMaskControls() {
        const btnAddRemove = document.getElementById('axp_mask_button_addRemove');
        const cbEnabled = document.getElementById('axp_mask_checkbox_enabled');
        const btnEditToggle = document.getElementById('axp_mask_button_editToggle');

        btnAddRemove.addEventListener('click', () => {
            const id = Number(this.currentLayer.dataset.id);
            if (this.layerObj[this.getLayerIndex(id)].mask) {
                this.removeMask(id);
            } else {
                this.addMask(id);
            }
            this._populateMaskControls(id);
        });
        cbEnabled.addEventListener('change', () => {
            this.toggleMaskEnabled(Number(this.currentLayer.dataset.id));
        });
        btnEditToggle.addEventListener('click', () => {
            // マスク編集モードは特定レイヤーのIDではなく単純なon/offのモードとして持つ
            // （選択中レイヤーに対して働く。選択レイヤーの切替やレイヤー削除でIDが不整合になる
            // 問題を根本的に避けるため）
            this.maskEditMode = !this.maskEditMode;
            this._populateMaskControls(Number(this.currentLayer.dataset.id));
        });
    }
    // マスクUIコントロールへ、指定レイヤーの現在値を反映する
    _populateMaskControls(id) {
        const idx = this.getLayerIndex(id);
        const mask = this.layerObj[idx].mask;
        const btnAddRemove = document.getElementById('axp_mask_button_addRemove');
        const cbEnabled = document.getElementById('axp_mask_checkbox_enabled');
        const btnEditToggle = document.getElementById('axp_mask_button_editToggle');
        btnAddRemove.textContent = mask ? this.axpObj._('@LAYERMASK.REMOVE') : this.axpObj._('@LAYERMASK.ADD');
        cbEnabled.checked = !!mask?.enabled;
        cbEnabled.disabled = !mask;
        btnEditToggle.disabled = !mask;
        btnEditToggle.dataset.editing = this.maskEditMode ? 'true' : 'false';
    }
    // ==== マスクブラシ（マスク編集モード専用の簡易円ブラシ。既存ペンツールとは独立） ====
    // マスク編集モードでのキャンバスへのポインタ操作は、axpobj.jsのpointerdown/move/upハンドラから
    // このstart/move/endへ委譲される（通常の描画パイプラインは経由しない）。
    // 対象レイヤーはstart時にcurrentLayerから解決し、ストローク中は固定する
    // （ストローク途中でレイヤー選択が変わっても書き込み先がぶれないようにするため）。
    maskBrushStart(x, y) {
        if (!this.maskEditMode) return;
        const id = Number(this.currentLayer.dataset.id);
        const idx = this.getLayerIndex(id);
        if (!this.layerObj[idx].mask) {
            this.maskEditMode = false;
            this._populateMaskControls(id);
            return;
        }
        // ロックされたレイヤーは通常の描画と同様にマスク編集も禁止する
        if (this.isWriteProtection(idx)) return;
        this._maskBrushTargetId = id;
        this._maskBrushBefore = this.layerObj[idx].mask.image;
        this._maskBrushCanvas = document.createElement('canvas');
        this._maskBrushCanvas.width = this.x_size;
        this._maskBrushCanvas.height = this.y_size;
        this._maskBrushCtx = this._maskBrushCanvas.getContext('2d');
        this._maskBrushCtx.putImageData(this._maskBrushBefore, 0, 0);
        this._maskBrushLastX = null;
        this._maskBrushLastY = null;
        this._maskBrushStamp(x, y);
    }
    maskBrushMove(x, y) {
        if (!this._maskBrushCtx) return;
        this._maskBrushStamp(x, y);
    }
    maskBrushEnd() {
        if (!this._maskBrushCtx) return;
        const id = this._maskBrushTargetId;
        const idx = this.getLayerIndex(id);
        const after = this._maskBrushCtx.getImageData(0, 0, this.x_size, this.y_size);
        const before = this._maskBrushBefore;
        // レイヤーが消えている場合（ストローク中の削除等）は書き戻さない
        if (idx !== -1 && this.layerObj[idx].mask) {
            this.layerObj[idx].mask = { ...this.layerObj[idx].mask, image: after };
        }
        if (!compareImages(before, after)) {
            this.axpObj.undoSystem.setUndo({
                type: 'mask-edit',
                id,
                maskBefore: before,
                maskAfter: after,
            });
            // マスクを編集しました。
            this.axpObj.msg('@INF1013');
            this.axpObj.saveSystem.autoSave();
        }
        this._maskBrushCtx = null;
        this._maskBrushCanvas = null;
        this._maskBrushBefore = null;
        this._maskBrushTargetId = null;
        this.updateCanvas(id);
    }
    // 円形スタンプを1点描く。lastX/lastY があれば区間を等間隔で補間して線を繋ぐ
    _maskBrushStamp(x, y) {
        const size = Number(document.getElementById('axp_mask_range_brushSize').value);
        const strength = Number(document.getElementById('axp_mask_range_brushStrength').value) / 100;
        const isRestore = document.getElementById('axp_mask_checkbox_restoreMode').checked;
        const ctx = this._maskBrushCtx;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = strength;
        ctx.fillStyle = isRestore ? '#ffffff' : '#000000';
        const drawDot = (px, py) => {
            ctx.beginPath();
            ctx.arc(px, py, size / 2, 0, Math.PI * 2);
            ctx.fill();
        };
        if (this._maskBrushLastX === null) {
            drawDot(x, y);
        } else {
            const dx = x - this._maskBrushLastX;
            const dy = y - this._maskBrushLastY;
            const dist = Math.hypot(dx, dy);
            const step = Math.max(1, size / 4);
            const steps = Math.max(1, Math.ceil(dist / step));
            for (let i = 1; i <= steps; i++) {
                drawDot(this._maskBrushLastX + dx * (i / steps), this._maskBrushLastY + dy * (i / steps));
            }
        }
        this._maskBrushLastX = x;
        this._maskBrushLastY = y;
        // ライブプレビュー（フルフレーム再合成。マスク編集はfast path対象外のためこれで十分）
        const idx = this.getLayerIndex(this._maskBrushTargetId);
        if (idx === -1 || !this.layerObj[idx].mask) return;
        this.layerObj[idx].mask = { ...this.layerObj[idx].mask, image: ctx.getImageData(0, 0, this.x_size, this.y_size) };
        this.updateCanvas(this._maskBrushTargetId);
    }
    // レイヤーUIの内部スクロール初期化
    initLayerScroll() {
        this.layerScrollEl = {
            container: document.getElementById('axp_layer_div_layerBoxContainer'),
            ul: document.getElementById('axp_layer_ul_layerBox'),
            thumb: document.getElementById('axp_layer_div_scrollThumb'),
        };
        const { container, thumb } = this.layerScrollEl;

        // PC：マウスホイールでスクロール（スクロールバー表示時のみ）
        // stopPropagationで裏側キャンバス（document側のmouseWheel）への伝搬を止める
        container.addEventListener('wheel', (e) => {
            if (!this.isLayerScrollable()) return;
            e.preventDefault();
            e.stopPropagation();
            this.setLayerScrollY(this.layerScrollY + e.deltaY);
        }, { passive: false });

        // スマホ等：スクロールバーつまみのドラッグ
        let thumbDrag = null;
        thumb.addEventListener('pointerdown', (e) => {
            // レイヤー入れ替えのpointerdownへ伝搬させない
            e.stopPropagation();
            e.preventDefault();
            thumb.setPointerCapture(e.pointerId);
            thumbDrag = { startClientY: e.clientY, startScrollY: this.layerScrollY };
        });
        thumb.addEventListener('pointermove', (e) => {
            if (!thumbDrag) return;
            const trackHeight = container.offsetHeight - thumb.offsetHeight;
            const scrollRange = this.getLayerScrollMax();
            if (trackHeight <= 0 || scrollRange <= 0) return;
            const dy = e.clientY - thumbDrag.startClientY;
            this.setLayerScrollY(thumbDrag.startScrollY + dy * (scrollRange / trackHeight));
        });
        const endThumbDrag = (e) => {
            if (!thumbDrag) return;
            thumbDrag = null;
            if (thumb.hasPointerCapture(e.pointerId)) {
                thumb.releasePointerCapture(e.pointerId);
            }
        };
        thumb.addEventListener('pointerup', endThumbDrag);
        thumb.addEventListener('pointercancel', endThumbDrag);
    }
    // スクロールバーが表示されている（＝スクロール可能な）状態か
    isLayerScrollable() {
        return this.layerScrollEl?.container.dataset.scrollable === 'true';
    }
    // スクロール可能な最大量（コンテンツ高 - 表示領域高）
    getLayerScrollMax() {
        const { container, ul } = this.layerScrollEl;
        return Math.max(0, ul.scrollHeight - container.offsetHeight);
    }
    // スクロール位置の設定（範囲クランプ＋つまみ更新）
    setLayerScrollY(y) {
        if (!this.layerScrollEl) return;
        this.layerScrollY = Math.max(0, Math.min(this.getLayerScrollMax(), y));
        this.layerScrollEl.ul.style.top = `-${this.layerScrollY}px`;
        this.updateLayerScrollThumb();
    }
    // スクロールバー表示状態の更新（レイヤー追加・削除・初期化時に呼び出す）
    updateLayerScrollbar() {
        if (!this.layerScrollEl) return;
        const scrollable = this.layerObj.length > this.CONST.LAYER_SCROLL_THRESHOLD;
        // CSS側 [data-scrollable="true"] と整合させるため空文字でOFFを表現
        this.layerScrollEl.container.dataset.scrollable = scrollable ? 'true' : '';
        // 表示状態が変わった結果として、現スクロール量をクランプし直して反映
        this.setLayerScrollY(this.layerScrollY);
    }
    // スクロールバーつまみの位置・サイズを再計算
    updateLayerScrollThumb() {
        if (!this.isLayerScrollable()) return;
        const { container, ul, thumb } = this.layerScrollEl;
        const containerHeight = container.offsetHeight;
        const scrollRange = this.getLayerScrollMax();
        if (scrollRange <= 0) {
            thumb.style.height = '0';
            return;
        }
        const thumbHeight = Math.max(
            this.CONST.SCROLL_THUMB_MIN_HEIGHT,
            containerHeight * containerHeight / ul.scrollHeight
        );
        const trackHeight = containerHeight - thumbHeight;
        thumb.style.height = `${thumbHeight}px`;
        thumb.style.top = `${(this.layerScrollY / scrollRange) * trackHeight}px`;
    }
    // 重複しない新規レイヤー名を取得
    getNewLayerName() {
        const checkDuplicateLayerName = (name, depth = 1) => {
            let testName = `${name}${depth}`;
            let resultName;
            let isDuplicate = false;
            for (let idx = 0; idx < this.layerObj.length; idx++) {
                if (testName == this.layerObj[idx].name) {
                    // 同じ名前が存在したら重複フラグを立てる
                    isDuplicate = true;
                    break;
                }
            }
            if (isDuplicate) {
                // 深度を+1して再帰、重複しない番号を特定する
                resultName = checkDuplicateLayerName(name, depth + 1);
            } else {
                resultName = testName;
            }
            return resultName;
        }
        return checkDuplicateLayerName(this.axpObj._('@LAYER.NEWLAYER_TEMPLATE'));
    }
    // 重複したレイヤー名を書き換え（カラータグ用） 引数depthは指定不要
    replaceDuplicateLayerName(name, depth = 1) {
        let testName;
        let resultName;
        let isDuplicate = false;
        if (depth === 1) {
            // 初回時
            testName = name;
        } else {
            // 再帰時
            testName = `${name}(${depth})`;
        }
        for (let idx = 0; idx < this.layerObj.length; idx++) {
            console.log(this.layerObj[idx].name);
            if (idx === this.getLayerIndex(this.currentLayer.dataset.id)) {
                // 自分自身（名前変更中のレイヤー）の重複チェックをスキップ
                console.log(this.layerObj[idx].name, 'は変更中のレイヤー自身');
            } else {
                if (testName == this.layerObj[idx].name) {
                    // 名前が一緒なら重複フラグを立てる
                    isDuplicate = true;
                    break;
                }
            }
        }
        console.log('重複', isDuplicate);
        if (isDuplicate) {
            // 深度を+1して再帰、重複しない番号を特定する
            resultName = this.replaceDuplicateLayerName(name, depth + 1);
        } else {
            resultName = testName;
        }
        return resultName;
    }
    // レイヤー名変更時のレイヤー名正規化
    normalizeLayerName(layerName, length) {
        let newName;
        // 前後の空白を除去
        newName = layerName.trim();
        // length文字以内にトリミング
        newName = newName.substring(0, length);
        //console.log('newName:', newName, newName.length);
        return newName;
    }
    // カラータグリスト配列をデフォルト値に初期化
    resetColorTagList(list = null) {
        // 引数にリスト指定あり（設定復元時）ならばリストを参照。無指定の場合デフォルトのリスト
        let referenceList = (list !== null) ? list : colorTagListDefault;
        this.colorTagList = [];
        for (let idx = 0; idx < referenceList.length; idx++) {
            this.colorTagList.push(
                {
                    name: referenceList[idx].name,
                    // ※現在のバージョンではcolorは復元せずデフォルト値を使用する
                    color: colorTagListDefault[idx].color
                }
            );
        }
    }
    // カラータグを最新の状態に更新
    updateAllColorTag() {
        for (let idx = 0; idx < this.colorTagList.length; idx++) {
            // レイヤー名変更サブウィンドウのボタン表示を更新
            document.querySelectorAll('.axpc_renamelayer_button_colorTag')[idx].textContent = this.colorTagList[idx].name;
            // 設定タブのテキスト表示を更新
            document.querySelectorAll('.axpc_config_text_colorTag')[idx].value = this.colorTagList[idx].name;
        }
    }
    createTagHTML(objTag) {
        const newButton = document.createElement('button');
        newButton.setAttribute('class', 'axpc_renamelayer_button_colorTag');
        newButton.textContent = objTag.name;
        newButton.style.background = `linear-gradient(90deg,#555, #555 89%, ${objTag.color} 90%)`;
        return newButton;
    }
    createTagConfigHTML(objTag, idx) {
        const newDiv = document.createElement('div');
        newDiv.setAttribute('class', 'axpc_config_div_colorTag');
        newDiv.style.background = `linear-gradient(90deg,#777, #777 89%, ${objTag.color} 90%)`;
        const newInput = document.createElement('input');
        newInput.setAttribute('type', 'text');
        newInput.setAttribute('id', `axp_config_text_colorTag${idx}`);
        newInput.setAttribute('class', 'axpc_config_text_colorTag');
        newInput.value = objTag.name;
        newDiv.appendChild(newInput);
        return newDiv;
    }
    deleteLayer(id) {
        //要素の取得
        var target;
        var elements = document.querySelectorAll('#axp_layer_ul_layerBox>li');


        // 対象レイヤーを検出（リドゥ処理の場合、選択しているレイヤーが対象とは限らない為、IDで特定が必要）
        var idx_delete;
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].dataset.id == id) {
                target = elements[i];
                idx_delete = i;
                break;
            }
        }
        // 削除後に選択される要素のインデックス（最上位[0]を削除する場合はそのまま）
        if (idx_delete >= 1) {
            idx_delete--;
        }

        var idx = this.getLayerIndex(id);
        this.layerObj.splice(idx, 1);
        this.CANVAS.thumbnail_ctx.splice(idx, 1);
        // safari
        if (this.axpObj.ENV.multiCanvas) {
            this.CANVAS.layer_ctx.splice(idx, 1);
        }
        // 添字情報の更新
        this.updateLayerIndex();

        var div1 = document.getElementById('axp_layer_ul_layerBox');
        div1.removeChild(target);

        elements = document.querySelectorAll('#axp_layer_ul_layerBox>li');
        // 選択中のレイヤーを検出
        var found = false;
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].dataset.selected == 'true') {
                found = true;
                break;
            }
        }
        if (!found) {
            // 選択中のレイヤーを削除した場合、削除レイヤーの１つ上を自動選択する
            this.setCurrentLayer(elements[idx_delete]);
        }
        // スクロールバー表示更新
        this.updateLayerScrollbar();
    }
    clear(id) {
        // 引数で指定されたIDのimageDataを初期化
        // アンドゥ時に元のimagedataが必要となるため、更新ではなく新規のimagedataを作成する
        const idx = this.getLayerIndex(id);
        this.layerObj[idx].image =
            this.CANVAS.tmp_ctx.createImageData(this.axpObj.x_size, this.axpObj.y_size);
        // クリア後は空レイヤー
        this.layerObj[idx].isBlank = true;
    }
    getLocked(index = null) {
        if (index) {
            return this.layerObj[index].locked;
        } else {
            return this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].locked;
        }
    }
    getChecked(index = null) {
        if (index) {
            return this.layerObj[index].checked;
        } else {
            return this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].checked;
        }
    }
    getMasked(index = null) {
        if (index) {
            return this.layerObj[index].masked;
        } else {
            return this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].masked;
        }
    }
    getTag(index = null) {
        if (index) {
            return this.layerObj[index].tag;
        } else {
            return this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].tag;
        }
    }
    getTagBackground(index) {
        if (index === -1) {
            return '#00000000';
        } else {
            return this.colorTagList[index].color;
        }
    }
    // レイヤースタイル（非破壊のフチ取り・ドロップシャドウ設定）を取得
    getLayerStyle(id = null) {
        const idx = (id === null) ? this.getLayerIndex(this.currentLayer.dataset.id) : this.getLayerIndex(id);
        return this.layerObj[idx].layerStyle;
    }
    // レイヤースタイルを設定する（アンドゥ/リドゥ・UI操作の両方から呼ばれる）
    setLayerStyle(id, style) {
        const idx = this.getLayerIndex(id);
        this.layerObj[idx].layerStyle = style;
    }
    getAlpha(index = null) {
        if (index) {
            return this.layerObj[index].alpha;
        } else {
            return this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].alpha;
        }
    }
    // 指定されたindexに対応するレイヤーセル要素<li>を取得
    getLayerElement(index) {
        const elementLi = document.querySelector(`#axp_layer_ul_layerBox>li:nth-of-type(${index + 1})`);
        //console.log(this.layerObj[index].name, elementLi.dataset.id);
        return elementLi;
    }
    // クリッピング状態
    getClupMode() {
        return this.currentLayer.querySelector('.axpc_layer_div_cellCliping').dataset.mode;
    }
    // クリッピングレイヤーの親のレイヤー名
    getClupParentName() {
        let idx = this.getLayerIndex(this.currentLayer.dataset.id) + 1;
        let result = '';
        while (idx < this.layerObj.length) {
            if (this.layerObj[idx].mode !== 'source-atop') break;
            idx++;
        }
        if (idx < this.layerObj.length) {
            result = this.layerObj[idx].name;
        } else {
            // 親が存在しないケース
            console.log('エラー：getClupParentName呼び出し異常');
        }
        return result;
    }
    setAlpha(alpha, index = null) {
        if (index) {
            // 指定indexのレイヤー
            this.layerObj[index].alpha = alpha;
            // 不透明度に応じて目のアイコンの背景を変化させる
            const elementEye = this.getLayerElement(index).querySelector('.axpc_layer_div_cellButtonEye');
            elementEye.style.background = this.getEyeBackground(alpha);
        } else {
            // 現在選択中のレイヤー
            this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].alpha = alpha;
            // 不透明度に応じて目のアイコンの背景を変化させる
            const elementEye = this.currentLayer.querySelector('.axpc_layer_div_cellButtonEye');
            elementEye.style.background = this.getEyeBackground(alpha);
        }
    }
    getName(index = null) {
        if (index) {
            return this.layerObj[index].name;
        } else {
            return this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].name;
        }
    }
    getMode() {
        return this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].mode;
    }
    getId() {
        return this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].id;
    }
    getIndex() {
        let index;
        if (this.currentLayer === null) {
            // カレントレイヤーが選択されていない（起動時、初期化時）場合は0
            index = 0;
        } else {
            index = this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].index;
        }
        return index;
    }
    getImage() {
        return this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].image;
    }
    // 全レイヤー合成済みのimagedata
    getCanvasImage() {
        if (this.axpObj.assistToolSystem.getIsTransparent()) {
            return this.CANVAS.backscreen_trans_ctx.getImageData(0, 0, this.axpObj.x_size, this.axpObj.y_size);
        } else {
            return this.CANVAS.backscreen_white_ctx.getImageData(0, 0, this.axpObj.x_size, this.axpObj.y_size);
        }
    }
    // 全レイヤー合成済みのcanvas
    getCanvas() {
        if (this.axpObj.assistToolSystem.getIsTransparent()) {
            return this.CANVAS.backscreen_trans;
        } else {
            return this.CANVAS.backscreen_white;
        }
    }
    getCurrentLayerImage() {
        return this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].image;
    }
    write(imageData) {
        // imagedataの更新
        const idx = this.getLayerIndex(this.currentLayer.dataset.id);
        this.layerObj[idx].image = imageData;
        // 内容が書き換わったため、空レイヤー扱いを解除（描画されたとみなす）
        this.layerObj[idx].isBlank = false;
    }
    // imagedataの差し替えのみ行い、isBlank判定を変更しない
    // （内容を変更しない開始時スワップ・キャンセル時の復元用）
    replaceCurrentImage(imageData) {
        const idx = this.getLayerIndex(this.currentLayer.dataset.id);
        this.layerObj[idx].image = imageData;
    }
    setImageId(imageData, id) {
        const idx = this.getLayerIndex(id);
        this.layerObj[idx].image = imageData;
        // 内容が書き換わったため、空レイヤー扱いを解除（保守的に false）
        this.layerObj[idx].isBlank = false;
    }
    setName(name) {
        this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].name = name;
    }
    setBlendMode(blendMode) {
        this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].mode = blendMode;
        // レイヤーセルに合成モードを表示
        this.displayBlendMode(this.currentLayer);
    }
    setTag(tagNumber) {
        this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].tag = tagNumber;
    }
    displayBlendMode(elementLayer) {
        const elementStatus = elementLayer.querySelector('.axpc_layer_span_cellStatus');
        const blendMode = this.layerObj[this.getLayerIndex(elementLayer.dataset.id)].mode;
        if (this.axpObj.config('axp_config_form_blendModeDisplayType') === 'none') {
            // 設定が表示なしの時
            elementStatus.textContent = '';
        } else {
            if (this.axpObj.config('axp_config_form_blendModeDisplayType') === 'unusual' && blendMode === 'source-over') {
                // 設定が通常以外表示で合成モードが通常の時
                elementStatus.textContent = '';
            } else {
                // セレクトボックスから、レイヤーに設定されている合成モード値に一致するoptionを取得
                const option = document.querySelector(`#axp_layer_select_blendMode>option[value='${blendMode}']`);
                // optionの表示名を取得
                const name = option.textContent;
                elementStatus.textContent = name;
            }
        }
        // クリッピング時用のdataset設定
        const elementCliping = elementLayer.querySelector('.axpc_layer_div_cellCliping');
        elementCliping.dataset.mode = blendMode;
        const elementRightSide = elementLayer.querySelector('.axpc_layer_div_cellRightSide');
        elementRightSide.dataset.mode = blendMode;

    }
    // 全レイヤーの合成モード表示更新
    updateBlendModeDisplayAll() {
        const elementsLayer = document.querySelectorAll('#axp_layer_ul_layerBox>li');
        for (const item of elementsLayer) {
            this.displayBlendMode(item);
        }
    }
    setLayerCounter(count) {
        this.layer_counter = count;
    }
    // 書き込み禁止状態であるか
    isWriteProtection(index = null) {
        if (this.getLocked(index) || !this.getChecked(index) || this.getAlpha(index) == 0) {
            return true;
        } else {
            return false;
        }
    }
    // 書き込み禁止の理由テキスト
    getReasonTextForWriteProtection(index = null) {
        let reasonText = null;
        // レイヤーの不透明度が0%
        if (this.getAlpha(index) == 0) {
            reasonText = '不透明度0%';
        }
        // レイヤーが非表示
        if (!this.getChecked(index)) {
            reasonText = '非表示';
        }
        // レイヤーがロック状態
        if (this.getLocked(index)) {
            reasonText = 'ロック状態';
        }
        return reasonText;
    }
    save() {
        // 描画開始時の状態を一時保存
        this.imageForUndo = this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].image;
        //console.log(this.imageForUndo);
    }
    load() {
        // 描画開始時の状態を一時保存
        return this.imageForUndo;
        //console.log(this.imageForUndo);
    }
    flip_h(target) {
        // 選択範囲（マジックワンド／多角形選択）はキャンバス座標に固定されたマスクのため、
        // 反転後のピクセル配置とは対応が取れなくなる。なげなわの浮動選択がflip前に
        // finalizeNagenawaSelection()で保護されるのと同じ理由で、こちらは単純に解除する
        // （全呼び出し経路：全体反転・レイヤー個別反転・undo/redoがここに集約されるため
        // 一箇所の変更で全経路をカバーできる）
        this.axpObj.clearSelection();
        if (target == 'all') {
            // 全体
            console.log('全体');
            for (const item of this.layerObj) {
                flip_horizontal(item.image);
            }
        } else if (!isNaN(target)) {
            // ID指定
            console.log('ID指定', target);
            flip_horizontal(this.layerObj[this.getLayerIndex(target)].image);
        } else {
            // 現在選択中のレイヤー（引数指定なし）
            console.log('単体');
            flip_horizontal(this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].image);
        }
        this.draw();
        this.drawThumbnail();
    }
    flip_v(target) {
        // flip_h()と同じ理由で、選択範囲マスクは反転前に解除する
        this.axpObj.clearSelection();
        if (target == 'all') {
            // 全体
            console.log('全体');
            for (const item of this.layerObj) {
                flip_vertical(item.image);
            }
        } else if (!isNaN(target)) {
            // 添え字指定
            console.log('ID指定', target);
            flip_vertical(this.layerObj[this.getLayerIndex(target)].image);
        } else {
            // 現在選択中のレイヤー（引数指定なし）
            console.log('単体');
            flip_vertical(this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].image);
        }
        this.draw();
        this.drawThumbnail();
    }
    // 共通処理：対象のレイヤー情報が格納されている配列の添字をIDを使って検索
    getLayerIndex(id) {
        var idx = -1;
        for (var i = 0; i < this.layerObj.length; i++) {
            if (this.layerObj[i].id == id) {
                idx = i;
                break;
            }
        }
        return idx;
    }
    // レイヤー新規
    newLayer() {
        // カウントアップ
        this.layer_counter++;
        // レイヤー生成情報
        let layerData = {
            x_size: this.axpObj.x_size,
            y_size: this.axpObj.y_size,
            id: this.layer_counter,
            name: this.getNewLayerName(),
            alpha: 100,
            mode: 'source-over',
            checked: true,
            locked: false,
            masked: false,
            tag: -1,
            // 空のイメージを生成
            image: this.CANVAS.tmp_ctx.createImageData(this.axpObj.x_size, this.axpObj.y_size),
            isBlank: true,
            // 挿入位置：カレントレイヤーの一つ上に追加
            insert_idx: this.getIndex(),
        }
        this.createLayer(layerData);
        return layerData.id;
    }
    // レイヤー複製
    copyLayer(sourceObj) {
        // カウントアップ
        this.layer_counter++;
        // レイヤー生成情報
        let layerData = {
            x_size: this.axpObj.x_size,
            y_size: this.axpObj.y_size,
            id: this.layer_counter,
            name: this.getNewLayerName(),
            alpha: sourceObj.alpha,
            mode: sourceObj.mode,
            checked: sourceObj.checked,
            locked: sourceObj.locked,
            masked: sourceObj.masked,
            tag: sourceObj.tag,
            // レイヤースタイルも複製する（参照ではなく複製先が独立して編集できるよう複製する）
            layerStyle: JSON.parse(JSON.stringify(sourceObj.layerStyle)),
            // マスクも複製する（ImageDataは新規生成しdataのみコピーする。参照共有を避けるため）
            mask: sourceObj.mask ? { enabled: sourceObj.mask.enabled, image: new ImageData(new Uint8ClampedArray(sourceObj.mask.image.data), sourceObj.mask.image.width, sourceObj.mask.image.height) } : null,
            // 空のイメージを生成
            image: this.CANVAS.tmp_ctx.createImageData(this.axpObj.x_size, this.axpObj.y_size),
            // 挿入位置：カレントレイヤーの一つ上に追加
            insert_idx: this.getIndex(),
        }
        // imageDataオブジェクトのコピー
        layerData.image.data.set(sourceObj.image.data);
        // 複製元が空ならコピーも空
        layerData.isBlank = sourceObj.isBlank === true;

        this.createLayer(layerData);
        return layerData.id;
    }
    // レイヤー復元（ロード／自動保存から復元／削除したレイヤーのアンドゥ）
    restoreLayer(actionObj) {
        let layerData = {
            x_size: this.axpObj.x_size,
            y_size: this.axpObj.y_size,
            id: actionObj.layerObj.id,
            name: actionObj.layerObj.name,
            alpha: actionObj.layerObj.alpha,
            mode: actionObj.layerObj.mode,
            checked: actionObj.layerObj.checked,
            locked: actionObj.layerObj.locked,
            masked: actionObj.layerObj.masked,
            // セーブデータにtagが含まれていない場合、初期値-1を設定（version 1.99.55カラータグ実装以前のセーブデータの互換性維持）
            tag: actionObj.layerObj.tag === undefined ? -1 : actionObj.layerObj.tag,
            // セーブデータにlayerStyleが含まれていない場合（本機能実装以前のセーブデータ）は
            // undefinedのままにし、Layerdataコンストラクタの既定値フォールバックに委ねる
            layerStyle: actionObj.layerObj.layerStyle,
            // セーブデータにmaskが含まれていない場合も同様にundefinedのままにする。
            // 存在する場合は複製する（copyLayer()と同じく、参照共有によるアンドゥ履歴汚染を防ぐため）
            mask: actionObj.layerObj.mask
                ? {
                    enabled: actionObj.layerObj.mask.enabled,
                    image: new ImageData(
                        new Uint8ClampedArray(actionObj.layerObj.mask.image.data),
                        actionObj.layerObj.mask.image.width,
                        actionObj.layerObj.mask.image.height
                    ),
                }
                : actionObj.layerObj.mask,
            // 元のイメージを復元
            image: actionObj.layerObj.image,
            // 挿入位置：レイヤーが存在した元の位置に挿入
            insert_idx: actionObj.layerObj.index,
        }
        this.createLayer(layerData);
        return layerData.id;
    }
    // レイヤー作成
    createLayer(layerData) {
        // 要素を作成する
        const newLayer = this.createLayerHTML(layerData);
        const insert_idx = layerData.insert_idx;

        // レイヤーボックスに要素を挿入
        const divElement = document.getElementById('axp_layer_ul_layerBox');
        divElement.insertBefore(
            newLayer,
            divElement.children[insert_idx]
        );

        // safari
        if (this.axpObj.ENV.multiCanvas) {
            // レイヤー毎のキャンバスctx
            const layercanvas = document.createElement('canvas');
            layercanvas.width = this.x_size;
            layercanvas.height = this.y_size;
            const layercanvas_ctx = layercanvas.getContext('2d');
            this.CANVAS.layer_ctx.splice(insert_idx, 0, layercanvas_ctx);
        }

        // サムネctx
        let canvas = newLayer.querySelector('canvas');
        let canvas_ctx = canvas.getContext('2d');
        // 実際のキャンバスサイズと、サムネ表示エリアのサイズより倍率を算出（縦横大きい方を基準値とする）
        canvas_ctx.setTransform(1, 0, 0, 1, 0, 0);
        canvas_ctx.scale(
            this.CONST.X_LAYER_MAX / Math.max(this.x_size, this.y_size),
            this.CONST.X_LAYER_MAX / Math.max(this.x_size, this.y_size)
        );
        this.CANVAS.thumbnail_ctx.splice(insert_idx, 0, canvas_ctx);

        // レイヤーを管理用の配列に登録
        this.layerObj.splice(insert_idx, 0, new Layerdata(layerData));
        // 添字情報の更新
        this.updateLayerIndex();

        // カレントレイヤー更新
        this.setCurrentLayer(newLayer);

        // 合成モード表示更新
        this.displayBlendMode(newLayer);

        // スクロールバー表示更新
        this.updateLayerScrollbar();
        // 追加されたレイヤーが見えるようにスクロール
        this.scrollLayerIntoView(newLayer);

        return layerData.id;
    }
    // 指定レイヤー要素が表示領域に収まるようにスクロール
    scrollLayerIntoView(layerElement) {
        if (!this.isLayerScrollable()) return;
        const containerHeight = this.layerScrollEl.container.offsetHeight;
        const itemTop = layerElement.offsetTop;
        const itemBottom = itemTop + layerElement.offsetHeight;
        if (itemTop < this.layerScrollY) {
            this.setLayerScrollY(itemTop);
        } else if (itemBottom > this.layerScrollY + containerHeight) {
            this.setLayerScrollY(itemBottom - containerHeight);
        }
    }
    // レイヤーの不透明度に応じた表示切替用のボタンの背景を取得
    getEyeBackground(alpha) {
        return `linear-gradient(0deg, #ddd, #ddd ${alpha - 1}%, #999 ${alpha}%)`;
    }
    createLayerHTML(layerData) {

        // 表示切替用の目のアイコン
        const newDivEyeIcon = document.createElement('div');
        newDivEyeIcon.setAttribute('data-id', layerData.id);
        newDivEyeIcon.setAttribute('class', 'axpc_layer_div_cellButtonEyeIcon');
        if (layerData.checked) {
            newDivEyeIcon.classList.add('axpc_icon_eyeON');
        } else {
            newDivEyeIcon.classList.add('axpc_icon_eyeOFF');
        }

        // レイヤー表示状態の切り替え
        newDivEyeIcon.addEventListener('pointerenter', (e) => {
            // ポインターが進入した時
            let msgtext = e.target.classList.contains('axpc_icon_eyeON') ? '表示' : '非表示';
            // レイヤーの表示状態を切り替えます。(現在の状態:%1)
            this.axpObj.msg('@AXP4000', '表示状態', msgtext);

            // マウスイベントの場合、ドラッグでオン／オフできるようにする
            // （タッチパッドの場合、enterとdownが同時に発生して競合するため対象外）
            if (e.pointerType === 'mouse') {
                if (e.buttons === 1) {
                    if (!this.axpObj.isDrawing) {
                        if (e.target.classList.contains('axpc_icon_eyeON')) {
                            console.log('off');
                            e.target.classList.remove('axpc_icon_eyeON');
                            e.target.classList.add('axpc_icon_eyeOFF');
                            this.layerObj[this.getLayerIndex(e.target.dataset.id)].checked = false;
                        } else {
                            console.log('on');
                            e.target.classList.remove('axpc_icon_eyeOFF');
                            e.target.classList.add('axpc_icon_eyeON');
                            this.layerObj[this.getLayerIndex(e.target.dataset.id)].checked = true;
                        }
                        msgtext = e.target.classList.contains('axpc_icon_eyeON') ? '表示' : '非表示';
                        // レイヤーの%1を切り替えました。(現在の状態:%2)
                        this.axpObj.msg('@INF4006', '表示状態', msgtext);
                        this.updateCanvas();
                    }
                }
            }
        }, false);
        // レイヤーの表示状態の切り替え
        newDivEyeIcon.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            if (e.target.classList.contains('axpc_icon_eyeON')) {
                console.log('off');
                e.target.classList.remove('axpc_icon_eyeON');
                e.target.classList.add('axpc_icon_eyeOFF');
                this.layerObj[this.getLayerIndex(e.target.dataset.id)].checked = false;
            } else {
                console.log('on');
                e.target.classList.remove('axpc_icon_eyeOFF');
                e.target.classList.add('axpc_icon_eyeON');
                this.layerObj[this.getLayerIndex(e.target.dataset.id)].checked = true;
            }
            var msgtext = e.target.classList.contains('axpc_icon_eyeON') ? '表示' : '非表示';
            // レイヤーの%1を切り替えました。(現在の状態:%2)
            this.axpObj.msg('@INF4006', '表示状態', msgtext);
            this.updateCanvas();
        }, false);

        // 表示切替用のボタン（目のアイコンの枠）
        const newDivEye = document.createElement('div');
        newDivEye.setAttribute('class', 'axpc_layer_div_cellButtonEye');
        newDivEye.setAttribute('data-id', layerData.id);
        // 不透明度に応じた背景の生成
        newDivEye.style.background = this.getEyeBackground(layerData.alpha);
        newDivEye.appendChild(newDivEyeIcon);

        // チェックボックス（ロック）
        var newCheckbox_lock = document.createElement('div');
        if (layerData.locked) {
            newCheckbox_lock.setAttribute('class', 'axpc_layer_div_cellButton axpc_icon_lockON');
        } else {
            newCheckbox_lock.setAttribute('class', 'axpc_layer_div_cellButton axpc_icon_lockOFF');
        }
        newCheckbox_lock.setAttribute('data-id', layerData.id);

        newCheckbox_lock.addEventListener('pointerenter', (e) => {
            // ポインターが進入した時
            var msgtext = e.target.classList.contains('axpc_icon_lockON') ? 'ロック' : 'なし';
            // レイヤーの%1を切り替えます。(現在の状態:%2)
            this.axpObj.msg('@AXP4000', 'ロック状態', msgtext);
        }, false);
        // レイヤーのロック状態の切り替え
        newCheckbox_lock.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            if (e.target.classList.contains('axpc_icon_lockON')) {
                e.target.classList.remove('axpc_icon_lockON');
                e.target.classList.add('axpc_icon_lockOFF');
                this.layerObj[this.getLayerIndex(e.target.dataset.id)].locked = false;
            } else {
                e.target.classList.remove('axpc_icon_lockOFF');
                e.target.classList.add('axpc_icon_lockON');
                this.layerObj[this.getLayerIndex(e.target.dataset.id)].locked = true;
            }
            var msgtext = e.target.classList.contains('axpc_icon_lockON') ? 'ロック' : 'なし';
            // レイヤーの%1を切り替えました。(現在の状態:%2)
            this.axpObj.msg('@INF4006', 'ロック状態', msgtext);
        }, false);

        // チェックボックス（透明部分のロック）
        let newCheckbox_mask = document.createElement('div');
        if (layerData.masked) {
            // クラス名axpc_layer_div_cellButtonはロックと共用
            newCheckbox_mask.setAttribute('class', 'axpc_layer_div_cellButton axpc_icon_maskON');
        } else {
            newCheckbox_mask.setAttribute('class', 'axpc_layer_div_cellButton axpc_icon_maskOFF');
        }
        newCheckbox_mask.setAttribute('data-id', layerData.id);
        newCheckbox_mask.addEventListener('pointerenter', (e) => {
            // ポインターが進入した時
            var msgtext = e.target.classList.contains('axpc_icon_maskON') ? 'ロック' : 'なし';
            // レイヤーの%1を切り替えます。(現在の状態:%2)
            this.axpObj.msg('@AXP4000', '透明部分のロック状態', msgtext);
        }, false);
        // レイヤーのマスク状態の切り替え
        newCheckbox_mask.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            if (e.target.classList.contains('axpc_icon_maskON')) {
                e.target.classList.remove('axpc_icon_maskON');
                e.target.classList.add('axpc_icon_maskOFF');
                this.layerObj[this.getLayerIndex(e.target.dataset.id)].masked = false;
            } else {
                e.target.classList.remove('axpc_icon_maskOFF');
                e.target.classList.add('axpc_icon_maskON');
                this.layerObj[this.getLayerIndex(e.target.dataset.id)].masked = true;
            }
            var msgtext = e.target.classList.contains('axpc_icon_maskON') ? 'ロック' : 'なし';
            // レイヤーの%1を切り替えました。(現在の状態:%2)
            this.axpObj.msg('@INF4006', '透明部分のロック状態', msgtext);
        }, false);

        // チェックボックスを縦配置する用のdiv要素
        let newDivCheckboxes = document.createElement('div');
        newDivCheckboxes.setAttribute('class', 'axpc_layer_div_cellButtonContainer');
        newDivCheckboxes.appendChild(newCheckbox_lock);
        newDivCheckboxes.appendChild(newCheckbox_mask);

        // キャンバス（レイヤーサムネイル）
        let newCanvas = document.createElement('canvas');
        newCanvas.setAttribute('class', 'axpc_layer_canvas_cellThumbnail axpc_layer_CANDRAG');
        newCanvas.width = this.CONST.X_LAYER_MAX;
        newCanvas.height = this.CONST.Y_LAYER_MAX;

        // レイヤー名
        let newSpan1 = document.createElement('span');
        newSpan1.setAttribute('class', 'axpc_layer_span_cellName axpc_layer_CANDRAG');
        newSpan1.textContent = layerData.name;

        // レイヤーの状態
        let newSpan2 = document.createElement('span');
        newSpan2.setAttribute('class', 'axpc_layer_span_cellStatus axpc_layer_CANDRAG');

        // (1)左側の箱div要素に、チェックボックスを追加
        let newDivLeft = document.createElement('div');
        newDivLeft.setAttribute('class', 'axpc_layer_div_cellLeftSide');
        newDivLeft.appendChild(newDivEye);
        newDivLeft.appendChild(newDivCheckboxes);

        // (2)右側の箱div要素に、ラベルを追加
        let newDivRight = document.createElement('div');
        newDivRight.setAttribute('class', 'axpc_layer_div_cellRightSide axpc_layer_CANDRAG');
        newDivRight.appendChild(newSpan1);
        newDivRight.appendChild(newSpan2);

        // (3)クリッピング時のマーク
        let newDivCliping = document.createElement('div');
        newDivCliping.setAttribute('class', 'axpc_layer_div_cellCliping axpc_layer_CANDRAG');

        // 外枠div要素
        let newDivAll = document.createElement('div');
        newDivAll.setAttribute('class', 'axpc_layer_div_cell');
        // 外枠div要素に作成した子要素(1)＋(3)＋サムネイル＋(2)を追加
        newDivAll.appendChild(newDivLeft);
        newDivAll.appendChild(newDivCliping);
        newDivAll.appendChild(newCanvas);
        newDivAll.appendChild(newDivRight);

        // カラータグ
        const newDivtTagColor = document.createElement('div');
        newDivtTagColor.setAttribute('class', 'axpc_layer_div_cellColorTag axpc_layer_CANDRAG');
        newDivtTagColor.style.background = this.getTagBackground(layerData.tag);
        //console.log('生成', layerData.tag, this.getTagBackground(layerData.tag));
        newDivAll.appendChild(newDivtTagColor);

        // リスト項目要素の作成
        let newLayer = document.createElement('li');
        newLayer.setAttribute('data-selected', '');       // レイヤーが選択状態か
        newLayer.setAttribute('data-name', 'Layer' + layerData.id);
        newLayer.setAttribute('data-id', layerData.id);              // レイヤーの固有ID
        newLayer.setAttribute('id', 'layer' + layerData.id);
        newLayer.appendChild(newDivAll);

        // レイヤー操作（選択、ドラッグによる順序入れ替え、ドロップによる削除）
        newLayer.addEventListener('pointerdown', (e) => {
            //console.log('click:', event.target.dataset.type);
            //console.log('click:', e.target, e.currentTarget);
            if (e.target.classList.contains('axpc_layer_CANDRAG')) {
                this.drag_down(e);
                // ドラッグで表示順序を入れ替え。ダブルクリックでレイヤー名変更。
                this.axpObj.msg('@AXP4001');
                // カレントレイヤー更新
                this.setCurrentLayer(e.currentTarget);
            }
        });
        // リネーム
        newDivRight.addEventListener('dblclick', (e) => {
            this.openRenameLayerWindow(e);
        });
        return newLayer;
    }
    openRenameLayerWindow() {
        // サブウィンドウオープン
        this.axpObj.openSubwindow('axp_renamelayer', this.currentLayer);

        // 現在のレイヤー名を取得
        const elementLayerLabel = this.currentLayer.querySelector('.axpc_layer_span_cellName');
        const layerName = elementLayerLabel.textContent;
        const textbox = document.getElementById('axp_renamelayer_text_newLayerName');
        textbox.value = layerName;
        // 決定ボタン無効化
        document.getElementById('axp_renamelayer_button_confirm').dataset.enabled = 'false';
        // テキストエリアにフォーカス
        textbox.focus();
        textbox.select();

        // レイヤースタイル（フチ取り・ドロップシャドウ）コントロールへ現在値を反映
        this._populateLayerStyleControls(this.currentLayer.dataset.id);
        // 透明マスクコントロールへ現在値を反映
        this._populateMaskControls(Number(this.currentLayer.dataset.id));
    }
    // レイヤーのドラッグ＆ドロップ
    drag_down(e) {
        //console.log(e);
        const target = e.currentTarget;
        const pageX = e.pageX;
        const pageY = e.pageY;
        const targetW = target.offsetWidth;
        data.idx_source = util.index(target); // 移動するレイヤーの添字
        data.target = target;
        data.diffX = pageX;
        data.diffY = pageY;
        data.ofx = target.offsetLeft;
        data.ofy = target.offsetTop;
        data.cloneName = util.insertClone(target, util.index(target));
        target.style.width = `${targetW}px`;
        target.classList.add('axpc_onGRAB');
        // ドラッグ中
        const onPointerMove = (e) => {
            //console.log('move');
            const target = data.target;
            const pageX = e.pageX;
            const pageY = e.pageY;
            const targetPosL = data.ofx + pageX - data.diffX;
            const targetPosT = data.ofy + pageY - data.diffY;
            target.style.left = `${targetPosL}px`;
            target.style.top = `${targetPosT}px`;
            util.swap(target);
        }
        // ドロップ
        const onPointerUp = () => {
            //console.log('up');
            //console.log('e:', e.currentTarget);
            const target = data.target;
            const cloneSelector = `.${data.cloneName}`;
            const clone = document.querySelector(cloneSelector);
            data.cloneName = '';
            clone.remove();
            target.removeAttribute('style');
            target.classList.remove('axpc_onGRAB');
            // イベントリスナー解除
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);

            // 操作終了後、実際に入替処理が行われたどうか判定する
            var elem = document.querySelectorAll('#axp_layer_ul_layerBox>li');
            for (var idx = 0; idx < elem.length; idx++) {
                if (elem[idx].dataset.id === target.dataset.id) break;
            }
            if (idx !== data.idx_source) {
                // レイヤー配列に反映
                //console.log("画面表示：移動元", data.idx_source, "=>移動先", idx);
                //console.log("配列：移動元", elem.length - 1 - data.idx_source, "=>移動先", elem.length - 1 - idx);
                /*
                // 配列の並び順と画面表示の並び順が逆順の仕様の時の置換ロジック（没）
                var moveObj = this.layerObj.splice(elem.length - 1 - data.idx_source, 1);
                this.layerObj.splice(elem.length - 1 - idx, 0, moveObj[0]);
                */
                // 配列の並び順と画面表示の並び順が同じ仕様の時の置換ロジック
                let moveObj = this.layerObj.splice(data.idx_source, 1);
                this.layerObj.splice(idx, 0, moveObj[0]);

                let moveCtx = this.CANVAS.thumbnail_ctx.splice(data.idx_source, 1);
                this.CANVAS.thumbnail_ctx.splice(idx, 0, moveCtx[0]);

                // safari
                if (this.axpObj.ENV.multiCanvas) {
                    let movelayerCtx = this.CANVAS.layer_ctx.splice(data.idx_source, 1);
                    this.CANVAS.layer_ctx.splice(idx, 0, movelayerCtx[0]);
                }
                //console.log(this.layerObj);

                // 添字情報の更新
                this.updateLayerIndex();
                this.updateCanvas();
            }
        }
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }
    // カレントレイヤー更新
    setCurrentLayer(targetElement) {
        // なげなわ変形中は、選択が変わる前に確定する
        this.axpObj.finalizeNagenawaSelection();
        // 引数の要素をカレントレイヤーとし、変更に伴う連動処理を行う
        const layerBoxElements = document.querySelectorAll('#axp_layer_ul_layerBox>li');
        // 一旦、全レイヤーを非選択に
        for (const item of layerBoxElements) {
            item.dataset.selected = '';
        }
        // カレントレイヤー（現在選択中のレイヤー）を更新
        this.currentLayer = targetElement;
        this.currentLayer.dataset.selected = 'true';

        // 透明度スライドバーの復元処理
        const alpha = this.getAlpha();
        document.getElementById('axp_layer_range_alpha').value = alpha;
        document.getElementById('axp_layer_form_alpha').result.value = alpha;

        // 合成モードの復元処理
        document.getElementById('axp_layer_select_blendMode').value = this.getMode();
        // セレクトボックスからフォーカスを外す(※safariでjsからの値変更が反映されない不具合の対策)
        document.getElementById('axp_layer_select_blendMode').blur();
    }
    // カレントレイヤー選択（index指定）
    selectCurrentLayerIndex(targetIndex) {
        const layerBoxElements = document.querySelectorAll('#axp_layer_ul_layerBox>li');
        let index = 0;
        for (const item of layerBoxElements) {
            if (index === targetIndex) {
                this.setCurrentLayer(item);
                break;
            }
        }
    }
    updateLayerIndex() {
        // レイヤー順序の入れ替え操作を行った際に、自身の添字情報を再更新する（アンドゥ時に参照）
        for (let i = 0; i < this.layerObj.length; i++) {
            this.layerObj[i].index = i;
        }
    }
    _compositeLayerRange(targetCtx, startIdx, endIdx) {
        targetCtx.beginPath();
        targetCtx.clearRect(0, 0, this.x_size, this.y_size);
        if (startIdx > endIdx || startIdx < 0 || endIdx >= this.layerObj.length) return;

        let skipIdx = endIdx;
        for (let idx = endIdx; idx >= startIdx; idx--) {
            const item = this.layerObj[idx];
            const isInvisible = (!item.checked) || item.isBlank;

            let tmp_ctx;
            if (this.axpObj.ENV.multiCanvas) {
                tmp_ctx = this.CANVAS.layer_ctx[idx];
            } else {
                tmp_ctx = this.CANVAS.tmp_ctx;
            }
            if (!isInvisible) {
                tmp_ctx.putImageData(item.image, 0, 0);
            }

            if (skipIdx < idx) continue;
            if (item.mode === 'source-atop') continue;

            let outputCanvas = tmp_ctx.canvas;

            if (idx - 1 >= startIdx && this.layerObj[idx - 1].mode === 'source-atop') {
                skipIdx = idx - 1;
                this.CANVAS.clip_ctx.globalCompositeOperation = 'source-over';
                this.CANVAS.clip_ctx.globalAlpha = 1;
                this.CANVAS.clip_ctx.clearRect(0, 0, this.x_size, this.y_size);
                while (skipIdx >= startIdx) {
                    if (this.layerObj[skipIdx].mode === 'source-atop') {
                        if (this.layerObj[skipIdx].checked) {
                            if (this.axpObj.ENV.multiCanvas) {
                                this.CANVAS.layer_ctx[skipIdx].putImageData(this.layerObj[skipIdx].image, 0, 0);
                                this.CANVAS.clip_ctx.globalAlpha = this.layerObj[skipIdx].alpha / 100;
                                this.CANVAS.clip_ctx.drawImage(this.CANVAS.layer_ctx[skipIdx].canvas, 0, 0);
                            } else {
                                tmp_ctx.putImageData(this.layerObj[skipIdx].image, 0, 0);
                                this.CANVAS.clip_ctx.globalAlpha = this.layerObj[skipIdx].alpha / 100;
                                this.CANVAS.clip_ctx.drawImage(tmp_ctx.canvas, 0, 0);
                            }
                        }
                        skipIdx--;
                    } else {
                        break;
                    }
                }
                this.CANVAS.merge_ctx.clearRect(0, 0, this.x_size, this.y_size);
                this.CANVAS.merge_ctx.putImageData(item.image, 0, 0);
                this.CANVAS.merge_ctx.globalCompositeOperation = 'source-atop';
                this.CANVAS.merge_ctx.globalAlpha = 1;
                this.CANVAS.merge_ctx.drawImage(this.CANVAS.clip_ctx.canvas, 0, 0);
                outputCanvas = this.CANVAS.merge;
            }

            if (!isInvisible) {
                targetCtx.globalCompositeOperation = item.mode;
                targetCtx.globalAlpha = item.alpha / 100;
                targetCtx.drawImage(outputCanvas, 0, 0);
            }
        }
    }
    activateFastPath() {
        const currentIdx = this.getLayerIndex(this.currentLayer.dataset.id);
        const item = this.layerObj[currentIdx];
        if (item.mode === 'source-atop') {
            this.compositeFastPathActive = false;
            return;
        }
        if (currentIdx > 0 && this.layerObj[currentIdx - 1].mode === 'source-atop') {
            this.compositeFastPathActive = false;
            return;
        }
        // レイヤースタイル（フチ取り/ドロップシャドウ）・透明マスクは1フレームごとの部分再合成に
        // 未対応のため、いずれかのレイヤーに有効なものがあれば安全側に倒し、通常の全面再合成に委ねる
        // （クリッピングレイヤーと同じ「fast path対象外」の扱い）
        if (this.layerObj.some((l) => hasActiveLayerStyle(l.layerStyle) || hasActiveMask(l.mask))) {
            this.compositeFastPathActive = false;
            return;
        }
        this._compositeLayerRange(
            this.CANVAS.compositeBelowCtx,
            currentIdx + 1, this.layerObj.length - 1
        );
        this._compositeLayerRange(
            this.CANVAS.compositeAboveCtx,
            0, currentIdx - 1
        );
        this.strokeCanvas = this.axpObj.penSystem.CANVAS.draw;
        this.compositeFastPathActive = true;
        // ダーティ矩形化のための基準値（ストローク中に不透明度/合成モードが変化した
        // かどうかの判定に使う。activateFastPath直後の値を基準とする）
        this._fastPathMode = item.mode;
        this._fastPathAlpha = item.alpha;
    }
    deactivateFastPath() {
        this.compositeFastPathActive = false;
        this.strokeCanvas = null;
    }
    // dirtyRect（{x,y,w,h}、キャンバス座標系）が渡された場合はその矩形だけを再合成する。
    // 省略・null・不正な矩形の場合は従来どおりの全面再合成にフォールバックする。
    drawFast(dirtyRect = null) {
        const currentIdx = this.getLayerIndex(this.currentLayer.dataset.id);
        const item = this.layerObj[currentIdx];

        // ストローク中に不透明度/合成モードが変化した場合（レイヤーパネル操作の
        // 同時操作等）、dirtyRect範囲外は前回値のまま取り残されるため、この
        // フレームだけ全面再合成にフォールバックして即座に最新値へ揃える。
        if (item.mode !== this._fastPathMode || item.alpha !== this._fastPathAlpha) {
            this._fastPathMode = item.mode;
            this._fastPathAlpha = item.alpha;
            this._drawFastFull(item);
            return;
        }

        if (!dirtyRect || dirtyRect.w <= 0 || dirtyRect.h <= 0) {
            this._drawFastFull(item);
            return;
        }

        const { x, y, w, h } = dirtyRect;

        this.CANVAS.backscreen_trans_ctx.beginPath();
        this.CANVAS.backscreen_trans_ctx.clearRect(x, y, w, h);

        this.CANVAS.backscreen_trans_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.backscreen_trans_ctx.globalAlpha = 1;
        this.CANVAS.backscreen_trans_ctx.drawImage(this.CANVAS.compositeBelow, x, y, w, h, x, y, w, h);

        this.CANVAS.backscreen_trans_ctx.globalCompositeOperation = item.mode;
        this.CANVAS.backscreen_trans_ctx.globalAlpha = item.alpha / 100;
        this.CANVAS.backscreen_trans_ctx.drawImage(this.strokeCanvas, x, y, w, h, x, y, w, h);

        this.CANVAS.backscreen_trans_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.backscreen_trans_ctx.globalAlpha = 1;
        this.CANVAS.backscreen_trans_ctx.drawImage(this.CANVAS.compositeAbove, x, y, w, h, x, y, w, h);

        this.CANVAS.backscreen_white_ctx.beginPath();
        this.CANVAS.backscreen_white_ctx.clearRect(x, y, w, h);
        this.CANVAS.backscreen_white_ctx.globalAlpha = 1;
        this.CANVAS.backscreen_white_ctx.fillStyle = this.axpObj.backgroundColor || this.axpObj.defaultColor?.sub || '#FFFFFF';
        this.CANVAS.backscreen_white_ctx.fillRect(x, y, w, h);
        this.CANVAS.backscreen_white_ctx.drawImage(this.CANVAS.backscreen_trans, x, y, w, h, x, y, w, h);

        let ctx = this.axpObj.CANVAS.main_ctx;
        if (this.axpObj.assistToolSystem.getIsTransparent()) {
            ctx.clearRect(x, y, w, h);
            ctx.drawImage(this.CANVAS.backscreen_trans, x, y, w, h, x, y, w, h);
        } else {
            ctx.drawImage(this.CANVAS.backscreen_white, x, y, w, h, x, y, w, h);
        }
        // 選択範囲の可視化オーバーレイ（どのレイヤーのimageデータにも書き込まない、表示専用）
        if (this.axpObj.selectionOverlayCanvas) {
            ctx.drawImage(this.axpObj.selectionOverlayCanvas, x, y, w, h, x, y, w, h);
        }
    }
    // drawFast()の全面再合成版（従来ロジック）。dirtyRect未指定/不正時のフォールバック先。
    _drawFastFull(item) {
        this.CANVAS.backscreen_trans_ctx.beginPath();
        this.CANVAS.backscreen_trans_ctx.clearRect(0, 0, this.x_size, this.y_size);

        this.CANVAS.backscreen_trans_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.backscreen_trans_ctx.globalAlpha = 1;
        this.CANVAS.backscreen_trans_ctx.drawImage(this.CANVAS.compositeBelow, 0, 0);

        this.CANVAS.backscreen_trans_ctx.globalCompositeOperation = item.mode;
        this.CANVAS.backscreen_trans_ctx.globalAlpha = item.alpha / 100;
        this.CANVAS.backscreen_trans_ctx.drawImage(this.strokeCanvas, 0, 0);

        this.CANVAS.backscreen_trans_ctx.globalCompositeOperation = 'source-over';
        this.CANVAS.backscreen_trans_ctx.globalAlpha = 1;
        this.CANVAS.backscreen_trans_ctx.drawImage(this.CANVAS.compositeAbove, 0, 0);

        this.CANVAS.backscreen_white_ctx.beginPath();
        this.CANVAS.backscreen_white_ctx.clearRect(0, 0, this.x_size, this.y_size);
        this.CANVAS.backscreen_white_ctx.globalAlpha = 1;
        this.CANVAS.backscreen_white_ctx.fillStyle = this.axpObj.backgroundColor || this.axpObj.defaultColor?.sub || '#FFFFFF';
        this.CANVAS.backscreen_white_ctx.fillRect(0, 0, this.x_size, this.y_size);
        this.CANVAS.backscreen_white_ctx.drawImage(this.CANVAS.backscreen_trans, 0, 0);

        let ctx = this.axpObj.CANVAS.main_ctx;
        if (this.axpObj.assistToolSystem.getIsTransparent()) {
            ctx.clearRect(0, 0, this.x_size, this.y_size);
            ctx.drawImage(this.CANVAS.backscreen_trans, 0, 0);
        } else {
            ctx.drawImage(this.CANVAS.backscreen_white, 0, 0);
        }
        // 選択範囲の可視化オーバーレイ（どのレイヤーのimageデータにも書き込まない、表示専用）
        if (this.axpObj.selectionOverlayCanvas) {
            ctx.drawImage(this.axpObj.selectionOverlayCanvas, 0, 0);
        }
    }
    draw(changedLayerId = null) {
        let ctx = this.axpObj.CANVAS.main_ctx;
        //console.log('ここで描画', this.x_size, this.y_size);
        // 表示領域をクリア
        this.CANVAS.backscreen_trans_ctx.beginPath();
        this.CANVAS.backscreen_trans_ctx.clearRect(0, 0, this.x_size, this.y_size);
        // 全レイヤー走査（※下層レイヤーから描画するため逆順）
        // 処理済みindex（クリッピング処理で子を先行して合成する場合がある時、スキップ判定に使用する）
        let skipIdx = this.layerObj.length - 1;
        for (let idx = this.layerObj.length - 1; idx >= 0; idx--) {
            let item = this.layerObj[idx];

            // 描画スキップ条件：非表示・空レイヤー（imagedata 自体は保持されており undo/redo で変更可能）
            const isInvisible = (!item.checked) || item.isBlank;
            // サムネ更新対象：全更新時(null) または 変動が発生したレイヤーのみ
            const wantThumbUpdate = (changedLayerId === null) || (item.id === changedLayerId);

            // imagedataを仮想キャンバスに描画
            let tmp_ctx;
            // safari
            if (this.axpObj.ENV.multiCanvas) {
                tmp_ctx = this.CANVAS.layer_ctx[idx];
            } else {
                tmp_ctx = this.CANVAS.tmp_ctx;
            }
            // 非破壊レイヤースタイル（フチ取り・ドロップシャドウ）・透明マスクが有効な場合、
            // 元データ(item.image)自体は変更せず、合成用に一時的に重ねた結果を使う。
            // クリッピング合成（後段）でも同じcomposited値を使うため、ループ内スコープで保持する
            let composited = item.image;
            // 非表示・空レイヤーは putImageData をスキップ（合成時にも不要）
            if (!isInvisible) {
                // マスクを先に適用してから輪郭/影を生成する（先にスタイルを生成すると、後で
                // マスクにより隠れる部分の輪郭がそのまま切り取られたり、逆に見えている縁に
                // 輪郭が付かなかったりする不整合が起きるため。マスクは「このレイヤーの実効的な
                // 形状」を決めるものなので、スタイルはその形状に対して計算するのが自然）
                composited = hasActiveMask(item.mask)
                    ? applyLayerMask(item.image, item.mask.image)
                    : item.image;
                if (hasActiveLayerStyle(item.layerStyle)) {
                    composited = applyLayerStyle(composited, item.layerStyle, this.x_size, this.y_size);
                }
                tmp_ctx.putImageData(composited, 0, 0);
            }

            // レイヤー毎のサムネイル描画（変動レイヤーのみ更新）
            if (wantThumbUpdate && !this.isStrokeActive) {
                const clearRect = Math.max(this.axpObj.x_size, this.axpObj.y_size);
                this.CANVAS.thumbnail_ctx[idx].clearRect(0, 0, clearRect, clearRect);
                if (!isInvisible) {
                    this.CANVAS.thumbnail_ctx[idx].drawImage(
                        tmp_ctx.canvas,
                        this.axpObj.ctx_map_shift_x,
                        this.axpObj.ctx_map_shift_y
                    );
                }
            }

            // クリッピング合成により描画済みの子レイヤーの場合、処理をスキップする
            if (skipIdx < idx) {
                //console.log('skip', skipIdx, '<', idx);
                continue;
            }

            // 自身がクリッピングの時、親がいない不正なレイヤーのため、表示を行わない
            if (item.mode === 'source-atop') {
                //console.log('idx=', idx, this.layerObj[idx].name, '親がいない');
                // 無効なクリッピングであることを表示
                const elementCliping = this.getLayerElement(idx).querySelector('.axpc_layer_div_cellCliping');
                elementCliping.dataset.mode = 'invalid';

            } else {
                // 合成結果の保存先キャンバス
                let outputCanvas = tmp_ctx.canvas;

                // 最上層レイヤー以外のとき、クリッピングの親（直上のレイヤーがクリッピング）であるならば、すべての子との合成処理を行い、mergeキャンバスに結果を保存
                if (idx !== 0) {
                    if (this.layerObj[idx - 1].mode === 'source-atop') {
                        //console.log('idx=', idx, this.layerObj[idx].name, '親');
                        // 子のindex
                        skipIdx = idx - 1;

                        // クリップ領域の初期化
                        this.CANVAS.clip_ctx.globalCompositeOperation = 'source-over';
                        this.CANVAS.clip_ctx.globalAlpha = 1;
                        this.CANVAS.clip_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);

                        // すべての子レイヤーを走査して親と合成する
                        // ※親が非表示の場合でも、有効なクリッピングであることの表示更新が必要なので、前段の子の走査は必須
                        while (skipIdx >= 0) {
                            if (this.layerObj[skipIdx].mode === 'source-atop') {
                                //console.log('skipIdx=', skipIdx, this.layerObj[skipIdx].name);
                                // 有効なクリッピングであることを表示
                                const elementCliping = this.getLayerElement(skipIdx).querySelector('.axpc_layer_div_cellCliping');
                                elementCliping.dataset.mode = this.layerObj[skipIdx].mode;

                                // 子レイヤーが「表示」の場合、そのレイヤーを親と合成する
                                // （子レイヤー自身のスタイル/マスクもここで適用する）
                                if (this.layerObj[skipIdx].checked) {
                                    const childItem = this.layerObj[skipIdx];
                                    // マスク→スタイルの順で適用する（上のメインループと同じ理由）
                                    let childComposited = hasActiveMask(childItem.mask)
                                        ? applyLayerMask(childItem.image, childItem.mask.image)
                                        : childItem.image;
                                    if (hasActiveLayerStyle(childItem.layerStyle)) {
                                        childComposited = applyLayerStyle(childComposited, childItem.layerStyle, this.x_size, this.y_size);
                                    }
                                    // safari
                                    if (this.axpObj.ENV.multiCanvas) {
                                        this.CANVAS.layer_ctx[skipIdx].putImageData(childComposited, 0, 0);
                                        this.CANVAS.clip_ctx.globalAlpha = this.layerObj[skipIdx].alpha / 100;
                                        this.CANVAS.clip_ctx.drawImage(this.CANVAS.layer_ctx[skipIdx].canvas, 0, 0);
                                    } else {
                                        tmp_ctx.putImageData(childComposited, 0, 0);
                                        this.CANVAS.clip_ctx.globalAlpha = this.layerObj[skipIdx].alpha / 100;
                                        this.CANVAS.clip_ctx.drawImage(tmp_ctx.canvas, 0, 0);
                                    }
                                }
                                skipIdx--;
                            } else {
                                break;
                            }
                        }
                        // 描画領域の初期化
                        this.CANVAS.merge_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
                        // 親レイヤーの画像をベースにする（スタイル/マスク適用済みのcompositedを使う）
                        this.CANVAS.merge_ctx.putImageData(composited, 0, 0);
                        // 子と合成
                        this.CANVAS.merge_ctx.globalCompositeOperation = 'source-atop';
                        this.CANVAS.merge_ctx.globalAlpha = 1;
                        this.CANVAS.merge_ctx.drawImage(this.CANVAS.clip_ctx.canvas, 0, 0);

                        // 合成結果の保存先キャンバスを変更（クリッピング合成用）
                        outputCanvas = this.CANVAS.merge;
                    }

                }
                // レイヤーが「表示」かつ非空の場合、そのレイヤーをキャンバスに描画する
                // （isInvisible 時は tmp_ctx に当該レイヤーの内容を putImageData していないため drawImage 不可）
                if (!isInvisible) {
                    //console.log('idx=', idx, this.layerObj[idx].name);
                    this.CANVAS.backscreen_trans_ctx.globalCompositeOperation = item.mode;
                    this.CANVAS.backscreen_trans_ctx.globalAlpha = item.alpha / 100;
                    this.CANVAS.backscreen_trans_ctx.drawImage(outputCanvas, 0, 0);
                }
            }
        }

        // 白塗りつぶし背景
        this.CANVAS.backscreen_white_ctx.beginPath();
        this.CANVAS.backscreen_white_ctx.clearRect(0, 0, this.x_size, this.y_size);
        this.CANVAS.backscreen_white_ctx.globalAlpha = 1;
        this.CANVAS.backscreen_white_ctx.fillStyle = this.axpObj.backgroundColor || this.axpObj.defaultColor?.sub || '#FFFFFF';
        this.CANVAS.backscreen_white_ctx.fillRect(0, 0, this.x_size, this.y_size);
        this.CANVAS.backscreen_white_ctx.drawImage(this.CANVAS.backscreen_trans, 0, 0);

        // 画面に出力
        if (this.axpObj.assistToolSystem.getIsTransparent()) {
            // 透過背景
            ctx.clearRect(0, 0, this.x_size, this.y_size);
            ctx.drawImage(this.CANVAS.backscreen_trans, 0, 0);
        } else {
            // 白背景
            ctx.drawImage(this.CANVAS.backscreen_white, 0, 0);
        }

        // 選択範囲の可視化オーバーレイ（どのレイヤーのimageデータにも書き込まない、表示専用）
        if (this.axpObj.selectionOverlayCanvas) {
            ctx.drawImage(this.axpObj.selectionOverlayCanvas, 0, 0);
        }

        // 背景タイルプレビュー表示
        if (this.axpObj.isBackgroundimage && !this.axpObj.isDrawing) {
            this.axpObj.drawBackground();
        }

    }
    // 補助ツールのサムネイル描画
    drawThumbnail() {
        let ctx = this.axpObj.assistToolSystem.CANVAS.thumbnail_ctx;
        // クリア
        ctx.clearRect(
            0,
            0,
            this.axpObj.assistToolSystem.CANVAS.thumbnail.width,
            this.axpObj.assistToolSystem.CANVAS.thumbnail.height);

        // 描画
        if (this.axpObj.assistToolSystem.getIsTransparent()) {
            // 透過背景
            ctx.drawImage(
                this.CANVAS.backscreen_trans,
                0,
                0,
                this.axpObj.assistToolSystem.CANVAS.thumbnail.width,
                this.axpObj.assistToolSystem.CANVAS.thumbnail.height);
        } else {
            // 白地背景
            ctx.drawImage(
                this.CANVAS.backscreen_white,
                0,
                0,
                this.axpObj.assistToolSystem.CANVAS.thumbnail.width,
                this.axpObj.assistToolSystem.CANVAS.thumbnail.height);
        }

    }
    updateCanvas(changedLayerId = null) {
        // キャンバス更新が影響する表示を一括処理
        // changedLayerId が指定された場合、そのレイヤーのサムネのみ更新（他レイヤーのサムネ再描画を省略）
        this.draw(changedLayerId);
        if (!this.isStrokeActive) {
            this.drawThumbnail();
        }
    }
    // 画像をダウンロード
    downloadImage() {
        // なげなわ変形中は確定してから出力する（点線プレビューの混入防止）
        this.axpObj.finalizeNagenawaSelection();
        let link = document.createElement("a");
        if (this.axpObj.assistToolSystem.getIsTransparent()) {
            // 透過
            link.href = this.CANVAS.backscreen_trans.toDataURL('image/png');
        } else {
            // 白地
            link.href = this.CANVAS.backscreen_white.toDataURL('image/png');
        }
        let filename = 'ap' + dispDate(new Date(), 'YYYYMMDD_hhmmss') + '.png';
        link.download = filename;
        link.click();
    }
    // レイヤーの新規作成
    buttonCreateLayer() {
        // レイヤー最大数を超える場合は生成不可
        if (this.layerObj.length >= this.CONST.LAYER_MAX) {
            // レイヤーは%1枚までです。
            this.axpObj.msg('@CAU4002', this.CONST.LAYER_MAX);
            return;
        }

        // レイヤー生成
        var targetId = this.newLayer();
        // %1を作成しました。
        this.axpObj.msg('@INF4001', this.getName());

        console.log(this.layerObj, targetId);

        // アンドゥ用記録
        this.axpObj.undoSystem.setUndo({
            type: 'layer-create',
            layerObj: this.layerObj[this.getLayerIndex(targetId)],
        });
    }
    // レイヤーの統合
    buttonIntegrateLayer() {
        // なげなわ変形中の場合、対象レイヤーが存在するうちに選択内容を確定する
        // （統合後に確定すると削除済みレイヤーへの書き込みでエラーになるため）
        this.axpObj.finalizeNagenawaSelection();
        var idx_source = this.getLayerIndex(this.currentLayer.dataset.id); // 統合元idx

        // 最下位チェック
        if (idx_source >= this.layerObj.length - 1) {
            // 最下層のレイヤーは統合できません。
            this.axpObj.msg('@CAU4005');
            return;
        }
        var idx_dest = idx_source + 1;  // 統合先idx
        var id_dest = this.layerObj[idx_dest].id; //統合先id（処理の最後でレイヤーを選択状態するために保持）

        // レイヤー名の記憶（統合処理後に参照できなくなるため）
        const source_name = this.getName();
        const dest_name = this.getName(idx_dest);

        // 書き込み禁止チェック（統合元）
        if (this.isWriteProtection()) {
            // %1が%2のため、統合できません。
            this.axpObj.msg('@CAU4006', source_name, this.getReasonTextForWriteProtection());
            return;
        }
        // 書き込み禁止チェック（統合先）
        if (this.isWriteProtection(idx_dest)) {
            // %1が%2のため、統合できません。
            this.axpObj.msg('@CAU4006', dest_name, this.getReasonTextForWriteProtection(idx_dest));
            return;
        }

        //console.log(this.layerObj[idx_source].index, idx_source);
        //console.log(this.layerObj[idx_dest].index, idx_dest);

        // アンドゥ用記録
        this.axpObj.undoSystem.setUndo({
            type: 'layer-integrate',
            layerObj: this.layerObj[idx_source],
            layerObj_dest: this.layerObj[idx_dest],
        });

        // 統合処理
        let draw = this.axpObj.penSystem.CANVAS.draw;
        let draw_ctx = this.axpObj.penSystem.CANVAS.draw_ctx;

        draw_ctx.clearRect(0, 0, draw.width, draw.height);
        draw_ctx.shadowBlur = 0; // 統合時はぼかしを無効にする

        let source_ctx, dest_ctx;
        // safari
        if (this.axpObj.ENV.multiCanvas) {
            source_ctx = this.CANVAS.layer_ctx[idx_dest];
            dest_ctx = this.CANVAS.layer_ctx[idx_source];
        } else {
            source_ctx = this.CANVAS.tmp_ctx;
            dest_ctx = this.CANVAS.tmp_ctx;
        }

        // 初期化
        this.CANVAS.merge_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
        draw_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);

        // 下層
        dest_ctx.putImageData(this.layerObj[idx_dest].image, 0, 0);
        draw_ctx.globalAlpha = Number(this.layerObj[idx_dest].alpha / 100);
        draw_ctx.globalCompositeOperation = 'source-over';
        draw_ctx.drawImage(dest_ctx.canvas, 0, 0);

        if (this.layerObj[idx_dest].masked) {
            // マスクデータの作成
            this.CANVAS.clip_ctx.putImageData(this.layerObj[idx_dest].image, 0, 0);
            const imageData = this.CANVAS.clip_ctx.getImageData(0, 0, this.axpObj.x_size, this.axpObj.y_size);
            // 1ピクセルずつ走査してαを255にする
            for (let i = 0, len = imageData.data.length; i < len; i += 4) {
                const alpha = imageData.data[i + 3];
                if (alpha > 0) {
                    imageData.data[i + 3] = 255;
                }
            }
            // マスクデータ描画
            this.CANVAS.clip_ctx.putImageData(imageData, 0, 0);
            this.CANVAS.merge_ctx.globalAlpha = 1;
            this.CANVAS.merge_ctx.globalCompositeOperation = 'source-over';
            this.CANVAS.merge_ctx.drawImage(this.CANVAS.clip_ctx.canvas, 0, 0);
            // 上層の画像をマスクデータで切り抜いて合成
            source_ctx.putImageData(this.layerObj[idx_source].image, 0, 0);
            this.CANVAS.merge_ctx.globalAlpha = Number(this.layerObj[idx_source].alpha / 100);
            this.CANVAS.merge_ctx.globalCompositeOperation = 'source-in';
            this.CANVAS.merge_ctx.drawImage(source_ctx.canvas, 0, 0);

            // 合成
            draw_ctx.globalAlpha = 1;
            draw_ctx.globalCompositeOperation = this.layerObj[idx_source].mode;
            draw_ctx.drawImage(this.CANVAS.merge_ctx.canvas, 0, 0);

        } else {
            // 上層
            source_ctx.putImageData(this.layerObj[idx_source].image, 0, 0);
            this.CANVAS.merge_ctx.globalAlpha = Number(this.layerObj[idx_source].alpha / 100);
            this.CANVAS.merge_ctx.globalCompositeOperation = 'source-over';
            this.CANVAS.merge_ctx.drawImage(source_ctx.canvas, 0, 0);

            // 合成
            draw_ctx.globalAlpha = 1;
            if (this.layerObj[idx_source].mode === 'source-atop' && this.layerObj[idx_dest].mode === 'source-atop') {
                draw_ctx.globalCompositeOperation = 'source-over';
            } else {
                draw_ctx.globalCompositeOperation = this.layerObj[idx_source].mode;
            }
            draw_ctx.drawImage(this.CANVAS.merge_ctx.canvas, 0, 0);
        }

        this.layerObj[idx_dest].image = draw_ctx.getImageData(0, 0, draw.width, draw.height);

        // 統合後の不透明度は強制的に100%にする
        this.setAlpha(100, idx_dest);

        // 統合元レイヤー削除
        this.deleteLayer(this.getId());
        // 表示更新
        this.updateCanvas();
        // 処理完了後、統合先のレイヤーを選択状態にする
        var elements = document.querySelectorAll('#axp_layer_ul_layerBox>li');
        for (var i = 0; i < elements.length; i++) {
            //console.log(elements[i].dataset.id, id_dest);
            if (Number(elements[i].dataset.id) === Number(id_dest)) {
                // レイヤー選択
                this.setCurrentLayer(elements[i]);
                break;
            }
        }
        // %1と%2を統合しました。
        this.axpObj.msg('@INF4004', source_name, dest_name);
        console.log(this.layerObj);
    }
    // レイヤーのコピー
    buttonCopyLayer() {
        // レイヤー最大数を超える場合は生成不可
        if (this.layerObj.length >= this.CONST.LAYER_MAX) {
            // レイヤーは%1枚までです。
            this.axpObj.msg('@CAU4002', this.CONST.LAYER_MAX);
            return;
        }

        // 複製元IDとレイヤー名（メッセージ表示用）を記憶
        const id_source = this.getId();
        const name_source = this.getName();

        // 複製元のレイヤー情報を渡してレイヤー生成
        var id_dest = this.copyLayer(this.layerObj[this.getLayerIndex(id_source)]);
        var name_dest = this.getName()
        // imageDataオブジェクトのコピー
        // this.getImage().data.set(this.layerObj[this.getLayerIndex(id_source)].image.data);

        // 表示更新
        this.updateCanvas();

        // %1を複製して、%2を作成しました。
        this.axpObj.msg('@INF4002', name_source, name_dest);

        // アンドゥ用記録
        this.axpObj.undoSystem.setUndo({
            type: 'layer-copy',
            layerObj: this.layerObj[this.getLayerIndex(id_dest)],
        });
        console.log(this.layerObj);
    }
    // レイヤーの削除
    buttonDeleteLayer() {
        // なげなわ変形中の場合、対象レイヤーが存在するうちに選択内容を確定する
        // （削除後に確定すると削除済みレイヤーへの書き込みでエラーになるため）
        this.axpObj.finalizeNagenawaSelection();
        // レイヤーがロック状態の場合は削除不可
        if (this.getLocked()) {
            // %1がロック状態のため、削除できません。
            this.axpObj.msg('@CAU4003', this.getName());
            return;
        }
        // レイヤー最大数を超える場合は生成不可
        if (this.layerObj.length <= 1) {
            // レイヤーをすべて削除することはできません。
            this.axpObj.msg('@CAU4004');
            return;
        }
        // アンドゥ用記録
        const targetId = this.getId();
        const targetName = this.getName();
        this.axpObj.undoSystem.setUndo({
            type: 'layer-delete',
            //id: targetId,
            layerObj: this.layerObj[this.getLayerIndex(targetId)],
        });
        // レイヤー削除
        this.deleteLayer(targetId);

        // 表示更新
        this.updateCanvas();
        // %1をを削除しました。
        this.axpObj.msg('@INF4003', targetName);
        console.log(this.layerObj);
    }
    // レイヤーのクリア
    buttonClearLayer() {
        // レイヤーがロック状態の場合は削除不可
        if (this.getLocked()) {
            // %1がロック状態のため、クリアできません。
            this.axpObj.msg('@CAU4000', this.getName());
            return;
        }

        // 空白のレイヤーの場合は処理を行わない（アンドゥ用履歴を作成しない）
        if (isBlankImage(this.getImage())) {
            // %1は空白のレイヤーです。
            this.axpObj.msg('@CAU4001', this.getName());
            return;
        }

        // アンドゥ用記録
        this.axpObj.undoSystem.setUndo({
            type: 'layer-clear',
            layerObj: this.axpObj.layerSystem.layerObj[this.axpObj.layerSystem.getLayerIndex(this.getId())],
        });

        // クリア
        this.clear(this.getId());
        this.updateCanvas();
        // %1をクリアしました。
        this.axpObj.msg('@INF4000', this.getName());
    }
}
// レイヤードラッグ用関数定義
let data = {
    target: null,
    diffX: 0,
    diffY: 0,
    ofx: 0,
    ofy: 0,
    idx_source: null,
};
const util = {
    index(el) {
        const parent = el.parentElement;
        const siblings = parent.children;
        const siblingsArr = [].slice.call(siblings);
        const idx = siblingsArr.indexOf(el);

        return idx;
    },
    insertClone(target, insertIdx) {
        const cloneName = `ddItemClone_${Math.trunc(Math.random() * 10000)}`;
        const clone = target.cloneNode(true);
        const parent = target.parentElement;
        const siblings = parent.children;

        clone.classList.add('axpc_HIDDEN');
        clone.classList.add(cloneName);
        siblings[insertIdx].insertAdjacentElement('afterend', clone);

        return cloneName;
    },
    swap(target) {
        const selfIdx = util.index(target);
        const cloneIdx = selfIdx + 1;
        const parent = target.parentElement;
        const siblings = parent.querySelectorAll(`:scope > *:not(.axpc_onGRAB):not(.${data.cloneName})`);

        for (let thatIdx = 0, len = siblings.length; thatIdx < len; thatIdx++) {
            const targetW = target.offsetWidth;
            const targetH = target.offsetHeight;
            const targetRect = target.getBoundingClientRect();
            const targetRectX = targetRect.left;
            const targetRectY = targetRect.top;
            const that = siblings[thatIdx];
            const thatW = that.offsetWidth;
            const thatH = that.offsetHeight;
            const thatRect = that.getBoundingClientRect();
            const thatRectX = thatRect.left;
            const thatRectY = thatRect.top;
            const thatRectYHalf = thatRectY + (thatH / 2);
            const hitX = thatRectX <= (targetRectX + targetW) && thatRectX + thatW >= targetRectX;
            const hitY = targetRectY <= thatRectYHalf && (targetRectY + targetH) >= thatRectYHalf;
            const isHit = hitX && hitY;

            if (isHit) {
                const siblingsAll = parent.children;
                const clone = siblingsAll[cloneIdx];

                parent.insertBefore(clone, selfIdx > thatIdx ? that : that.nextSibling);
                parent.insertBefore(target, clone);

                break;
            }
        }
    }
};
