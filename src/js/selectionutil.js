// @description 選択範囲（マジックワンド・多角形選択）共通ユーティリティ
//
// 選択範囲は Uint8Array（長さ = width*height、各要素0=非選択/255=選択）で表現する。
// なげなわツールの「切り取って移動」モデルとは独立した、別の選択概念として実装している
// （既存の複雑な変形/フローティングクリップ機構には一切手を入れない）。

// 塗りつぶし判定と同じ許容誤差方式（RGBユークリッド距離の2乗）で色域選択マスクを生成する
export function floodFillMask(imageData, x, y, colorTolerance, width, height) {
    const mask = new Uint8Array(width * height);
    if (x < 0 || y < 0 || x >= width || y >= height) return mask;

    const clampedTolerance = Math.max(0, Math.min(100, Number(colorTolerance) || 0));
    const toleranceDistanceSq = (clampedTolerance / 100) ** 2 * 255 * 255 * 3;

    const data = imageData.data;
    const seedIdx = (y * width + x) * 4;
    const seedR = data[seedIdx + 0];
    const seedG = data[seedIdx + 1];
    const seedB = data[seedIdx + 2];
    const isAlphaSeed = data[seedIdx + 3] === 0;

    const matches = (px, py) => {
        const idx = (py * width + px) * 4;
        const alpha = data[idx + 3];
        if (isAlphaSeed) {
            return alpha === 0;
        }
        if (alpha === 0) return false;
        const dr = data[idx + 0] - seedR;
        const dg = data[idx + 1] - seedG;
        const db = data[idx + 2] - seedB;
        return (dr * dr + dg * dg + db * db) <= toleranceDistanceSq;
    };

    if (!matches(x, y)) return mask;

    const visited = new Uint8Array(width * height);
    const startIdx = y * width + x;
    visited[startIdx] = 1;
    mask[startIdx] = 255;
    const queue = [startIdx];

    let head = 0;
    while (head < queue.length) {
        const p = queue[head++];
        const px = p % width;
        const py = (p - px) / width;
        if (py > 0 && !visited[p - width]) {
            const nIdx = p - width;
            visited[nIdx] = 1;
            if (matches(px, py - 1)) {
                mask[nIdx] = 255;
                queue.push(nIdx);
            }
        }
        if (px < width - 1 && !visited[p + 1]) {
            const nIdx = p + 1;
            visited[nIdx] = 1;
            if (matches(px + 1, py)) {
                mask[nIdx] = 255;
                queue.push(nIdx);
            }
        }
        if (py < height - 1 && !visited[p + width]) {
            const nIdx = p + width;
            visited[nIdx] = 1;
            if (matches(px, py + 1)) {
                mask[nIdx] = 255;
                queue.push(nIdx);
            }
        }
        if (px > 0 && !visited[p - 1]) {
            const nIdx = p - 1;
            visited[nIdx] = 1;
            if (matches(px - 1, py)) {
                mask[nIdx] = 255;
                queue.push(nIdx);
            }
        }
    }
    return mask;
}

// クリック頂点列（多角形）から選択マスクを生成する（なげなわと同じevenodd規則でラスタライズ）
export function polygonToMask(points, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill('evenodd');
    const data = ctx.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        mask[i] = data[i * 4 + 3] >= 128 ? 255 : 0;
    }
    return mask;
}

// 既存の選択マスクと新規マスクをブール演算で合成する
export function combineSelectionMask(existing, incoming, mode, width, height) {
    if (mode === 'replace' || !existing) return incoming;
    const size = width * height;
    const out = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        const a = existing[i] !== 0;
        const b = incoming[i] !== 0;
        let sel;
        switch (mode) {
            case 'add': sel = a || b; break;
            case 'subtract': sel = a && !b; break;
            case 'intersect': sel = a && b; break;
            default: sel = b;
        }
        out[i] = sel ? 255 : 0;
    }
    return out;
}

// 選択範囲の可視化用オーバーレイ（内部は薄いティント、境界は濃い実線）を
// 非破壊のオフスクリーンcanvasとして生成する。draw()/drawFast()末尾でmain_ctxへ
// 重ねて描画するだけで、どのレイヤーのimageデータにも書き込まれない
export function buildSelectionOverlayCanvas(mask, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const out = imageData.data;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (!mask[i]) continue;
            const left = x > 0 ? mask[i - 1] : 0;
            const right = x < width - 1 ? mask[i + 1] : 0;
            const up = y > 0 ? mask[i - width] : 0;
            const down = y < height - 1 ? mask[i + width] : 0;
            const isEdge = !left || !right || !up || !down;
            const o = i * 4;
            out[o + 0] = 20;
            out[o + 1] = 140;
            out[o + 2] = 255;
            out[o + 3] = isEdge ? 230 : 55;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

// 選択されている画素数（UI表示用）
export function countSelectedPixels(mask) {
    let count = 0;
    for (let i = 0; i < mask.length; i++) {
        if (mask[i]) count++;
    }
    return count;
}
