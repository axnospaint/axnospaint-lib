// @description ペン定義：親クラス＞丸ペン＞角ペン

import { Round } from './round.js';

// 角ペン
export class Square extends Round {
    constructor(option) {
        super(option);
        // 値（Roundからの差分）
        this.name = '角ペン';
        this.size = 8;
        // 制御
        // 描画
        this.borderRadius = 0;
        this.borderStyle = 'normal';
        this.lineCap = 'square';
        this.lineJoin = 'bevel';

        this.init_save();
    }
}