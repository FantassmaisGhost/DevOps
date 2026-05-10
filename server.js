'use strict'

const fs = require('fs')
const path = require('path')

// MIME types mapping
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
}

/**
 * Resolves a URL path to a file path and content type
 * @param {string} urlPath - The request URL path
 * @param {string} rootDir - The root directory to serve from
 * @returns {object} { filePath, contentType }
 */
function resolveFile(urlPath, rootDir) {
  // Decode URL-encoded paths
  const decodedPath = decodeURIComponent(urlPath)
  
  // Check if file exists in root directory first
  const rootFilePath = path.join(rootDir, decodedPath)
  if (fs.existsSync(rootFilePath) && fs.statSync(rootFilePath).isFile()) {
    const ext = path.extname(rootFilePath)
    const contentType = mimeTypes[ext] || 'text/plain'
    return { filePath: rootFilePath, contentType }
  }
  
  // Check in pages directory
  const pagesPath = path.join(rootDir, 'pages')
  
  // Handle root path
  if (decodedPath === '/') {
    const filePath = path.join(pagesPath, 'index.html')
    return { filePath, contentType: 'text/html' }
  }
  
  // Try the requested file in pages
  const requestedFile = path.join(pagesPath, decodedPath.startsWith('/') ? decodedPath.slice(1) : decodedPath)
  if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
    const ext = path.extname(requestedFile)
    const contentType = mimeTypes[ext] || 'text/plain'
    return { filePath: requestedFile, contentType }
  }
  
  // SPA fallback to index.html
  const indexPath = path.join(pagesPath, 'index.html')
  return { filePath: indexPath, contentType: 'text/html' }
}

/**
 * Creates an HTTP request handler
 * @param {string} rootDir - The root directory to serve files from
 * @returns {function} HTTP request handler
 */
function createHandler(rootDir) {
  return (req, res) => {
    try {
      const { filePath, contentType } = resolveFile(req.url, rootDir)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(fileContent)
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
    }
  }
}

module.exports = { resolveFile, createHandler, mimeTypes }