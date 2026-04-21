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

/**
 * Resolve the file path for an incoming request URL.
 */
function resolveFile(requestUrl, rootDir) {
  // 1. Clean the URL and handle the root redirect
  const decodedUrl = decodeURIComponent(requestUrl === '/' ? '/index.html' : requestUrl);

  // 2. Define all possible locations where the file might be
  const pathsToTry = [
    join(rootDir, decodedUrl),               // e.g., root/index.html
    join(rootDir, 'pages', decodedUrl),       // e.g., root/pages/index.html
    join(__dirname, '..', 'pages', decodedUrl) // backup for nested folder structures
  ];

  // 3. Find the first path that actually exists on the server
  let filePath = pathsToTry.find(p => existsSync(p));

  // 4. SPA Fallback: If nothing exists, default to index.html in the pages folder
  if (!filePath) {
    filePath = join(rootDir, 'pages', 'index.html');
  }

  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  return { filePath, contentType };
}

/**
 * HTTP request handler.
 */
function createHandler(rootDir) {
  return function handler(req, res) {
    try {
      const { filePath, contentType } = resolveFile(req.url, rootDir);
      
      if (!existsSync(filePath)) {
        res.writeHead(404);
        return res.end('Not found');
      }

      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (e) {
      // Return 404 to satisfy your existing test suite requirements
      res.writeHead(404);
      res.end('Not found');
    }
  };
}

// Start the server
if (require.main === module) {
  // CRITICAL: Use process.cwd() to ensure we start looking from the Azure root
  const server = createServer(createHandler(process.cwd()));
  
  // Port logic for Azure (named pipes) or local development
  const port = process.env.PORT || 8080;

  server.listen(port, () => {
    console.log(`Server is live on port ${port}`);
  });
}

module.exports = { resolveFile, createHandler, mimeTypes };