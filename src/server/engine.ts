import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadPageModule } from '../core/loader.js';
import { renderPageToHtml } from '../core/renderer.js';
import { bundleIslands, ClientRuntime } from '../core/bundler.js';
import { IslandInstance } from '../core/island-registry.js';

export interface EngineOptions {
  /** Project root directory (default: process.cwd()) */
  root?: string;
  /** Source pages directory (default: 'src/pages' or 'pages') */
  pagesDir?: string;
  /** Production build output directory (default: 'dist') */
  distDir?: string;
  /** Static public directory (default: 'public') */
  publicDir?: string;
  /** Force production mode. If omitted, checks process.env.NODE_ENV === 'production' */
  isProduction?: boolean;
  /** Base asset URL prefix (default: '/') */
  basePath?: string;
  /** Client runtime for island hydration ('react' | 'preact', default: 'react') */
  clientRuntime?: ClientRuntime;
}

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
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

export class ReactHtmlEngine {
  public readonly root: string;
  public readonly pagesDir: string;
  public readonly distDir: string;
  public readonly publicDir: string;
  public readonly isProduction: boolean;
  public readonly basePath: string;
  public readonly clientRuntime: ClientRuntime;

  constructor(options: EngineOptions = {}) {
    this.root = path.resolve(options.root || process.cwd());
    this.isProduction =
      options.isProduction !== undefined
        ? options.isProduction
        : process.env.NODE_ENV === 'production';
    this.basePath = options.basePath || '/';
    this.clientRuntime = options.clientRuntime || 'react';

    // Resolve distDir
    this.distDir = path.resolve(this.root, options.distDir || 'dist');
    this.publicDir = path.resolve(this.root, options.publicDir || 'public');

    // Resolve pagesDir
    if (options.pagesDir) {
      this.pagesDir = path.resolve(this.root, options.pagesDir);
    } else {
      const candidates = ['src/pages', 'pages'];
      let found = path.join(this.root, 'src/pages');
      for (const cand of candidates) {
        const p = path.join(this.root, cand);
        if (existsSync(p)) {
          found = p;
          break;
        }
      }
      this.pagesDir = found;
    }
  }

  /**
   * Render a page by name or route.
   * - In production: checks for pre-built static HTML in dist/ first.
   * - In development: recompiles the TSX page on the fly and bundles any needed reactive islands.
   */
  public async render(
    pageRoute: string,
    props: Record<string, unknown> = {},
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    const cleanRoute = pageRoute.replace(/^\/+/, '').replace(/\.html$/, '');
    const normalizedName = cleanRoute === '' ? 'index' : cleanRoute;

    // In production, check for pre-built static HTML
    if (this.isProduction) {
      const candidatePaths = [
        path.join(this.distDir, `${normalizedName}.html`),
        path.join(this.distDir, normalizedName, 'index.html')
      ];

      for (const candidate of candidatePaths) {
        if (existsSync(candidate)) {
          return await fs.readFile(candidate, 'utf8');
        }
      }
    }

    // In development (or if production pre-build not found), compile on-the-fly
    const sourceFilePath = await this.resolveSourcePage(normalizedName);
    if (!sourceFilePath) {
      throw new Error(
        `[react-html] Page "${pageRoute}" not found in "${this.pagesDir}".`
      );
    }

    const { Component, metadata: pageMeta } = await loadPageModule(sourceFilePath);
    const mergedMetadata = { ...pageMeta, ...metadata };

    const { html, islands } = renderPageToHtml({
      pagePath: sourceFilePath,
      Component,
      props,
      metadata: mergedMetadata,
      basePath: this.basePath
    });

    // In development, bundle reactive islands on-the-fly into distDir/assets/islands
    if (islands.length > 0) {
      await bundleIslands(islands, {
        outDir: this.distDir,
        minify: this.isProduction,
        clientRuntime: this.clientRuntime
      });
    }

    return html;
  }

  /**
   * Universal Connect / Express / Node.js HTTP middleware.
   * Handles page routes and static assets according to environment mode.
   */
  public middleware = async (
    req: IncomingMessage,
    res: ServerResponse,
    next?: () => void
  ): Promise<void> => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(url.pathname);

    // 1. Check if request matches an asset in dist/ or public/
    const assetResponse = await this.tryServeStaticAsset(pathname);
    if (assetResponse) {
      res.writeHead(200, {
        'Content-Type': assetResponse.contentType,
        'Content-Length': assetResponse.content.length
      });
      res.end(assetResponse.content);
      return;
    }

    // 2. Normalize page route
    let route = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    if (route === '' || route.endsWith('.html')) {
      route = route.replace(/\.html$/, '') || 'index';
    }

    // 3. Try rendering the page
    try {
      // In production: check if dist HTML exists
      if (this.isProduction) {
        const candidatePaths = [
          path.join(this.distDir, `${route}.html`),
          path.join(this.distDir, route, 'index.html')
        ];
        for (const candidate of candidatePaths) {
          if (existsSync(candidate)) {
            const content = await fs.readFile(candidate);
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Length': content.length
            });
            res.end(content);
            return;
          }
        }
      } else {
        // In development: check if source page exists
        const sourcePath = await this.resolveSourcePage(route);
        if (sourcePath) {
          const html = await this.render(route);
          const buffer = Buffer.from(html, 'utf8');
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': buffer.length
          });
          res.end(buffer);
          return;
        }
      }
    } catch (err: any) {
      console.error(`[react-html] Engine rendering error for route "${pathname}":`, err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`500 Internal Server Error: ${err?.message || err}`);
      return;
    }

    // If not handled, pass to next middleware if available
    if (typeof next === 'function') {
      next();
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404 Not Found</h1><p>Route "${pathname}" not found.</p>`);
    }
  };

  /**
   * Standalone HTTP request handler suitable for http.createServer(engine.handle)
   */
  public handle = (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    return this.middleware(req, res);
  };

  private async resolveSourcePage(normalizedName: string): Promise<string | null> {
    const extensions = ['.tsx', '.jsx', '.ts', '.js'];
    const candidates = [
      ...extensions.map(ext => path.join(this.pagesDir, `${normalizedName}${ext}`)),
      ...extensions.map(ext => path.join(this.pagesDir, normalizedName, `index${ext}`))
    ];

    for (const cand of candidates) {
      if (existsSync(cand)) {
        return cand;
      }
    }
    return null;
  }

  private async tryServeStaticAsset(
    pathname: string
  ): Promise<{ content: Buffer; contentType: string } | null> {
    const ext = path.extname(pathname).toLowerCase();
    if (!ext || ext === '.html') return null;

    const cleanPath = pathname.replace(/^\/+/, '');
    const candidateFiles = [
      path.join(this.distDir, cleanPath),
      path.join(this.publicDir, cleanPath)
    ];

    for (const filePath of candidateFiles) {
      if (existsSync(filePath)) {
        try {
          const stat = await fs.stat(filePath);
          if (stat.isFile()) {
            const content = await fs.readFile(filePath);
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            return { content, contentType };
          }
        } catch {
          // Continue searching
        }
      }
    }
    return null;
  }
}

/**
 * Factory function to create a new ReactHtmlEngine instance
 */
export function createEngine(options: EngineOptions = {}): ReactHtmlEngine {
  return new ReactHtmlEngine(options);
}

