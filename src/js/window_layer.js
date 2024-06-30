// @description ツールウィンドウ：親クラス＞レイヤー

import { ToolWindow } from './window.js';
import htmldata from '../html/window_layer.txt';
import { isBlankImage, flip_horizontal, flip_vertical, dispDate } from './etc.js';
// css適用
require('../css/window_layer.css');

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
    }
}

export class LayerSystem extends ToolWindow {
    // レイヤーの名前番号に使用するカウンタ
    layer_counter = 0;
    // 選択しているレイヤー要素
    currentLayer = null;
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
        LAYER_MAX: 8,
        // レイヤーのサムネイル表示のサイズ
        X_LAYER_MAX: 40,
        Y_LAYER_MAX: 40,
    }
    // 描画処理用の一時保存イメージ
    imageForUndo;
    // カラータグリスト
    colorTagList = null;
    constructor(axpObj) {
        super(axpObj);
    }
    // 初期ウィンドウ位置
    getDefaultPosition() {
        return {
            left: 10,
            top: 340,
        }
    }
    init() {
        this.createHTML(
            'axp_layer',
            'LAY',
            'レイヤー',
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
    }
    //　イベント受付開始
    startEvent() {
        // セレクトボックス：レイヤー合成モード
        document.getElementById('axp_layer_select_blendMode').addEventListener('change', (e) => {
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
        document.getElementById('axp_renamelayer').addEventListener('click', (e) => {
            cancelRename();
        });
        document.querySelector('#axp_renamelayer>div').addEventListener('click', (e) => {
            // サブウィンドウ内クリックでウィンドウが閉じないように、親へのイベント伝播を中止
            e.stopPropagation();
        });
        // キャンセルボタン
        document.getElementById('axp_renamelayer_button_close').addEventListener('click', (e) => {
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
        document.getElementById('axp_renamelayer_text_newLayerName').addEventListener('input', (e) => {
            // 決定ボタン有効化
            document.getElementById('axp_renamelayer_button_confirm').dataset.enabled = 'true';
        });
        // 色解除
        document.getElementById('axp_renamelayer_button_colorReset').addEventListener('click', (e) => {
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
            newButton.addEventListener('click', (e) => {
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
            newButton.addEventListener('pointerenter', (e) => {
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
        return checkDuplicateLayerName('レイヤー');
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
        for (var i = 0; i < elements.length; i++) {
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
        for (var i = 0; i < elements.length; i++) {
            if (elements[i].dataset.selected == 'true') {
                found = true;
                break;
            }
        }
        if (!found) {
            // 選択中のレイヤーを削除した場合、削除レイヤーの１つ上を自動選択する
            this.setCurrentLayer(elements[idx_delete]);
        }
    }
    clear(id) {
        // 引数で指定されたIDのimageDataを初期化
        // アンドゥ時に元のimagedataが必要となるため、更新ではなく新規のimagedataを作成する
        this.layerObj[this.getLayerIndex(id)].image =
            this.CANVAS.tmp_ctx.createImageData(this.axpObj.x_size, this.axpObj.y_size);
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
        this.layerObj[this.getLayerIndex(this.currentLayer.dataset.id)].image = imageData;
    }
    setImageId(imageData, id) {
        this.layerObj[this.getLayerIndex(id)].image = imageData;
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
            // 空のイメージを生成
            image: this.CANVAS.tmp_ctx.createImageData(this.axpObj.x_size, this.axpObj.y_size),
            // 挿入位置：カレントレイヤーの一つ上に追加
            insert_idx: this.getIndex(),
        }
        // imageDataオブジェクトのコピー
        layerData.image.data.set(sourceObj.image.data);

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

        return layerData.id;
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
            var msgtext = e.target.classList.contains('axpc_icon_eyeON') ? '表示' : '非表示';
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
                        var msgtext = e.target.classList.contains('axpc_icon_eyeON') ? '表示' : '非表示';
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
    openRenameLayerWindow(e) {
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
        // イベントリスナー解除用
        const controller = new AbortController();
        // ドラッグ中
        window.addEventListener('pointermove', (e) => {
            //console.log('move');
            const target = data.target;
            const pageX = e.pageX;
            const pageY = e.pageY;
            const targetPosL = data.ofx + pageX - data.diffX;
            const targetPosT = data.ofy + pageY - data.diffY;
            target.style.left = `${targetPosL}px`;
            target.style.top = `${targetPosT}px`;
            util.swap(target);
        }, { signal: controller.signal });
        // ドロップ
        window.addEventListener('pointerup', (e) => {
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
            controller.abort();

            // 操作終了後、実際に入替処理が行われたどうか判定する
            var elem = document.querySelectorAll('#axp_layer_ul_layerBox>li');
            for (var idx = 0; idx < elem.length; idx++) {
                if (elem[idx].dataset.id === target.dataset.id) break;
            }
            if (idx !== data.idx_source) {
                // レイヤー配列に反映
                //console.log("画面表示：移動元", data.idx_source, "=>移動先", idx);
                //console.log("配列　　：移動元", elem.length - 1 - data.idx_source, "=>移動先", elem.length - 1 - idx);
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
        }, { signal: controller.signal });
    }
    // カレントレイヤー更新
    setCurrentLayer(targetElement) {
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
    draw() {
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

            // imagedataを仮想キャンバスに描画
            let tmp_ctx;
            // safari
            if (this.axpObj.ENV.multiCanvas) {
                tmp_ctx = this.CANVAS.layer_ctx[idx];
            } else {
                tmp_ctx = this.CANVAS.tmp_ctx;
            }
            tmp_ctx.putImageData(item.image, 0, 0);

            // レイヤー毎のサムネイル描画
            const clearRect = Math.max(this.axpObj.x_size, this.axpObj.y_size);
            this.CANVAS.thumbnail_ctx[idx].clearRect(0, 0, clearRect, clearRect);
            this.CANVAS.thumbnail_ctx[idx].drawImage(
                tmp_ctx.canvas,
                this.axpObj.ctx_map_shift_x,
                this.axpObj.ctx_map_shift_y
            );

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
                                if (this.layerObj[skipIdx].checked) {
                                    // safari
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
                        // 描画領域の初期化
                        this.CANVAS.merge_ctx.clearRect(0, 0, this.axpObj.x_size, this.axpObj.y_size);
                        // 親レイヤーの画像をベースにする
                        this.CANVAS.merge_ctx.putImageData(item.image, 0, 0);
                        // 子と合成
                        this.CANVAS.merge_ctx.globalCompositeOperation = 'source-atop';
                        this.CANVAS.merge_ctx.globalAlpha = 1;
                        this.CANVAS.merge_ctx.drawImage(this.CANVAS.clip_ctx.canvas, 0, 0);

                        // 合成結果の保存先キャンバスを変更（クリッピング合成用）
                        outputCanvas = this.CANVAS.merge;
                    }

                }
                // レイヤーが「表示」の場合、そのレイヤーをキャンバスに描画する
                if (item.checked) {
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
        this.CANVAS.backscreen_white_ctx.fillStyle = '#ffffff';
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
    updateCanvas() {
        // キャンバス更新が影響する表示を一括処理
        this.draw();
        this.drawThumbnail();
    }
    // 画像をダウンロード
    downloadImage() {
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
