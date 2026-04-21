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
  const urlPath = requestUrl.split('?')[0];
  const decodedUrl = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);

  // 1. Define paths to try
  const pathsToTry = [
    join(rootDir, decodedUrl),
    join(rootDir, 'pages', decodedUrl)
  ];

  let filePath = pathsToTry.find(p => existsSync(p));

  // 2. SPA Fallback - The test EXPLICITLY wants pages/index.html
  if (!filePath) {
    filePath = join(rootDir, 'pages', 'index.html');
  }

  // 3. Last ditch - if pages/index doesn't exist, check root index
  if (!existsSync(filePath)) {
    filePath = join(rootDir, 'index.html');
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

      if (existsSync(filePath) && !filePath.endsWith('/') && !filePath.endsWith('\\')) {
        const content = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        return res.end(content);
      } 
      
      // If file doesn't exist, throw to catch block for the 404
      throw new Error('Not found');

    } catch (e) {
      // Ensure we only send ONE response
      if (!res.writableEnded) {
        res.writeHead(404);
        res.end('Not found');
      }
    }
  };
}

if (require.main === module) {
  const root = existsSync(join(process.cwd(), 'pages')) ? process.cwd() : __dirname;
  const server = createServer(createHandler(root));
  const port = process.env.PORT || 8080;
  server.listen(port);
}

module.exports = { resolveFile, createHandler, mimeTypes };