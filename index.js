require('babel-register')({
  ignore: ['node_modules'],
});

require('css-modules-require-hook')({
  generateScopedName: '[path][name]-[local]'
});

const express = require('express');
const webpack = require('webpack');
const chokidar = require('chokidar');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const webpackConfig = require('./config/webpack.dev');
const server = require('./server');

class ServerApp {

  constructor (){
    this.app = express();
    const env = process.env.NODE_ENV || 'production';
    if(env === 'development') {
      this.development();
    } else {
      this.production();
    }
    this.listen(env === 'development' ? 8080 : 80);
  }

  development() {
    const compiler = webpack(webpackConfig);

    this.app.use(webpackDevMiddleware(compiler, {
      noInfo: false,
      publicPath: webpackConfig.output.publicPath,
      serverSideRender: true,
    }));

    this.app.use(webpackHotMiddleware(compiler));
    this.app.use(this.mapDevStatics);
    this.app.use((req, res, next) => require('./server')(req, res, next));

    const watcher = chokidar.watch('./server');

    // Listen changes to clean node's cache
    watcher.on('ready', function() {
      watcher.on('all', function() {
        console.log("Clearing /server/ module cache from server");
        Object.keys(require.cache).forEach(function(id) {
          if (/[\/\\]server[\/\\]/.test(id)) delete require.cache[id];
        });
      });
    });

    // Clean React App modules
    compiler.plugin('done', function() {
      console.log("Clearing /client/ module cache from server");
      Object.keys(require.cache).forEach(function(id) {
        if (/[\/\\]app[\/\\]/.test(id)) delete require.cache[id];
      });
    });
  }

  production() {
    const staticsMapping = require('./build/manifest.json');
    this.app.use(server);
  }

  mapDevStatics(req, res, next){
    // entrypoints match dependency order better than assetsByChunkName
    console.log(res.locals.webpackStats.toJson().entrypoints);
    next();
  }

  listen(port) {
    this.app.listen(port, () => console.log(`listening @${port}`));
  }
}

module.exports = new ServerApp();