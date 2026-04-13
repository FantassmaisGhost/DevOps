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
  console.log(`RAW REQUEST: "${req.url}"`);

  let url = req.url === '/' ? '/index.html' : req.url;
  url = decodeURIComponent(url);
  console.log(`DECODED URL: "${url}"`);

  // Strip any leading /../backend/ or ../backend/
  url = url.replace(/^\/\.\.\/backend\//, '/');
  url = url.replace(/^\/\.\.%2Fbackend\//, '/');
  console.log(`NORMALIZED URL: "${url}"`);

  let filePath = join(__dirname, 'pages', url);
  console.log(`TRYING pages: ${filePath} — exists: ${existsSync(filePath)}`);

  if (!existsSync(filePath)) {
    filePath = join(__dirname, 'backend', url);
    console.log(`TRYING backend: ${filePath} — exists: ${existsSync(filePath)}`);
  }

  if (!existsSync(filePath)) {
    console.log(`FALLING BACK to index.html`);
    filePath = join(__dirname, 'pages', 'index.html');
  }

  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Server running on port ${PORT}`));