// 开发服务器插件：把仓库根目录的 games/ 以 /play/* 提供，响应头与生产环境的 Caddyfile 保持一致。
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const GAMES_DIR = resolve(process.cwd(), 'games');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.pck': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
};

function contentHeaders(filePath) {
  if (filePath.endsWith('.br') || filePath.endsWith('.gz')) {
    const inner = filePath.slice(0, -3);
    return {
      'Content-Type': MIME[extname(inner)] ?? 'application/octet-stream',
      'Content-Encoding': filePath.endsWith('.br') ? 'br' : 'gzip',
    };
  }
  return { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' };
}

/** @returns {import('vite').Plugin} */
export function playDevServer() {
  return {
    name: 'pzc:play-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/play', (req, res, next) => {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
        let filePath = normalize(join(GAMES_DIR, urlPath));
        if (filePath !== GAMES_DIR && !filePath.startsWith(GAMES_DIR + sep)) return next();
        if (!existsSync(filePath)) return next();
        if (statSync(filePath).isDirectory()) {
          if (!urlPath.endsWith('/')) {
            res.writeHead(301, { Location: `/play${urlPath}/` });
            return res.end();
          }
          filePath = join(filePath, 'index.html');
          if (!existsSync(filePath)) return next();
        }
        res.writeHead(200, {
          ...contentHeaders(filePath),
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cache-Control': 'no-cache',
        });
        createReadStream(filePath).pipe(res);
      });
    },
  };
}
