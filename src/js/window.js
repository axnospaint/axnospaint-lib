// @description ツールウィンドウ：親クラス

// ツールウィンドウ共通
export class ToolWindow {
    axpObj;
    // 自身が管理するツールウィンドウのdiv要素
    windowElement = null;
    // ランチャーボタン要素
    launcherButtonElement = null;
    // 最小化対象ウィンドウ
    isCanMinimize = false;
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
        this.isCanMinimize = minimize;
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
            // アイコン無し（ランチャーウィンドウ、カスタムウィンドウ）
            divTitle.style.gridArea = '1/1/2/3';
            divTitle.style.marginLeft = '8px';
        }
        divHeader.appendChild(divTitle);
        // 最小化可能なウィンドウの場合、最小化ボタンを生成する
        if (minimize) {
            const buttonMinimize = document.createElement('button');
            buttonMinimize.setAttribute('class', 'axpc_MSG axpc_window_header_minimizeButton');
            buttonMinimize.dataset.msg = `${name}ウィンドウを閉じます。`;
            divHeader.appendChild(buttonMinimize);

            // ランチャーボタンの生成と追加
            const newButton = document.createElement('button');
            // class追加
            newButton.classList.add('axpc_MSG', 'axpc_launcher_personalButton');
            newButton.dataset.id = id;
            newButton.dataset.msg = `${name}ウィンドウを開閉します。`;

            // アイコン用div
            const newDiv = document.createElement('div');
            newDiv.classList.add(icon);
            newButton.appendChild(newDiv);

            document.getElementById('axp_launcher_div_personalButtonsEntry').appendChild(newButton);
            this.launcherButtonElement = newButton;
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
    minimize() {
        // ツールウィンドウ消去
        this.windowElement.classList.add('axpc_window_minimize');
    }
    unminimize() {
        // ツールウィンドウ表示
        this.windowElement.classList.remove('axpc_window_minimize');
    }
    hidden() {
        // ツールウィンドウ消去
        this.windowElement.classList.add('axpc_window_hidden');
    }
    visible() {
        // ツールウィンドウ表示
        this.windowElement.classList.remove('axpc_window_hidden');
    }
}