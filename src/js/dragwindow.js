// @description ツールウィンドウのドラッグ＆ドロップ制御

// 要素内のクリック座標保持用
var drag_x;
var drag_y;
// ツールウィンドウ制御
export class DragWindow {
    axpObj;
    windowSystems = [];
    windowElements = [];
    taskObjects = [];
    zIndex_max = 1000;
    constructor(axpObj) {
        this.axpObj = axpObj;
    }
    add(objSystem) {
        this.windowSystems.push(objSystem);
        let element = objSystem.windowElement;
        this.windowElements.push(element);
        // z-index（ウィンドウの表示優先順位）割り当て
        this.zIndex_max++;
        element.style.zIndex = this.zIndex_max;
        const thisClass = this;
        element.addEventListener('pointerenter', (e) => { this.enter(e, objSystem) });
        element.addEventListener('pointerleave', (e) => { this.leave(e) });
        element.addEventListener('pointerup', (e) => { this.up(e) });
        element.addEventListener('pointerdown', (e) => { this.down(e, objSystem) });
        element.addEventListener('animationend', (e) => { this.animeend(e) });

        let elementTaskIcon = objSystem.taskIconElement;
        //console.log(elementTaskIcon);
        elementTaskIcon.addEventListener('pointerenter', (e) => { this.enter_icon(e, objSystem) });
        elementTaskIcon.addEventListener('pointerdown', (e) => { this.down_icon(e, objSystem) });
        elementTaskIcon.addEventListener('pointerleave', (e) => { this.leave(e) });
        elementTaskIcon.addEventListener('animationend', (e) => { this.animeend(e) });
    }
    enter_icon(e, objSystem) {
        // ペンの太さカーソル非表示
        this.axpObj.ELEMENT.cursor.style.visibility = 'hidden';
        // 最小化した%1ウィンドウを元の位置に戻します。
        this.axpObj.msg('@AXP0002', objSystem.name);
    }
    down_icon(e, objSystem) {
        // キャンバスへのイベント伝播停止
        e.stopPropagation();
        this.updateZIndex(objSystem.windowElement);
        objSystem.taskIconElement.style.display = 'none';
        objSystem.windowElement.style.display = '';

        let left_px = objSystem.taskIconElement.style.left;
        let top_px = objSystem.taskIconElement.style.top;
        let duration = document.getElementById('axp_config_number_minimizeDuration').value;
        // 間隔が0または非数の場合、アニメ処理しない
        if (duration === 0 || isNaN(duration)) {
            //console.log('アニメ省略',duration);
        } else {
            objSystem.windowElement.style.setProperty('--tool-left', left_px);
            objSystem.windowElement.style.setProperty('--tool-top', top_px);
            objSystem.windowElement.style.setProperty('--tool-duration', duration + 'ms');
            //console.log('アニメ開始');
            objSystem.windowElement.classList.add('axpc_window_minimizeAnime');
        }

        // 選択されたウィンドウを管理配列から削除
        let index = this.taskObjects.indexOf(objSystem);
        this.taskObjects.splice(index, 1)
        //console.log('length:', this.taskObjects.length);
        //console.log('array:', this.taskObjects);
        this.updateIconPosition();
    }
    updateIconPosition() {
        // アイコンを詰める
        this.taskObjects.forEach((element, index) => {
            this.setup_iconPositon(element.taskIconElement, index);
        });
    }
    // アイコン位置の設定
    setup_iconPositon(element, index) {
        let left, top;
        if (this.axpObj.config('axp_config_form_minimizeType') === 'horizontal') {
            // 横並び
            left = 8 + index * 32;
            top = 40;
        } else {
            // 縦並び
            left = 8;
            top = 40 + index * 32;
        }
        element.style.left = left + 'px';
        element.style.top = `calc(100% - ${top}px)`;
    }
    // アイコン最小化タイプ設定
    setMinimizeType() {
        // ツールチップの表示位置判定用クラスを付与
        const type = this.axpObj.config('axp_config_form_minimizeType');
        for (const item of this.windowSystems) {
            switch (type) {
                case 'horizontal':
                    item.taskIconElement.classList.add('axpc_window_minimizeIconHorizontal');
                    item.taskIconElement.classList.remove('axpc_window_minimizeIconVertical');
                    break;
                case 'vertical':
                    item.taskIconElement.classList.remove('axpc_window_minimizeIconHorizontal');
                    item.taskIconElement.classList.add('axpc_window_minimizeIconVertical');
                    break;
            }
        }
        // ここで画面を更新しても、キャンバスタブ非表示のため、位置が算出できない。キャンバスタブに切り替えたタイミングで更新
    }
    // デバッグ用ツールウィンドウ一覧表示
    disp() {
        for (const item of this.windowElements) {
            console.log(item.id, item.style.zIndex);
        }
    }
    //エンター時
    enter(e, objSystem) {
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
    animeend(e) {
        console.log('アニメ終了', e.currentTarget);
        e.currentTarget.classList.remove('axpc_window_minimizeAnime');
    }
    //
    updateZIndex(elem) {
        //最後に操作したウィンドウが最前面になるように重なるようにz-indexの値を再設定
        if (elem.style.zIndex === this.zIndex_max) {
            // 既に最前面の場合は処理しない（２度同じウィンドウを操作した時など）
        } else {
            // 操作したウィンドウの現在のz_indexを保持しておく
            let zIndex_target = elem.style.zIndex;
            for (const item of this.windowElements) {
                if (item === elem) {
                    // 操作したウィンドウは最前面
                    item.style.zIndex = this.zIndex_max;
                } else {
                    // その他のウィンドウ
                    if (item.style.zIndex > zIndex_target) {
                        // 現在値より高い場合は１つ下げる
                        item.style.zIndex--;
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
            let left = e.currentTarget.offsetLeft;
            let top = e.currentTarget.offsetTop;
            let duration = document.getElementById('axp_config_number_minimizeDuration').value;
            // 間隔が0または非数の場合、アニメ処理しない
            if (duration === 0 || isNaN(duration)) {
                //console.log('アニメ省略',duration);
            } else {
                objSystem.taskIconElement.style.setProperty('--tool-left', left + 'px');
                objSystem.taskIconElement.style.setProperty('--tool-top', top + 'px');
                objSystem.taskIconElement.style.setProperty('--tool-duration', duration + 'ms');
                objSystem.taskIconElement.classList.add('axpc_window_minimizeAnime');
            }
            // ツールウィンドウ消去
            objSystem.windowElement.style.display = 'none';
            // タスクアイコン表示
            objSystem.taskIconElement.style.display = '';

            this.taskObjects.push(objSystem);
            this.setup_iconPositon(objSystem.taskIconElement, this.taskObjects.length - 1);
            return;
        }

        //ドラッグ可能エリア外操作
        if (!e.target.classList.contains('axpc_window_header_dragZone')) {
            return;
        }

        //要素内の相対座標を取得
        drag_x = e.pageX - elem.offsetLeft;
        drag_y = e.pageY - elem.offsetTop;

        // イベントリスナー解除用
        const controller = new AbortController();

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
		const onPointerMove=(e)=>{
			
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
            controller.abort();
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
		};
        window.addEventListener('pointermove',onPointerMove,{ signal: controller.signal });
        window.addEventListener('pointerup',onPointerUp,{ signal: controller.signal });
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
