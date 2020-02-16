var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

function replaceUrl(url) {
  var m = url.match(/.*\/distr\/.*\.(map|js)/);
  if (m) return url;
  var m = url.match(/.*\/distr\/.*/);
  if (m) return url + '.js';
  return url;
}

function contentType(url) {
  var extname = path.extname(url);
  switch (extname) {
    case '.js': return 'text/javascript';
    case '.css': return 'text/css';
    case '.json': return 'application/json';
    case '.png': return 'image/png';
    case '.jpg': return 'image/jpg';
    case '.wav': return 'audio/wav';
    default: return 'text/html';
  }
}

http.createServer(function (req, res) {
  let name = replaceUrl(new url.URL(req.url, 'https://example.org/').pathname);
  fs.readFile(__dirname + name, function (err, data) {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(name) });
    res.end(data, 'utf-8');
  });

}).listen(8080);