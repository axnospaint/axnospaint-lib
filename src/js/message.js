// @description 画面左下のガイドメッセージ用データロード処理

// メッセージテキスト
import text_00 from '../text/msg.txt';
const textArray = text_00.split(/\r\n|\n/);
const talk = new Map();
for (let index = 0; index < textArray.length; index++) {
    let splitText = textArray[index].split(',');
    let type = splitText[0];
    let text = splitText[1];
    if (splitText[1] === '') {
        throw (`メッセージデータに不正があります type:${type} index:${index}`);
    }
    if (!talk.has(type)) {
        talk.set(type, text);
    } else {
        throw (`メッセージデータにID重複があります type:${type} index:${index}`);
    }
}
//
export class Message {
    static getMessage(id) {
        let text = "";
        if (talk.has(id)) {
            text = talk.get(id);
        };
        //console.log('text:', text);
        return text;
    }
}