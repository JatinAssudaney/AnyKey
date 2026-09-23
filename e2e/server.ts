// Static server for e2e/fixtures. Started by Playwright's webServer option.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { FIXTURE_ORIGIN, FIXTURE_PORT } from './constants.ts';

const ROOT = path.resolve(import.meta.dirname, 'fixtures');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', FIXTURE_ORIGIN);
  if (pathname === '/health') {
    res.end('ok');
    return;
  }
  const file = path.join(ROOT, path.normalize(pathname));
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  readFile(file).then(
    (body) => {
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(body);
    },
    () => {
      res.writeHead(404).end('not found');
    },
  );
}).listen(FIXTURE_PORT, '127.0.0.1');
