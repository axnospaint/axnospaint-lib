/** ↓ エディタで補完を効かせるための JSDoc */
/** @type {import('webpack').Configuration} */
// プラグインの読み込み
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require('path');
const webpack = require('webpack');

// 環境変数
const environment = process.env.NODE_ENV || 'prod';
const version = `${require('./package.json').version}`;
// ビルド日時
const buildDate = new Date().toISOString();

module.exports = {
    mode: "development",
    resolve: {
        alias: {
            '@extensions': path.resolve(__dirname, `extensions/${environment}.js`),
        },
    },
    module: {
        rules: [
            {
                // 拡張子 js のファイル（正規表現）
                //test: /\.js$/,
                // ローダーの指定
                //loader: "babel-loader",
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.txt$/,
                type: 'asset/source',
            },
            {
                test: /\.json$/,
                loader: 'json-loader',
                type: 'javascript/auto'
            },
            {
                test: /\.png/,
                type: 'asset/inline'
            }
        ],
    },

    devtool: 'source-map',
    devServer: {
        static: {
            directory: "./dist",
        },
    },

    entry: "./src/index.js",
    // 出力ファイル
    output: {
        filename: 'axnospaint.js',
        library: {
            name: 'AXNOSPaint',
            export: 'default',
            type: 'umd',
        },
    },
    plugins: [
        // プラグインのインスタンスを作成
        new HtmlWebpackPlugin({
            // テンプレート
            template: "./src/index.html",
            // <script> ~ </script> タグの挿入位置
            inject: "body",
            // スクリプト読み込みのタイプ
            scriptLoading: "defer",
            // ファビコンも <link rel="shortcut icon" ~ /> として挿入できる
            //favicon: "./src/favicon.ico",
        }),
        new webpack.DefinePlugin({
            PACKAGE_VERSION: `"${version}"`,
            PACKAGE_DATE: `"${buildDate}"`,
        }),
        // ビルドファイルの先頭にコメントを挿入
        new webpack.BannerPlugin(
            `AXNOS Paint version ${version} (${buildDate})\n(c) 2022「悪の巣」部屋番号13番：「趣味の悪い大衆酒場[Mad end dance hall]」\nLicensed under MPL 2.0`,
            {
                raw: false,
                entryOnly: true
            }
        ),
    ],
};