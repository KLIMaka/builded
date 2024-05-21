const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/builded',
  output: {
    path: path.resolve(__dirname, 'distr'),
    filename: 'app.bundle.js'
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx'],
    plugins: [new TsconfigPathsPlugin()]
  },
  module: {
    rules: [{
      test: /\.(ts|js|tsx)$/i,
      exclude: /node_modules/,
      loader: 'babel-loader',
    },
    {
      test: /\.css$/i,
      use: ["style-loader", "css-loader"],
    }],
  },
  devtool: 'source-map',
  devServer: {
    static: {
      directory: __dirname,
      watch: false
    },
    compress: true,
    port: 9000,
  },
  experiments: {
    asyncWebAssembly: true
  },
};