// @description ブラウザの使用言語を識別し、対応する追加辞書JSONをカレントパスからロードする

export function getUserLanguage() {
    const languages = navigator.languages || [navigator.language || navigator.userLanguage];
    // 最上位の言語を取得
    const primaryLanguage = languages[0];
    // 言語情報の変換
    let result;
    if (primaryLanguage.startsWith('ja')) {
        // 先頭がjaから始まる言語は、日本語（デフォルト）
        result = 'ja';
    } else if (primaryLanguage.startsWith('en')) {
        // 先頭がenから始まる言語は、en共通
        result = 'en';
    } else {
        // その他の言語
        result = primaryLanguage;
    }
    return result;
}

export async function getDictionaryJSON(language) {
    // ロードするファイル
    const loadFileName = `${language}.json`;
    // 辞書ファイル存在確認
    async function checkFileExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.error('Error:', error);
            return false;
        }
    }
    // 辞書ファイルフェッチ
    async function loadJSON(url) {
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error:', error);
            return false;
        }
    }
    if (await checkFileExists(loadFileName)) {
        const loadedJSON = await loadJSON(loadFileName)
        if (loadedJSON) {
            // 読込成功
            return loadedJSON;
        }
    }
    // 失敗時はnullを返却
    return null;
}
