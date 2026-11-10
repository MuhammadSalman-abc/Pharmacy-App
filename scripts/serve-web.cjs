const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../apps/web/out');
if (!fs.existsSync(root)) { console.error('Run npm run build:web first.'); process.exit(1); }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  if (req.url === '/sw.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Service-Worker-Allowed': '/', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); return fs.createReadStream(path.resolve(__dirname, '../apps/web/public/sw.js')).pipe(res); }
  if (req.url === '/offline.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); return fs.createReadStream(path.resolve(__dirname, '../apps/web/public/offline.html')).pipe(res); }
  let filename;
  try { filename = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname)); } catch { res.writeHead(400); return res.end(); }
  if (filename !== root && !filename.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.html');
  fs.readFile(filename, (error, data) => { if (error) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' }); res.end(data); });
}).listen(Number(process.env.WEB_PORT || 3000), process.env.WEB_HOST || '0.0.0.0', () => console.log(`Offline frontend: http://${process.env.WEB_HOST || '0.0.0.0'}:${Number(process.env.WEB_PORT || 3000)}`));
