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

  const entryPoints: Record<string, string> = {};

  for (const [name, island] of uniqueIslandsMap.entries()) {
    let resolvedEntry = island.entryPath;
    if (resolvedEntry.startsWith('file://')) {
      resolvedEntry = fileURLToPath(resolvedEntry);
    } else {
      resolvedEntry = path.resolve(resolvedEntry);
    }

    try {
      await fs.access(resolvedEntry);
    } catch {
      console.warn(`[react-html] Warning: Island source file not found for "${name}" at "${resolvedEntry}". Skipping client bundle.`);
      continue;
    }

    // Create a virtual client entrypoint for this island
    const virtualEntryFile = path.join(tempDir, `${name}.entry.ts`);
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
    entryPoints[name] = virtualEntryFile;
  }

  if (Object.keys(entryPoints).length === 0) {
    return [];
  }

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

  const buildResult = await esbuild.build({
    entryPoints,
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
          // Redirect any import of react-html or root index to island-client
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

  const bundledFiles: string[] = [];
  if (buildResult.metafile) {
    for (const outPath of Object.keys(buildResult.metafile.outputs)) {
      bundledFiles.push(path.resolve(process.cwd(), outPath));
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
