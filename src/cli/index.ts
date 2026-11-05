import path from 'node:path';
import { build } from '../index.js';
import { createDevServer } from '../server/dev-server.js';
import { launchDocsTui } from './tui-docs.js';

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  const command = args[0] || 'help';

  function getArgValue(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  }

  const hasFlag = (flag: string) => args.includes(flag);

  if (hasFlag('--help') || hasFlag('-h') || command === 'help') {
    console.log(`
react-html - Engine to convert React to pure HTML with reactive islands

Usage:
  react-html <command> [options]

Commands:
  build         Compile pages into pure HTML & bundle reactive islands
  dev           Start live preview development server with auto-rebuild
  docs          Browse interactive documentation in Terminal UI (TUI)
  help          Show this help message

Options:
  --pages <dir>     Pages directory (default: src/pages or pages)
  --out <dir>       Output directory (default: dist)
  --port <number>   Dev server port (default: 3000)
  --host <string>   Dev server host (default: localhost)
  --no-minify       Disable minification for island bundles
  --root <path>     Project root directory (default: cwd)

Docs Options:
  react-html docs              Launch interactive Terminal UI
  react-html docs --all        Print complete manual to terminal
  react-html docs <section>    Print a specific section (e.g. islands, api, cli)
`);
    return;
  }

  if (hasFlag('--version') || hasFlag('-v')) {
    console.log(`react-html v0.1.0`);
    return;
  }

  const root = getArgValue('--root') || process.cwd();
  const pagesDir = getArgValue('--pages');
  const outDir = getArgValue('--out') || 'dist';
  const minify = !hasFlag('--no-minify');

  if (command === 'build') {
    console.log(`\n🚀 [react-html] Building static site...`);
    const startTime = Date.now();
    try {
      const result = await build({
        root,
        pagesDir,
        outDir,
        minify
      });
      console.log(`✅ [react-html] Build successful in ${Date.now() - startTime}ms`);
      console.log(`📄 Pages compiled (${result.pages.length}):`);
      result.pages.forEach(p => {
        console.log(`   - ${path.relative(root, p.output)}`);
      });
      if (result.islands.length > 0) {
        console.log(`🏝️  Reactive islands bundled (${result.islands.length}):`);
        result.islands.forEach(isl => {
          console.log(`   - ${path.relative(root, isl)}`);
        });
      } else {
        console.log(`✨ Pure 100% HTML generated (0 KB JavaScript overhead)`);
      }
    } catch (err: any) {
      console.error(`❌ [react-html] Build failed:`, err?.message || err);
      process.exit(1);
    }
  } else if (command === 'dev') {
    const port = parseInt(getArgValue('--port') || '3000', 10);
    const host = getArgValue('--host') || 'localhost';
    try {
      await createDevServer({
        root,
        pagesDir,
        outDir,
        port,
        host
      });
    } catch (err: any) {
      console.error(`❌ [react-html] Dev server failed:`, err?.message || err);
      process.exit(1);
    }
  } else if (command === 'docs') {
    try {
      await launchDocsTui(args[1]);
    } catch (err: any) {
      console.error(`❌ [react-html] Docs error:`, err?.message || err);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command "${command}". Run "react-html --help" for available commands.`);
    process.exit(1);
  }
}

// Direct invocation check
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
