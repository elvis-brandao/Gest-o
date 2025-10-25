const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = process.env.PORT ? Number(process.env.PORT) : 8080;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

function send(res, status, content, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(content);
}

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) return send(res, 403, 'Forbidden');

    fs.stat(filePath, (err, stat) => {
      if (err) return send(res, 404, 'Not Found');
      if (stat.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        fs.readFile(indexPath, (err2, data2) => {
          if (err2) return send(res, 404, 'Not Found');
          res.writeHead(200, { 'Content-Type': mime['.html'] });
          res.end(data2);
        });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const type = mime[ext] || 'application/octet-stream';
      fs.readFile(filePath, (err3, data3) => {
        if (err3) return send(res, 500, 'Server Error');
        res.writeHead(200, { 'Content-Type': type });
        res.end(data3);
      });
    });
  } catch (e) {
    send(res, 500, 'Server Error');
  }
});

server.listen(port, () => {
  console.log(`Static server running at http://localhost:${port}/`);
});
