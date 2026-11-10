import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import path from 'node:path';
import { build, BuildConfig } from '../index.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

export interface DevServerOptions extends BuildConfig {
  port?: number;
  host?: string;
}

export async function createDevServer(options: DevServerOptions = {}): Promise<http.Server> {
  const port = options.port || 3000;
  const host = options.host || 'localhost';
  const root = path.resolve(options.root || process.cwd());
  const outDir = path.resolve(root, options.outDir || 'dist');

  console.log(`[react-html] Performing initial build...`);
  await build({ ...options, minify: false });
  console.log(`[react-html] Build completed.`);

  // Setup file watcher with debounce
  let isRebuilding = false;
  let rebuildTimeout: NodeJS.Timeout | null = null;

  const triggerRebuild = () => {
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(async () => {
      if (isRebuilding) return;
      isRebuilding = true;
      try {
        console.log(`[react-html] Change detected, rebuilding...`);
        const startTime = Date.now();
        await build({ ...options, minify: false });
        console.log(`[react-html] Rebuild finished in ${Date.now() - startTime}ms`);
      } catch (err) {
        console.error(`[react-html] Rebuild error:`, err);
      } finally {
        isRebuilding = false;
      }
    }, 100);
  };

  const watchDirs = ['src', 'pages', 'public'].map(d => path.join(root, d)).filter(existsSync);
  for (const dir of watchDirs) {
    try {
      watch(dir, { recursive: true }, (event, filename) => {
        if (filename && !filename.includes('.react-html') && !filename.includes('dist')) {
          triggerRebuild();
        }
      });
    } catch {
      // Fallback
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${host}:${port}`);
      let pathname = decodeURIComponent(url.pathname);

      if (pathname.endsWith('/')) {
        pathname += 'index.html';
      }

      let filePath = path.join(outDir, pathname);

      // If no extension, check if an .html file exists
      if (!path.extname(filePath)) {
        if (existsSync(`${filePath}.html`)) {
          filePath = `${filePath}.html`;
        } else if (existsSync(path.join(filePath, 'index.html'))) {
          filePath = path.join(filePath, 'index.html');
        }
      }

      if (!existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`<h1>404 Not Found</h1><p>File not found: ${pathname}</p>`);
        return;
      }

      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      const content = await fs.readFile(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length
      });
      res.end(content);
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`500 Internal Server Error: ${err?.message || err}`);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log(`[react-html] Dev server running at http://${host}:${port}/`);
      resolve(server);
    });
  });
}

