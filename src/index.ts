import fs from 'node:fs/promises';
import path from 'node:path';
import { loadPageModule, clearCache } from './core/loader.js';
import { renderPageToHtml } from './core/renderer.js';
import { bundleIslands } from './core/bundler.js';
import { IslandInstance } from './core/island-registry.js';

export { Island, island } from './core/island.js';
export type { IslandProps } from './core/island.js';
export { hydrateIsland } from './client/hydrate.js';
export { renderPageToHtml } from './core/renderer.js';
export { createEngine, ReactHtmlEngine } from './server/engine.js';
export type { EngineOptions } from './server/engine.js';

export interface BuildConfig {
  root?: string;
  pagesDir?: string;
  outDir?: string;
  publicDir?: string;
  minify?: boolean;
}

export interface BuildResult {
  pages: { input: string; output: string }[];
  islands: string[];
  outDir: string;
}

async function findFilesRecursively(dir: string, extensions: string[]): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findFilesRecursively(fullPath, extensions)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext) && !entry.name.startsWith('_') && !entry.name.includes('.test.')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

export async function build(config: BuildConfig = {}): Promise<BuildResult> {
  const root = path.resolve(config.root || process.cwd());
  const outDir = path.resolve(root, config.outDir || 'dist');
  const minify = config.minify ?? true;

  // Locate pages directory
  let pagesDir = config.pagesDir ? path.resolve(root, config.pagesDir) : '';
  if (!pagesDir) {
    const candidateDirs = ['src/pages', 'pages'];
    for (const cand of candidateDirs) {
      const p = path.join(root, cand);
      try {
        const stat = await fs.stat(p);
        if (stat.isDirectory()) {
          pagesDir = p;
          break;
        }
      } catch {
        // Continue checking
      }
    }
  }

  if (!pagesDir) {
    throw new Error(`Pages directory not found. Please create 'src/pages' or specify 'pagesDir'.`);
  }

  // Ensure output directory exists and is clean
  await fs.mkdir(outDir, { recursive: true });

  // Copy public static directory if present
  const publicDir = path.resolve(root, config.publicDir || 'public');
  try {
    const publicStat = await fs.stat(publicDir);
    if (publicStat.isDirectory()) {
      await fs.cp(publicDir, outDir, { recursive: true });
    }
  } catch {
    // Public directory optional
  }

  const pageFiles = await findFilesRecursively(pagesDir, ['.tsx', '.jsx', '.ts', '.js']);
  if (pageFiles.length === 0) {
    console.warn(`[react-html] No pages found in ${pagesDir}`);
  }

  const allDiscoveredIslands: IslandInstance[] = [];
  const processedPages: { input: string; output: string }[] = [];

  for (const pageFile of pageFiles) {
    const relativePage = path.relative(pagesDir, pageFile);
    const parsed = path.parse(relativePage);

    // Compute destination path: index.tsx -> index.html, about.tsx -> about.html
    const outHtmlFile = path.join(outDir, parsed.dir, `${parsed.name}.html`);
    await fs.mkdir(path.dirname(outHtmlFile), { recursive: true });

    // Load page module
    const { Component, metadata } = await loadPageModule(pageFile);

    // Render to pure HTML and extract islands
    const { html, islands } = renderPageToHtml({
      pagePath: pageFile,
      Component,
      metadata
    });

    await fs.writeFile(outHtmlFile, html, 'utf8');
    processedPages.push({ input: pageFile, output: outHtmlFile });

    if (islands.length > 0) {
      allDiscoveredIslands.push(...islands);
    }
  }

  // Bundle reactive islands
  let bundledIslands: string[] = [];
  if (allDiscoveredIslands.length > 0) {
    bundledIslands = await bundleIslands(allDiscoveredIslands, { outDir, minify });
  }

  // Cleanup compile cache
  await clearCache();

  return {
    pages: processedPages,
    islands: bundledIslands,
    outDir
  };
}

