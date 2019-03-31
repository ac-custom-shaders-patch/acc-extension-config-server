const http = require('http');
const contentTypes = require('./content-types');
const config = require('../config');

let providersList = {};

function respondWithError(res, msg = null){
  res.writeHead(msg ? 500 : 404);
  res.end(JSON.stringify({ error: msg || 'not found' }));
}

function respondWith(req, res, data){
  if (data == null){
    respondWithError(res, 'data isn’t ready')
  } else {
    if (/gzip/i.test(req.headers['accept-encoding'] || '')){
      res.setHeader('Content-Encoding', 'gzip');
      res.end(data.gzip);
    } else if (/deflate/i.test(req.headers['accept-encoding'] || '')){
      res.setHeader('Content-Encoding', 'deflate');
      res.end(data.deflate);
    } else {
      res.end(data.raw);
    }
  }
}

function processRequest(req, res, query, dataProvider){
  if (query === ''){
    respondWith(req, res, dataProvider.getListResponse());
  } else if (query === 'warnings.json') {
    respondWith(req, res, dataProvider.getWarningsListResponse());
  } else if (query === 'warnings.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(dataProvider.getWarningsHtmlResponse());
  } else if (query === 'warnings.svg') {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.end(dataProvider.getWarningsSvgResponse());
  } else {
    let piece = dataProvider.getPiece(query);
    if (piece != null){
      res.setHeader('Content-Type', contentTypes[path.extname(piece)] || 'application/octet-stream');
      fs.createReadStream(piece).pipe(res);
    } else {
      respondWithError(res);
    }
  }
}

let server = http.createServer(function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store');

  let url = req.url.replace(/\/$/, '');
  for (let entry of providersList){
    if (entry.test(url)) {
      processRequest(req, res, RegExp.$1, entry.provider);
      return;
    }
  }

  respondWithError(res);
});

module.exports = {
  run: providers => {
    if (!config.serverPort){
      $.echo(β.yellow('Server port is not set'));
      return;
    }
    providersList = [];
    for (let n in providers){
      providersList.push({ test: /./.test.bind(new RegExp(`^\/${n}(?:\/?(.+))?\/?$`)), provider: providers[n] });
    }
    server.listen(config.serverPort, () => $.echo(`Server started at port ${config.serverPort}`));
  }
}