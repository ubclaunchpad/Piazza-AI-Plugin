const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "production",
  devtool: "cheap-module-source-map",
  entry: {
    content: "./src/content/content.js",
    background: "./src/background/background.js",
    popup: "./src/popup/main.jsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  resolve: {
    extensions: [".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/preset-env",
              ["@babel/preset-react", { runtime: "automatic" }],
            ],
          },
        },
      },
      {
        test: /\.css$/,
        // Handle ?raw query to import CSS as raw string (but process through PostCSS/Tailwind first)
        resourceQuery: /raw/,
        use: [
          {
            loader: "css-loader",
            options: {
              exportType: "string",
            },
          },
          "postcss-loader",
        ],
      },
      {
        test: /\.css$/,
        // Regular CSS imports (without ?raw)
        resourceQuery: { not: [/raw/] },
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/popup/index.html",
      filename: "popup.html",
      chunks: ["popup"],
    }),
    new CopyPlugin({
      patterns: [
        { from: "public/manifest.json", to: "manifest.json" },
        { from: "public/icons", to: "icons", noErrorOnMissing: true },
      ],
    }),
  ],
};
