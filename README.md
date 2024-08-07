# AXNOS Paint

## 更新履歴
* 2024/8/3 version 2.2.0[2024/08/03版]を公開しました。
* 2024/7/1 version 2.1.1[2024/07/01版]を公開しました。（※ビルド日付とバージョン番号の更新修正）
* 2024/7/1 version 2.1.0[2024/05/30版]を公開しました。
* 2024/5/5 version 2.0.0[2024/05/05版]を正式公開しました。

## 概要
AXNOS Paint（アクノスペイント）は「お絵かき掲示板サイト」での利用を想定したペイントツールです。

- JavaScript(Vanilla JS)ライブラリとして提供しています。
- 機能を基本的なものに限定し、知識や熟練を必要としないお絵かき環境を提供します。
- 扱うことができる画像サイズは8×8～600×600です。
- 画像の自動バックアップ機能、一時保存機能を搭載しています。
- ローカルファイルの保存／読込、クリップボードからの貼り付けなどの機能は意図的に排除しています。
- サーバー側で指定した画像を下書きとして読み込む機能を持ちます。
- 投稿用のインターフェースとして、タイトルと本文を入力するフォームを備えています。
- 投稿処理（サーバーとの通信部分）はライブラリに含まれません。ユーザーが独自に組み込む必要があります。

## 動作サンプル

* [https://axnospaint.github.io/axnospaint-lib/](https://axnospaint.github.io/axnospaint-lib/)  

## 機能マニュアル

* [https://dic.nicovideo.jp/id/5703111](https://dic.nicovideo.jp/id/5703111)  
AXNOS Paint:ヘルプ - ニコニコ大百科  

## 対応環境
* Edge, Safari, Chrome, Firefox, Opera いずれかの最新版  
スマートフォンでの利用はサポート対象外とします。

## 使用ライブラリ

* reinvented-color-wheel(WTFPL License)  [https://github.com/luncheon/reinvented-color-wheel](https://github.com/luncheon/reinvented-color-wheel)  
 カラーピッカー（改変して使用）

* webpack5(MIT License)  [https://github.com/webpack/webpack](https://github.com/webpack/webpack)  
 ビルド用  

## 導入

### ファイル構成
起動に必要なファイル構成は以下の通りです。（/dist/の中にビルド済min.jsファイルが格納されています）
```
index.html（任意のhtmlファイル）
axnospaint-lib-2.2.0.min.js
```
### 起動用htmlファイル
最小構成の例を以下に示します。必要に応じて後述のオプションを指定してください。
```html
<head>
    <script defer="defer" src="axnospaint-lib-2.2.0.min.js"></script>
    <script>
        document.addEventListener("DOMContentLoaded", function () {
            new AXNOSPaint({
                bodyId: 'axnospaint_body',
            });
        });
    </script>
</head>
<body>
    <div id="axnospaint_body"></div>
</body>
```

### 起動オプション

AXNOS Paintのインスタンス作成時に以下のオプションを指定することができます。

| オプション名 | 内容 | 初期値 |
| ---- | ---- | ---- |
| bodyId       | AXNOS Paintの画面を展開するdiv要素のid属性。**指定必須** |  |
| width        | キャンバスの初期サイズ（横）。単位はピクセル。最小8～最大600。 | 317 |
| height       | キャンバスの初期サイズ（縦）。単位はピクセル。最小8～最大600。 | 317 |
| oekakiURL     | 下書き機能で使用する画像が配置されているURLパス名。<br>詳細は[下書き機能](#下書き機能)の項で解説。|  |
| checkSameBBS | 自動保存からの復元またはロード機能を使用する際、同一の掲示板の画像であるかをチェックします。<br>詳細は[下書き機能使用時の同一掲示板チェック](#下書き機能使用時の同一掲示板チェック)の項で解説。| false |
| restrictPost | 投稿タブを開けないようにします。何らかの理由で投稿機能を無効化したいときに使用します。| false |
| headerText      | ヘッダーのテキスト表示領域に表示する文字列。最大1024文字まで。超過する場合は切り捨て。<br>「投稿先の掲示板名」が指定されることを想定しています。  |  |
| post      | 投稿処理で呼び出すユーザー関数定義。<br>詳細は[投稿機能](#投稿機能)の項で解説。 |  |
| expansionTab      |  ユーザーが任意で追加することができる拡張タブ定義。<br>「ヘルプページへのリンク」が指定されることを想定しています。<br>詳細は[拡張タブ](#拡張タブ)の項で解説。 |  |

### URLパラメータ指定

AXNOS Paintは起動時に以下のURLパラメータを受け取ります。

| パラメータ名  | 内容 |
| ------------- | ---- |
| oekaki_id     | `${oekaki_id}.png`を下書きとして読み込みます。起動オプションの`oekakiURL`で画像のパスが指定されている必要があります。  |
| oekaki_width  | 起動オプションのwidthと同様。同時に指定した場合はURLパラメータの値が優先。   |
| oekaki_height | 起動オプションのheightと同様。同時に指定した場合はURLパラメータの値が優先。   |

例）キャンバスサイズ横600、縦400でAXNOS Paintを起動
```
https://www.axnospaint.jp/index.html?oekaki_width=600&oekaki_height=400
```

### 下書き機能

以下の方法で、任意の画像を下書きとして読み込み、初期レイヤーにすることが可能です。PNG形式の画像ファイルのみ対応しています。

1. 起動オプション`oekakiURL`に、画像が配置されているURLパス名を指定する。  
（※同一生成元ポリシーに違反する場合、セキュリティエラーが発生しますので注意してください）

```js
new AXNOSPaint({
    // 中略
    oekakiURL: 'https://www.axnospaint.jp/oekaki/',
});
```

2. URLパラメータ`oekaki_id`に画像ファイル名（.png除く）を指定して起動する。（`https://www.axnospaint.jp/oekaki/12345.png`が読み込まれる）  
```
https://www.axnospaint.jp/index.html?oekaki_id=12345
```


画像読み込みが成功した場合、以下のルールが適用されます。
* キャンバスサイズは読み込み画像の値が適用される。サイズが600×600より大きい場合、超過分は切り捨てられる。
* キャンバスサイズの変更機能が使用不可能になる。
* 投稿画面で`oekaki_id`を基にした画像であることが表示される。
* 投稿情報の`oekaki_id`に、URLパラメータで指定した`oekaki_id`の値が設定される。（下書きを利用した投稿であることを示す）
* セーブ、自動保存データに`oekaki_id`が保存され、ロード画面で表示される。
* 新規キャンバスで開始して、途中で`oekaki_id`が保存されたデータをロードした場合、その時点から上記ルールが再適用される。
* 途中で新規キャンバス作成または別の画像のロードにより下書きが破棄された場合は、その時点で上記ルールは撤廃される。

画像が読み込めなかった場合、エラーメッセージを表示し、新規キャンバスとして起動します。  

#### 下書き機能使用時の同一掲示板チェック

下書き機能を利用して、一度投稿された画像を（別の投稿者が）他の掲示板へ転載したり、新規と偽って投稿する行為を予防（※完全ではありません）する仕組みです。  
起動オプションの`checkSameBBS`にtrue（有効）を指定した場合、適用される機能です。  
```js
new AXNOSPaint({
    // 中略
    checkSameBBS: true,
});
```

  
AXNOS Paintでは下書き機能を使用した際に、以下の情報を記憶します。
1. URLパス名（`url.pathname`）
2. 基にした画像ファイル名（`oekaki_id`）
3. 起動ページの&lt;title&gt;要素の文字列

AXNOS Paintで自動保存からの復元またはロード機能を使用する際、URLパス名が一致しない（＝下書き画像が投稿された掲示板とは違う掲示板でロードを行った）場合に、ロードをキャンセルし、同一の掲示板でロードしてもらうことを促すメッセージを表示します。（この時、3.の&lt;title&gt;要素の文字列をメッセージの文言に使用します。この理由から、起動ページの&lt;title&gt;要素には、予め掲示板を一意に特定できるタイトルを指定しておくことが望ましいです）


このルールは下書きを使用しない画像の投稿には適用していません。これは投稿者自身であれば、投稿済みのセーブデータをロードすることで、自由に掲示板を再選択して何度でも再投稿できることを意味します。  
仮にここに制限をかけてしまうと「〇〇の掲示板に投稿するつもりだったのに、うっかり△△の掲示板で描き始めてしまった」「〇〇の掲示板で描いている途中に掲示板が削除／閉鎖されてしまった」といったケースで問題が発生することになり、ユーザーの不利益になることが予想されるためです。  
投稿者自身による多重投稿については、セーブデータや自動バックアップデータが既に投稿されたものであるかの判定が現実的に困難であり、障害発生で画像が消失してしまうリスクがあるため、こちらについてはAXNOS Paintでは制限を設けず、サービス管理者に対処を一任するものとします。
  

### 投稿機能
AXNOS Paint上でユーザーが投稿操作を行ったとき、起動オプションの`post`に指定された関数を呼び出します。この関数内にサーバーとの通信処理を記述することで、サーバー側に投稿情報を渡すことができます。
```js
new AXNOSPaint({
    // 中略
    post: function (postObj) {
        // ここにサーバーとの通信処理を記述
    },
});
```

##### 投稿情報オブジェクト

AXNOS Paintはサーバーとのインターフェースとして、以下のメンバ変数をもつObject型データを関数に受け渡します。

|  メンバ変数名        | 内容 |
| ----           | ---- |
|  strName       |  投稿者名。空欄可。trim()メソッドで文字列の両端の空白を削除済。  |
|  strTitle      |  タイトル。空欄可。trim()メソッドで文字列の両端の空白を削除済。  |
|  strMessage    |  本文。入力必須。trim()メソッドで文字列の両端の空白を削除済。<br>AXNOS Paint側で１文字以上入力されていることをチェックしている。  |
|  strWatchList  |  ウォッチリストに登録<br>チェックボックスが選択されている場合't'、それ以外は''（空文字）とする。  |
|  oekaki_id  | 「下書き機能」を使用した場合に付与される識別子。未使用時はNULL。（URLパラメータで指定した`oekaki_id`の内容の転記。**ただし、AXNOSPaint使用中の操作で更新される場合があります。** |
|  strEncodeImg  |  投稿するpng画像のdata URI<br>toDataURL('image/png')でエンコードした後、replace('data:image/png;base64,', '')でヘッダ部分を削除したもの。<br>AXNOS Paint側の設定により、背景透過pngとなる場合もある。  |

【重要】  
AXNOS Paintは、キャンバスサイズの変更機能、画像のセーブ／ロード機能をもつ関係上、起動時に指定したURLパラメータと実際に投稿される画像の情報が一致しない場合が発生します。  
（例：317×317の画像ファイルを下描きとして描き始めたが、途中で既にセーブしてあったキャンバスサイズ400×400の別の画像データをロードして投稿した等）  
そのため、投稿処理の中ではAXNOS Paintが受け渡す投稿情報オブジェクトを参照することを前提とし、**以下の操作は想定外の動作を引き起こす原因となるため絶対に行わないでください。**

* ❌投稿処理内でURLパラメータの値を参照する
* ❌「下書き機能」を使用した投稿であるかの情報を、サーバー側で事前に投稿処理に埋め込む
* ❌サーバー側でURLパラメータ（referer）と投稿画像との整合性チェックを行う

### 拡張タブ

AXNOS Paintに、ユーザー独自のタブを１つ追加する機能です。「リンク表示」「関数呼び出し」の２通りの使用方法があります。

1. リンク表示（推奨）  
`name`で指定された名前のタブを追加し、クリックすると別タブで`link`で指定されたURLのページを開きます。また、タブにポインタを重ねた時、`msg`で指定されたガイドメッセージを左下に表示します。
```js
new AXNOSPaint({
    // 中略
    expansionTab: {
        name: 'ヘルプ',
        msg: '説明書（ニコニコ大百科のAXNOS Paint:ヘルプの記事）を別タブで開きます。',
        link: 'https://dic.nicovideo.jp/id/5703111',
    },
});
```

2. 関数呼び出し  
`name`で指定された名前のタブを追加し、クリックすると`function`で指定された関数を呼び出します。また、タブにポインタを重ねた時、`msg`で指定されたガイドメッセージを左下に表示します。  
AXNOS Paintのページ内でユーザー独自の処理を行う必要がある場合に使用します。
```js
new AXNOSPaint({
    // 中略
    expansionTab: {
        name: 'お知らせ',
        msg: 'お知らせ：運営からのお知らせを表示します。',
        function: function () {
            alert('運営からのお知らせです。');
        }
    },
});
```

### ページ遷移防止
AXNOSPaintでは、ライブラリ利用者がページ遷移を制御できるようにする為、`Window:beforeunloadイベント`を**設定していません。**
必要に応じて以下のようなイベントハンドラを設定してください。
```js
// 設定
window.onbeforeunload = function (event) {
    event.preventDefault();
    event.returnValue = "";
}
// 解除（投稿処理時）
window.onbeforeunload = null;
```

### ページ内に任意の情報を表示する

AXNOS Paintを起動するページ内で任意の情報（緊急告知、メンテナンス予告など）を表示する必要がある場合、
AXNOS Paintを展開するdiv要素の前または後（あるいは両方）にdiv要素を追加することで、その領域内を任意に使用することができます。
ただし、ペイントツールとしての使用感を著しく低下させる恐れがあるため、基本的には使用を推奨しません。
通常はAXNOS Paintが標準で提供しているお知らせ領域の利用を推奨します。

例）
```html
<body>
    <div>
      2024/xx/xx 緊急メンテナンスのお知らせ 20:00~24:00の間、サービスをご利用いただくことができません。
    </div>
    <div id="axnospaint_body"></div>
</body>
```


## 開発資料

### ビルド

webpack5を使用し、.pngファイルや.cssファイルを含めた全ファイルを１つの.jsファイルにバンドルします。  

 webpack.config.js ： 開発用webpack設定ファイル。.jsファイル出力用。  
 webpack.prod.js ： プロダクションビルド用webpack設定ファイル。コメントなどを削除したmin.jsファイル出力用。
  
#### プロダクションビルド

通常版とWebデモ版が存在します。Webデモ版にはマスコット機能が追加されます。  
  
通常版プロダクションビルド。ファイル名は「axnospaint-lib-2.x.x.min.js」（バージョン番号はpackage.jsonに依存します）。
```
 npm run prod
```
Webデモ版プロダクションビルド。ファイル名は「axnospaint-lib-demo-2.x.x.min.js」（バージョン番号はpackage.jsonに依存します）。
```
 npm run prod-demo
```

ファイルの出力先は./dist/になります。

### マスコット機能

マスコットキャラがペイントツールの機能について紹介を行う機能が追加されます。  
拡張機能として./extensions/mascot/の中にデータが配置されています。Webデモ版のビルドを行った場合、.jsファイルにデータが取り込まれ機能が有効になります。


### データ保存

AXNOS PaintはブラウザのindexedDB領域（DB名：`axnospaint_db1`）を使用して、画像のセーブロード、自動バックアップ、ユーザー設定情報の保存を行います。
indexedDBが使用できない環境（プライベートブラウジングモード使用時など）の場合、起動時に警告が表示され、関連する機能が動作しなくなります。
localStorage、Cookieは使用していません。


### 所属名

機能や役割を識別するための名前として所属名を定義しています。

| 所属名 | 内容 |
| ---- | ---- |
|main       | メイン領域 |
|canvas     | キャンバスタブ内のコンテンツ |
|pen        | ペンツールウィンドウ |
|penmode    | ペン種別選択サブウィンドウ |
|layer      | レイヤーウィンドウ |
|renamelayer| レイヤー名変更サブウィンドウ |
|palette    | パレットウィンドウ |
|makecolor  | 色作成ウィンドウ |
|tool       | 補助ツールウィンドウ |
|saveload   | セーブ／ロード／自動保存サブウィンドウ |
|gridconfig | 補助線の色変更サブウィンドウ |
|custom     | カスタムボタンウィンドウ |
|mascot     | マスコット表示用領域 |
|config     | 設定タブ内のコンテンツ |
|post       | 投稿タブ内のコンテンツ |
|footer     | フッター領域 |
   
### id名

AXNOS Paintでは、先頭にaxp_を付与したid名を使用します。
競合を避けるためにaxp_で始まるid名を同時に使用しないように留意してください。

```
axp_所属名
axp_所属名_要素名_任意の識別名
```
例：axp_pen（ペンツールウィンドウ）  
例：axp_pen_form_penSize（ペンツールウィンドウ内の&lt;form&gt;要素、ペンの太さ調整用）  
例：axp_layer_button_create（レイヤーウィンドウ内の&lt;button&gt;要素、新規ボタン）

* 「axp_所属名」のidをもつ要素は、その所属の親divを意味するものとします。
* 要素名はdiv、span、form、labelなどを指します。
* input要素の場合は、type属性を要素名として扱います。（例：range、checkbox、number）
* penmodeで命名規則例外あり

### class名

AXNOS Paintでは、先頭にaxpc_を付与したclass名を使用します。
競合を避けるためにaxpc_で始まるclass名を同時に使用しないように留意してください。

```
axpc_分類名
axpc_分類名_任意の識別名
axpc_所属名_任意の識別名
```

| 分類名      | 役割 |
| ----        | ---- |
| button      | ボタン |
| checkbox    | チェックボックス |
| icon        | アイコン画像 |
| radio       | ラジオボタン生成用。JavaScriptで &lt;span&gt; を &lt;input type"radio"&gt; に展開する。|
| range       | レンジスライダー |
| window      | ツールウィンドウ制御用css |
| toggle      | トグルスイッチ風チェックボックス |