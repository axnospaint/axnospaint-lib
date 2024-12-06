// @description ツールウィンドウ：親クラス

// ツールウィンドウ共通
export class ToolWindow {
    axpObj;
    // 自身が管理するツールウィンドウのdiv要素
    windowElement = null;
    // 最小化時アイコンのdiv要素
    taskIconElement = null;
    // ツールウィンドウ名
    name;
    // ツールウィンドウのid
    id;
    // タイプ識別子
    type;
    // ウィンドウの座標
    window_width = 0;
    window_height = 0;
    window_left = 0;
    window_top = 0;
    constructor(axpObj) {
        this.axpObj = axpObj;
    }
    createHTML(id, type, name, icon, html, minimize = true) {
        this.id = id;
        this.type = type;
        //console.log('createHTML', name);
        // ツールウィンドウの枠div（共通部）を生成
        let divWindow = document.createElement('div');
        divWindow.setAttribute('id', id);
        divWindow.setAttribute('class', 'axpc_window');

        let divHeader = document.createElement('div');
        divHeader.setAttribute('class', 'axpc_window_header');

        // ウィンドウ名
        let divTitle = document.createElement('div');
        divTitle.textContent = name;
        // アイコン表示の生成
        if (icon) {
            let spanIcon = document.createElement('span');
            spanIcon.setAttribute('class', icon);
            divHeader.appendChild(spanIcon);
        } else {
            // カスタムボタンウィンドウのみ、アイコン無し
            divTitle.style.gridArea = '1/1/2/3';
            divTitle.style.marginLeft = '8px';

            //divWindow.style.backgroundColor = 'rgb(0, 0, 0, 0)';
        }
        divHeader.appendChild(divTitle);
        // 最小化可能なウィンドウの場合、最小化ボタンを生成する
        if (minimize) {
            let divMinimize = document.createElement('div');
            divMinimize.setAttribute('class', 'axpc_MSG axpc_window_header_minimizeButton');
            divMinimize.textContent = '▼';
            divMinimize.dataset.msg = 'ツールウィンドウを最小化します。';
            divHeader.appendChild(divMinimize);
        }

        let divDragzone = document.createElement('div');
        divDragzone.setAttribute('class', 'axpc_MSG axpc_window_header_dragZone');
        divDragzone.dataset.msg = 'ドラッグでツールウィンドウの位置を移動します。';
        divHeader.appendChild(divDragzone);

        divWindow.appendChild(divHeader);

        this.axpObj.ELEMENT.base.appendChild(divWindow);

        // 枠内にHTMLデータを展開
        divWindow.insertAdjacentHTML('beforeend', this.axpObj.translateHTML(html));
        this.windowElement = document.getElementById(id);
        this.name = name;

        //console.log('>', this.windowElement, this.name);
        // タスクバーアイコンの生成
        let newDiv = document.createElement('div');

        newDiv.setAttribute('class', 'axpc_window_minimizeIconHorizontal');
        newDiv.setAttribute('style', 'display:none');
        // data-tip属性にレイヤー名設定（hover時のtip表示用）
        newDiv.dataset.tip = name;
        // アイコン用class追加
        newDiv.classList.add(icon);

        this.axpObj.ELEMENT.base.appendChild(newDiv);

        this.taskIconElement = newDiv;
    }
    /**
     * ツールウィンドウの座標を設定する
     * @param {*} x
     * @param {*} y
     */
    setPosition(x, y) {
        // 指定なしの場合は現在座標（設定：自動調整を切り替えた場合に同一値でstyleを更新するために使用）
        let left = (x === undefined) ? this.window_left : x;
        let top = (y === undefined) ? this.window_top : y;

        if (this.axpObj.config('axp_config_form_windowAutoAdjust') === 'on') {
            // 設定：自動調整あり
            // ブラウザのリサイズ時に画面に収まるように最小値を設定
            ///this.windowElement.style.left = `min(100% - ${this.window_width}px, ${left}px)`;
            this.windowElement.style.left = `max(0px, min(100% - ${this.window_width}px, ${left}px))`;
            this.windowElement.style.top = `min(100% - 30px, ${top}px)`;
        } else {
            // 設定：自動調整なし px指定
            this.windowElement.style.left = `${left}px`;
            this.windowElement.style.top = `${top}px`;
        }
        // 現在値更新
        this.window_left = left;
        this.window_top = top;
        //console.log(this.id, this.windowElement.style.left, this.windowElement.style.top);
    }
    resetPosition() {
        let pos = this.getDefaultPosition();
        this.setPosition(pos.left, pos.top);
    }
}