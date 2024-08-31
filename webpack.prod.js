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
            PACKAGE_VERSION: `"${require('./package.json').version}"`,
            PACKAGE_DATE: `"${new Date().toISOString()}"`,
        }),
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