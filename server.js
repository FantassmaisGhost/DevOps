const { createServer } = require('http');
const { readFileSync, existsSync } = require('fs');
const { join, extname } = require('path');

const PORT = process.env.PORT || 8080;
const PAGES_DIR = join(__dirname, 'pages');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

createServer((req, res) => {
  let filePath = join(PAGES_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!existsSync(filePath)) filePath = join(PAGES_DIR, 'index.html');
  
  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';
  
  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Server running on port ${PORT}`));