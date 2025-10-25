const path = require('path');
const HTMLWebpackPlugin = require('html-webpack-plugin');



module.exports = {
    entry: "./src/index.jsx",
    output: {
        path: path.resolve(__dirname, '/dist'),
        filename: "bundle.js",
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
                use: 'babel-loader'
            },
            {
                test: /\.sass/,
                use: [
                    'style-loader',
                    'css-loader',
                    "sass-loader"
                ]
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
        new HTMLWebpackPlugin({
            template: "./public/index.html",
        }),
    ],
    devServer: {
        port: 3000,
        compress: true,
        open: true,
        hot: true,
        static: {
            directory: path.join(__dirname, "dist"),
            watch: true
        }
    },
    mode: "development"
}