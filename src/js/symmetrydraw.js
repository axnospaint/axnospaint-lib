// @description 対称・回転描画（曼荼羅/雪結晶）
// libmypaint(ISC)の対称描画のアイデア（アフィン変換による複数ダブ同時描画）を踏襲。
// ストローク確定後、変化した画素（差分）だけを中心点基準で反転・回転コピーする
// （ライブプレビュー中は通常のストロークのみ描画され、コピーはストローク確定時にのみ現れる。
// 既存のDirtyRect部分再合成パイプラインには一切手を入れず、stroke-end後の後処理として実装）。
//
// 実装方式について: 当初はcanvasのdrawImage（source-over合成）でコピーしていたが、
// 消しゴム（アルファを下げるストローク）や半透明ブラシでは「合成」では正しく複製できない
// （アルファを下げた差分をsource-overで重ねても下地は消えない）。そのため、変化した画素の
// 「値」そのものを対称位置へ直接上書きコピーする（合成ではなく代入）方式に変更した。
// これにより消しゴム・半透明ストロークとも、元のストロークと同じ結果が対称位置に複製される。

export function defaultSymmetryConfig() {
    return {
        enabled: false,
        // 'mirrorH'（左右）/ 'mirrorV'（上下）/ 'mirrorBoth'（上下左右）/ 'radial'（放射状）
        mode: 'radial',
        // radialモード時の分割数（2〜16）
        radialCount: 6,
    };
}

// 対称モードに応じた変換関数群（各関数は(x,y)→[x',y']の座標変換）を返す
function buildTransforms(config, centerX, centerY) {
    const transforms = [];
    if (config.mode === 'mirrorH' || config.mode === 'mirrorBoth') {
        transforms.push((x, y) => [2 * centerX - x, y]);
    }
    if (config.mode === 'mirrorV' || config.mode === 'mirrorBoth') {
        transforms.push((x, y) => [x, 2 * centerY - y]);
    }
    if (config.mode === 'mirrorBoth') {
        // 上下左右反転（180度回転相当）。4分割の対称にするため、H単独・V単独に加えて必要
        transforms.push((x, y) => [2 * centerX - x, 2 * centerY - y]);
    }
    if (config.mode === 'radial') {
        const n = Math.max(2, Math.min(16, Math.round(config.radialCount)));
        for (let k = 1; k < n; k++) {
            const angle = (2 * Math.PI * k) / n;
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            transforms.push((x, y) => {
                const dx = x - centerX, dy = y - centerY;
                return [centerX + dx * cosA - dy * sinA, centerY + dx * sinA + dy * cosA];
            });
        }
    }
    return transforms;
}

// beforeとafter（対称描画OFF時と同じ、通常どおり描かれたストローク結果）から、
// 対称コピーを合成した最終ImageDataを返す。config.enabled=falseならafterをそのまま返す。
// 変化した画素の値をそのまま対称位置へ上書きコピーする（アルファ合成ではなく直接代入のため、
// 消しゴム・半透明ストロークも正しく複製される）。回転を伴う放射状モードは最近傍座標への
// 代入のため、対称コピー部分に若干のジャギーが生じ得る（v1の既知の制限）。
export function applySymmetryToStroke(before, after, config, width, height, centerX, centerY) {
    if (!config?.enabled) return after;
    const transforms = buildTransforms(config, centerX, centerY);
    if (transforms.length === 0) return after;

    const b = before.data, a = after.data;
    const out = new ImageData(width, height);
    out.data.set(a);
    const dst = out.data;

    for (let y = 0; y < height; y++) {
        const rowBase = y * width;
        for (let x = 0; x < width; x++) {
            const i = (rowBase + x) * 4;
            if (b[i] === a[i] && b[i + 1] === a[i + 1] && b[i + 2] === a[i + 2] && b[i + 3] === a[i + 3]) {
                continue; // このストロークで変化していない画素はコピー元にしない
            }
            for (const transform of transforms) {
                const [tx, ty] = transform(x, y);
                const rx = Math.round(tx);
                const ry = Math.round(ty);
                if (rx < 0 || rx >= width || ry < 0 || ry >= height) continue;
                const j = (ry * width + rx) * 4;
                dst[j] = a[i]; dst[j + 1] = a[i + 1]; dst[j + 2] = a[i + 2]; dst[j + 3] = a[i + 3];
            }
        }
    }

    return out;
}
