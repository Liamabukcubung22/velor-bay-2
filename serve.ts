// Velor Bay — tiny static server for local testing. Serves this directory
// on port 8080: /game/ is the game, /screenshots/ the renders. No build,
// no dependencies, plain node.
//
//   node serve.ts
//   open http://localhost:8080/game/
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  const raw = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  let path = normalize(join(ROOT, raw));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404);
    res.end('not found: ' + raw);
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream' });
  createReadStream(path).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Velor Bay server on http://localhost:${PORT}/game/`);
});
