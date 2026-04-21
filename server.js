'use strict';

const { createServer } = require('http');
const { readFileSync, existsSync } = require('fs');
const { join, extname } = require('path');

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
  const urlPath = (requestUrl || '/').split('?')[0];
  
  // If root, immediately point to pages/index.html
  let relativePath = urlPath === '/' ? '/pages/index.html' : urlPath;
  
  // Try directly, then try under /pages/
  let filePath = join(rootDir, relativePath);
  if (!existsSync(filePath)) {
    filePath = join(rootDir, 'pages', relativePath);
  }

  // SPA Fallback for Tests
  if (!existsSync(filePath) || filePath.endsWith('/') || filePath.endsWith('\\')) {
    filePath = join(rootDir, 'pages', 'index.html');
  }

  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  return { filePath, contentType };
}

function createHandler(rootDir) {
  return function (req, res) {
    if (req.url === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }

    try {
      const { filePath, contentType } = resolveFile(req.url, rootDir);

      if (existsSync(filePath)) {
        const content = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        return res.end(content);
      } 
      
      res.writeHead(404);
      res.end('Not found');
    } catch (e) {
      res.writeHead(404);
      res.end('Not found');
    }
  };
}

if (require.main === module) {
  const server = createServer(createHandler(process.cwd()));
  const port = process.env.PORT || 8080;
  server.listen(port);
}

module.exports = { resolveFile, createHandler, mimeTypes };