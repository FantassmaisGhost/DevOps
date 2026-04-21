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
 * Resolve the file path. Required by your test suite!
 */
function resolveFile(requestUrl, rootDir) {
  const urlPath = requestUrl.split('?')[0];
  const decodedUrl = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);

  const pathsToTry = [
    join(rootDir, decodedUrl),
    join(rootDir, 'pages', decodedUrl)
  ];

  let filePath = pathsToTry.find(p => existsSync(p));

  // SPA Fallback
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
      res.writeHead(404);
      res.end('Not found');
    }
  };
}

// Start the server
if (require.main === module) {
  // Use process.cwd() as primary, fallback to __dirname
  const root = existsSync(join(process.cwd(), 'pages')) ? process.cwd() : __dirname;
  const server = createServer(createHandler(root));
  const port = process.env.PORT || 8080;

  server.listen(port, () => {
    console.log(`Server listening on ${port}`);
  });
}

// Ensure resolveFile is exported for the tests!
module.exports = { resolveFile, createHandler, mimeTypes };