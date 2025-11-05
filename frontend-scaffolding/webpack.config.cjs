const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    mode: "production",
    devtool: 'cheap-module-source-map',
    entry: {
        content: "./src/index.jsx",
        background: "./src/background.js"
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: "[name].js",
        clean: true
    },
    resolve: {
        extensions: [".js", ".jsx"]
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            '@babel/preset-env',
                            ['@babel/preset-react', { runtime: 'automatic' }]
                        ]
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'postcss-loader'
                ],
            },
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'public/manifest.json', to: 'manifest.json' },
                { from: 'public/icons', to: 'icons', noErrorOnMissing: true }
            ]
        })
    ],
}