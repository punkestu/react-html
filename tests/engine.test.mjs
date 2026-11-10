import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderPageToHtml, build, Island, island } from '../dist/index.js';

describe('react-html Engine Test Suite', () => {
  describe('Static HTML Rendering', () => {
    test('renders pure static component to HTML with zero script tags', () => {
      function StaticPage() {
        return React.createElement(
          'div',
          { className: 'hero' },
          React.createElement('h1', null, 'Hello Pure World'),
          React.createElement('p', null, 'This is pure static HTML without JS.')
        );
      }

      const result = renderPageToHtml({
        pagePath: '/test/page.tsx',
        Component: StaticPage,
        metadata: { title: 'Static Test' }
      });

      assert.ok(result.html.includes('<!DOCTYPE html>'));
      assert.ok(result.html.includes('<title>Static Test</title>'));
      assert.ok(result.html.includes('<h1>Hello Pure World</h1>') || result.html.includes('Hello Pure World'));
      assert.ok(!result.html.includes('<script'));
      assert.equal(result.islands.length, 0);
    });

    test('preserves full html document when component returns html tag', () => {
      function FullDoc() {
        return React.createElement(
          'html',
          { lang: 'fr' },
          React.createElement('head', null, React.createElement('title', null, 'French Page')),
          React.createElement('body', null, React.createElement('h1', null, 'Bonjour'))
        );
      }

      const result = renderPageToHtml({
        pagePath: '/test/french.tsx',
        Component: FullDoc
      });

      assert.ok(result.html.startsWith('<!DOCTYPE html>'));
      assert.ok(result.html.includes('<html lang="fr">'));
      assert.ok(result.html.includes('Bonjour'));
      assert.ok(!result.html.includes('<script'));
    });
  });

  describe('Reactive Island Architecture', () => {
    test('registers island and injects script tag for interactive component', () => {
      function MyCounter({ initial = 5 }) {
        return React.createElement('button', null, `Count: ${initial}`);
      }

      const InteractiveCounter = island(MyCounter, '/fake/path/Counter.tsx', 'MyCounter');

      function PageWithIsland() {
        return React.createElement(
          'main',
          null,
          React.createElement('h1', null, 'Island Page'),
          React.createElement(InteractiveCounter, { initial: 10 })
        );
      }

      const result = renderPageToHtml({
        pagePath: '/test/island-page.tsx',
        Component: PageWithIsland
      });

      assert.equal(result.islands.length, 1);
      assert.equal(result.islands[0].name, 'MyCounter');
      assert.deepEqual(result.islands[0].props, { initial: 10 });
      assert.ok(result.html.includes('data-island="MyCounter"'));
      assert.ok(result.html.includes('data-props="{&quot;initial&quot;:10}"'));
      assert.ok(result.html.includes('<script type="module" src="/assets/islands/MyCounter.js">'));
    });
  });

  describe('End-to-End Build Pipeline', () => {
    const testFixtureDir = path.resolve(process.cwd(), '.test-fixture');
    const outDir = path.join(testFixtureDir, 'dist');

    before(async () => {
      await fs.mkdir(path.join(testFixtureDir, 'src/pages'), { recursive: true });
      await fs.mkdir(path.join(testFixtureDir, 'src/components'), { recursive: true });

      // Create a pure static page
      await fs.writeFile(
        path.join(testFixtureDir, 'src/pages/pure.tsx'),
        `
        import React from 'react';
        export const title = "Pure Static";
        export default function Pure() {
          return <div><h1>Zero JS</h1></div>;
        }
        `
      );

      // Create an island component
      await fs.writeFile(
        path.join(testFixtureDir, 'src/components/Toggle.island.tsx'),
        `
        import React, { useState } from 'react';
        import { island } from '${path.resolve(process.cwd(), 'dist/index.js')}';
        function ToggleComp({ label = 'Click' }) {
          const [on, setOn] = useState(false);
          return <button onClick={() => setOn(!on)}>{label}: {on ? 'ON' : 'OFF'}</button>;
        }
        export const Toggle = island(ToggleComp, import.meta.url, 'Toggle');
        export default Toggle;
        `
      );

      // Create a page using the island
      await fs.writeFile(
        path.join(testFixtureDir, 'src/pages/interactive.tsx'),
        `
        import React from 'react';
        import { Toggle } from '../components/Toggle.island.js';
        export default function Interactive() {
          return <div><h1>Interactive</h1><Toggle label="Power" /></div>;
        }
        `
      );
    });

    after(async () => {
      await fs.rm(testFixtureDir, { recursive: true, force: true });
    });

    test('builds static pages and bundles reactive islands correctly', async () => {
      const result = await build({
        root: testFixtureDir,
        outDir: 'dist',
        minify: true
      });

      assert.equal(result.pages.length, 2);

      // Check pure static HTML output: absolutely NO script tags
      const pureHtml = await fs.readFile(path.join(outDir, 'pure.html'), 'utf8');
      assert.ok(pureHtml.includes('Zero JS'));
      assert.ok(!pureHtml.includes('<script'));

      // Check interactive page HTML output: has island markup & script tag
      const interactiveHtml = await fs.readFile(path.join(outDir, 'interactive.html'), 'utf8');
      assert.ok(interactiveHtml.includes('Interactive'));
      assert.ok(interactiveHtml.includes('data-island="Toggle"'));
      assert.ok(interactiveHtml.includes('<script type="module" src="/assets/islands/Toggle.js">'));

      // Check island JS bundle was generated
      const islandJsExists = await fs.stat(path.join(outDir, 'assets/islands/Toggle.js')).then(() => true).catch(() => false);
      assert.ok(islandJsExists, 'Toggle.js island bundle should exist in assets/islands');
    });
  });

  describe('Terminal Documentation (TUI)', () => {
    test('contains comprehensive documentation sections', async () => {
      const { DOC_SECTIONS } = await import('../dist/cli/docs-content.js');
      assert.ok(DOC_SECTIONS.length >= 8, 'Expected at least 8 doc sections');
      
      const ids = DOC_SECTIONS.map(s => s.id);
      assert.ok(ids.includes('intro'));
      assert.ok(ids.includes('islands'));
      assert.ok(ids.includes('directives'));
      assert.ok(ids.includes('cli'));
      assert.ok(ids.includes('troubleshooting'));
    });
  });

  describe('Island Auto-Discovery (Zero-Boilerplate)', () => {
    test('detects island files and extracts clean names', async () => {
      const { isIslandFile, getIslandName } = await import('../dist/index.js');
      assert.ok(isIslandFile('src/components/Counter.island.tsx'));
      assert.ok(isIslandFile('/project/islands/Modal.tsx'));
      assert.ok(isIslandFile('src/islands/dropdown-menu.jsx'));
      assert.ok(!isIslandFile('src/components/Header.tsx'));
      assert.ok(!isIslandFile('node_modules/pkg/Counter.island.tsx'));

      assert.equal(getIslandName('src/components/Counter.island.tsx'), 'Counter');
      assert.equal(getIslandName('islands/dropdown-menu.island.jsx'), 'DropdownMenu');
      assert.equal(getIslandName('src/islands/user_profile.tsx'), 'UserProfile');
    });

    test('auto-transforms pure export default function into an island', async () => {
      const { transformIslandSource } = await import('../dist/index.js');
      const input = `
import React, { useState } from 'react';
export default function Clicker({ start = 0 }) {
  const [val, setVal] = useState(start);
  return <button onClick={() => setVal(v => v + 1)}>{val}</button>;
}
      `;

      const transformed = transformIslandSource(input, '/app/src/components/Clicker.island.tsx');
      assert.ok(transformed.includes('__react_html_auto_island__'), 'Should include island wrapper');
      assert.ok(transformed.includes('"Clicker"'), 'Should infer island name');
      assert.ok(transformed.includes('export default __react_html_wrapped_island__'));
      assert.ok(transformed.includes('export { __react_html_wrapped_island__ as Clicker }'));
    });

    test('end-to-end build with pure export default island (zero boilerplate)', async () => {
      const autoFixtureDir = path.resolve(process.cwd(), '.auto-island-fixture');
      const outDir = path.join(autoFixtureDir, 'dist');

      try {
        await fs.mkdir(path.join(autoFixtureDir, 'src/pages'), { recursive: true });
        await fs.mkdir(path.join(autoFixtureDir, 'src/components'), { recursive: true });

        // Pure component with zero react-html imports or island() wrapping
        await fs.writeFile(
          path.join(autoFixtureDir, 'src/components/PureCounter.island.tsx'),
          `
          import React, { useState } from 'react';
          export default function PureCounter({ count = 10 }) {
            const [c, setC] = useState(count);
            return <button onClick={() => setC(n => n + 1)}>Auto Island: {c}</button>;
          }
          `
        );

        // Page importing it directly
        await fs.writeFile(
          path.join(autoFixtureDir, 'src/pages/index.tsx'),
          `
          import React from 'react';
          import PureCounter from '../components/PureCounter.island.js';
          export default function Index() {
            return <div><PureCounter count={42} /></div>;
          }
          `
        );

        const result = await build({
          root: autoFixtureDir,
          outDir: 'dist',
          minify: true
        });

        assert.equal(result.pages.length, 1);
        assert.equal(result.islands.length, 1);

        const html = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
        assert.ok(html.includes('data-island="PureCounter"'), 'HTML should have island container');
        assert.ok(html.includes('Auto Island: <!-- -->42'), 'HTML should have SSR pre-rendered content');
        assert.ok(html.includes('<script type="module" src="/assets/islands/PureCounter.js">'), 'Script should be injected');

        const bundleExists = await fs.stat(path.join(outDir, 'assets/islands/PureCounter.js')).then(() => true).catch(() => false);
        assert.ok(bundleExists, 'Client bundle should be generated');
      } finally {
        await fs.rm(autoFixtureDir, { recursive: true, force: true });
      }
    });

    test('multi-island code splitting produces tiny island bundles (< 2 KB)', async () => {
      const splitFixtureDir = path.resolve(process.cwd(), '.split-test-fixture');
      const outDir = path.join(splitFixtureDir, 'dist');

      try {
        await fs.mkdir(path.join(splitFixtureDir, 'src/pages'), { recursive: true });
        await fs.mkdir(path.join(splitFixtureDir, 'src/components'), { recursive: true });

        await fs.writeFile(
          path.join(splitFixtureDir, 'src/components/A.island.tsx'),
          `import React, { useState } from 'react'; export default function A() { const [v] = useState(1); return <div>{v}</div>; }`
        );
        await fs.writeFile(
          path.join(splitFixtureDir, 'src/components/B.island.tsx'),
          `import React, { useState } from 'react'; export default function B() { const [v] = useState(2); return <div>{v}</div>; }`
        );
        await fs.writeFile(
          path.join(splitFixtureDir, 'src/pages/index.tsx'),
          `import React from 'react'; import A from '../components/A.island.js'; import B from '../components/B.island.js'; export default function Page() { return <div><A /><B /></div>; }`
        );

        const result = await build({
          root: splitFixtureDir,
          outDir: 'dist',
          minify: true
        });

        assert.ok(result.islands.length >= 3, 'Should produce 2 island files + shared chunk');

        const statA = await fs.stat(path.join(outDir, 'assets/islands/A.js'));
        const statB = await fs.stat(path.join(outDir, 'assets/islands/B.js'));

        assert.ok(statA.size < 2048, `A.js should be under 2 KB, got ${statA.size} bytes`);
        assert.ok(statB.size < 2048, `B.js should be under 2 KB, got ${statB.size} bytes`);

        const chunkFiles = result.islands.filter(f => f.includes('chunks'));
        assert.ok(chunkFiles.length > 0, 'Shared vendor chunk should be generated');
      } finally {
        await fs.rm(splitFixtureDir, { recursive: true, force: true });
      }
    });

    test('clientRuntime: "preact" generates ultra-light framework chunk (< 35 KB)', async () => {
      const preactFixtureDir = path.resolve(process.cwd(), '.preact-test-fixture');
      const outDir = path.join(preactFixtureDir, 'dist');

      try {
        await fs.mkdir(path.join(preactFixtureDir, 'src/pages'), { recursive: true });
        await fs.mkdir(path.join(preactFixtureDir, 'src/components'), { recursive: true });

        await fs.writeFile(
          path.join(preactFixtureDir, 'src/components/WidgetA.island.tsx'),
          `import React, { useState } from 'react'; export default function WidgetA() { const [v] = useState('a'); return <div>{v}</div>; }`
        );
        await fs.writeFile(
          path.join(preactFixtureDir, 'src/components/WidgetB.island.tsx'),
          `import React, { useState } from 'react'; export default function WidgetB() { const [v] = useState('b'); return <div>{v}</div>; }`
        );
        await fs.writeFile(
          path.join(preactFixtureDir, 'src/pages/index.tsx'),
          `import React from 'react'; import WidgetA from '../components/WidgetA.island.js'; import WidgetB from '../components/WidgetB.island.js'; export default function Page() { return <div><WidgetA /><WidgetB /></div>; }`
        );

        const result = await build({
          root: preactFixtureDir,
          outDir: 'dist',
          minify: true,
          clientRuntime: 'preact'
        });

        const chunkFiles = result.islands.filter(f => f.includes('chunks'));
        assert.ok(chunkFiles.length > 0, 'Shared Preact chunk should be generated');

        const chunkStat = await fs.stat(chunkFiles[0]);
        // Preact total chunk is ~25 KB vs ~220 KB for React 19
        assert.ok(chunkStat.size < 35000, `Preact chunk should be under 35 KB, got ${chunkStat.size} bytes`);
      } finally {
        await fs.rm(preactFixtureDir, { recursive: true, force: true });
      }
    });
  });

  describe('Server Application Library (createEngine)', () => {
    const fixtureDir = path.resolve(process.cwd(), '.server-test-fixture');
    const pagesDir = path.join(fixtureDir, 'src/pages');
    const distDir = path.join(fixtureDir, 'dist');

    before(async () => {
      await fs.mkdir(pagesDir, { recursive: true });
      await fs.mkdir(distDir, { recursive: true });

      // Create pre-built production HTML in dist
      await fs.writeFile(
        path.join(distDir, 'index.html'),
        '<!DOCTYPE html><html><body><h1>PRE-BUILT PRODUCTION HTML</h1></body></html>'
      );

      // Create development source page in src/pages
      await fs.writeFile(
        path.join(pagesDir, 'index.tsx'),
        `
        import React from 'react';
        export default function Home() {
          return <h1>LIVE REBUILT DEV HTML</h1>;
        }
        `
      );
    });

    after(async () => {
      await fs.rm(fixtureDir, { recursive: true, force: true });
    });

    test('production mode: loads and returns pre-built static HTML from dist', async () => {
      const { createEngine } = await import('../dist/index.js');
      const engine = createEngine({
        root: fixtureDir,
        pagesDir,
        distDir,
        isProduction: true
      });

      const html = await engine.render('index');
      assert.ok(html.includes('PRE-BUILT PRODUCTION HTML'), 'Production should return pre-built dist HTML');
      assert.ok(!html.includes('LIVE REBUILT DEV HTML'));
    });

    test('development mode: dynamically rebuilds and returns fresh HTML string', async () => {
      const { createEngine } = await import('../dist/index.js');
      const engine = createEngine({
        root: fixtureDir,
        pagesDir,
        distDir,
        isProduction: false
      });

      const html = await engine.render('index');
      assert.ok(html.includes('LIVE REBUILT DEV HTML'), 'Development should rebuild from source TSX');
      assert.ok(!html.includes('PRE-BUILT PRODUCTION HTML'));

      // Modify the source file on the fly
      await fs.writeFile(
        path.join(pagesDir, 'index.tsx'),
        `
        import React from 'react';
        export default function Home() {
          return <h1>UPDATED LIVE IN DEV</h1>;
        }
        `
      );

      // Re-render: should reflect the immediate update without server restart!
      const updatedHtml = await engine.render('index');
      assert.ok(updatedHtml.includes('UPDATED LIVE IN DEV'), 'Dev mode should reflect immediate code edits');
    });

    test('middleware: serves request via connect/express-compatible middleware', async () => {
      const { createEngine } = await import('../dist/index.js');
      const engine = createEngine({
        root: fixtureDir,
        pagesDir,
        distDir,
        isProduction: true
      });

      let statusCode = 0;
      let headers = {};
      let body = '';

      const fakeReq = {
        url: '/',
        headers: { host: 'localhost:3000' }
      };

      const fakeRes = {
        writeHead(status, h) {
          statusCode = status;
          headers = h;
        },
        end(data) {
          body = data.toString();
        }
      };

      await engine.middleware(fakeReq, fakeRes);

      assert.equal(statusCode, 200);
      assert.equal(headers['Content-Type'], 'text/html; charset=utf-8');
      assert.ok(body.includes('PRE-BUILT PRODUCTION HTML'));
    });
  });

  describe('Vanilla DOM Islands (Zero-React Client Compilation)', () => {
    const vanillaFixtureDir = path.resolve(process.cwd(), '.vanilla-test-fixture');
    const outDir = path.join(vanillaFixtureDir, 'dist');

    before(async () => {
      await fs.mkdir(path.join(vanillaFixtureDir, 'src/pages'), { recursive: true });
      await fs.mkdir(path.join(vanillaFixtureDir, 'src/components'), { recursive: true });

      // 1. Vanilla DOM Island (export default JSX + export function client)
      await fs.writeFile(
        path.join(vanillaFixtureDir, 'src/components/VanillaClicker.island.tsx'),
        `
        import React from 'react';

        export default function VanillaClicker({ label = 'Clicks', start = 0 }: { label?: string; start?: number }) {
          return (
            <div className="vanilla-clicker">
              <span className="count-display">{start}</span>
              <button data-action="click">{label}</button>
            </div>
          );
        }

        export function client(el: HTMLElement, props: { label?: string; start?: number }) {
          let count = props.start || 0;
          const display = el.querySelector('.count-display');
          el.querySelector('[data-action="click"]')?.addEventListener('click', () => {
            count++;
            if (display) display.textContent = String(count);
          });
        }
        `
      );

      // 2. Standard React Island
      await fs.writeFile(
        path.join(vanillaFixtureDir, 'src/components/ReactCounter.island.tsx'),
        `
        import React, { useState } from 'react';

        export default function ReactCounter({ initial = 10 }: { initial?: number }) {
          const [val, setVal] = useState(initial);
          return <button onClick={() => setVal(v => v + 1)}>React: {val}</button>;
        }
        `
      );

      // 3. Page using both Vanilla DOM Island and React Island
      await fs.writeFile(
        path.join(vanillaFixtureDir, 'src/pages/index.tsx'),
        `
        import React from 'react';
        import VanillaClicker from '../components/VanillaClicker.island.js';
        import ReactCounter from '../components/ReactCounter.island.js';

        export default function IndexPage() {
          return (
            <div>
              <h1>Mixed Islands Page</h1>
              <VanillaClicker label="Tap Me" start={5} />
              <ReactCounter initial={100} />
            </div>
          );
        }
        `
      );
    });

    after(async () => {
      await fs.rm(vanillaFixtureDir, { recursive: true, force: true });
    });

    test('builds vanilla DOM island with zero React runtime and standalone bundle', async () => {
      const result = await build({
        root: vanillaFixtureDir,
        outDir: 'dist',
        minify: true
      });

      assert.equal(result.pages.length, 1);
      assert.ok(result.islands.length >= 2, 'Should generate bundles for both islands');

      // 1. Verify HTML output
      const html = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
      assert.ok(html.includes('data-island="VanillaClicker"'), 'HTML contains vanilla island markup');
      assert.ok(html.includes('data-island="ReactCounter"'), 'HTML contains react island markup');
      assert.ok(html.includes('<script type="module" src="/assets/islands/VanillaClicker.js">'));
      assert.ok(html.includes('<script type="module" src="/assets/islands/ReactCounter.js">'));

      // 2. Verify VanillaClicker bundle:
      const vanillaBundlePath = path.join(outDir, 'assets/islands/VanillaClicker.js');
      const vanillaContent = await fs.readFile(vanillaBundlePath, 'utf8');
      const vanillaStat = await fs.stat(vanillaBundlePath);

      // Bundle size should be tiny (< 1.5 KB uncompressed)
      assert.ok(vanillaStat.size < 1500, `Vanilla bundle should be < 1.5 KB, got ${vanillaStat.size} bytes`);

      // MUST NOT contain any imports (completely self-contained, 0 chunks)
      assert.ok(!vanillaContent.includes('import '), 'Vanilla bundle must not have import statements');
      assert.ok(!vanillaContent.includes('from "'), 'Vanilla bundle must not import from external modules');
      assert.ok(!vanillaContent.includes('from"'), 'Vanilla bundle must not import from external modules');

      // MUST NOT contain React / ReactDOM runtime
      assert.ok(!vanillaContent.includes('react-dom'), 'Must not reference react-dom');
      assert.ok(!vanillaContent.includes('hydrateRoot'), 'Must not reference hydrateRoot');
      assert.ok(!vanillaContent.includes('createElement'), 'Must not reference createElement');

      // 3. Verify ReactCounter bundle:
      const reactBundlePath = path.join(outDir, 'assets/islands/ReactCounter.js');
      const reactContent = await fs.readFile(reactBundlePath, 'utf8');
      // React island imports its chunk
      assert.ok(reactContent.includes('import'), 'React island bundle should import shared chunk');
    });
  });
});

