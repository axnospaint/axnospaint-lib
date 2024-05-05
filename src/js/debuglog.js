// @description デバッグ情報表示
import { UTIL } from '../../src/js/etc.js';

const MAX_LINE = 300;
// デバッグログ表示
export class DebugLog {
    elementDiv;
    elementStatus;
    elementLog;
    mode = false;
    lineCount = 0;
    constructor(id, flag) {
        this.elementDiv = document.getElementById(id);
        this.elementStatus = this.elementDiv.querySelector('div:nth-of-type(1)');
        this.elementLog = this.elementDiv.querySelector('div:nth-of-type(2)');
        if (flag) {
            this.mode = true;
            UTIL.show(this.elementDiv);
        }
    }
    status(touch, maxtouch, isDrawing, isDrawn, isDrawCancel) {
        if (!this.mode) return;
        const drawing = (isDrawing) ? 'O' : '-';
        const drawn = (isDrawn) ? 'O' : '-';
        const drawCancel = (isDrawCancel) ? 'O' : '-';
        this.elementStatus.textContent =
            `タッチ数:${touch} max(${maxtouch}) ` +
            `開始:${drawing} 確定:${drawn} 中止:${drawCancel}`;
    }
    log(text) {
        if (!this.mode) return;

        const type = text.substring(0, 7);
        let addStyle = ''
        let addText = '';
        switch (type) {
            case '[DRAW_]':
                addStyle = '<span style="color:#0f0">';
                break;
            case '[MOVE_]':
                addStyle = '<span style="color:#aaa">';
                break;
            case '[EXEC_]':
                addStyle = '<span style="color:#f0f">';
                break;
            case '[TIMER]':
                addStyle = '<span style="color:#ff0">';
                break;
            default:
                addStyle = '<span>';
        }
        addText = addStyle + text + '</span><br>';
        if (this.lineCount >= MAX_LINE) {
            this.elementLog.removeChild(this.elementLog.firstChild);
            this.elementLog.removeChild(this.elementLog.firstChild);
        } else {
            this.lineCount++;
        }
        this.elementLog.insertAdjacentHTML('beforeend', addText);
        this.elementLog.scrollTop = this.elementLog.scrollHeight;

    }
    get isDebugMode() {
        return this.mode;
    }
    set isDebugMode(flag) {
        if (flag) {
            this.mode = true;
            UTIL.show(this.elementDiv);
        } else {
            this.mode = false;
            UTIL.hide(this.elementDiv);
        }
    }
}