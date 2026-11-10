import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IslandInstance } from './island-registry.js';

export type ClientRuntime = 'react' | 'preact';

export interface BundlerOptions {
  outDir: string;
  minify?: boolean;
  clientRuntime?: ClientRuntime;
}

export async function bundleIslands(
  islands: IslandInstance[],
  options: BundlerOptions
): Promise<string[]> {
  const { outDir, minify = true, clientRuntime = 'react' } = options;
  const islandsOutputDir = path.join(outDir, 'assets', 'islands');
  await fs.mkdir(islandsOutputDir, { recursive: true });

  const tempDir = path.resolve(process.cwd(), '.react-html/temp-islands');
  await fs.mkdir(tempDir, { recursive: true });

  const uniqueIslandsMap = new Map<string, IslandInstance>();
  for (const island of islands) {
    if (!uniqueIslandsMap.has(island.name)) {
      uniqueIslandsMap.set(island.name, island);
    }
  }

  if (uniqueIslandsMap.size === 0) {
    return [];
  }

  // Locate hydrate module
  const currentDir = import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));
  let hydratePath = path.resolve(currentDir, '../client/hydrate.js');
  if (!existsSync(hydratePath)) {
    hydratePath = path.resolve(currentDir, '../client/hydrate.ts');
  }

  let islandClientPath = path.resolve(currentDir, './island-client.js');
  if (!existsSync(islandClientPath)) {
    islandClientPath = path.resolve(currentDir, './island-client.ts');
  }

  const vanillaEntries: Record<string, string> = {};
  const reactEntries: Record<string, string> = {};

  for (const [name, island] of uniqueIslandsMap.entries()) {
    let resolvedEntry = island.entryPath;
    if (resolvedEntry.startsWith('file://')) {
      resolvedEntry = fileURLToPath(resolvedEntry);
    } else {
      resolvedEntry = path.resolve(resolvedEntry);
    }

    let fileContent = '';
    try {
      fileContent = await fs.readFile(resolvedEntry, 'utf8');
    } catch {
      console.warn(`[react-html] Warning: Island source file not found for "${name}" at "${resolvedEntry}". Skipping client bundle.`);
      continue;
    }

    // Check if the island exports a vanilla DOM client function
    const isVanilla = /\bexport\s+(function|const|let|var)\s+client\b/.test(fileContent);

    const virtualEntryFile = path.join(tempDir, `${name}.entry.ts`);

    if (isVanilla) {
      // Pure Vanilla DOM Island entrypoint
      const virtualEntryCode = `
import { client } from ${JSON.stringify(resolvedEntry)};

function init() {
  document.querySelectorAll(${JSON.stringify(`[data-island="${name}"]`)}).forEach((el) => {
    if (el.hasAttribute('data-hydrated')) return;

    const rawProps = el.getAttribute('data-props');
    let props = {};
    if (rawProps) {
      try { props = JSON.parse(rawProps); } catch (e) {}
    }

    const directive = el.getAttribute('data-client') || 'load';
    const doMount = () => {
      if (el.hasAttribute('data-hydrated')) return;
      el.setAttribute('data-hydrated', 'true');
      client(el as HTMLElement, props);
    };

    switch (directive) {
      case 'idle': {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(doMount);
        } else {
          setTimeout(doMount, 200);
        }
        break;
      }
      case 'visible': {
        if ('IntersectionObserver' in window) {
          const obs = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                observer.disconnect();
                doMount();
              }
            });
          });
          obs.observe(el);
        } else {
          doMount();
        }
        break;
      }
      case 'load':
      default: {
        if (document.readyState === 'loading') {
          window.addEventListener('DOMContentLoaded', doMount, { once: true });
        } else {
          doMount();
        }
        break;
      }
    }
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
`;
      await fs.writeFile(virtualEntryFile, virtualEntryCode, 'utf8');
      vanillaEntries[name] = virtualEntryFile;
    } else {
      // React / Preact Island entrypoint
      const virtualEntryCode = `
import React from 'react';
import { hydrateIsland } from ${JSON.stringify(hydratePath)};
import * as Module from ${JSON.stringify(resolvedEntry)};

const mod: Record<string, any> = { ...Module };
const raw = mod.default ?? mod[${JSON.stringify(name)}] ?? mod;
const Component = (raw && raw.__rawComponent) ? raw.__rawComponent : raw;

hydrateIsland(${JSON.stringify(name)}, Component);
`;
      await fs.writeFile(virtualEntryFile, virtualEntryCode, 'utf8');
      reactEntries[name] = virtualEntryFile;
    }
  }

  const bundledFiles: string[] = [];

  // 1. Bundle Vanilla Islands: completely stub React so ZERO bytes of React/VDOM are included!
  if (Object.keys(vanillaEntries).length > 0) {
    const vanillaResult = await esbuild.build({
      entryPoints: vanillaEntries,
      outdir: islandsOutputDir,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      minify,
      treeShaking: true,
      legalComments: 'none',
      plugins: [
        {
          name: 'stub-react-for-vanilla',
          setup(build) {
            // Stub react, react/jsx-runtime and react-html
            build.onResolve({ filter: /^(react|react\/.*|react-html|@punkestu\/react-html)$/ }, (args) => {
              return { path: args.path, namespace: 'vanilla-empty-stub' };
            });
            build.onLoad({ filter: /.*/, namespace: 'vanilla-empty-stub' }, () => {
              return {
                contents: 'export default {}; export const jsx = () => {}; export const jsxs = () => {}; export const Fragment = ""; export function island(c){return c;}',
                loader: 'js'
              };
            });
          }
        }
      ],
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.css': 'empty'
      },
      metafile: true
    });

    if (vanillaResult.metafile) {
      for (const outPath of Object.keys(vanillaResult.metafile.outputs)) {
        bundledFiles.push(path.resolve(process.cwd(), outPath));
      }
    }
  }

  // 2. Bundle React / Preact Islands with ESM code splitting
  if (Object.keys(reactEntries).length > 0) {
    const alias: Record<string, string> = {
      'react-html': islandClientPath,
      ...(clientRuntime === 'preact'
        ? {
            react: 'preact/compat',
            'react-dom/client': 'preact/compat/client',
            'react-dom': 'preact/compat'
          }
        : {})
    };

    const reactResult = await esbuild.build({
      entryPoints: reactEntries,
      outdir: islandsOutputDir,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      splitting: true,
      chunkNames: 'chunks/[name]-[hash]',
      minify,
      treeShaking: true,
      legalComments: 'none',
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      alias,
      plugins: [
        {
          name: 'redirect-react-html-imports',
          setup(build) {
            build.onResolve(
              { filter: /(react-html|@punkestu\/react-html|(\/|\\)(src|dist)(\/|\\)index(\.js|\.mjs|\.ts)?)$/ },
              () => {
                return { path: islandClientPath };
              }
            );
          }
        }
      ],
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.css': 'empty'
      },
      metafile: true
    });

    if (reactResult.metafile) {
      for (const outPath of Object.keys(reactResult.metafile.outputs)) {
        bundledFiles.push(path.resolve(process.cwd(), outPath));
      }
    }
  }

  // Cleanup virtual entry files
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup error
  }

  return bundledFiles;
}
