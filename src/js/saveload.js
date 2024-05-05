// @description セーブ／ロード／自動保存から復元処理　indexedDB処理系

import { UTIL } from './etc.js';

// 自動保存の間隔
const AUTOSAVE_INTERVAL = 10;
// indexedDB定義
const DB_NAME = 'axnospaint_db1';
const DB_VERSION = 2;
const STORE_NAME_SAVE_MANUAL = 'save_manual';
const STORE_NAME_SAVE_AUTO = 'save_auto';
const STORE_NAME_CONFIG = 'save_config';
const STORE_NAME_PALETTE = 'save_palette';

// 自動保存の最大スロット数
const AUTOSAVE_MAX = 20;
// マニュアル保存の最大スロット数
const MANUALSAVE_MAX = 5;

export class SaveSystem {
    axpObj;
    dbSystem;
    // indexedDB利用可能判定
    isDBAvailable;
    // 自動保存カウンタ
    autosave_counter;
    CONST = {
        // AXNOS Paintセーブデータ書式のバージョン（他システムから参照される）※indexedDBのバージョンとは別物
        DATA_VERSION: 2,
    }
    constructor(axpObj) {
        this.axpObj = axpObj;
        this.dbSystem = new DbSystem();
        this.autosave_counter = 0;
    }
    // 初期処理
    init() {
    }
    // DB初期化
    async initDB() {
        let result;
        try {
            result = await this.dbSystem.initIndexedDB();
            if (result) {
                this.isDBAvailable = true;
            } else {
                alert('ブラウザのIndexedDBが無効になっています。\nセーブ/ロード機能などは利用できません。');
                this.isDBAvailable = false;
            }
        } catch (error) {
            console.log(error);
            alert(`エラー:IndexedDBの初期化に失敗しました。\nセーブ/ロード機能などは利用できません。\n${error}`);
            this.isDBAvailable = false;
        }
        return this.isDBAvailable;
    }
    // オートセーブ（カウントとセーブ実行）
    async autoSave() {
        // DB使用不可の場合処理しない
        if (!this.isDBAvailable) return;

        this.autosave_counter++;
        // 規定回数の描画操作を行ったらオートセーブ
        if (this.autosave_counter >= AUTOSAVE_INTERVAL) {
            this.autosave_counter = 0;
            const data = {
                created: new Date(),
                version: this.CONST.DATA_VERSION,
                src: this.axpObj.assistToolSystem.CANVAS.thumbnail.toDataURL(),
                x_max: this.axpObj.x_size,
                y_max: this.axpObj.y_size,
                counter: this.axpObj.layerSystem.layer_counter,
                // 配列を反転して保存（ver1.13以前との互換用）
                //layer: this.axpObj.layerSystem.layerObj.reverse(),
                layer: this.axpObj.layerSystem.layerObj,
                oekaki_id: this.axpObj.oekaki_id,
                oekaki_bbs_pageno: this.axpObj.oekaki_bbs_pageno,
                oekaki_bbs_title: this.axpObj.oekaki_bbs_title,
                transparent: this.axpObj.assistToolSystem.getIsTransparent()
            };
            // 指定のデータをDBへ書き込む
            try {
                await this.dbSystem.autosaveToDB(data, STORE_NAME_SAVE_AUTO);
            } catch (error) {
                // オートセーブエラーは告知しない（連続で表示されると描画処理が困難になるため）
                console.log(error);
            }
        }
    }
    startEvent() {
        // セーブ／ロード画面の閉じるボタン
        // （仕様変更）ボタン以外　document.getElementById('axp_saveload').onclick でも閉じることができたのを廃止
        document.getElementById('axp_saveload_button_close').onclick = (e) => {
            this.closeWindow();
        }
    }
    closeWindow() {
        // 子要素を全消去
        const elementDiv = document.getElementById('axp_saveload_div_insertHTML');
        while (elementDiv.childElementCount) {
            elementDiv.removeChild(elementDiv.firstElementChild);
        }
        // モーダルウィンドウを閉じる
        this.axpObj.isModalOpen = false;
        UTIL.hide('axp_saveload');
    }
    // セーブ／ロード画面表示（セーブ／ロード／自動保存から復元共通）
    openWindow() {
        if (!this.isDBAvailable) {
            // 現在セーブ/ロード機能は使用できません。ヘルプをご確認下さい。
            this.axpObj.msg('@CAU0300');
            return false;
        }
        this.axpObj.isModalOpen = true;
        UTIL.show('axp_saveload');

        // 子要素を全消去（閉じる時に削除されなかった場合の保険初期化）
        const elementDiv = document.getElementById('axp_saveload_div_insertHTML');
        while (elementDiv.childElementCount) {
            elementDiv.removeChild(elementDiv.firstElementChild);
        }
        return true;
    }
    createSlotHTML(mode, cursor) {
        // スロット挿入用枠要素
        const obj = document.getElementById('axp_saveload_div_insertHTML');
        const value = cursor.value;

        // スロットの作成
        const newDiv = document.createElement('div');
        // 主キーを含んだ文字列をid名とする
        newDiv.setAttribute('id', `axp_saveload_div_${cursor.primaryKey}`);
        // 主キーを記憶しておく
        newDiv.setAttribute('data-key', cursor.primaryKey);
        // セーブ用とロード用で別のクラスを付与
        if (mode === 'save') {
            newDiv.setAttribute('class', 'axpc_saveload_saveSlot');
        } else {
            newDiv.setAttribute('class', 'axpc_saveload_loadSlot');
        }
        // サムネイル枠
        const newDivThumbnall = document.createElement('div');
        newDivThumbnall.setAttribute('class', 'axpc_saveload_thumbnall');
        newDiv.appendChild(newDivThumbnall);

        // セーブデータありのスロット
        if (value.created !== undefined) {
            // サムネイル画像
            const newImg = document.createElement('img');
            newImg.setAttribute('src', value.src);
            newDivThumbnall.appendChild(newImg);
            // 日付、時刻、基にしたoekaki_idの要素作成
            const newDivDate = document.createElement('div');
            const newDivTime = document.createElement('div');
            const newDivRefId = document.createElement('div');
            newDivRefId.setAttribute('class', 'axpc_saveload_refId');
            // 日付
            let stringDate = 'YYYY/MM/DD';
            stringDate = stringDate.replace(/YYYY/, value.created.getFullYear());
            stringDate = stringDate.replace(/MM/, ("0" + (value.created.getMonth() + 1)).slice(-2));
            stringDate = stringDate.replace(/DD/, ("0" + value.created.getDate()).slice(-2));
            newDivDate.textContent = stringDate;
            // 時刻
            let stringTime = 'hh:mm:ss';
            stringTime = stringTime.replace(/hh/, ("0" + value.created.getHours()).slice(-2));
            stringTime = stringTime.replace(/mm/, ("0" + value.created.getMinutes()).slice(-2));
            stringTime = stringTime.replace(/ss/, ("0" + value.created.getSeconds()).slice(-2));
            newDivTime.textContent = stringTime;
            // 基にしたoekaki_id
            if (value.oekaki_id !== undefined) {
                if (value.oekaki_id !== null) {
                    newDivRefId.textContent = '[基]' + value.oekaki_id;
                }
            }
            newDiv.appendChild(newDivDate);
            newDiv.appendChild(newDivTime);
            newDiv.appendChild(newDivRefId);
        } else {
            // 空エントリ
            newDiv.appendChild(document.createTextNode('空き'));
        }
        // スロット挿入用枠要素に作成したスロットを追加
        obj.appendChild(newDiv);
    }
    // セーブ
    async save() {
        // サブ画面を表示
        if (!this.openWindow()) {
            return;
        }
        document.getElementById('axp_saveload_span_message').textContent = 'セーブするスロットを選択（※保存済みのスロットは上書きされます）';
        try {
            await this.dbSystem.loadEntry('save', STORE_NAME_SAVE_MANUAL, this.createSlotHTML);
            // スロット要素（直下の子要素div）を取得
            const elementsSlot = document.querySelectorAll('#axp_saveload_div_insertHTML > div');
            for (const item of elementsSlot) {
                // スロットがクリックされたらセーブ処理を行う
                item.onclick = (e) => {
                    // data-keyに記憶しておいた主キーを使用する
                    const save_id = e.currentTarget.dataset.key;
                    const data = {
                        id: save_id,
                        version: this.CONST.DATA_VERSION,
                        created: new Date(),
                        src: this.axpObj.assistToolSystem.CANVAS.thumbnail.toDataURL(),
                        x_max: this.axpObj.x_size,
                        y_max: this.axpObj.y_size,
                        counter: this.axpObj.layerSystem.layer_counter,
                        layer: this.axpObj.layerSystem.layerObj,
                        oekaki_id: this.axpObj.oekaki_id,
                        oekaki_bbs_pageno: this.axpObj.oekaki_bbs_pageno,
                        oekaki_bbs_title: this.axpObj.oekaki_bbs_title,
                        transparent: this.axpObj.assistToolSystem.getIsTransparent()
                    };

                    (async () => {
                        // 指定のデータをDBへ書き込む
                        try {
                            await this.dbSystem.saveToDB(data, STORE_NAME_SAVE_MANUAL);
                            // スロット%1にセーブしました。
                            this.axpObj.msg('@INF0300', save_id.substr(5));
                        } catch (error) {
                            console.log(error);
                            alert(`エラー：セーブデータの保存に失敗しました。\n${error}`);
                        } finally {
                            this.closeWindow();
                        }
                    })();
                }
            }
        } catch (error) {
            console.log(error);
            alert(`エラー：セーブデータの読込に失敗しました。\n${error}`);
        }
    }
    // ロード処理共通
    // mode: 'load' or 'auto'
    async loadCommon(mode, storeName) {
        try {
            await this.dbSystem.loadEntry(mode, storeName, this.createSlotHTML);
            // スロット要素（直下の子要素div）を取得
            const elementsSlot = document.querySelectorAll('#axp_saveload_div_insertHTML > div');
            for (const item of elementsSlot) {
                // スロットがクリックされたらロード処理を行う
                item.onclick = (e) => {
                    // data-keyに記憶しておいた主キーを使用する
                    let save_id;
                    if (mode === 'auto') {
                        // 自動保存用セーブデータのキーは数値型の自動付与）
                        save_id = Number(e.currentTarget.dataset.key);
                    } else {
                        // マニュアル用セーブデータのキーは文字列
                        save_id = e.currentTarget.dataset.key;
                    }
                    (async () => {
                        try {
                            // 指定IDのデータをDBから読み込む
                            const data = await this.dbSystem.loadFromDB(save_id, storeName);
                            //console.log(data);
                            if (data.created === undefined) {
                                // スロット%1にはデータがありません。
                                this.axpObj.msg('@CAU0301', save_id.substr(5));
                                return;
                            }
                            // 同一掲示板のみロード可能とする設定の場合、チェックを行う
                            if (this.restore_oekaki_id(data)) {
                                this.restoreData(data);
                                if (mode === 'auto') {
                                    // 自動保存されたデータをロードしました。
                                    this.axpObj.msg('@INF0302');
                                } else {
                                    // スロット%1をロードしました。
                                    this.axpObj.msg('@INF0301', save_id.substr(5));
                                }
                            } else {
                                // 掲示板不一致
                                alert(data.oekaki_bbs_title
                                    + '\nに投稿された画像を基にしているため、別の掲示板には投稿できません。\n同一の掲示板でロードしてください。');
                            }
                        } catch (error) {
                            console.log(error);
                            alert(`エラー：セーブデータの読込に失敗しました。\n${error}`);
                        } finally {
                            this.closeWindow();
                        }
                    })();
                }
            }
        } catch (error) {
            console.log(error);
            alert(`エラー：セーブデータの読込に失敗しました。\n${error}`);
        }
    }
    // ロード
    load() {
        // サブ画面を表示
        if (!this.openWindow()) {
            return;
        }
        document.getElementById('axp_saveload_span_message').textContent = 'ロードするスロットを選択（※現在の描画内容は破棄されます）';
        this.loadCommon('load', STORE_NAME_SAVE_MANUAL);
    }
    // 自動保存から復元
    restore() {
        // サブ画面を表示
        if (!this.openWindow()) {
            return;
        }
        document.getElementById('axp_saveload_span_message').textContent = '自動バックアップ（10ストローク毎に保存）を選択（※現在の描画内容は破棄されます）';
        this.loadCommon('auto', STORE_NAME_SAVE_AUTO);
    }
    // 「基にしてお絵カキコ」情報のチェックと復元
    restore_oekaki_id(readdata) {
        //console.log(readdata.oekaki_id);
        if (readdata.oekaki_id !== undefined && readdata.oekaki_id !== null) {
            // 「基にしてお絵カキコ」画像の場合
            console.log('同一掲示板チェック:', readdata.oekaki_bbs_pageno, this.axpObj.post_bbs_pageno);
            // 同一掲示板チェックが有効
            if (this.axpObj.checkSameBBS) {
                if (readdata.oekaki_bbs_pageno !== this.axpObj.post_bbs_pageno) {
                    return false;
                }
            }
            // 「基にしてお絵カキコ」情報の復元
            this.axpObj.oekaki_id = readdata.oekaki_id;
            this.axpObj.oekaki_bbs_pageno = readdata.oekaki_bbs_pageno;
            this.axpObj.oekaki_bbs_title = readdata.oekaki_bbs_title;
        } else {
            // 「基にしてお絵カキコ」情報のリセット
            this.axpObj.oekaki_id = null;
            this.axpObj.oekaki_bbs_pageno = null;
            this.axpObj.oekaki_bbs_title = null;
        }
        return true;
    }
    // レイヤーオブジェクトから画面を復元する
    restoreData(obj) {
        // キャンバスサイズ再設定
        this.axpObj.x_size = obj.x_max;
        this.axpObj.y_size = obj.y_max;
        // キャンバス初期化（キャンバスサイズ変更、レイヤー削除、拡大率リセットなど）
        this.axpObj.resetCanvas();
        // レイヤーカウンタ復元
        this.axpObj.layerSystem.setLayerCounter(obj.counter);

        // バージョンチェック
        let ver = (obj.version) ? obj.version : 0;
        console.log('data version:', ver);
        // ver1.13以前のデータならば、互換性のためにレイヤー配列の順序を反転する
        if (ver < 2) {
            Array.prototype.reverse.call(obj.layer);
            for (let i = 0; i < obj.layer.length; i++) {
                obj.layer[i].index = i;
            }
        }

        //console.log(obj);
        // レイヤー復元
        for (let idx = 0; idx < obj.layer.length; idx++) {
            // ロードしたデータを元に、layerObjを復元、生成する
            this.axpObj.layerSystem.restoreLayer({
                layerObj: obj.layer[idx],
            });
        }
        // 背景透過の有無の情報が含まれていれば復元
        if (typeof obj.transparent !== 'undefined') {
            this.axpObj.assistToolSystem.setIsTransparent(obj.transparent);
        } else {
            // 情報なしの場合、透過なし（ver1.99.80以前のデータ互換用）
            this.axpObj.assistToolSystem.setIsTransparent(false);
        }
        // 最上位のレイヤーを選択
        this.axpObj.layerSystem.selectCurrentLayerIndex(0);
        // 合成モード表示更新
        this.axpObj.layerSystem.updateBlendModeDisplayAll();
        // キャンバスを更新
        this.axpObj.layerSystem.updateCanvas();
    }
    // ユーザー設定の保存
    save_config(configObj) {
        // DB使用不可の場合処理しない
        if (!this.isDBAvailable) return;

        const data = {
            id: 'config_01',
            config: configObj,
        }
        try {
            this.dbSystem.saveToDB(data, STORE_NAME_CONFIG);
        } catch (error) {
            console.log(error);
        }
    }
    // ユーザー設定の読込
    async load_config() {
        // DB使用不可の場合処理しない（コール前に判定しているため、正常系では不通）
        if (!this.isDBAvailable) return;

        const save_id = 'config_01';
        // 指定IDのデータをDBから読み込む
        let result = await this.dbSystem.loadFromDB(save_id, STORE_NAME_CONFIG)
        if (result.config !== undefined) {
            // 復元データあり
            // console.log('ユーザー設定データあり');
            return result.config;
        } else {
            // 復元データなし
            // console.log('ユーザー設定データなし');
            return;
        }
    }
    // カラーパレットの保存
    save_palette(paletteObj) {
        // DB使用不可の場合処理しない
        if (!this.isDBAvailable) return;

        const data = {
            id: 'palette_01',
            palette: paletteObj,
        }
        try {
            this.dbSystem.saveToDB(data, STORE_NAME_PALETTE);
        } catch (error) {
            console.log(error);
        }
    }
    // カラーパレットの読込
    async load_palette() {
        // DB使用不可の場合処理しない（コール前に判定しているため、正常系では不通）
        if (!this.isDBAvailable) return;

        const save_id = 'palette_01';
        // 指定IDのデータをDBから読み込む
        let result = await this.dbSystem.loadFromDB(save_id, STORE_NAME_PALETTE)
        if (result.palette !== undefined) {
            // 復元データあり
            //console.log("パレットデータあり");
            return result.palette;
        } else {
            //console.log("パレットデータなし");
            return;
        }
    }
}

// indexedDB処理系
// saveSystemからのみアクセス可能
class DbSystem {
    constructor() {
    }
    initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                // indexedDBが使用不可な環境（正常終了）
                resolve(false);
            }
            const openReq = indexedDB.open(DB_NAME, DB_VERSION);
            openReq.onerror = () => {
                reject(new Error('initIndexedDB:openReq.onerror'));
            }
            openReq.onupgradeneeded = (event) => {
                const db = openReq.result;
                // 初回利用時（またはDBが古い状態の時）DBを新規作成／更新する
                if (event.oldVersion <= 1) {
                    const store_manual = db.createObjectStore(STORE_NAME_SAVE_MANUAL, { keyPath: 'id' });
                    store_manual.put({ id: 'save_01' });
                    store_manual.put({ id: 'save_02' });
                    store_manual.put({ id: 'save_03' });
                    store_manual.put({ id: 'save_04' });
                    store_manual.put({ id: 'save_05' });

                    const store_auto = db.createObjectStore(STORE_NAME_SAVE_AUTO, { autoIncrement: true });
                    store_auto.createIndex('created', 'created', { unique: false });

                    const store_config = db.createObjectStore(STORE_NAME_CONFIG, { keyPath: 'id' });
                    store_config.put({ id: 'config_01' });

                    const store_palette = db.createObjectStore(STORE_NAME_PALETTE, { keyPath: 'id' });
                    store_palette.put({ id: 'palette_01' });
                }
            }
            openReq.onsuccess = () => {
                resolve(true);
            }
        });
    }
    // エントリーロード（セーブロード自動保存共通）
    // mode : 'save'or 'load' of 'auto'
    // storeName : ストア名
    // dispFunction : 画面表示用コールバック関数
    loadEntry(mode, storeName, dispFunction) {
        return new Promise((resolve, reject) => {
            // データベースを開く
            let db;
            const openReq = indexedDB.open(DB_NAME, DB_VERSION);
            openReq.onerror = () => {
                reject(new Error('loadEntry:openReq.onerror'));
            }
            // DBからレイヤーオブジェクトを読み込み
            openReq.onsuccess = () => {
                db = openReq.result;
                // DBから読み込み
                const transaction = db.transaction(storeName);
                const store = transaction.objectStore(storeName);

                let direction;
                let slotMAX;
                if (mode === 'auto') {
                    // 自動保存は新着順
                    direction = 'prev';
                    slotMAX = AUTOSAVE_MAX;
                } else {
                    // セーブロードはID順
                    direction = 'next';
                    slotMAX = MANUALSAVE_MAX;
                }
                const readReq = store.openCursor(null, direction);

                let idx = 0;
                readReq.onerror = () => {
                    reject(new Error('loadEntry:readReq.onerror'));
                }
                readReq.onsuccess = () => {
                    let cursor = readReq.result;
                    if (cursor) {
                        // カーソル（１スロット分）のHTML生成表示
                        dispFunction(mode, cursor);
                        // カーソルを進める
                        idx++;
                        //console.log(idx);
                        if (idx < slotMAX) {
                            cursor.continue();
                        } else {
                            // 最大件数まで読み込んだら正常終了
                            resolve();
                        }
                    } else {
                        if (mode === 'auto') {
                            // 最大件数に満たない場合でも正常終了
                            resolve();
                        } else {
                            // 既定分のカーソルが取得できなかった場合
                            reject(new Error('loadEntry:readReq.onsuccess'));
                        }
                    }
                }
            }
        });
    }
    // DBへセーブ（共通）
    saveToDB(data, storeName) {
        return new Promise((resolve, reject) => {
            const openReq = indexedDB.open(DB_NAME, DB_VERSION);
            openReq.onerror = () => {
                reject(new Error('saveToDB:openReq.onerror'));
            }
            openReq.onsuccess = () => {
                const db = openReq.result;
                const transaction = db.transaction(storeName, "readwrite");
                // 操作するためにオブジェクトストアを取得
                const store = transaction.objectStore(storeName);
                // DBへレイヤーオブジェクトを書き込み
                const saveReq = store.put(data);
                saveReq.onerror = () => {
                    reject(new Error('saveToDB:saveReq.onerror'));
                }
                saveReq.onsuccess = () => {
                    resolve();
                }
            }
        });
    }
    // DBへセーブ（自動保存用）
    autosaveToDB(data, storeName) {
        return new Promise((resolve, reject) => {
            const openReq = indexedDB.open(DB_NAME, DB_VERSION);
            openReq.onerror = () => {
                reject(new Error('autosaveToDB:openReq.onerror'));
            }
            openReq.onsuccess = () => {
                const db = openReq.result;
                const transaction = db.transaction(storeName, "readwrite");
                // 操作するためにオブジェクトストアを取得
                const store = transaction.objectStore(storeName);

                // データが２０件を超える場合は一番古いものを削除
                const countReq = store.count();
                countReq.onerror = () => {
                    reject(new Error('autosaveToDB:countReq.onerror'));
                }
                countReq.onsuccess = () => {
                    //console.log(countReq.result);
                    //console.log(AUTOSAVE_MAX);
                    if (countReq.result >= AUTOSAVE_MAX) {
                        // DBから読み込み
                        const readReq = store.openCursor(null, "next");
                        readReq.onerror = () => {
                            reject(new Error('autosaveToDB:readReq.onerror'));
                        }
                        readReq.onsuccess = () => {
                            const cursor = readReq.result;
                            if (cursor) {
                                // １件削除
                                const deleteReq = cursor.delete();
                                deleteReq.onerror = () => {
                                    reject(new Error('autosaveToDB:deleteReq.onerror'));
                                }
                                deleteReq.onsuccess = () => {
                                    //console.log("olddata delete success");
                                }
                            } else {
                                //console.log("No more entry");
                            }
                        }
                    }
                }
                // DBへレイヤーオブジェクトを書き込み
                const saveReq = store.put(data);
                saveReq.onerror = () => {
                    reject(new Error('autosaveToDB:saveReq.onerror'));
                }
                saveReq.onsuccess = () => {
                    resolve();
                }
            }
        });
    }
    // DBからロード（マニュアル/自動保存兼用）
    loadFromDB(id, storeName) {
        return new Promise((resolve, reject) => {
            const openReq = indexedDB.open(DB_NAME, DB_VERSION);
            openReq.onerror = () => {
                reject(new Error('loadFromDB:openReq.onerror'));
            }
            openReq.onsuccess = () => {
                const db = openReq.result;
                // DBから読み込み
                const transaction = db.transaction(storeName);
                const store = transaction.objectStore(storeName);
                const readReq = store.get(id);
                readReq.onerror = () => {
                    reject(new Error('loadFromDB:readReq.onerror'));
                }
                readReq.onsuccess = () => {
                    if (readReq.result !== undefined) {
                        resolve(readReq.result);
                    } else {
                        reject(new Error('loadFromDB:readReq.onsuccess'));
                    }
                }
            }
        });
    }
}