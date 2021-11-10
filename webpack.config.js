var path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/builded',
  output: {
    path: path.resolve(__dirname, 'distr'),
    filename: 'app.bundle.js'
  },
  resolve: {
    extensions: ['.ts', '.js', '.jsx', '.tsx']
  },
  module: {
    rules: [{
      test: /\.(ts|js|jsx|tsx)$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
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
  }
};