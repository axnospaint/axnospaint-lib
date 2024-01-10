<style type="text/css">

body {
    background: #fff;
    color: #222;
    font: 14px/1.6 Verdana, "ヒラギノ角ゴ ProN W3", "Hiragino Kaku Gothic ProN", "メイリオ", Meiryo, "游ゴシック", YuGothic, sans-serif;
    letter-spacing: .02em;
    word-wrap: break-word;
}

h2 {
    background: #eee;
    padding: 2px 10px;
    border-radius: 8px;
    color:#333;
    font-size: 1.2em;
    font-weight: bolder;
}

h1 {
    background: linear-gradient(to left,#fff,#ffc971);
    padding:8px 8px;
    color:#333;
    font-size: 1.2em;
    font-weight: bolder;
    border: 0;
}

table > thead > tr > th {
	text-align: left;
	border: 1px solid;
    background:#eee;
}

table > tbody > tr > td {
	text-align: left;
	border: 1px solid;
}

.container{
    width: 800px;
    margin: 0 auto;
}

.t_div {
    border: 2px solid #ffcc44;
    padding: 20px;
    background: #ffe;
    border-radius: 8px;
    box-shadow: 4px 4px 8px #ddd;
    margin-bottom: 8px;
}

.t_button {
    color: #fff;
    background: #FDAE32;
    margin: 4px 0px;
    padding: 5px 15px;
    border: 0px;
    border-radius: 2px;
    cursor: pointer;
}

b {
    background:linear-gradient(transparent 60%, #ff6 60%);
}

.column-left{
  float: left;
  width: 40%;
  text-align: left;
}
.column-right{
  float: right;
  width: 60%;
  text-align: left;
}
.column-one{
  float: left;
  width: 100%;
  text-align: left;
}

</style>

<div class="container">

# AXNOS Paint

AXNOS Paint（アクノスペイント）は「お絵かき掲示板サイト」での利用を想定したペイントツールのオープンソースライブラリです。

![image](./pic/ss00.jpg) 

# 特徴
機能を「お絵かき」でよく使われるものだけに限定しており、「レタッチ」系の機能は意図的に排除しています。
これにより、お絵かき初心者の方、初見の方でも操作に迷うことなく扱うことができるシンプルなお絵かき環境を提供します。

# お試しデモ version 1.99.66[2024/01/10版]
* Edge, Safari, Chrome, Firefox, Opera いずれかの最新版）で動作します
* スマートフォンには対応していません
* 投稿タブを開くことはできますが、実際に投稿を行うことはできません


<div class="t_div">
    <form action="demo-2.0.0/index.html" method="get" target=”_blank”>
        <div>
            <label>お絵カキコのサイズ:</label>
            <label>横</label>
            <input name="oekaki_width" type="number" maxlength="3" min="8" max="600" value="317" size="5">
            <label>縦</label>
            <input name="oekaki_height" type="number" maxlength="3" min="8" max="600" value="317" size="5">
        </div>
        <button class="t_button" type="submit">お絵カキコする</button><br>
    </form>
</div>

# 提供する機能

<div class="column-left">

![image](./pic/image01.png)

</div>
<div class="column-right">

## レイヤー
最大８枚までのレイヤーを作成し、下書き、線画、色塗りなどに使い分けることができます。

乗算などの合成モードの他、透明部分のロックやクリッピングを使った簡易的なマスク機能を使用することができます。

</div>
<div class="column-one"></div>

<div class="column-left">

![image](./pic/image02.png)

</div>
<div class="column-right">

## 透明色の使用/背景透過画像の作成
補助ツールの「背景透過」ボタンで白地と透過が切り替わります。透過状態の画素は灰色の市松模様として表示され、透過色を意識した描画が可能になります。

※透過画像を投稿するには、投稿先のシステムが透過画像に対応している必要があります。
</div>
<div class="column-one"></div>

<div class="column-left">

![image](./pic/image03.png)

</div>
<div class="column-right">

## ドットペン/ドット単位の補助線
ドット単位で点が打てるドット専用ペンと、カスタマイズ可能な補助線を用意。ドット単位のグリッド線も表示可能です。

キャンバス全体のアンチエイリアシングのON/OFFを切り替えることができるため、ドットがぼやけてしまう心配もありません。
</div>
<div class="column-one"></div>


<div class="column-left">

![image](./pic/image04.png)

</div>
<div class="column-right">

## 自動バックアップ
10ストローク毎に画像情報を自動的にバックアップします。不慮の事故でブラウザが強制終了してしまっても、直近の状態に復元することができます。

この他に、任意にセーブ／ロードができるスロットが５つまで使用できます。

</div>
<div class="column-one"></div>

<div class="column-left">

![image](./pic/image07.png)

</div>
<div class="column-right">

## キーカスタマイズ
キーボードの数字キーに自由に機能を割り当てたり、マウスの右ボタンにアンドゥを割り当てるといったカスタマイズに対応しています。

</div>
<div class="column-one"></div>


<div class="column-left">

![image](./pic/image05.png)

</div>
<div class="column-right">

## 混色パレット（オプション）
メインカラーとサブカラーを段階的に混ぜ合わせたカラーパレットを自動作成し、描画色として使用することができます。

※機能を使用するには、色作成の設定で有効化が必要です。
</div>
<div class="column-one"></div>


<div class="column-left">

![image](./pic/image06.png)

</div>
<div class="column-right">

## ぼかし/トーン（オプション）
描画する線にぼかしをかけたりトーン効果を加えることができます。

※機能を使用するには、ペンツールの設定で有効化が必要です。
</div>


<div class="column-one">

# 開発コミュニティ

## ニコニコミュニティ
* [「悪の巣」部屋番号13番：「趣味の悪い大衆酒場[Mad end dance hall]」](https://com.nicovideo.jp/community/co1128854)

## GitHub
* [https://github.com/axnospaint/axnospaint-lib/](https://github.com/axnospaint/axnospaint-lib/)

## 免責事項
* AXNOS Paintを利用することで何らかの損害が発生したとしても、コミュニティは一切の責任を負うことはできません。自己責任でのご利用をお願いします。

<hr>
<small>
    AXNOS Paint &copy; 2022<a href="https://com.nicovideo.jp/community/co1128854" target="_blank"
        style="text-decoration: none;color:#222;">
        「悪の巣」部屋番号13番：「趣味の悪い大衆酒場[Mad end dance hall]」</a>
</small>

</div>

</div>