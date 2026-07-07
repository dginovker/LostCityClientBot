// Static file server with upstream proxy for cache files
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const STATIC_DIR = path.join(__dirname, 'out');
// Default rs2b2t (https). For a local server, run: BOT_UPSTREAM=localhost:8888 node serve.cjs
const UPSTREAM = process.env.BOT_UPSTREAM || 'w1.rs2b2t.com';
const [UP_HOST, UP_PORT] = UPSTREAM.split(':');
const UP_HTTPS = !UP_PORT && !UPSTREAM.startsWith('localhost'); // host-only => rs2b2t over https; host:port => local http

const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.map': 'application/json',
    '.wasm': 'application/wasm',
    '.css': 'text/css',
    '.zip': 'application/zip',
};

// Cache filenames that should be proxied to the upstream server
const CACHE_FILES = new Set(['crc', 'title', 'config', 'interface', 'media', 'versionlist', 'textures', 'wordenc', 'sounds', 'build', 'ondemand.zip']);

function proxyToUpstream(req, res) {
    const options = {
        hostname: UP_HOST,
        port: UP_PORT || (UP_HTTPS ? 443 : 80),
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            host: UPSTREAM,
        },
    };

    const proxy = (UP_HTTPS ? https : http).request(options, (upstream) => {
        res.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(res);
    });

    proxy.on('error', (err) => {
        console.log(`Proxy error: ${err.message}`);
        res.writeHead(502);
        res.end('Bad Gateway');
    });

    req.pipe(proxy);
}

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0]; // strip query params
    if (urlPath === '/') urlPath = '/index.html';

    // Proxy cache file requests to upstream FIRST (before local lookup)
    const basename = urlPath.slice(1); // remove leading /
    for (const known of CACHE_FILES) {
        // The client requests archives as `<name><crc>` where crc is a signed int,
        // so the char after the name is '-' (negative crc), '?' (query), or a digit (positive crc).
        const after = basename.charAt(known.length);
        if (basename === known || (basename.startsWith(known) && (after === '-' || after === '?' || (after >= '0' && after <= '9')))) {
            console.log(`Proxy: ${req.url} -> https://${UPSTREAM}${req.url}`);
            proxyToUpstream(req, res);
            return;
        }
    }

    // Try local file (client.js, index.html, .wasm, etc.)
    let filePath = path.join(STATIC_DIR, urlPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    console.log(`404: ${req.url}`);
    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`Bot client server running at http://localhost:${PORT}`);
    console.log(`Serving static files from ${STATIC_DIR}`);
    console.log(`Proxying cache files to https://${UPSTREAM}`);
});
