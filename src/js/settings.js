import html from '../html/settings.html';
import Alpine from 'alpinejs';

import button from '../html/settings_button.html';
import range from '../html/settings_range.html';
import toggleSwitch from '../html/settings_switch.html';
import select from '../html/settings_select.html';

// 設定項目データ
import fetchData from '../text/test.json';

export class Settings {
    axpObj;
    constructor(axpObj) {
        this.axpObj = axpObj;
    }
    // 初期化
    init() {
        // 全体HTML生成
        const targetElement = document.getElementById('axp_settings');
        targetElement.insertAdjacentHTML('beforeend', html);

        const thisClass = this;
        // alpinejs有効化
        window.Alpine = Alpine;
        Alpine.data('fetchData', ()=> ({
            chapters: fetchData,
            htmlButton: button,
            htmlRange: range,
            htmlSwitch: toggleSwitch,
            htmlSelect: select,
            i18n(prefix) {
                const trans = thisClass.axpObj._(prefix);
                //console.log(prefix,trans); 
                return trans; 
            },
            activeAccordion: '', 
            setActiveAccordion(id) { 
                this.activeAccordion = (this.activeAccordion == id) ? '' : id 
            }
        }));

        // // ナビメニューとページコンテンツのHTML生成
        // const elementUlNav = document.getElementById('axp_settings_ul_nav');
        // const elementDivContents = document.getElementById('axp_settings_div_contents'); 
        // for (const [key, value] of Object.entries(settingsJSON)) {
        //     //console.log(this.axpObj._(key));
        //     // 大見出し
        //     const li = elementUlNav.appendChild(this.#html(key));
        //     elementDivContents.insertAdjacentHTML('beforeend', this.#contentsHead(key));
        //     // 小見出し
        //     const h2Data =  Object.entries(value);
        //       if(h2Data.length > 0){
        //         const ul = document.createElement('ul');
        //         for(const [h2Key, h2Value] of h2Data){
        //             const h2Token = `${key}.${h2Key}`
        //             ul.appendChild(this.#h2Html(h2Token));
        //             elementDivContents.insertAdjacentHTML('beforeend', this.#contentsCard(h2Token,h2Value));
        //         }               
        //         li.appendChild(ul);
        //     }
        // }
        // // 辞書変換
        // // console.log(targetElement);
        // this.axpObj.translateHTMLi18n(targetElement);
    }
    // #html(key){
    //     const li = document.createElement('li');
    //     li.textContent = this.axpObj._(key);
    //     return li
    // }
    // #h2Html(key){
    //     const li = document.createElement('li');
    //     li.insertAdjacentHTML('afterbegin',
    //         `${bullet}${this.axpObj._(key)}`
    //     );
    //     li.setAttribute('class','ms-4 group flex items-center gap-x-2 py-0.5 text-sm leading-6 text-gray-700 hover:text-gray-800 focus:text-blue-600 focus:outline-none dark:text-neutral-400 dark:hover:text-neutral-300 dark:focus:text-blue-500');
    //     return li
    // }
    // #contentsHead(key){
    //     return `
    //         <div id="item-1">
    //           <h3 class="text-lg font-semibold dark:text-white">
    //             <span data-i18n="${key}"></span>
    //           </h3>
    //         </div>
    //     `;
    // }
    // #contentsCard(key,value){
    //   let htmlText = '';
    //   switch(value.type){
    //     case 'button':{
    //       htmlText = `
    //         <button class="inline rounded bg-blue-500 px-4 py-2 text-white">
    //           <span data-i18n="@COMMON.BUTTON_EXECUTION"></span>
    //         </button>
    //       `;
    //       break;
    //     }
    //     case 'switch':{
    //       htmlText = `
    //       <div>
    //           <label class="inline-flex cursor-pointer items-center">
    //             <input type="checkbox" value="" class="peer sr-only" />
    //             <div
    //               class="peer relative h-6 w-11 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800 rtl:peer-checked:after:-translate-x-full"
    //             ></div>
    //           </label>
    //         </div>
    //       `;
    //       break;
    //     }
    //   };

    //   return `
    //       <div class="mx-auto my-2 rounded-xl bg-white p-6 shadow-md dark:bg-black">
    //         <div class="text-base font-semibold dark:text-white">
    //           <span data-i18n="${key}"></span>
    //         </div>
          
    //         <div class="mt-0 text-sm leading-6 text-gray-600 dark:text-neutral-400">
    //           <span data-i18n="${key}.MSG"></span>
    //         </div>

    //         <div>
    //           ${htmlText}
    //         </div>
    //       </div>
    //   `;
    // }    
}