var path = require('path');

module.exports = {
  entry: './src/builded',
  output: {
    path: path.resolve(__dirname, 'distr'),
    filename: 'app.bundle.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [{
      test: /\.(ts|js)$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
    }],
  },
  devServer: {
    contentBase: __dirname,
    compress: true,
    port: 9000
  }
};