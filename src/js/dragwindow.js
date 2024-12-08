// @description ツールウィンドウのドラッグ＆ドロップ制御

// 要素内のクリック座標保持用
var drag_x;
var drag_y;
// ツールウィンドウ制御
export class DragWindow {
    axpObj;
    windowSystems = [];
    zIndex_max = 1000;
    constructor(axpObj) {
        this.axpObj = axpObj;
    }
    add(objSystem) {
        this.windowSystems.push(objSystem);
        let element = objSystem.windowElement;
        // z-index（ウィンドウの表示優先順位）割り当て
        this.zIndex_max++;
        element.style.zIndex = this.zIndex_max;
        element.addEventListener('pointerenter', (e) => { this.enter(e, objSystem) });
        element.addEventListener('pointerleave', (e) => { this.leave(e) });
        element.addEventListener('pointerup', (e) => { this.up(e) });
        element.addEventListener('pointerdown', (e) => { this.down(e, objSystem) });
    }
    // 登録済みウィンドウオブジェクトからIDが一致するオブジェクトを検索
    getSystem(id) {
        for (const item of this.windowSystems) {
            if (item.id === id) {
                return item;
            }
        }
        return null;
    }
    unminimize(id) {
        const objSystem = this.getSystem(id);
        if (objSystem) {
            // ツールウィンドウ表示
            objSystem.unminimize();
        }
    }
    minimize(id) {
        const objSystem = this.getSystem(id);
        if (objSystem) {
            // ツールウィンドウ消去
            objSystem.minimize();
        }
    }
    // 非表示クラスの全体付与／解除
    changeAllWindowHiddenClass(isHidden) {
        for (const item of this.windowSystems) {
            if (item.isCanMinimize) {
                isHidden ? item.hidden() : item.visible();
            }
        }
    }
    allVisible() {
        this.changeAllWindowHiddenClass(false);
    }
    allHidden() {
        this.changeAllWindowHiddenClass(true);
    }
    // 再起動時の復元用
    restoreMinimize(id) {
        // 全体ボタン
        if (id === 'axp_all') {
            // ツールウィンドウ消去
            this.allHidden();
            // ランチャーのボタンに反映
            this.axpObj.launcher.minimizeButton(id);
            // 成功
            return true;
        }
        const objSystem = this.getSystem(id);
        if (objSystem) {
            // ツールウィンドウ消去
            this.minimize(id);
            // ランチャーのボタンに反映
            this.axpObj.launcher.minimizeButton(id);
            // 成功
            return true;
        } else {
            // 失敗
            return false;
        }
    }
    //エンター時
    enter(e) {
        if (this.axpObj.isDrawing) {
            // 描画中にツールウィンドウに被った場合は、ツールウィンドウを半透明化
            e.currentTarget.style.opacity = '0.25';
        } else {
            // ペンの太さカーソル非表示
            this.axpObj.ELEMENT.cursor.style.visibility = 'hidden';
        }
    }
    //離れた時
    leave(e) {
        e.currentTarget.style.opacity = '1';
        this.axpObj.msg('');
    }
    //ポインタアップ
    up(e) {
        e.currentTarget.style.opacity = '1';
    }
    //
    updateZIndex(elem) {
        //最後に操作したウィンドウが最前面になるように重なるようにz-indexの値を再設定
        if (elem.style.zIndex === this.zIndex_max) {
            // 既に最前面の場合は処理しない（２度同じウィンドウを操作した時など）
        } else {
            // 操作したウィンドウの現在のz_indexを保持しておく
            let zIndex_target = elem.style.zIndex;
            for (const item of this.windowSystems) {
                if (item.windowElement === elem) {
                    // 操作したウィンドウは最前面
                    item.windowElement.style.zIndex = this.zIndex_max;
                } else {
                    // その他のウィンドウ
                    if (item.windowElement.style.zIndex > zIndex_target) {
                        // 現在値より高い場合は１つ下げる
                        item.windowElement.style.zIndex--;
                    }
                }
            }
        }
    }
    down(e, objSystem) {
        if (this.axpObj.isDrawing) {
            // 描画処理中は、処理しない
            return;
        } else {
            // ツールウィンドウの操作時は、描画処理を作動させない
            // イベントバブリング抑止
            e.stopPropagation();
        }
        let elem = e.currentTarget;
        this.updateZIndex(elem);

        //最小化ボタンが押された場合
        if (e.target.classList.contains('axpc_window_header_minimizeButton')) {
            this.minimize(objSystem.windowElement.id);
            // ランチャーのボタンに反映
            this.axpObj.launcher.minimizeButton(objSystem.windowElement.id);
            // 状態保存
            this.axpObj.configSystem.saveConfig('WDMIN_' + objSystem.windowElement.id, true);
            return;
        }

        //ドラッグ可能エリア外操作
        if (!e.target.classList.contains('axpc_window_header_dragZone')) {
            return;
        }

        //要素内の相対座標を取得
        drag_x = e.pageX - elem.offsetLeft;
        drag_y = e.pageY - elem.offsetTop;

        // ドラッグ中

        const calcPosition = (x, y) => {
            //ドラッグ範囲制限
            var new_x = x - drag_x;
            var new_y = y - drag_y;
            var rect = this.axpObj.ELEMENT.base.getBoundingClientRect();
            // 横方向への移動可能最大値（ツールウィンドウの横幅分だけ残す）
            var limit_width = rect.width - objSystem.windowElement.clientWidth;
            // 下方向への移動可能最大値（ツールウィンドウのヘッダ部分だけ残す）
            var limit_height = rect.height - 30;

            if (new_x < 0) new_x = 0;
            if (new_y < 0) new_y = 0;
            if (new_x >= limit_width) new_x = limit_width;
            if (new_y >= limit_height) new_y = limit_height;

            return { x: new_x, y: new_y };
        }
        const onPointerMove = (e) => {

            let pos = calcPosition(e.pageX, e.pageY);
            //マウスが動いた場所に要素を動かす
            objSystem.setPosition(
                pos.x,
                pos.y
            );
        };
        const onPointerUp = (e) => {
            // ドロップ
            let pos = calcPosition(e.pageX, e.pageY);
            //マウスが動いた場所に要素を動かす
            objSystem.setPosition(
                pos.x,
                pos.y
            );
            //ウィンドウの座標をデータ化してコンフィグオブジェクトに格納
            let savedata = pos.x + ',' + pos.y;
            this.axpObj.configSystem.saveConfig('WDPOS_' + objSystem.windowElement.id, savedata);
            // イベントリスナー解除
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }
    /**
     * 指定idと一致したツールウィンドウ要素をサーチし、見つかった場合、初期座標を更新する
     * @param {*} id ツールウィンドウ要素のID
     * @param {*} x left座標
     * @param {*} y top座標
     * @return 要素が見つかった場合:true 見つからなかった場合（仕様変更などにより存在しないIDの設定データが受け渡された場合）:false
     */
    setInitPosition(id, x, y) {
        let isFound = false;
        for (let index = 0; index < this.windowSystems.length; index++) {
            if (this.windowSystems[index].id === id) {
                // 初期座標更新
                this.windowSystems[index].window_left = x;
                this.windowSystems[index].window_top = y;
                isFound = true;
            }
        }
        return isFound;
    }
    /**
     * 全ツールウィンドウ位置の初期設定（事前にユーザー設定復元でwindow_leftとwindow_topを更新しておくこと）
     */
    initPosition() {
        for (let item of this.windowSystems) {
            item.setPosition();
        }
    }
    /**
     * 全ツールウィンドウ位置をデフォルトにリセット
     */
    resetPosition() {
        for (let item of this.windowSystems) {
            item.resetPosition();
            let key = 'WDPOS_' + item.windowElement.id;
            this.axpObj.configSystem.deleteConfig(key);
        }
    }
    changeAutoAdjustPosition() {
        for (let item of this.windowSystems) {
            item.setPosition();
        }
    }
}
