// @description ペンの太さスライダー用変換テーブル

export const range_value = [
    0, 1, 1, 1, 1, 2, 2, 2, 2, 2,
    3, 3, 3, 3, 3, 4, 4, 4, 4, 5,
    5, 5, 5, 6, 6, 6, 6, 7, 7, 7,
    7, 8, 8, 8, 8, 9, 9, 9, 9, 10,
    10, 10, 10, 11, 11, 12, 12, 13, 13, 14,
    14, 15, 15, 16, 16, 17, 17, 18, 18, 19,
    19, 20, 20, 21, 22, 23, 24, 25, 26, 27,
    28, 29, 30, 31, 32, 33, 34, 35, 40, 45,
    50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
    100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
    200
];
// ペンの太さに対応するインデックスを返却する
export const range_index = function (value) {
    var result = 0;
    for (var idx = 0; idx < range_value.length; idx++) {
        if (range_value[idx] === value) {
            result = idx;
            break;
        }
        if (range_value[idx] > value) {
            break;
        }
        result = idx;
    }
    return result;
};