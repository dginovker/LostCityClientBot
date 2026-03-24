// Local proxy server: serves static files from out/ and proxies game resources to rsleague.com
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const STATIC_DIR = path.join(__dirname, 'out');
const UPSTREAM = 'rsleague.com';

const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.map': 'application/json',
    '.wasm': 'application/wasm',
    '.css': 'text/css',
};

const server = http.createServer((req, res) => {
    // Try to serve static file first
    const filePath = path.join(STATIC_DIR, req.url === '/' ? '/index.html' : req.url);
    const ext = path.extname(filePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    // Proxy to rsleague.com
    const proxyReq = https.request({
        hostname: UPSTREAM,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: UPSTREAM },
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
        console.error(`Proxy error for ${req.url}:`, e.message);
        res.writeHead(502);
        res.end('Proxy error');
    });

    req.pipe(proxyReq);
});

server.listen(PORT, () => {
    console.log(`Bot client server running at http://localhost:${PORT}`);
    console.log(`Static files from ${STATIC_DIR}, proxying to ${UPSTREAM}`);
});
