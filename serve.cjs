// Static file server - mirrors GitHub Pages behavior for local testing
// No proxy needed: all game cache files are served locally from out/
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const STATIC_DIR = path.join(__dirname, 'out');

const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.map': 'application/json',
    '.wasm': 'application/wasm',
    '.css': 'text/css',
    '.zip': 'application/zip',
};

// Known cache filenames (for stripping CRC suffixes)
const CACHE_FILES = new Set(['crc', 'title', 'config', 'interface', 'media', 'versionlist', 'textures', 'wordenc', 'sounds', 'build', 'ondemand.zip']);

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0]; // strip query params
    if (urlPath === '/') urlPath = '/index.html';

    // Try exact file first
    let filePath = path.join(STATIC_DIR, urlPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    // Try stripping CRC suffix: /title-945108033 -> /title
    const basename = urlPath.slice(1); // remove leading /
    for (const known of CACHE_FILES) {
        if (basename.startsWith(known)) {
            filePath = path.join(STATIC_DIR, known);
            if (fs.existsSync(filePath)) {
                res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
                fs.createReadStream(filePath).pipe(res);
                return;
            }
        }
    }

    console.log(`404: ${req.url}`);
    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`Bot client server running at http://localhost:${PORT}`);
    console.log(`Serving static files from ${STATIC_DIR} (no proxy)`);
});
