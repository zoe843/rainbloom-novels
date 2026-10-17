import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp' };
const server = http.createServer(async (req,res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Mirror the GitHub Pages project prefix during QA.
    if (pathname.startsWith('/rainbloom-novels/')) pathname = pathname.slice('/rainbloom-novels'.length);
    let target = path.resolve(root, '.'+pathname);
    if (target !== root && !target.startsWith(root+path.sep)) { res.writeHead(403).end(); return; }
    if ((await stat(target)).isDirectory()) target = path.join(target,'index.html');
    res.writeHead(200, { 'Content-Type':types[path.extname(target)]||'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(await readFile(target));
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(Number(process.env.PORT || 8947), '127.0.0.1', () => console.log('Preview http://127.0.0.1:8947/rainbloom-novels/'));
