import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export interface LoadedPage {
  Component: React.ComponentType<any>;
  metadata?: {
    title?: string;
    description?: string;
    [key: string]: unknown;
  };
}

const CACHE_DIR = path.resolve(process.cwd(), '.react-html/cache');

// Plugin to replace import.meta.url with the real source file URL
const importMetaUrlPlugin: esbuild.Plugin = {
  name: 'preserve-import-meta-url',
  setup(build) {
    build.onLoad({ filter: /\.(tsx|ts|jsx|js)$/ }, async (args) => {
      if (args.path.includes('node_modules')) return null;
      let text = await fs.readFile(args.path, 'utf8');
      if (text.includes('import.meta.url')) {
        const fileUrl = pathToFileURL(args.path).href;
        text = text.replaceAll('import.meta.url', JSON.stringify(fileUrl));
        const ext = path.extname(args.path).slice(1);
        return {
          contents: text,
          loader: (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') ? (ext as any) : 'tsx'
        };
      }
      return null;
    });
  }
};

export async function loadPageModule(pageFilePath: string): Promise<LoadedPage> {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const resolvedPath = path.resolve(pageFilePath);
  const hash = crypto.createHash('sha256').update(resolvedPath).digest('hex').slice(0, 12);
  const cacheFilePath = path.join(CACHE_DIR, `page-${hash}.mjs`);

  // Build the page bundle for Node.js execution
  await esbuild.build({
    entryPoints: [resolvedPath],
    outfile: cacheFilePath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    packages: 'external',
    sourcemap: 'inline',
    plugins: [importMetaUrlPlugin],
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
      '.jsx': 'jsx',
      '.js': 'js',
      '.css': 'empty'
    }
  });

  // Dynamic import with timestamp cache buster
  const fileUrl = `${pathToFileURL(cacheFilePath).href}?t=${Date.now()}`;
  const importedModule = await import(fileUrl);

  const Component = importedModule.default;
  if (!Component) {
    throw new Error(`Page "${pageFilePath}" does not have a default export. Please provide "export default function Page()".`);
  }

  const { default: _, ...metadata } = importedModule;

  return {
    Component,
    metadata
  };
}

export async function clearCache(): Promise<void> {
  try {
    await fs.rm(CACHE_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cache cleanup errors
  }
}
