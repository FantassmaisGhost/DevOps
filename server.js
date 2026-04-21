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
  // Strip query strings and handle the root path
  let url = requestUrl.split('?')[0];
  if (url === '/' || url === '') {
    url = '/index.html';
  }

  // 1. Try exact path from project root
  let filePath = join(rootDir, url);

  // 2. Try pages/ subdirectory
  if (!existsSync(filePath)) {
    filePath = join(rootDir, 'pages', url);
  }

  // 3. SPA fallback — serve index.html from pages if still not found
  if (!existsSync(filePath)) {
    filePath = join(rootDir, 'pages', 'index.html');
  }

  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  return { filePath, contentType };
}

function createHandler(rootDir) {
  return function handler(req, res) {
    try {
      const { filePath, contentType } = resolveFile(req.url, rootDir);
      
      if (!existsSync(filePath)) {
        res.writeHead(404);
        return res.end('File not found');
      }

      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (e) {
      // Showing the error message helps debug if Azure is failing
      res.writeHead(500);
      res.end(`Server Error: ${e.message}`);
    }
  };
}

// THE CRITICAL FIX IS HERE
if (require.main === module) {
  const server = createServer(createHandler(__dirname));
  
  // Azure uses process.env.PORT (which is a named pipe string).
  // We MUST listen to exactly what Azure provides.
  const port = process.env.PORT || 8080;

  server.listen(port, () => {
    console.log(`Server listening on ${port}`);
  });
}

module.exports = { resolveFile, createHandler, mimeTypes };