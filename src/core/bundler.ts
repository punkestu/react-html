import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IslandInstance } from './island-registry.js';

export interface BundlerOptions {
  outDir: string;
  minify?: boolean;
}

export async function bundleIslands(
  islands: IslandInstance[],
  options: BundlerOptions
): Promise<string[]> {
  const { outDir, minify = true } = options;
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

  const bundledFiles: string[] = [];

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

const raw = Module.default || Module[${JSON.stringify(name)}] || Module;
const Component = (raw && raw.__rawComponent) ? raw.__rawComponent : raw;

hydrateIsland(${JSON.stringify(name)}, Component);
`;
    await fs.writeFile(virtualEntryFile, virtualEntryCode, 'utf8');

    const outfile = path.join(islandsOutputDir, `${name}.js`);

    await esbuild.build({
      entryPoints: [virtualEntryFile],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      minify,
      treeShaking: true,
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      alias: {
        'react-html': islandClientPath
      },
      plugins: [
        {
          name: 'redirect-react-html-imports',
          setup(build) {
            // Redirect any import of react-html or root index to island-client
            build.onResolve({ filter: /(react-html|(\/|\\)(src|dist)(\/|\\)index(\.js|\.mjs|\.ts)?)$/ }, () => {
              return { path: islandClientPath };
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
      }
    });

    bundledFiles.push(outfile);
  }

  // Cleanup virtual entry files
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup error
  }

  return bundledFiles;
}
