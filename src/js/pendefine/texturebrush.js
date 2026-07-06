// @description ペン定義：スタンプ系共通＞テクスチャブラシ（紙目）
//
// ChickenPaint CPBrushManager のダブ座標テクスチャの簡易版。ブラシの塗り色を
// 単色ではなく、ノイズタイルをその色でティントしたパターンにする。
// canvas の createPattern はキャンバス座標系に固定されてタイリングされるため
// （ストローク座標に追従しない）、そのまま「紙にペン先で擦った」ような
// キャンバス固定の紙目テクスチャになる。

import { StampPenBase } from './_stamppen.js';
import { range_index } from './rangeindex.js';
import { hex2rgb } from '../etc.js';

export class TextureBrush extends StampPenBase {
    constructor(option) {
        super(option);
        this.name = this.axpObj._('@PENNAME.TEXTUREBRUSH');
        this.size = 16;
        this.index = range_index(this.size);
        this.usePressure = true;
        this.usePressureControl = true;
        this.useSubPxAlpha = false;
        this.flickTaper = null;
        // テクスチャタイルのサイズ・濃淡の振れ幅
        this.textureTileSize = 32;
        this.textureMinAlpha = 0.5;

        this._textureCacheKey = null;
        this._textureCachePattern = null;

        this.init_save();
    }
    init_brush(option) {
        super.init_brush(option);
        const color = this.getColor();
        // 同じ色の間は毎フレーム再生成せずキャッシュを使う（ノイズタイル生成コストの節約）
        if (this._textureCacheKey !== color) {
            this._textureCachePattern = this._buildTexturePattern(color);
            this._textureCacheKey = color;
        }
        this.CANVAS.brush_ctx.fillStyle = this._textureCachePattern;
        this.CANVAS.brush_ctx.strokeStyle = this._textureCachePattern;
    }
    _buildTexturePattern(color) {
        const tile = document.createElement('canvas');
        tile.width = this.textureTileSize;
        tile.height = this.textureTileSize;
        const tctx = tile.getContext('2d');
        const [r, g, b] = hex2rgb(color);
        const imgData = tctx.createImageData(this.textureTileSize, this.textureTileSize);
        const range = 1 - this.textureMinAlpha;
        for (let i = 0; i < imgData.data.length; i += 4) {
            const noise = this.textureMinAlpha + Math.random() * range;
            imgData.data[i] = r;
            imgData.data[i + 1] = g;
            imgData.data[i + 2] = b;
            imgData.data[i + 3] = Math.round(255 * noise);
        }
        tctx.putImageData(imgData, 0, 0);
        return this.CANVAS.brush_ctx.createPattern(tile, 'repeat');
    }
}
