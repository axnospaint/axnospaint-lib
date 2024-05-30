// @description キーボード入力処理

export class KeyboardSystem {
    axpObj;
    constructor(axpObj) {
        this.axpObj = axpObj;
    }
    // 初期化
    init() {
    }
    startEvent() {
        // ウィンドウ非アクティブの時、強制的に押しているキーを解除
        window.addEventListener('blur', (e) => {
            if (this.axpObj.isSPACE) {
                this.axpObj.penSystem.restorePenModeTemporary('axp_penmode_hand');
                this.axpObj.isSPACE = false;
            }
            if (this.axpObj.isCTRL) {
                this.axpObj.penSystem.restorePenModeTemporary('axp_penmode_spuit');
                this.axpObj.isCTRL = false;
            }
            if (this.axpObj.isSHIFT) {
                this.axpObj.isSHIFT = false;
            }
            if (this.axpObj.codeCHANGE_SIZE_KEY) {
                this.axpObj.codeCHANGE_SIZE_KEY = null;
            }
        });

        // キーが離された時
        window.addEventListener('keyup', (e) => {
            // e.keyが有効の場合のみ処理する（オートコンプリートによるイベントを無視）
            if (!e.key) return;

            let inkey = e.key.toUpperCase();
            switch (inkey) {
                case ' ':
                    this.axpObj.penSystem.restorePenModeTemporary('axp_penmode_hand');
                    this.axpObj.isSPACE = false;
                    break;
                case 'CONTROL':
                    this.axpObj.penSystem.restorePenModeTemporary('axp_penmode_spuit');
                    this.axpObj.isCTRL = false;
                    break;
                case 'SHIFT':
                    this.axpObj.isSHIFT = false;
                    break;
            }
            // ショートカット「ペンの太さ調整」で押された物理キー
            if (e.code === this.axpObj.codeCHANGE_SIZE_KEY) {
                this.axpObj.penSystem.modeChangeSizeOff();
            }
        });
        // キーが押された時（キーボードショートカット）
        window.addEventListener('keydown', (e) => {

            // 非表示時は無効
            if (this.axpObj.isClose) { return };

            // キャンバスタブ以外の画面（設定、投稿）は無効
            if (!this.axpObj.isCanvasOpen) { return; }

            // モーダルウィンドウ表示中（セーブロード、レイヤー名変更入力時）は無効
            if (this.axpObj.isModalOpen) { return; }

            // キー入力可能な要素にフォーカス中の場合は無効
            if (document.activeElement.type === 'number' || document.activeElement.type === 'text') {
                return;
            }

            // OS本来の操作を抑止
            e.preventDefault();

            let inkey = e.key.toUpperCase(); // 入力されたキーを大文字に変換
            // 描画中は無効
            if (this.axpObj.isDrawing) {
                if (inkey === 'SHIFT') {
                    // SHIFTキーで描画途中からでも直線描画モードに移行
                    this.axpObj.isLine = true;
                }
                return;
            }

            if (e.repeat) {
                if (
                    inkey === ' ' ||
                    inkey === 'CONTROL' ||
                    inkey === 'ALT' ||
                    inkey === 'SHIFT'
                ) {
                    // 上記のキーは、押しっぱなし入力を無効とする
                    return;
                } else {
                    // その他のキーは、呼び出す機能に応じて、後続の処理で判定を行う
                }
            }

            let keyId = inkey;
            // 記号を文字に変換
            switch (keyId) {
                case '*':
                    keyId = 'ASTERISK';
                    break;
                case '+':
                    keyId = 'PLUS';
                    break;
                case ',':
                    keyId = 'COMMA';
                    break;
                case '-':
                    keyId = 'MINUS';
                    break;
                case '.':
                    keyId = 'DOT';
                    break;
                case '/':
                    keyId = 'SLASH';
                    break;
                case ':':
                    keyId = 'COLON';
                    break;
                case ';':
                    keyId = 'SEMICOLON';
                    break;
            }
            console.log('keyboard:', e.code, e.key, '->', inkey, keyId);
            // e.code : 物理キーコード
            // e.key : 入力されたキーコード
            // keyId : 要素ID用
            // inkey : 画面表示用キー
            switch (inkey) {
                case ' ':
                    this.axpObj.isSPACE = true;
                    this.axpObj.penSystem.changePenModeTemporary('axp_penmode_hand');
                    break;
                case 'CONTROL':
                    this.axpObj.isCTRL = true;
                    this.axpObj.penSystem.changePenModeTemporary('axp_penmode_spuit');
                    break;
                case 'ALT':
                    break;
                case 'SHIFT':
                    this.axpObj.isSHIFT = true;
                    break;
                default:
                    this.axpObj.callTask(`axp_config_custom_key${keyId}`, inkey, e.repeat, e.code);
                    break;
            }
        });
    }
}
