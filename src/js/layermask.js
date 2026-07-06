// @description 透明マスク（非破壊消しゴム）
// マスクはレイヤーと同サイズのグレースケール画像（白=フル表示・黒=完全に隠す）。
// レイヤー本体のピクセルデータ(item.image)は一切変更せず、合成のたびに
// レイヤーのアルファへマスクの輝度を乗算した結果を一時的に返す。

// 新規マスクの既定値（全面白＝フル表示。追加しただけでは見た目が変わらない）
export function defaultMaskImage(width, height) {
    const img = new ImageData(width, height);
    img.data.fill(255);
    return img;
}

// マスクが実際に表示へ影響するか（fast path可否判定・描画スキップ判定に使用）
export function hasActiveMask(mask) {
    return !!mask && mask.enabled === true;
}

// レイヤーのImageDataへマスクを適用（アルファへ輝度を乗算）したImageDataを返す
// （引数のimageData/maskImageDataは変更しない）
export function applyLayerMask(imageData, maskImageData) {
    const src = imageData.data;
    const maskData = maskImageData.data;
    const out = new ImageData(imageData.width, imageData.height);
    const dst = out.data;
    for (let i = 0; i < src.length; i += 4) {
        // マスクはグレースケール想定だが、色付きで塗られた場合も考慮しRGB平均を輝度として扱う
        const luminance = (maskData[i] + maskData[i + 1] + maskData[i + 2]) / 3;
        dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2];
        dst[i + 3] = Math.round(src[i + 3] * (luminance / 255));
    }
    return out;
}
