const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser.js'),
      };
      
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser.js',
        })
      );

      // ESM modül çözümlemesi için
      webpackConfig.resolve.extensionAlias = {
        '.js': ['.js', '.ts', '.tsx'],
      };
      
      return webpackConfig;
    },
  },
};