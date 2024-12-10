import html from '../html/settings.html';

export class Settings {
    axpObj;
    constructor(axpObj) {
        this.axpObj = axpObj;
    }
    // 初期化
    init() {
        // HTML生成
        //console.log(html);
        let targetElement = document.getElementById('axp_settings');
        // targetElement.insertAdjacentHTML('afterbegin', this.axpObj.translateHTML(html));
        targetElement.insertAdjacentHTML('afterbegin', html);
        this.axpObj.translateHTMLi18n(targetElement);
    }
}