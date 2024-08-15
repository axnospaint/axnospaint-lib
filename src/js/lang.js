// @description 指定されたパスから追加辞書JSONをロードする

export async function getDictionaryJSON(dictionaryURL) {
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
    if (await checkFileExists(dictionaryURL)) {
        const loadedJSON = await loadJSON(dictionaryURL)
        if (loadedJSON) {
            // 読込成功
            return loadedJSON;
        } else {
            return 'SYNTAX_ERROR';
        }
    } else {
        return 'NOT_FOUND';
    }
}
