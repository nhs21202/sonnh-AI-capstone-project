const path = require("path");
const webpack = require("webpack");
const dotenv = require("dotenv");

// Build-time env: load storefront/.env and inject the public API base URL via DefinePlugin.
const fileEnv = dotenv.config().parsed || {};
const apiBaseUrl =
  process.env.REACT_APP_API_BASE_URL || fileEnv.REACT_APP_API_BASE_URL || "";

module.exports = {
  entry: "./src/index.ts",
  module: {
    rules: [{ test: /\.ts$/, use: "ts-loader", exclude: /node_modules/ }],
  },
  resolve: { extensions: [".ts", ".js"] },
  output: {
    filename: "announcement-bar.js",
    // Built straight into the Theme App Extension's assets so {{ 'announcement-bar.js' | asset_url }} resolves.
    path: path.resolve(__dirname, "extensions/announcement-bar/assets"),
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.REACT_APP_API_BASE_URL": JSON.stringify(apiBaseUrl),
    }),
  ],
};
