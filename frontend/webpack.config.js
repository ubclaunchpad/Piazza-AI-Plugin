const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin"); // safe to keep even if not using React yet
const webpack = require("webpack");

const isDev = process.env.NODE_ENV !== "production";

const EXT_ENV = {
  API_BASE_URL: process.env.API_BASE_URL || "http://localhost:8000",
  VERSION: process.env.APP_VERSION || "1.0.0",
  NODE_ENV: isDev ? "development" : "production",
};

module.exports = {
  mode: isDev ? "development" : "production",
  devtool: isDev ? "eval-cheap-module-source-map" : "source-map",
  entry: {
    popup: path.resolve(__dirname, "src/popup/popup.js"),
    content: path.resolve(__dirname, "src/content/piazza-enhancer.js"),
    background: path.resolve(__dirname, "src/background/service-worker.js"),
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: isDev ? "[name].js" : "[name].[contenthash].js",
    clean: true,
  },
  resolve: { extensions: [".js", ".jsx"] },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/i,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            plugins: [isDev && require.resolve("react-refresh/babel")].filter(Boolean),
            presets: [
              ["@babel/preset-env", { targets: "defaults" }],
              ["@babel/preset-react", { runtime: "automatic" }],
            ],
          },
        },
      },
      {
        test: /\.css$/i,
        use: [
          isDev ? "style-loader" : MiniCssExtractPlugin.loader,
          { loader: "css-loader", options: { importLoaders: 1 } },
          "postcss-loader",
        ],
      },
      { test: /\.(png|jpe?g|gif|svg|ico)$/i, type: "asset" },
      { test: /\.(woff2?|ttf|eot)$/i, type: "asset/resource" },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/popup/popup.html"),
      filename: "popup.html",
      chunks: ["popup"],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "manifest.json", to: "." },
        { from: "public/icons", to: "icons", noErrorOnMissing: true },
      ],
    }),
    !isDev && new MiniCssExtractPlugin({ filename: "[name].[contenthash].css" }),
    new webpack.DefinePlugin({ EXTENSION_ENV: JSON.stringify(EXT_ENV) }),
    isDev && new ReactRefreshWebpackPlugin(),
  ].filter(Boolean),
  devServer: {
    hot: true,
    port: 5173,
    static: { directory: path.resolve(__dirname, "public") },
    historyApiFallback: { rewrites: [{ from: /^\/$/, to: "/popup.html" }] },
    open: ["popup.html"],
  },
  performance: { hints: false },
};
