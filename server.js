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

function createHandler(rootDir) {
  return function handler(req, res) {
    try {
      // 1. FORCE ROOT FIX: If the request is "/" or empty, just serve index.html directly
      const urlPath = req.url.split('?')[0];
      if (urlPath === '/' || urlPath === '/index.html') {
        const rootIndex = join(rootDir, 'pages', 'index.html');
        if (existsSync(rootIndex)) {
          const content = readFileSync(rootIndex);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          return res.end(content);
        }
      }

      // 2. Standard resolution for everything else
      const decodedUrl = decodeURIComponent(urlPath);
      const pathsToTry = [
        join(rootDir, decodedUrl),
        join(rootDir, 'pages', decodedUrl)
      ];

      const filePath = pathsToTry.find(p => existsSync(p)) || join(rootDir, 'pages', 'index.html');
      
      // Safety check for the found file
      if (!existsSync(filePath)) {
        res.writeHead(404);
        return res.end('Not found');
      }

      const content = readFileSync(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content);

    } catch (e) {
      // Azure hates custom 500 pages; sending a 404 is safer to prevent the "Blue Screen"
      res.writeHead(404);
      res.end('Not found');
    }
  };
}

if (require.main === module) {
  // Use BOTH process.cwd() and __dirname fallback
  const root = existsSync(join(process.cwd(), 'pages')) ? process.cwd() : __dirname;
  const server = createServer(createHandler(root));
  const port = process.env.PORT || 8080;

  server.listen(port);
}

module.exports = { createHandler, mimeTypes };