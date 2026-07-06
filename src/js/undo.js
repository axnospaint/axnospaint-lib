// @description アンドゥ／リドゥ処理

import { Layerdata } from './window_layer.js';

/*
◆処理概要
キャンバスに対して操作が行われた際に、どのような操作を行ったかを記録するログ情報として「actionObj」（※１）を作成し、setUndo()で受け取り、undoObj[]に登録する。
アンドゥ要求があった場合、undoObj[]から最新の「actionObj」を取りだし、記録されている情報を元に復元を行う。
この時、リドゥ処理に必要な情報を、redoObj[]へ登録する。

リドゥ要求があった場合、redoObj[]から最新の「actionObj」を取りだし、記録されている情報を元にアンドゥの取り消しを行う。
この時、アンドゥ処理に必要な情報（※１で作成したものと同様の内容）を、undoObj[]へ登録する。（元の状態に戻し、再度アンドゥできるようにする。）

undoObj[]は、一定数（アンドゥ可能最大数）の「actionObj」が登録されたら、１件登録するたび、最古の情報を１件消去する。
redoObj[]は、undoObj[]に新しい「actionObj」（リドゥ要求による戻しではない）が登録されるたび、全て消去する。
（その時点までに行ったアンドゥを確定事項として、リドゥ対象から外す）
*/

class UndoObj {
    constructor(obj) {
        this.type = obj.type;
        this.detail = obj.detail;
        // 処理対象のレイヤーID（layerObjの保存が必要ないアンドゥの場合、id情報を保存する）
        this.id = obj.id;
        // 処理対象のレイヤー情報
        this.layerObj = (obj.layerObj) ? new Layerdata(obj.layerObj) : null;
        // レイヤー統合時の統合先レイヤー
        this.layerObj_dest = (obj.layerObj_dest) ? new Layerdata(obj.layerObj_dest) : null;;
        // レイヤースタイル変更の前後値（type:'layer-style'で使用。自己反転しない操作のため
        // flip_h/flip_vと異なり前後両方の値を保持する）
        this.styleBefore = obj.styleBefore;
        this.styleAfter = obj.styleAfter;
        // 透明マスクブラシ編集の前後ImageData（type:'mask-edit'で使用）
        this.maskBefore = obj.maskBefore;
        this.maskAfter = obj.maskAfter;
    }
}

export class UndoSystem {
    axpObj;

    undoObj = [];
    redoObj = [];

    isUndoing = false;
    isRedoing = false;

    constructor(axpObj) {
        this.axpObj = axpObj;

    }
    // 初期化（＆キャンバスリセット時の再初期化）
    init() {
    }
    resetCanvas() {
        this.undoObj.splice(0);
        this.redoObj.splice(0);
    }
    setUndo(actionObj) {
        //console.log('exec:', actionObj.type);
        //console.log('exec:', actionObj.layerObj.image);
        // リドゥ処理での呼び出しではない場合、リドゥ記憶を消す
        if (!this.isRedoing) {
            this.redoObj.splice(0);
        }
        // 記録数が１０を超える場合、最古の記録を消す
        if (this.undoObj.length >= this.axpObj.undo_max) {
            this.undoObj.shift();
        }

        let obj = new UndoObj(actionObj);
        this.undoObj.push(obj);
        //console.log("undo", this.undoObj, "redo", this.redoObj);
    }
    // アンドゥ実行
    undo() {
        // なげなわ変形中は確定してから処理する
        this.axpObj.finalizeNagenawaSelection();
        this.axpObj.finalizeLiquifySession();
        if (this.undoObj.length <= 0) {
            // これ以上アンドゥできません。
            this.axpObj.msg('@CAU0400');
            return;
        }
        const actionObj = this.undoObj.pop();
        // console.log('undo:', actionObj);
        // アンドゥ中であることを記憶しておく（※未使用。将来拡張用フラグ）
        this.isUndoing = true;
        let msgtext = '';
        // 変動が単一レイヤーに限定される操作の場合、サムネ更新対象IDを設定する
        // （カレントレイヤー以外が変動する場合があるため、actionObjから取得する）
        let changedLayerId = null;
        switch (actionObj.type) {
            case 'draw':
                // 詳細情報に対応するテキスト取得
                msgtext = this.getDetailText(actionObj.detail);
                // リドゥ用記憶
                this.axpObj.undoSystem.setRedo({
                    type: actionObj.type,
                    detail: actionObj.detail,
                    layerObj: this.axpObj.layerSystem.layerObj[this.axpObj.layerSystem.getLayerIndex(actionObj.layerObj.id)],
                });
                // アンドゥ処理
                this.axpObj.layerSystem.setImageId(actionObj.layerObj.image, actionObj.layerObj.id);
                changedLayerId = actionObj.layerObj.id;
                break;

            case 'layer-create':
                msgtext = '[レイヤー:新規]';
                // リドゥ用記憶
                this.setRedo(actionObj);
                // アンドゥ処理
                this.axpObj.layerSystem.deleteLayer(actionObj.layerObj.id);
                break;
            case 'layer-copy':
                msgtext = '[レイヤー:複製]';
                // リドゥ用記憶
                this.setRedo(actionObj);
                // アンドゥ処理
                this.axpObj.layerSystem.deleteLayer(actionObj.layerObj.id);
                break;

            case 'layer-delete':
                msgtext = '[レイヤー:削除]';
                // リドゥ用記憶
                this.setRedo(actionObj);
                // アンドゥ処理
                this.axpObj.layerSystem.restoreLayer(actionObj);
                break;

            case 'layer-clear':
                msgtext = '[レイヤー:クリア]';
                // リドゥ用記憶
                this.setRedo(actionObj);
                // アンドゥ処理
                this.axpObj.layerSystem.setImageId(actionObj.layerObj.image, actionObj.layerObj.id);
                changedLayerId = actionObj.layerObj.id;
                break;

            case 'layer-integrate': {
                msgtext = '[レイヤー:統合]';
                // リドゥ用記憶
                this.axpObj.undoSystem.setRedo({
                    type: actionObj.type,
                    // リドゥで消去する統合元のレイヤー
                    layerObj: actionObj.layerObj,
                    // リドゥで再統合される復元される統合先のレイヤー
                    layerObj_dest: this.axpObj.layerSystem.layerObj[this.axpObj.layerSystem.getLayerIndex(actionObj.layerObj_dest.id)],
                });
                // アンドゥ処理
                //  統合元レイヤーを復元
                this.axpObj.layerSystem.restoreLayer(actionObj);
                //  統合先レイヤーを復元
                let data = actionObj.layerObj_dest;
                // 画像と不透明度を復元する
                const index = this.axpObj.layerSystem.getLayerIndex(data.id);
                this.axpObj.layerSystem.layerObj[index].image = data.image;
                this.axpObj.layerSystem.setAlpha(data.alpha, index);
                break;
            }
            case 'flip_h':
                // リドゥ用記憶
                this.setRedo(actionObj);
                // アンドゥ処理
                //  idには、単体ならレイヤーのID、全体なら'all'が格納されている
                this.axpObj.layerSystem.flip_h(actionObj.id);
                //console.log(actionObj.index);
                if (actionObj.id == 'all') {
                    msgtext = '[左右反転:全体]';
                } else {
                    msgtext = '[左右反転:単体]';
                    changedLayerId = actionObj.id;
                }
                break;
            case 'flip_v':
                // リドゥ用記憶
                this.setRedo(actionObj);
                // アンドゥ処理
                this.axpObj.layerSystem.flip_v(actionObj.id);
                if (actionObj.id == 'all') {
                    msgtext = '[上下反転:全体]';
                } else {
                    msgtext = '[上下反転:単体]';
                    changedLayerId = actionObj.id;
                }
                break;

            case 'layer-style':
                // リドゥ用記憶（前後値は変わらないため同じ内容をそのまま積み直す）
                this.setRedo(actionObj);
                // アンドゥ処理：変更前の値へ戻す
                this.axpObj.layerSystem.setLayerStyle(actionObj.id, actionObj.styleBefore);
                msgtext = '[レイヤースタイル変更]';
                changedLayerId = actionObj.id;
                break;

            case 'mask-edit': {
                // リドゥ用記憶（前後値は変わらないため同じ内容をそのまま積み直す）
                this.setRedo(actionObj);
                // アンドゥ処理：マスクを変更前の画像へ戻す（マスク追加/削除は非アンドゥ対象のため、
                // この編集後にマスク自体が削除されている場合は復元先が無く何もしない）
                const layer = this.axpObj.layerSystem.layerObj[this.axpObj.layerSystem.getLayerIndex(actionObj.id)];
                if (layer?.mask) {
                    // mask全体を新しいオブジェクトで置き換える（既存オブジェクトを直接書き換えると、
                    // 同じmaskを参照している別のスナップショット/redo記録にも波及してしまうため）
                    layer.mask = { ...layer.mask, image: actionObj.maskBefore };
                }
                msgtext = '[マスク編集]';
                changedLayerId = actionObj.id;
                break;
            }

            default:
                console.log('WARNING:未登録のactionObj.type:', actionObj.type);
        }
        this.isUndoing = false;
        // %1をアンドゥしました。（残り回数：%2）
        this.axpObj.msg('@INF0400', msgtext, this.undoObj.length);
        // キャンバス再描画
        this.axpObj.layerSystem.updateCanvas(changedLayerId);

        //console.log("undo", undoObj , "redo" , redoObj);
    }
    setRedo(actionObj) {
        // 記録数が可能回数を超える場合、最古の記録を消す（可能回数以上になることはないはず）
        if (this.redoObj.length >= this.axpObj.undo_max) {
            this.redoObj.shift();
            alert('REDO error');
        }
        let obj = new UndoObj(actionObj);
        this.redoObj.push(obj);
    }
    // リドゥ実行
    redo() {
        // なげなわ変形中は確定してから処理する
        this.axpObj.finalizeNagenawaSelection();
        this.axpObj.finalizeLiquifySession();
        if (this.redoObj.length <= 0) {
            // これ以上リドゥできません。
            this.axpObj.msg('@CAU0401');
            return;
        }
        // リドゥ中であることを記憶しておく
        this.isRedoing = true;
        const actionObj = this.redoObj.pop();
        let msgtext = '';
        // 変動が単一レイヤーに限定される操作の場合、サムネ更新対象IDを設定する
        let changedLayerId = null;
        switch (actionObj.type) {
            case 'draw':
                // 詳細情報に対応するテキスト取得
                msgtext = this.getDetailText(actionObj.detail);
                // 再アンドゥ記憶
                this.axpObj.undoSystem.setUndo({
                    type: actionObj.type,
                    detail: actionObj.detail,
                    layerObj: this.axpObj.layerSystem.layerObj[this.axpObj.layerSystem.getLayerIndex(actionObj.layerObj.id)],
                });
                // リドゥ処理
                this.axpObj.layerSystem.setImageId(actionObj.layerObj.image, actionObj.layerObj.id);
                changedLayerId = actionObj.layerObj.id;
                break;
            case 'layer-create':
                msgtext = '[レイヤー:新規]';
                // 再アンドゥ記憶
                this.setUndo(actionObj);
                // リドゥ処理
                this.axpObj.layerSystem.restoreLayer(actionObj);
                break;
            case 'layer-copy':
                msgtext = '[レイヤー:複製]';
                // 再アンドゥ記憶
                this.setUndo(actionObj);
                // リドゥ処理
                this.axpObj.layerSystem.restoreLayer(actionObj);
                break;
            case 'layer-delete':
                msgtext = '[レイヤー:削除]';
                // 再アンドゥ記憶
                this.setUndo(actionObj);
                // リドゥ処理
                this.axpObj.layerSystem.deleteLayer(actionObj.layerObj.id);
                break;
            case 'layer-clear':
                msgtext = '[レイヤー:クリア]';
                // 再アンドゥ記憶
                this.setUndo(actionObj);
                // リドゥ処理
                this.axpObj.layerSystem.clear(actionObj.layerObj.id);
                changedLayerId = actionObj.layerObj.id;
                break;
            case 'layer-integrate': {
                msgtext = '[レイヤー:統合]';
                // 再アンドゥ記憶
                this.setUndo({
                    type: actionObj.type,
                    // 統合元のレイヤー
                    layerObj: actionObj.layerObj,
                    // 統合先のレイヤー
                    layerObj_dest: this.axpObj.layerSystem.layerObj[this.axpObj.layerSystem.getLayerIndex(actionObj.layerObj_dest.id)],
                });
                // リドゥ処理
                // 統合先レイヤーを復元
                let data = actionObj.layerObj_dest;
                const index = this.axpObj.layerSystem.getLayerIndex(data.id);
                this.axpObj.layerSystem.layerObj[index].image = data.image;
                this.axpObj.layerSystem.setAlpha(data.alpha, index);
                // 統合元レイヤーを削除
                this.axpObj.layerSystem.deleteLayer(actionObj.layerObj.id);
                break;
            }
            case 'flip_h':
                // 再アンドゥ記憶
                this.setUndo(actionObj);
                // リドゥ処理
                this.axpObj.layerSystem.flip_h(actionObj.id);
                if (actionObj.id == 'all') {
                    msgtext = '[左右反転:全体]';
                } else {
                    msgtext = '[左右反転:単体]';
                    changedLayerId = actionObj.id;
                }
                break;
            case 'flip_v':
                // 再アンドゥ記憶
                this.setUndo(actionObj);
                // リドゥ処理
                this.axpObj.layerSystem.flip_v(actionObj.id);
                if (actionObj.id == 'all') {
                    msgtext = '[上下反転:全体]';
                } else {
                    msgtext = '[上下反転:単体]';
                    changedLayerId = actionObj.id;
                }
                break;
            case 'layer-style':
                // 再アンドゥ記憶（前後値は変わらないため同じ内容をそのまま積み直す）
                this.setUndo(actionObj);
                // リドゥ処理：変更後の値を再適用する
                this.axpObj.layerSystem.setLayerStyle(actionObj.id, actionObj.styleAfter);
                msgtext = '[レイヤースタイル変更]';
                changedLayerId = actionObj.id;
                break;
            case 'mask-edit': {
                // 再アンドゥ記憶（前後値は変わらないため同じ内容をそのまま積み直す）
                this.setUndo(actionObj);
                // リドゥ処理：マスクを変更後の画像へ再適用する（マスクが削除済みなら何もしない）
                const layer = this.axpObj.layerSystem.layerObj[this.axpObj.layerSystem.getLayerIndex(actionObj.id)];
                if (layer?.mask) {
                    layer.mask = { ...layer.mask, image: actionObj.maskAfter };
                }
                msgtext = '[マスク編集]';
                changedLayerId = actionObj.id;
                break;
            }
            default:
                console.log('WARNING:未登録のactionObj.type:', actionObj.type);
        }
        this.isRedoing = false;
        // %1をリドゥしました。（残り回数：%2）
        this.axpObj.msg('@INF0401', msgtext, this.redoObj.length);
        // キャンバス再描画
        this.axpObj.layerSystem.updateCanvas(changedLayerId);
        //console.log("undo", undoObj , "redo" , redoObj);
    }
    getDetailText(detail) {
        let msgtext;
        switch (detail) {
            case 'eraser':
                msgtext = '[消しゴム]';
                break;
            case 'move':
                msgtext = '[移動ツール]';
                break;
            case 'fill':
                msgtext = '[バケツ]';
                break;
            case 'fillall':
                msgtext = '[全面塗り潰し]';
                break;
            case 'rotate90':
                msgtext = '[90°回転]';
                break;
            case 'filter':
                msgtext = '[フィルタ]';
                break;
            default:
                msgtext = '[線の描画]';
        }
        return msgtext;
    }
}
