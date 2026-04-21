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

// This function is required for your GitHub Tests to pass
function resolveFile(requestUrl, rootDir) {
  const urlPath = requestUrl.split('?')[0];
  const decodedUrl = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);

  // Check Root first (since you moved index.html there), then pages
  const pathsToTry = [
    join(rootDir, decodedUrl),
    join(rootDir, 'pages', decodedUrl)
  ];

  let filePath = pathsToTry.find(p => existsSync(p)) || join(rootDir, 'index.html');
  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  return { filePath, contentType };
}

function createHandler(rootDir) {
  return function (req, res) {
    // 1. Safety check for favicon (prevents Azure 500 loop)
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
      } else {
        // Fallback to the root index.html
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(readFileSync(join(rootDir, 'index.html')));
      }
    } catch (e) {
      // Return a plain text 404 to satisfy tests if things go wrong
      res.writeHead(404);
      res.end('Not found');
    }
  };
}

// Start the server using process.cwd() for Azure stability
if (require.main === module) {
  const server = createServer(createHandler(process.cwd()));
  const port = process.env.PORT || 8080;
  server.listen(port);
}

module.exports = { resolveFile, createHandler, mimeTypes };