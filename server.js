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

// Simple static file server with SPA fallback for index.html
/**
 * Resolve the file path for an incoming request URL.
 * Exported for testability.
 *
 * @param {string} requestUrl  - raw req.url
 * @param {string} rootDir     - project root directory
 * @returns {{ filePath: string, contentType: string }}
 */
function resolveFile(requestUrl, rootDir) {
  const url = decodeURIComponent(requestUrl === '/' ? '/index.html' : requestUrl);

  // 1. Try exact path from project root
  let filePath = join(rootDir, url);

  // 2. Try pages/ subdirectory
  if (!existsSync(filePath)) {
    filePath = join(rootDir, 'pages', url);
  }

  // 3. SPA fallback — serve index.html
  if (!existsSync(filePath)) {
    filePath = join(rootDir, 'pages', 'index.html');
  }

  const ext         = extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  return { filePath, contentType };
}

/**
 * HTTP request handler. Exported for testability.
 *
 * @param {string} rootDir
 * @returns {function(req, res): void}
 */
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

// Only start listening when this file is run directly (not required by tests)
if (require.main === module) {
  const server = createServer(createHandler(__dirname))
  const port = process.env.PORT || process.env.IISNODE_VERSION ? null : 8080

  if (process.env.PORT) {
    server.listen(process.env.PORT)
  } else {
    server.listen(8080, () => console.log(`Server running on port 8080`))
  }
}

module.exports = { resolveFile, createHandler, mimeTypes };