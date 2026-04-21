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
  // Decode the URL first so we can check for file existence properly
  const decodedUrl = decodeURIComponent(requestUrl === '/' ? '/index.html' : requestUrl);

  // 1. Try exact path from project root
  let filePath = join(rootDir, decodedUrl);

  // 2. Try pages/ subdirectory
  if (!existsSync(filePath)) {
    filePath = join(rootDir, 'pages', decodedUrl);
  }

  // 3. SPA fallback — only if the file STILL doesn't exist
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
      
      // The test specifically looks for 'Not found' (no 'File' prefix)
      if (!existsSync(filePath)) {
        res.writeHead(404);
        return res.end('Not found');
      }

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
  
  // Clean port logic for Azure and Local
  const port = process.env.PORT || 8080;

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = { resolveFile, createHandler, mimeTypes };