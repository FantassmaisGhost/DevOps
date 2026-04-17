/**
 * __tests__/server.test.js
 * Tests for server.js — resolveFile(), createHandler(), and mimeTypes
 */

'use strict'

const http = require('http')
const path = require('path')
const fs   = require('fs')
const os   = require('os')

const { resolveFile, createHandler, mimeTypes } = require('../server')

// ── Temp directory fixture ───────────────────────────────────
let tmpDir

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meddev-srv-'))
  const pages = path.join(tmpDir, 'pages')
  fs.mkdirSync(pages)

  fs.writeFileSync(path.join(pages,  'index.html'),   '<html>index</html>')
  fs.writeFileSync(path.join(pages,  'booking.html'), '<html>booking</html>')
  fs.writeFileSync(path.join(pages,  'style.css'),    'body { color: red }')
  fs.writeFileSync(path.join(tmpDir, 'root.js'),       'const x = 1')
  fs.writeFileSync(path.join(pages,  'data.json'),    '{"ok":true}')
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ────────────────────────────────────────────────────────────
// mimeTypes map
// ────────────────────────────────────────────────────────────
describe('mimeTypes', () => {
  test('has correct type for .html', () => expect(mimeTypes['.html']).toBe('text/html'))
  test('has correct type for .css',  () => expect(mimeTypes['.css']).toBe('text/css'))
  test('has correct type for .js',   () => expect(mimeTypes['.js']).toBe('application/javascript'))
  test('has correct type for .json', () => expect(mimeTypes['.json']).toBe('application/json'))
  test('has correct type for .png',  () => expect(mimeTypes['.png']).toBe('image/png'))
  test('has correct type for .svg',  () => expect(mimeTypes['.svg']).toBe('image/svg+xml'))
})

// ────────────────────────────────────────────────────────────
// resolveFile
// ────────────────────────────────────────────────────────────
describe('resolveFile', () => {
  test('/ resolves to pages/index.html', () => {
    const { filePath } = resolveFile('/', tmpDir)
    expect(filePath).toBe(path.join(tmpDir, 'pages', 'index.html'))
  })

  test('/index.html resolves to pages/index.html', () => {
    const { filePath } = resolveFile('/index.html', tmpDir)
    expect(filePath).toBe(path.join(tmpDir, 'pages', 'index.html'))
  })

  test('/booking.html resolves to pages/booking.html', () => {
    const { filePath } = resolveFile('/booking.html', tmpDir)
    expect(filePath).toBe(path.join(tmpDir, 'pages', 'booking.html'))
  })

  test('/root.js resolves to root directory first', () => {
    const { filePath } = resolveFile('/root.js', tmpDir)
    expect(filePath).toBe(path.join(tmpDir, 'root.js'))
  })

  test('unknown path falls back to pages/index.html (SPA fallback)', () => {
    const { filePath } = resolveFile('/does-not-exist', tmpDir)
    expect(filePath).toBe(path.join(tmpDir, 'pages', 'index.html'))
  })

  test('URL-encoded path is decoded correctly', () => {
    fs.writeFileSync(path.join(tmpDir, 'pages', 'my file.html'), '<html>spaced</html>')
    const { filePath } = resolveFile('/my%20file.html', tmpDir)
    expect(filePath).toContain('my file.html')
  })

  test('returns text/html content-type for .html', () => {
    const { contentType } = resolveFile('/', tmpDir)
    expect(contentType).toBe('text/html')
  })

  test('returns text/css content-type for .css', () => {
    const { contentType } = resolveFile('/style.css', tmpDir)
    expect(contentType).toBe('text/css')
  })

  test('returns application/javascript for .js', () => {
    const { contentType } = resolveFile('/root.js', tmpDir)
    expect(contentType).toBe('application/javascript')
  })

  test('returns application/json for .json', () => {
    const { contentType } = resolveFile('/data.json', tmpDir)
    expect(contentType).toBe('application/json')
  })

  test('unknown extension defaults to text/plain', () => {
    // .xyz file won't exist → falls back to index.html (.html)
    // Test with an actual .xyz file in pages to hit the unknown branch
    fs.writeFileSync(path.join(tmpDir, 'pages', 'file.xyz'), 'raw data')
    const { contentType } = resolveFile('/file.xyz', tmpDir)
    expect(contentType).toBe('text/plain')
  })
})

// ────────────────────────────────────────────────────────────
// createHandler (integration via live server)
// ────────────────────────────────────────────────────────────
describe('createHandler', () => {
  let server
  let baseUrl

  beforeAll(done => {
    const handler = createHandler(tmpDir)
    server = http.createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`
      done()
    })
  })

  afterAll(() => new Promise(r => server.close(r)))

  function get(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(`${baseUrl}${urlPath}`, res => {
        let body = ''
        res.on('data', chunk => { body += chunk })
        res.on('end',  ()    => resolve({ status: res.statusCode, headers: res.headers, body }))
      }).on('error', reject)
    })
  }

  test('GET / → 200 with index.html body', async () => {
    const res = await get('/')
    expect(res.status).toBe(200)
    expect(res.body).toContain('index')
  })

  test('GET /booking.html → 200', async () => {
    const res = await get('/booking.html')
    expect(res.status).toBe(200)
    expect(res.body).toContain('booking')
  })

  test('GET /style.css → correct content-type', async () => {
    const res = await get('/style.css')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('text/css')
  })

  test('GET /root.js → served from root dir', async () => {
    const res = await get('/root.js')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/javascript')
  })

  test('GET /nonexistent → SPA fallback to index.html', async () => {
    const res = await get('/nonexistent-route')
    expect(res.status).toBe(200)
    expect(res.body).toContain('index')
  })

  test('GET /data.json → 200 with JSON content-type', async () => {
    const res = await get('/data.json')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/json')
  })

  test('file read error → 404 response', async () => {
    // Point handler at a non-existent rootDir so readFileSync always throws
    const badHandler = createHandler('/tmp/definitely-does-not-exist-xyz')
    const badServer  = http.createServer(badHandler)
    await new Promise(r => badServer.listen(0, '127.0.0.1', r))
    const { port }   = badServer.address()

    const res = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/`, r => {
        let body = ''
        r.on('data', c => { body += c })
        r.on('end', () => resolve({ status: r.statusCode, body }))
      }).on('error', reject)
    })

    await new Promise(r => badServer.close(r))
    expect(res.status).toBe(404)
    expect(res.body).toBe('Not found')
  })
})