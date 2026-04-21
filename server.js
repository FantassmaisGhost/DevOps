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
  // 1. Split query params and then DECODE the URI to handle spaces/%20
  const urlPath = decodeURIComponent((requestUrl || '/').split('?')[0]);
  
  // 2. Determine relative path (Root becomes pages/index.html)
  let relativePath = urlPath === '/' ? '/pages/index.html' : urlPath;
  
  // 3. Define priority: Try raw path, then try under pages/
  const pathsToTry = [
    join(rootDir, relativePath),
    join(rootDir, 'pages', relativePath)
  ];
  
  let filePath = pathsToTry.find(p => existsSync(p) && !p.endsWith('/') && !p.endsWith('\\'));

  // 4. SPA Fallback (Required by Test Suite)
  if (!filePath) {
    filePath = join(rootDir, 'pages', 'index.html');
  }

  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  return { filePath, contentType };
}

// ... (keep all your mimeTypes and resolveFile functions at the top)

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

// THE STARTUP BLOCK
if (require.main === module) {
  // Use process.cwd() to ensure we are in the DevOps directory
  const root = process.cwd();
  const server = createServer(createHandler(root));
  
  // Azure provides the port via process.env.PORT
  const port = process.env.PORT || 8080;

  server.listen(port, () => {
    console.log('Server is running');
  });
}

module.exports = { resolveFile, createHandler, mimeTypes };