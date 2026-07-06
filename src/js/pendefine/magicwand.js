// @description ペン定義：親クラス＞マジックワンド（色域選択）

import { PenObj } from './_penobj.js';
import { inRange } from '../etc.js';
import { floodFillMask } from '../selectionutil.js';

// マジックワンド：クリック位置に近い色の連続領域を選択範囲にする。
// レイヤーのimageデータは一切変更しない（バケツ塗りの範囲制約・可視化のみに使う）
export class MagicWand extends PenObj {
    constructor(option) {
        super();
        this.axpObj = option.axpObj;
        this.CANVAS = option.CANVAS;
        // 値（PenObjからの差分）
        this.name = this.axpObj._('@PENNAME.MAGICWAND');
        this.type = 'magicwand';
        this.colorTolerance = 10;
        // 制御（レイヤーへの書き込みを行わないため、書き込み禁止の影響を受けない）
        this.usePenPreview = false;
        this.usePenLock = false;
        this.usesSelectionMode = true; // 選択の合成方法セレクトボックスを表示する
        this.canUndo = false;

        this.init_save();
    }
    init_brush() {
        // レイヤーへの描画を行わないため何もしない
    }
    // 描画開始
    start() {
        this.set_modeflag();
    }
    // 描画中
    move() {
        // 何もしない（クリックのみで完結するツール）
    }
    // 描画終了
    end(x, y) {
        if (this.axpObj.isDrawing && !this.axpObj.isDrawCancel) {
            if (inRange(x, 0, this.axpObj.x_size - 1) && inRange(y, 0, this.axpObj.y_size - 1)) {
                const isCurrentLayerOnly =
                    document.getElementById('axp_pen_select_fillMode').value === 'option_layer';
                const img = isCurrentLayerOnly
                    ? this.axpObj.layerSystem.getImage()
                    : this.axpObj.layerSystem.getCanvasImage();
                const mask = floodFillMask(
                    img,
                    Math.trunc(x),
                    Math.trunc(y),
                    this.colorTolerance,
                    this.axpObj.x_size,
                    this.axpObj.y_size
                );
                this.axpObj.applySelectionMask(mask);
            }
        }
        this.end_common();
    }
}
