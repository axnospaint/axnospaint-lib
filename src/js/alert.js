// @description 拡張アラート

// 拡張アラート-------------------------------------------------------------------------------------
const ALERT_TITLE = "メッセージ";
const ALERT_BUTTON_OK = "Ok";
const ALERT_BUTTON_CANCEL = "キャンセル";

// アラート用HTML生成
const createAlertHTML = (message, useCancel = false) => {
    let mObj = document.getElementsByTagName("body")[0].appendChild(document.createElement("div"));
    mObj.id = "axp_alert_div_modalContainer";
    mObj.style.height = document.documentElement.scrollHeight + "px";

    let alertObj = mObj.appendChild(document.createElement("div"));
    alertObj.id = "axp_alert_div_alertBox";
    //※恐らくIEのための個別処理
    //if (document.all && !window.opera) alertObj.style.top = document.documentElement.scrollTop + "px";
    alertObj.style.left = (document.documentElement.scrollWidth - alertObj.offsetWidth) / 2 + "px";
    alertObj.style.visiblity = "visible";

    let h1 = alertObj.appendChild(document.createElement("h1"));
    h1.appendChild(document.createTextNode(ALERT_TITLE));

    let messagetext = alertObj.appendChild(document.createElement("p"));
    messagetext.innerText = message;

    let div1 = alertObj.appendChild(document.createElement("div"));
    div1.style.display = 'flex';

    // OKボタン
    let btn_ok = div1.appendChild(document.createElement("button"));
    btn_ok.id = "axp_alert_button_closeBtn";
    btn_ok.appendChild(document.createTextNode(ALERT_BUTTON_OK));
    btn_ok.focus();

    let btn_cancel;
    if (useCancel) {
        // キャンセルボタン
        btn_cancel = div1.appendChild(document.createElement("button"));
        btn_cancel.id = "axp_alert_button_cancelBtn";
        btn_cancel.appendChild(document.createTextNode(ALERT_BUTTON_CANCEL));
    } else {
        btn_cancel = null;
    }

    // 生成したHTML要素への参照を返却
    return {
        alertObj: alertObj,
        btn_ok: btn_ok,
        btn_cancel: btn_cancel
    };
};

// アラート用HTML削除
function removeCustomAlert() {
    document.getElementsByTagName("body")[0].removeChild(document.getElementById("axp_alert_div_modalContainer"));
}

// 標準アラートのオーバーライド用（通常のalert()が他の処理を阻害しない独自仕様になる）
export function createCustomAlert(message) {
    if (document.getElementById("axp_alert_div_modalContainer")) return;
    const obj = createAlertHTML(message);
    obj.btn_ok.onclick = function () { removeCustomAlert(); return true; }
    obj.alertObj.style.display = "block";
}

// 確認ダイアログ（OK／キャンセル）
export function confirmExPromise(message) {
    var _showConfirmDialog = function (message, okFunction, cancelFunction) {
        if (document.getElementById("axp_alert_div_modalContainer")) return;
        const obj = createAlertHTML(message, true);
        obj.btn_ok.onclick = function () { removeCustomAlert(); okFunction(); }
        obj.btn_cancel.onclick = function () { removeCustomAlert(); cancelFunction(); }
        obj.alertObj.style.display = "block";
    }
    return new Promise(function (resolve, reject) {
        _showConfirmDialog(message, resolve, reject);
    });
}

// 確認ダイアログ（OK）（Promiseで処理を待機してくれる版）
export function alertExPromise(message) {
    var _showConfirmDialog = function (message, okFunction) {
        if (document.getElementById("axp_alert_div_modalContainer")) return;
        const obj = createAlertHTML(message);
        obj.btn_ok.onclick = function () { removeCustomAlert(); okFunction(); }
        obj.alertObj.style.display = "block";
    }
    return new Promise(function (resolve) {
        _showConfirmDialog(message, resolve);
    });
}
