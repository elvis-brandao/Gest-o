const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 5500;
const root = __dirname;

function send404(res){
  res.statusCode = 404;
  res.setHeader('Content-Type','text/plain');
  res.end('Not Found');
}

function serveFile(filePath, res){
  fs.readFile(filePath, (err, data) => {
    if (err) { send404(res); return; }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.ico': 'image/x-icon'
    };
    res.statusCode = 200;
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(root, reqPath);
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      serveFile(filePath, res);
    } else if (!err && stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (e2, st2) => {
        if (!e2 && st2.isFile()) serveFile(indexPath, res);
        else send404(res);
      });
    } else {
      send404(res);
    }
  });
});

server.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}/`);
});
