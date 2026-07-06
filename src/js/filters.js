// @description 画像フィルタ（現在レイヤーに対する一発適用処理）
// ImageDataを受け取り新しいImageDataを返す純粋関数群。適用・アンドゥ登録の呼び出し側は window_filter.js。

// Color to Alpha（指定した基準色=既定は白を、色を保ったまま透明度へ変換する）
// GIMP/Krita と同じアンミックス式: 各チャンネルで基準色との乖離から必要alphaを逆算し、
// 得られたalphaで割り戻して基準色の混色分を除去した元の色を復元する。
export function colorToAlpha(imageData, baseColor = { r: 255, g: 255, b: 255 }) {
    const src = imageData.data;
    const out = new ImageData(imageData.width, imageData.height);
    const dst = out.data;
    const { r: br, g: bg, b: bb } = baseColor;

    const channelAlpha = (c, b) => {
        if (c > b) return (c - b) / (255 - b);
        if (c < b) return (b - c) / b;
        return 0;
    };

    for (let i = 0; i < src.length; i += 4) {
        const r = src[i], g = src[i + 1], b = src[i + 2], a0 = src[i + 3];
        if (a0 === 0) {
            // 元々透明な画素はそのまま
            dst[i] = r; dst[i + 1] = g; dst[i + 2] = b; dst[i + 3] = 0;
            continue;
        }
        const aR = channelAlpha(r, br);
        const aG = channelAlpha(g, bg);
        const aB = channelAlpha(b, bb);
        const alpha = Math.max(aR, aG, aB);
        const newAlpha = Math.round(alpha * a0);
        let nr, ng, nb;
        if (alpha > 0) {
            nr = Math.round((r - br) / alpha + br);
            ng = Math.round((g - bg) / alpha + bg);
            nb = Math.round((b - bb) / alpha + bb);
        } else {
            nr = br; ng = bg; nb = bb;
        }
        dst[i] = Math.max(0, Math.min(255, nr));
        dst[i + 1] = Math.max(0, Math.min(255, ng));
        dst[i + 2] = Math.max(0, Math.min(255, nb));
        dst[i + 3] = Math.max(0, Math.min(255, newAlpha));
    }
    return out;
}

// モザイク（ブロック平均化）。blockSizeはピクセル単位（例:10なら10x10ブロック単位で平均色に均す）。
export function mosaic(imageData, blockSize) {
    const { width, height, data: src } = imageData;
    const out = new ImageData(width, height);
    const dst = out.data;
    const bs = Math.max(1, Math.round(blockSize));

    for (let by = 0; by < height; by += bs) {
        const bh = Math.min(bs, height - by);
        for (let bx = 0; bx < width; bx += bs) {
            const bw = Math.min(bs, width - bx);
            // RGBはアルファ加重平均にする。透明/半透明ピクセルの生RGB値（見えていない色）が
            // そのまま単純平均に混ざると、不透明部分との境界ブロックで色が滲む/暗くなるため。
            let sr = 0, sg = 0, sb = 0, sa = 0;
            const count = bw * bh;
            for (let y = by; y < by + bh; y++) {
                for (let x = bx; x < bx + bw; x++) {
                    const idx = (y * width + x) * 4;
                    const a = src[idx + 3];
                    sr += src[idx] * a; sg += src[idx + 1] * a; sb += src[idx + 2] * a; sa += a;
                }
            }
            if (sa === 0) {
                // ブロック全体が完全透明な場合、見た目に影響しないRGB成分を書き換えると
                // compareImages()のバイト単位比較で「変化あり」と誤判定され、視覚的に
                // 無意味なアンドゥ登録・自動保存が発生する。元データをそのまま維持する。
                for (let y = by; y < by + bh; y++) {
                    for (let x = bx; x < bx + bw; x++) {
                        const idx = (y * width + x) * 4;
                        dst[idx] = src[idx]; dst[idx + 1] = src[idx + 1]; dst[idx + 2] = src[idx + 2]; dst[idx + 3] = src[idx + 3];
                    }
                }
                continue;
            }
            const ar = Math.round(sr / sa);
            const ag = Math.round(sg / sa);
            const ab = Math.round(sb / sa);
            const aa = Math.round(sa / count);
            for (let y = by; y < by + bh; y++) {
                for (let x = bx; x < bx + bw; x++) {
                    const idx = (y * width + x) * 4;
                    dst[idx] = ar; dst[idx + 1] = ag; dst[idx + 2] = ab; dst[idx + 3] = aa;
                }
            }
        }
    }
    return out;
}

// 全ピクセルをLUT（0-255→0-255の256要素配列）に通す共通処理。
// アルファは変更しない。完全透明画素はRGBも変更しない
// （compareImages()のバイト比較による無意味なundo登録を防ぐ既存の方針を踏襲）。
function applyLUT(imageData, lut) {
    const src = imageData.data;
    const out = new ImageData(imageData.width, imageData.height);
    const dst = out.data;
    for (let i = 0; i < src.length; i += 4) {
        const a = src[i + 3];
        if (a === 0) {
            dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = 0;
            continue;
        }
        dst[i] = lut[src[i]];
        dst[i + 1] = lut[src[i + 1]];
        dst[i + 2] = lut[src[i + 2]];
        dst[i + 3] = a;
    }
    return out;
}

// レベル補正: 入力の黒点/白点/ガンマを指定し、0-255の出力へ再マッピングする
// （Krita KisLevelsCurve相当の簡易版。出力側の黒点/白点は将来拡張の余地として省略）
export function levels(imageData, { inBlack = 0, inWhite = 255, gamma = 1 } = {}) {
    const black = Math.max(0, Math.min(254, Math.round(inBlack)));
    const white = Math.max(black + 1, Math.min(255, Math.round(inWhite)));
    const g = Math.max(0.1, Math.min(10, gamma));
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
        const normalized = Math.max(0, Math.min(1, (v - black) / (white - black)));
        lut[v] = Math.round(Math.pow(normalized, 1 / g) * 255);
    }
    return applyLUT(imageData, lut);
}

// トーンカーブ（簡易5点式）: x=0,64,128,192,255の5アンカーにyを指定し、
// Catmull-Romスプラインで滑らかに補間したLUTを適用する。全チャンネル共通の1本のみ対応
// （R/G/B個別カーブ・自由な制御点追加は将来拡張）。
export function toneCurve(imageData, points = [0, 64, 128, 192, 255]) {
    const xs = [0, 64, 128, 192, 255];
    const ys = points.map((v) => Math.max(0, Math.min(255, v)));
    const lut = new Uint8ClampedArray(256);
    // Catmull-Romの前後仮想点は線形外挿で求める（単純に複製すると、未編集の
    // 既定値（恒等変換のはず）でも境界区間の接線が乱れ、最大5階調ずれてしまう）
    const p = [
        2 * ys[0] - ys[1], ys[0], ys[1], ys[2], ys[3], ys[4],
        2 * ys[4] - ys[3],
    ];
    for (let v = 0; v < 256; v++) {
        // vが属する区間(seg)とその中での位置(t: 0-1)を求める
        let seg = 0;
        while (seg < xs.length - 2 && v > xs[seg + 1]) seg++;
        const segStart = xs[seg];
        const segEnd = xs[seg + 1];
        const t = segEnd === segStart ? 0 : (v - segStart) / (segEnd - segStart);
        const p0 = p[seg], p1 = p[seg + 1], p2 = p[seg + 2], p3 = p[seg + 3];
        const t2 = t * t, t3 = t2 * t;
        const value = 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
        lut[v] = Math.round(value);
    }
    return applyLUT(imageData, lut);
}

// HSV調整（色相回転・彩度・明度）。hueDeltaは度数(-180〜180)、
// saturationDelta/valueDeltaは-100〜100のパーセント増減。
export function hsvAdjust(imageData, { hueDelta = 0, saturationDelta = 0, valueDelta = 0 } = {}) {
    const src = imageData.data;
    const out = new ImageData(imageData.width, imageData.height);
    const dst = out.data;
    for (let i = 0; i < src.length; i += 4) {
        const a = src[i + 3];
        if (a === 0) {
            dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = 0;
            continue;
        }
        const r = src[i] / 255, g = src[i + 1] / 255, b = src[i + 2] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const delta = max - min;
        let h = 0;
        if (delta !== 0) {
            if (max === r) h = ((g - b) / delta) % 6;
            else if (max === g) h = (b - r) / delta + 2;
            else h = (r - g) / delta + 4;
            h *= 60;
            if (h < 0) h += 360;
        }
        let s = max === 0 ? 0 : delta / max;
        let v = max;

        h = (h + hueDelta + 360) % 360;
        s = Math.max(0, Math.min(1, s * (1 + saturationDelta / 100)));
        v = Math.max(0, Math.min(1, v * (1 + valueDelta / 100)));

        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        let nr, ng, nb;
        if (h < 60) { nr = c; ng = x; nb = 0; }
        else if (h < 120) { nr = x; ng = c; nb = 0; }
        else if (h < 180) { nr = 0; ng = c; nb = x; }
        else if (h < 240) { nr = 0; ng = x; nb = c; }
        else if (h < 300) { nr = x; ng = 0; nb = c; }
        else { nr = c; ng = 0; nb = x; }

        dst[i] = Math.round((nr + m) * 255);
        dst[i + 1] = Math.round((ng + m) * 255);
        dst[i + 2] = Math.round((nb + m) * 255);
        dst[i + 3] = a;
    }
    return out;
}

// カラーバランス（シャドウ/ミッドトーン/ハイライトの3階調域ごとにC-R/M-G/Y-Bを補正）。
// 各値は-100〜100。輝度に応じた重み付けで3階調域の補正量を合成する
// （Photoshopのカラーバランスに準拠した近似式）。
export function colorBalance(imageData, {
    shadows = { cr: 0, mg: 0, yb: 0 },
    midtones = { cr: 0, mg: 0, yb: 0 },
    highlights = { cr: 0, mg: 0, yb: 0 },
} = {}) {
    const src = imageData.data;
    const out = new ImageData(imageData.width, imageData.height);
    const dst = out.data;
    for (let i = 0; i < src.length; i += 4) {
        const a = src[i + 3];
        if (a === 0) {
            dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = 0;
            continue;
        }
        const r = src[i], g = src[i + 1], b = src[i + 2];
        const lum = (r + g + b) / 3 / 255;
        // シャドウ/ハイライトの重みは輝度の両端で1・中央で0となる山型、ミッドトーンは残り
        const shadowWeight = Math.max(0, 1 - lum * 2);
        const highlightWeight = Math.max(0, lum * 2 - 1);
        const midtoneWeight = Math.max(0, 1 - shadowWeight - highlightWeight);

        const deltaR = shadows.cr * shadowWeight + midtones.cr * midtoneWeight + highlights.cr * highlightWeight;
        const deltaG = shadows.mg * shadowWeight + midtones.mg * midtoneWeight + highlights.mg * highlightWeight;
        const deltaB = shadows.yb * shadowWeight + midtones.yb * midtoneWeight + highlights.yb * highlightWeight;

        dst[i] = Math.max(0, Math.min(255, Math.round(r + deltaR)));
        dst[i + 1] = Math.max(0, Math.min(255, Math.round(g + deltaG)));
        dst[i + 2] = Math.max(0, Math.min(255, Math.round(b + deltaB)));
        dst[i + 3] = a;
    }
    return out;
}

// グレースケール化（NTSC輝度式）。アルファは変更しない。完全透明画素はRGBも変更しない
// （他フィルタと同じ規約。compareImages()のバイト比較による無意味なundo登録を防ぐ）
export function grayscale(imageData) {
    const src = imageData.data;
    const out = new ImageData(imageData.width, imageData.height);
    const dst = out.data;
    for (let i = 0; i < src.length; i += 4) {
        if (src[i + 3] === 0) {
            dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = 0;
            continue;
        }
        const lum = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
        dst[i] = lum; dst[i + 1] = lum; dst[i + 2] = lum; dst[i + 3] = src[i + 3];
    }
    return out;
}
