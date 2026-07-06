// @description 非破壊レイヤースタイル（フチ取り・ドロップシャドウ/光彩）
// レイヤーのピクセルデータ(item.image)は一切変更しない。合成（draw）のたびに元データへ
// 一時的に効果を重ねた結果を返す純粋関数群。DirtyRect部分再合成には未対応のため、
// 有効なスタイルを持つレイヤーが存在する間はwindow_layer.jsが通常の全面再合成にフォールバックする。

// 既定のレイヤースタイル（両効果とも無効）
export function defaultLayerStyle() {
    return {
        stroke: { enabled: false, radius: 4, color: '#000000' },
        dropShadow: { enabled: false, offsetX: 6, offsetY: 6, blur: 6, color: '#000000', opacity: 60 },
    };
}

// いずれかの効果が有効か（fast path可否判定・描画スキップ判定に使用）
export function hasActiveLayerStyle(style) {
    return !!style && !!(style.stroke?.enabled || style.dropShadow?.enabled);
}

// レイヤーの元画像を指定色でシルエット化したcanvasを返す（アルファ形状はそのまま、RGBのみ置換）
function silhouette(srcCanvas, width, height, color) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    ctx.drawImage(srcCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return c;
}

// シルエットを同心円状（半径1px刻み）×円周N点へオフセット描画することで膨張（dilate）を近似する。
// 円周上のみのサンプルだと、細い線や小さいドットのような疎なシルエットでは元の形と外側の
// 間に隙間ができる。ぼかし(blur)+二値化も試したが、小さいシルエットに大きい半径を掛けると
// ぼかしでアルファが薄まりすぎて閾値を超えず何も残らない逆の問題があった。
// drawImageによる複製は常にフル強度（減衰しない）ため、半径方向の間隔を1pxまで細かくすれば、
// シルエットの大きさに関わらず隙間なく埋まる（コスト増と引き換えに正しさを優先する）。
function dilateSilhouette(silhouetteCanvas, width, height, radius) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    const ringCount = Math.max(1, radius); // 半径1pxごとに1リング
    for (let ring = 0; ring <= ringCount; ring++) {
        const r = (radius * ring) / ringCount;
        if (r === 0) {
            ctx.drawImage(silhouetteCanvas, 0, 0);
            continue;
        }
        // 半径に応じてサンプル数を増やし、大きい半径でも円形に近づける（多角形化を防ぐ）
        const steps = Math.max(8, Math.min(48, Math.round(r * 3)));
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            ctx.drawImage(silhouetteCanvas, Math.round(Math.cos(angle) * r), Math.round(Math.sin(angle) * r));
        }
    }
    return c;
}

// レイヤーのImageDataへ非破壊スタイルを適用したImageDataを返す（引数のimageDataは変更しない）
export function applyLayerStyle(imageData, style, width, height) {
    if (!hasActiveLayerStyle(style)) return imageData;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width; srcCanvas.height = height;
    srcCanvas.getContext('2d').putImageData(imageData, 0, 0);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = width; outCanvas.height = height;
    const outCtx = outCanvas.getContext('2d');

    // 1. ドロップシャドウ/光彩（最背面）
    if (style.dropShadow?.enabled) {
        const s = style.dropShadow;
        const sil = silhouette(srcCanvas, width, height, s.color);
        outCtx.save();
        outCtx.globalAlpha = Math.max(0, Math.min(100, s.opacity)) / 100;
        if (s.blur > 0) {
            outCtx.filter = `blur(${Math.max(0, Math.min(60, s.blur))}px)`;
        }
        outCtx.drawImage(sil, s.offsetX, s.offsetY);
        outCtx.restore();
    }

    // 2. フチ取り（元画像の下・影の上に描画。輪郭の外側にリング状に広げる）
    if (style.stroke?.enabled) {
        const r = Math.max(0, Math.min(60, Math.round(style.stroke.radius)));
        if (r > 0) {
            const sil = silhouette(srcCanvas, width, height, style.stroke.color);
            const dilated = dilateSilhouette(sil, width, height, r);
            outCtx.drawImage(dilated, 0, 0);
        }
    }

    // 3. 元のレイヤー内容を最前面に描画
    outCtx.drawImage(srcCanvas, 0, 0);

    return outCtx.getImageData(0, 0, width, height);
}
