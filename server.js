const { createServer } = require('http');
const { readFileSync, existsSync } = require('fs');
const { join, extname } = require('path');

const PORT = process.env.PORT || 8080;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

createServer((req, res) => {
  let url = decodeURIComponent(req.url === '/' ? '/index.html' : req.url);

  // Try exact path from root first
  let filePath = join(__dirname, url);
  if (!existsSync(filePath)) {
    // Then try pages/
    filePath = join(__dirname, 'pages', url);
  }
  if (!existsSync(filePath)) {
    // Fall back to index.html
    filePath = join(__dirname, 'pages', 'index.html');
  }

  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Server running on port ${PORT}`));