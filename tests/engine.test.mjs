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
});

