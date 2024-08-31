// @description ユーティリティ（独立した関数ライブラリ）

/**
 * AXNOS Paint用ユーティリティ（staticメソッド）
 */
export class UTIL {
    /**
     * 要素の非表示
     * @param {*} element 非表示にする要素のobjectまたはid(string)
     */
    static hide(element) {
        let target;
        if (typeof element === 'string') {
            // IDが指定された時
            target = document.getElementById(element);
        } else {
            // 要素が指定された時
            target = element;
        }
        target.classList.add('axpc_NONE');
    }
    /**
     * 要素の表示
     * @param {*} element 表示する要素のobjectまたはid(string)
     */
    static show(element) {
        let target;
        if (typeof element === 'string') {
            // IDが指定された時
            target = document.getElementById(element);
        } else {
            // 要素が指定された時
            target = element;
        }
        target.classList.remove('axpc_NONE');
    }
}
/**
 * ブラウザ種別取得
 * @returns 
 */
export function getBrowserType() {
    const agent = window.navigator.userAgent.toLowerCase();
    let type;

    if (agent.indexOf("msie") != -1 || agent.indexOf("trident") != -1) {
        type = "IE";
    } else if (agent.indexOf("edg") != -1 || agent.indexOf("edge") != -1) {
        type = "Edge";
    } else if (agent.indexOf("opr") != -1 || agent.indexOf("opera") != -1) {
        type = "Opera";
    } else if (agent.indexOf("chrome") != -1) {
        type = "Chrome";
    } else if (agent.indexOf("safari") != -1) {
        type = "Safari";
    } else if (agent.indexOf("firefox") != -1) {
        type = "FireFox";
    } else {
        type = "unknown";
    }
    return type;
}

// ファイルパスからファイル名部分だけ切り抜いて返却する
export function getFileNameFromURL(input) {
    const baseUrl = window.location.href; // 現在のページのURL
    const absoluteUrl = new URL(input, baseUrl).href;
    // ファイル名抽出（例として、最後のスラッシュ以降の部分を取得）
    const fileName = absoluteUrl.split('/').pop();
    //console.log(input, fileName);
    return fileName;
}

/**
 * ２点間の距離
 * @param {*} x1 
 * @param {*} y1 
 * @param {*} x2 
 * @param {*} y2 
 * @returns 
 */
export function calcDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}
/**
 * ２点の中点
 * @param {*} p1 
 * @param {*} p2 
 * @returns 
 */
export function calcMidPointBetween(p1, p2) {
    return {
        x: (p2.x + p1.x) / 2,
        y: (p2.y + p1.y) / 2
    };
}

// 共通処理：HEXをRGBに変換
export function hex2rgb(hex) {
    // #つきのカラーコードの場合は#を取り除く
    if (hex.slice(0, 1) == "#") hex = hex.slice(1);
    if (hex.length == 3) hex = hex.slice(0, 1) + hex.slice(0, 1) + hex.slice(1, 2) + hex.slice(1, 2) + hex.slice(2, 3) + hex.slice(2, 3);

    return [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map(function (str) {
        return parseInt(str, 16);
    });
}

// 共通処理：RGBをHEXに変換
export function rgb2hex(rgb) {
    let hex = rgb.map(function (value) {
        return ("0" + value.toString(16)).slice(-2);
    }).join("");
    // 大文字で返却
    return hex.toUpperCase();
}

// 左右反転用関数
// ImageData:canvasのgetImageDataで取得したデータ
export function flip_horizontal(ImageData) {
    var idx_base;
    var idx_swap;
    for (var y = 0; y < ImageData.height; y++) {
        for (var x = 0; x < ImageData.width / 2; x++) {
            idx_base = (y * ImageData.width + x) * 4;
            idx_swap = (y * ImageData.width + ImageData.width - x - 1) * 4;
            var tmp0 = ImageData.data[idx_base + 0];
            var tmp1 = ImageData.data[idx_base + 1];
            var tmp2 = ImageData.data[idx_base + 2];
            var tmp3 = ImageData.data[idx_base + 3];
            ImageData.data[idx_base + 0] = ImageData.data[idx_swap + 0];
            ImageData.data[idx_base + 1] = ImageData.data[idx_swap + 1];
            ImageData.data[idx_base + 2] = ImageData.data[idx_swap + 2];
            ImageData.data[idx_base + 3] = ImageData.data[idx_swap + 3];
            ImageData.data[idx_swap + 0] = tmp0;
            ImageData.data[idx_swap + 1] = tmp1;
            ImageData.data[idx_swap + 2] = tmp2;
            ImageData.data[idx_swap + 3] = tmp3;
        }
    }
}

// 上下反転用関数
// ImageData:canvasのgetImageDataで取得したデータ
export function flip_vertical(ImageData) {
    var idx_base;
    var idx_swap;
    for (var y = 0; y < ImageData.height / 2; y++) {
        for (var x = 0; x < ImageData.width; x++) {
            idx_base = (y * ImageData.width + x) * 4;
            idx_swap = ((ImageData.height - y - 1) * ImageData.width + x) * 4;
            var tmp0 = ImageData.data[idx_base + 0];
            var tmp1 = ImageData.data[idx_base + 1];
            var tmp2 = ImageData.data[idx_base + 2];
            var tmp3 = ImageData.data[idx_base + 3];
            ImageData.data[idx_base + 0] = ImageData.data[idx_swap + 0];
            ImageData.data[idx_base + 1] = ImageData.data[idx_swap + 1];
            ImageData.data[idx_base + 2] = ImageData.data[idx_swap + 2];
            ImageData.data[idx_base + 3] = ImageData.data[idx_swap + 3];
            ImageData.data[idx_swap + 0] = tmp0;
            ImageData.data[idx_swap + 1] = tmp1;
            ImageData.data[idx_swap + 2] = tmp2;
            ImageData.data[idx_swap + 3] = tmp3;
        }
    }
}

// 数値範囲内チェック-------------------------------------------------------------------------------
export function inRange(x, min, max) {
    return ((x - min) * (x - max) <= 0);
}

export function adjustInRange(x, min, max) {
    let result = x;
    if (x < min) result = min;
    if (x > max) result = max;
    return result;
}

// 日付の表示フォーマット変換----------------------------------------------------------------------------------------
// 使用例：filename = "ap_data" + dispDate(new Date(), 'YYYYMMDD_hhmmss') + ".axp"
export function dispDate(date, format) {
    format = format.replace(/YYYY/, date.getFullYear());
    format = format.replace(/MM/, ("0" + (date.getMonth() + 1)).slice(-2));
    format = format.replace(/DD/, ("0" + date.getDate()).slice(-2));
    format = format.replace(/hh/, ("0" + date.getHours()).slice(-2));
    format = format.replace(/mm/, ("0" + date.getMinutes()).slice(-2));
    format = format.replace(/ss/, ("0" + date.getSeconds()).slice(-2));
    return format;
}

// カラーコード妥当性チェック----------------------------------------------------------------------------------------
// 引数colorに格納されている６桁or３桁が正常なカラーコードであればtrue、異常であればfalseを返却する
export function isColor(color) {
    if (color.slice(0, 1) == "#") color = color.slice(1);
    return color.match(/^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/) !== null;
}

// カラー数値妥当性チェック
export function adjustColorValue(value) {
    var result = value;
    if (isNaN(result)) { result = 0 }; // 数字でなければ0に変換
    result = Math.min(255, result); // 255を超えていたら255に変換
    result = Math.max(0, result); // 0より小さければ0に変換
    return result;
}

// 画像の読み込み（タイムアウト指定あり）
export function loadImageWithTimeout(url, timeout) {
    return new Promise((resolve, reject) => {
        let image = new Image();

        let timer = setTimeout(() => {
            image.src = ''; // 画像の読み込みを中止
            reject(new Error('タイムアウトしました'));
        }, timeout);

        image.onload = () => {
            clearTimeout(timer);
            resolve(image);
        };

        image.onerror = () => {
            clearTimeout(timer);
            reject(new Error('画像の読み込みエラー'));
        };

        image.src = url;
    });
}

// イメージ比較（描画によってイメージが更新されたかどうかを判別する）
export function compareImages(img1, img2) {
    if (img1.data.length != img2.data.length)
        return false;
    for (var i = 0; i < img1.data.length; ++i) {
        if (img1.data[i] != img2.data[i])
            return false;
    }
    return true;
}

// イメージ描画範囲を取得
export function getRectSize(img) {
    let x0 = img.width;
    let y0 = img.height;
    let x1 = 0;
    let y1 = 0;
    // 描画情報あり（アルファチャンネルが１以上）なら矩形範囲更新
    for (var y = 0; y < img.height; y++) {
        for (var x = 0; x < img.width; x++) {
            let idx = (x + y * img.height) * 4;
            if (img.data[idx + 3] !== 0) {
                x0 = Math.min(x, x0);
                y0 = Math.min(y, y0);
                x1 = Math.max(x, x1);
                y1 = Math.max(y, y1);
            }
        }
    }
    /*
        if (x1 - x0 >= 0) {
            console.log('rect', x0, y0, x1, y1);
        } else {
            console.log('データなし');
        }
    */
    return {
        x0: x0,
        y0: y0,
        x1: x1,
        y1: y1
    }
}

// イメージが空白であるかの判定
export function isBlankImage(img) {
    let x0 = img.width;
    let y0 = img.height;
    let x1 = 0;
    let y1 = 0;
    // 描画情報あり（アルファチャンネルが１以上）なら矩形範囲更新
    for (var y = 0; y < img.height; y++) {
        for (var x = 0; x < img.width; x++) {
            let idx = (x + y * img.height) * 4;
            if (img.data[idx + 3] !== 0) {
                // 空白ではない
                return false;
            }
        }
    }
    // 空白
    return true;
}

export function createTonePattern(toneLevel, color) {
    let colorRGB = hex2rgb(color);
    let patternCanvas = document.createElement('canvas'),
        ctx = patternCanvas.getContext('2d');
    patternCanvas.width = 4;
    patternCanvas.height = 4;
    // トーンパターン配列（ベイヤーマトリクス）
    const arrayTonePatternTable = [0, 10, 2, 8, 5, 15, 7, 13, 1, 11, 3, 9, 4, 14, 6, 12];
    // スクリーントーン生成
    let img = new ImageData(4, 4);

    // トーンレベルで指定された濃さになるまで、順番に既定の位置にドットを打つ
    let maxLevel = toneLevel;
    for (let idx = 0; idx < maxLevel; idx++) {
        let i = arrayTonePatternTable[idx] * 4;
        img.data[i + 0] = colorRGB[0];
        img.data[i + 1] = colorRGB[1];
        img.data[i + 2] = colorRGB[2];
        img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    return ctx.createPattern(patternCanvas, 'repeat');

}

