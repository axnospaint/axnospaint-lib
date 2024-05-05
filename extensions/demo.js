// @description webpackビルド制御（Webデモ版）

import { default as Mascot } from './mascot/mascot.js';

export var isExtenstions = true;
export class ExTool {
    member = [];
    constructor(axpObj) {
        this.member.push(new Mascot(axpObj));
    }
    init() {
        this.member.forEach(item => item.init());
    }
    startEvent() {
        this.member.forEach(item => item.startEvent());
    }
}