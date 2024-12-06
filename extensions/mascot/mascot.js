// @description マスコット制御（Webデモページ用）

// css適用
require('./mascot.css');

// メッセージテキスト
import text_01 from './axptan_01.txt';

const textArray = [];
textArray[0] = text_01.split(/\r\n|\n/);
//console.log(textArray);
const message = [];

for (let char = 0; char < textArray.length; char++) {
    const talk = new Map();
    for (let index = 0; index < textArray[char].length; index++) {
        let splitText = textArray[char][index].split(',');
        let type = splitText[0];
        let text = splitText[1];
        if (splitText[1] === '') {
            throw (`メッセージデータに不正があります type:${type} index:${index}`);
        }
        if (!talk.has(type)) {
            talk.set(type, [text]);
        } else {
            talk.get(type).push(text);
        }
    }
    message.push(talk);
}

import text_02 from './axptan_02.txt';
const textArray2 = text_02.split(/\r\n|\n/);

const talkById = new Map();
for (let index = 0; index < textArray2.length; index++) {
    let splitText = textArray2[index].split(',');
    let type = splitText[0];
    let text = splitText[1];
    if (splitText[1] === '') {
        //throw (`メッセージデータに不正があります type:${type} index:${index}`);
    }
    talkById.set(type, text);
}

const INTERVAL_MASCOT_MESSAGE = 15000;
const INTERVAL_MASCOT_SLEEP = 3000;

// 補助ツール制御オブジェクト
export default class Mascot {
    axpObj = null;
    element = null;
    lastType = null;
    lastIndex = null;
    messageTimerID = null;
    charId = 0;
    baseLeft = null;
    baseTop = null;
    baseX = null;
    baseY = null;
    constructor(axpObj) {
        this.axpObj = axpObj;
        console.log('ex:Mascot Ready');
    }
    init() {
        // HTMLデータを展開
        // 設定画面ナビボタン
        document.getElementById('axp_config_button_version').insertAdjacentHTML('beforebegin',
            `
            <button class="axpc_MSG" data-msg="マスコットの設定を行います。">マスコット</button>
            `
        );
        // 設定画面本文
        document.getElementById('axp_config_div_version').insertAdjacentHTML('beforebegin',
            `
        <div class="axpc_config_section" data-title="マスコット">
            <div class="axpc_config_group" data-title="マスコットの表示">
                <form id="axp_config_form_useMascotType" class="axpc_radio">
                    <span data-msg="マスコットを非表示にします。" data-value="none">なし</span>
                    <span data-msg="マスコットを表示します。" data-value="axptan1" data-default="y">あり</span>
                </form>
            </div>
            <div class="axpc_config_group" data-title="セリフの表示">
                <form id="axp_config_form_mascotMessageType" class="axpc_radio">
                    <span data-msg="マスコットのセリフを非表示にします。" data-value="none">なし</span>
                    <span data-msg="マスコットのセリフを表示します。" data-value="axptan1" data-default="y">あり</span>
                </form>
            </div>
        </div>
        `
        );
        // 本体
        document.getElementById('axp_canvas').insertAdjacentHTML('beforeend',
            `
            <div id="axp_mascot">
                <div>
                    <div id="axp_mascot_rotate">
                        <div id="axp_mascot_char"></div>
                    </div>
                    <div id="axp_mascot_ballon">
                        <div class="axpc_mascot_balloon">
                            <div id="axp_mascot_message"></div>
                        </div>
                    </div>
                </div>
            </div>
            `
        );
        this.element = document.getElementById('axp_mascot');
    }
    startEvent() {
        // ウィンドウから離れたとき、メッセージ消去＋雑談タイマーセット
        const elementsWindow = document.querySelectorAll('.axpc_window');
        for (const item of elementsWindow) {
            // ウィンドウから離れたとき
            item.addEventListener('pointerleave', () => {
                this.talk();
                this.resetTimer();
            });

        }
        // ボタンにカーソルをあてたときにメッセージを表示
        const messages = document.querySelectorAll('.axpc_MSG,.axpc_FUNC,#axp_palette_div_paletteBox');
        for (const item of messages) {
            // 要素に入ったとき
            item.addEventListener('pointerenter', (e) => {
                let targetId = e.target.id;
                //console.log(targetId);
                // 最小化ボタン専用処理
                if (e.target.classList.contains('axpc_window_header_minimizeButton')) {
                    targetId = 'axpc_window_header_minimizeButton';
                }
                // ツールウィンドウ専用処理
                if (e.target.classList.contains('axpc_window_header_dragZone')) {
                    // 親の親要素からツールウィンドウIDを取得
                    let grandParent = e.target.parentNode.parentNode;
                    if (grandParent) {
                        targetId = grandParent.id;
                    };
                }
                // スポイト専用処理
                if (targetId === 'axp_pen_button_spuitBase') {
                    this.setAmine('puyon');
                } else {
                    this.setAmine();
                }
                let text = talkById.get(targetId);
                if (text) {
                    this.talk(text);
                    this.clearTimer();
                }
            });
        }
        // レイヤー専用処理（要素が動的生成のため、リスナー設定ができないため）
        document.getElementById('axp_layer_ul_layerBox').addEventListener('pointermove', (e) => {
            let element = document.elementFromPoint(e.clientX, e.clientY);
            let targetClass = null;
            if (element.classList.contains('axpc_icon_eyeON') || element.classList.contains('axpc_icon_eyeOFF')) {
                targetClass = 'axpc_icon_eyeON';
            }
            if (element.classList.contains('axpc_icon_lockON') || element.classList.contains('axpc_icon_lockOFF')) {
                targetClass = 'axpc_icon_lockON';
            }
            if (element.classList.contains('axpc_icon_maskON') || element.classList.contains('axpc_icon_maskOFF')) {
                targetClass = 'axpc_icon_maskON';
            }
            if (element.classList.contains('axpc_layer_canvas_cellThumbnail')) {
                targetClass = 'axpc_layer_canvas_cellThumbnail';
            }
            if (element.classList.contains('axpc_layer_div_cellRightSide') || element.classList.contains('axpc_layer_span_cellName')) {
                targetClass = 'axpc_layer_div_cellRightSide';
            }
            if (targetClass) {
                this.talk(talkById.get(targetClass));
                this.clearTimer();
            }
        });

        this.element.addEventListener('pointerenter', () => {
            // ペンの太さカーソル非表示
            this.axpObj.ELEMENT.cursor.style.visibility = 'hidden';
            this.randomMessage();
        });

        // 設定：アクペたん
        document.getElementById('axp_config_form_useMascotType').onchange = (e) => {
            this.displayMascot();
        }
        // 設定：アクペたん
        document.getElementById('axp_config_form_mascotMessageType').onchange = (e) => {
            this.setMsg();
        }
        // 表示
        this.displayMascot();
        this.setAmine();

        // 設定：アクペたん
        document.getElementById('axp_mascot_char').addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            const rect = this.element.getBoundingClientRect();
            const rectHead = document.getElementById('axp_canvas').getBoundingClientRect();
            this.baseLeft = rect.left;
            this.baseTop = rect.top - rectHead.top;
            this.baseX = e.pageX;
            this.baseY = e.pageY;
            //console.log('down', e.pageX, e.pageY);
            // ドラッグ中
            const calcPosition = (x, y) => {
                //ドラッグ範囲制限
                let new_x = this.baseLeft + (x - this.baseX);
                let new_y = this.baseTop + (y - this.baseY);

                var rect = this.axpObj.ELEMENT.base.getBoundingClientRect();
                // 横方向への移動可能最大値（マスコットの横幅分だけ残す）
                var limit_width = rect.width - 128;
                // 下方向への移動可能最大値（マスコットの縦幅分だけ残す）
                var limit_height = rect.height - 128;

                if (new_x < 0) new_x = 0;
                if (new_y < 0) new_y = 0;
                if (new_x >= limit_width) new_x = limit_width;
                if (new_y >= limit_height) new_y = limit_height;
                return { x: new_x, y: new_y };
            }
            const onPointerMove = (e) => {
                e.stopPropagation();
                let pos = calcPosition(e.pageX, e.pageY);
                //マウスが動いた場所に要素を動かす
                this.setPosition(
                    pos.x,
                    pos.y
                );
            }
            // ドロップ
            const onPointerUp = (e) => {
                e.stopPropagation();
                let pos = calcPosition(e.pageX, e.pageY);
                //マウスが動いた場所に要素を動かす
                this.setPosition(
                    pos.x,
                    pos.y
                );
                // イベントリスナー解除
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
            }
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        });
    }
    //
    talk(text) {
        if (this.axpObj.config('axp_config_form_mascotMessageType') === 'none') {
            return;
        }
        if (!text) {
            document.getElementById('axp_mascot_ballon').style.display = 'none';
        } else {
            document.getElementById('axp_mascot_ballon').style.display = '';
            document.getElementById('axp_mascot_message').textContent = text;
        }
    }

    setPosition(x, y) {
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
    }
    setChar(type = 'axptan1') {
        // 全クラス削除
        let element = document.getElementById('axp_mascot_char');
        element.classList.remove(...element.classList);
        element.classList.add(type);
    }
    setAmine(type = 'idle') {
        // 全クラス削除
        let element = document.getElementById('axp_mascot_char');
        element.classList.remove(...element.classList);
        //element.classList.add('axptan1');
        element.classList.add(type);
    }
    setMsg() {
        let type = this.axpObj.config('axp_config_form_mascotMessageType');
        switch (type) {
            case 'none':
                this.charId = -1;
                document.getElementById('axp_mascot_ballon').style.display = 'none';
                break;
            case 'axptan1':
                this.charId = 0;
                break;
        }
        this.randomMessage('GRE');
    }

    displayMascot() {
        let type = this.axpObj.config('axp_config_form_useMascotType');
        if (type === 'none') {
            document.getElementById('axp_config_form_mascotMessageType').style.opacity = '.3';
            this.hide();
        } else {
            document.getElementById('axp_config_form_mascotMessageType').style.opacity = '1';
            this.setChar(type);
            this.setMsg();
            this.show();
        }
    }
    show() {
        this.element.style.display = '';
    }
    hide() {
        // タイマーリセット
        if (this.messageTimerID) {
            clearTimeout(this.messageTimerID);
            this.messageTimerID = null;
        }
        this.element.style.display = 'none';
    }

    randomMessage(type = 'ETC') {
        if (this.charId === -1) return;

        this.resetTimer();

        let talk = message[this.charId];
        let execType;
        if (talk.has(type)) {
            execType = type;
        } else {
            execType = 'ETC';
        }
        // 該当するタイプのメッセージ配列を取得
        let length = talk.get(execType).length;
        let index = -1;
        while (index === -1) {
            let rand = Math.floor(Math.random() * length);
            //console.log('msg', execType, rand);
            if (length > 1 &&
                this.lastType === execType &&
                this.lastIndex === rand) {
                // 連続して同じメッセージが表示されないようにリロール
                //console.log('リロール');
            } else {
                index = rand;
            }
        }
        let text = talk.get(execType)[index];
        //console.log('text=', execType,length, text);

        this.talk(text);

        this.lastType = execType;
        this.lastIndex = index;
    }
    clearTimer() {
        // 発行中のタイマーを停止する
        if (this.messageTimerID) {
            clearTimeout(this.messageTimerID);
            this.messageTimerID = null;
        }
    }
    resetTimer() {
        this.clearTimer();
        this.messageTimerID = setTimeout(() => {
            // 一定時間sleep後、再度メッセージ表示
            this.talk();
            this.messageTimerID = setTimeout(() => {
                this.randomMessage();
            }, INTERVAL_MASCOT_SLEEP);
        }, INTERVAL_MASCOT_MESSAGE);
    }
}