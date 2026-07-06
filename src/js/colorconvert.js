// @description 色空間変換ユーティリティ（RGB⇔CMYK・RGB⇔Lab、多モデル数値ピッカー用）
//
// ICCプロファイルは使用しない単純な数式変換（デバイスCMYK・sRGB/D65基準のLab）。
// 印刷用途の正確な色分解ではなく、あくまで「別の数値モデルでの直感的な色指定」を
// 提供する目的のため、業界標準の簡易式（CSS Color 4 相当）を用いる。

// RGB(0-255) → CMYK(0-100の百分率)
export function rgb2cmyk([r, g, b]) {
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const k = 1 - Math.max(rf, gf, bf);
    if (k >= 1) {
        return [0, 0, 0, 100];
    }
    const c = (1 - rf - k) / (1 - k);
    const m = (1 - gf - k) / (1 - k);
    const y = (1 - bf - k) / (1 - k);
    return [c, m, y, k].map((v) => Math.round(v * 100));
}

// CMYK(0-100の百分率) → RGB(0-255)
export function cmyk2rgb([c, m, y, k]) {
    const cf = c / 100, mf = m / 100, yf = y / 100, kf = k / 100;
    const r = 255 * (1 - cf) * (1 - kf);
    const g = 255 * (1 - mf) * (1 - kf);
    const b = 255 * (1 - yf) * (1 - kf);
    return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))));
}

// sRGB(0-255) → CIE Lab（D65基準）
export function rgb2lab([r, g, b]) {
    const toLinear = (c) => (c <= 0.04045) ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const rl = toLinear(r / 255);
    const gl = toLinear(g / 255);
    const bl = toLinear(b / 255);

    // 線形RGB → XYZ（D65、sRGB標準変換行列）
    let x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
    let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
    let z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

    // D65白色点で正規化
    x /= 0.95047;
    y /= 1.0;
    z /= 1.08883;

    const f = (t) => (t > 0.008856) ? Math.cbrt(t) : (7.787 * t + 16 / 116);
    const fx = f(x), fy = f(y), fz = f(z);

    const L = (116 * fy) - 16;
    const a = 500 * (fx - fy);
    const bLab = 200 * (fy - fz);
    return [L, a, bLab];
}

// CIE Lab（D65基準） → sRGB(0-255)
export function lab2rgb([L, a, bLab]) {
    const fy = (L + 16) / 116;
    const fx = fy + a / 500;
    const fz = fy - bLab / 200;

    const finv = (t) => (t ** 3 > 0.008856) ? t ** 3 : (t - 16 / 116) / 7.787;
    const x = finv(fx) * 0.95047;
    const y = finv(fy) * 1.0;
    const z = finv(fz) * 1.08883;

    // XYZ → 線形RGB（D65、sRGB標準逆変換行列）
    let rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
    let gl = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
    let bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

    const toGamma = (c) => (c <= 0.0031308) ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    rl = toGamma(rl);
    gl = toGamma(gl);
    bl = toGamma(bl);

    const clamp = (c) => Math.max(0, Math.min(255, Math.round(c * 255)));
    return [clamp(rl), clamp(gl), clamp(bl)];
}
