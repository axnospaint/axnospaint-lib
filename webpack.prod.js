/** ↓ エディタで補完を効かせるための JSDoc */
/** @type {import('webpack').Configuration} */
// プラグインの読み込み
const HtmlWebpackPlugin = require("html-webpack-plugin");
const TerserPlugin = require('terser-webpack-plugin');
const cssnano = require("cssnano");
const path = require('path');
const webpack = require('webpack');

// 環境変数
const environment = process.env.NODE_ENV || 'prod';
const version = `${require('./package.json').version}`;
const filename = (environment === 'prod') ? `axnospaint-lib-${version}.min.js` : `axnospaint-lib-${environment}-${version}.min.js`;
const outputPath = (environment === 'demo') ? 'docs/latest' : 'dist';
// ビルド日時
const buildDate = new Date().toISOString();

module.exports = {
    mode: "production",
    resolve: {
        alias: {
            '@extensions': path.resolve(__dirname, `extensions/${environment}.js`),
        },
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader",
                    {
                        loader: "postcss-loader",
                        options: {
                            postcssOptions: {
                                plugins: [
                                    [
                                        cssnano,
                                        {
                                            // コメントを削除する
                                            preset: [
                                                "default",
                                                { discardComments: { removeAll: true } },
                                            ],
                                        },
                                    ],
                                ],
                            },
                        },
                    },
                ],
            },
            {
                test: /\.txt/,
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

    devServer: {
        static: {
            directory: "./dist",
        },
    },
    // メインのJS
    entry: {
        'axnospaint': "./src/index.js",
    },
    // 出力ファイル
    output: {
        path: path.resolve(__dirname, outputPath),
        filename: `${filename}`,
        library: {
            name: 'AXNOSPaint',
            export: 'default',
            type: 'umd',
        },
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                extractComments: false,
                terserOptions: {
                    compress: { drop_console: true }
                },
            }),
        ],
    },
};