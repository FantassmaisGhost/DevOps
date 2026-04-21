'use strict';

const { createServer } = require('http');
const { readFileSync, existsSync } = require('fs');
const { join, extname } = require('path');

const PORT = process.env.PORT || 8080;

const mimeTypes = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
};

function resolveFile(requestUrl, rootDir) {
  const url = decodeURIComponent(requestUrl === '/' ? '/index.html' : requestUrl);

  let filePath = join(rootDir, url);

  if (!existsSync(filePath)) {
    filePath = join(rootDir, 'pages', url);
  }

  if (!existsSync(filePath)) {
    filePath = join(rootDir, 'pages', 'index.html');
  }

  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  return { filePath, contentType };
}

function createHandler(rootDir) {
  return function handler(req, res) {
    const { filePath, contentType } = resolveFile(req.url, rootDir);
    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (e) {
      res.writeHead(404);
      res.end('Not found');
    }
  };
}

if (require.main === module) {
  const server = createServer(createHandler(__dirname));
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { resolveFile, createHandler, mimeTypes };