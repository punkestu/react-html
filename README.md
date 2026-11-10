# react-html ⚛️ ➡️ 📄

A blazing-fast engine to convert React/JSX components into **pure, semantic HTML** with selective compilation of interactive components into **micro JavaScript islands**.

Write DRY, modular HTML using React components without shipping any React runtime or JavaScript to the client by default.

---

## 🌟 Why react-html?

- **Zero-JS by Default**: Static pages are rendered to 100% pure HTML. No client-side React runtime, no `<script>` tags, and 0 KB JavaScript overhead.
- **Modular & DRY**: Stop duplicating headers, footers, meta tags, and layouts. Build reusable components (`<Layout>`, `<Header>`, `<Card>`, `<Footer>`) using familiar React JSX syntax.
- **Selective Reactivity (Islands Architecture)**: When a component needs client-side interactivity (counters, modals, tabs, forms), the engine bundles only that component into a standalone, micro ESM script using `esbuild`.
- **Fast Build Pipeline**: Powered by `esbuild` for instantaneous static site generation and sub-100ms builds.
- **Node.js Native**: Runs strictly on standard Node.js (v20+) with npm.

---

## 🚀 Quick Start

### Installation

```bash
npm install react-html
```

Or install globally / link locally:

```bash
npm link
```

### CLI Usage

```bash
# Build static site to dist/ (with code splitting, islands are ~800 B each)
react-html build

# Ultra-light Preact mode (drops total framework chunk to ~24 KB!)
react-html build --preact

# Build with custom pages or output directory
react-html build --pages src/pages --out dist

# Start dev server with watch & live recompile
react-html dev --port 3000
```

---

## 📖 How It Works

### 1. Pure Modular HTML (Zero JavaScript)

Create your reusable layout and page components using standard JSX:

```tsx
// src/components/Layout.tsx
import React, { ReactNode } from 'react';

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <header>
          <h1>My Modular Site</h1>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

```tsx
// src/pages/about.tsx
import React from 'react';
import { Layout } from '../components/Layout.js';

export default function AboutPage() {
  return (
    <Layout title="About Us">
      <h2>About Our Project</h2>
      <p>This entire page compiles into pure static HTML with 0 KB JavaScript!</p>
    </Layout>
  );
}
```

**Output in `dist/about.html`:**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>About Us</title>
    <link rel="stylesheet" href="/styles.css"/>
  </head>
  <body>
    <header>
      <h1>My Modular Site</h1>
    </header>
    <main>
      <h2>About Our Project</h2>
      <p>This entire page compiles into pure static HTML with 0 KB JavaScript!</p>
    </main>
  </body>
</html>
```

---

### 2. Reactive Components (Island Auto-Discovery)

When a component needs client-side state and interactivity, simply name the file `*.island.tsx` (or place it inside an `islands/` directory) and **export default** your pure React component. Zero wrapping required!

```tsx
// src/components/Counter.island.tsx (or src/islands/Counter.tsx)
import React, { useState } from 'react';

export default function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial);

  return (
    <div className="counter">
      <button onClick={() => setCount(c => c - 1)}>-</button>
      <span>Count: {count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}
```

Now import and use it in any page just like a normal React component:

```tsx
// src/pages/index.tsx
import React from 'react';
import { Layout } from '../components/Layout.js';
import Counter from '../components/Counter.island.js';

export default function HomePage() {
  return (
    <Layout title="Home">
      <h2>Welcome!</h2>
      {/* Pre-rendered to HTML for instant paint, then hydrated with tiny JS */}
      <Counter initial={10} />
    </Layout>
  );
}
```

> 💡 **Manual Island Wrapping (Optional)**: If you prefer explicit wrapping or have dynamic component references, `island(Component, import.meta.url, 'Name')` and `<Island component={...} />` are also supported for full backward compatibility.

**What the engine does:**
1. Renders the initial static markup during SSR for instant paint.
2. Compiles a dedicated micro-bundle `dist/assets/islands/Counter.js`.
3. Injects `<script type="module" src="/assets/islands/Counter.js"></script>` into `index.html`.
4. Hydrates only the island element in-place using React 19's `hydrateRoot`.

---

### 3. Pure Vanilla DOM Islands (Zero-React Client Compilation)

Want client-side interactivity but **zero React or VDOM runtime on the client**?

You can write standard React JSX on the server for DRY markup, and export a native `client(element, props)` controller function in the same island file:

```tsx
// src/components/VanillaCounter.island.tsx
import React from 'react';

// 1. Server: Pure modular HTML via standard React JSX
export default function VanillaCounter({ initialCount = 0, step = 1 }: { initialCount?: number; step?: number }) {
  return (
    <div className="counter-box">
      <span className="counter-value">{initialCount}</span>
      <button data-action="dec">- {step}</button>
      <button data-action="inc">+ {step}</button>
    </div>
  );
}

// 2. Client: Pure native DOM controller (Zero React/VDOM runtime!)
export function client(el: HTMLElement, props: { initialCount?: number; step?: number }) {
  let count = props.initialCount || 0;
  const step = props.step || 1;
  const display = el.querySelector('.counter-value');

  el.querySelector('[data-action="dec"]')?.addEventListener('click', () => {
    count -= step;
    if (display) display.textContent = String(count);
  });

  el.querySelector('[data-action="inc"]')?.addEventListener('click', () => {
    count += step;
    if (display) display.textContent = String(count);
  });
}
```

**Why this is huge:**
- **0 KB React, 0 KB ReactDOM, 0 KB Preact**: The engine completely stubs React in the client bundle.
- **Zero Chunk Imports**: Outputs a single, self-contained standalone `.js` file (~1 KB uncompressed, ~450 bytes gzipped).
- **Zero Hydration Overhead**: Bypasses VDOM reconciliation and binds native event listeners directly to existing DOM nodes.
- **Mix & Match**: You can use Pure Vanilla DOM islands and standard React/Preact islands in the very same project without conflict!

---

## 🛠️ Hydration Directives

`react-html` supports client loading directives to maximize performance:

| Directive | Syntax | Behavior |
| :--- | :--- | :--- |
| `load` (default) | `<Counter client="load" />` | Hydrates immediately on DOM ready |
| `idle` | `<Counter client="idle" />` | Hydrates during browser idle time (`requestIdleCallback`) |
| `visible` | `<Counter client="visible" />` | Hydrates when scrolled into view (`IntersectionObserver`) |

---

## ⚡ Tiny Island Bundles & Preact Ultra-Light Mode

`react-html` uses ESM multi-entry code splitting and comment stripping to keep island bundles tiny:

- **Code Splitting by Default**: Component logic is separated from runtime code. `Counter.js` and `Tabs.js` weigh only **~800 bytes to 1 KB** each, importing a shared vendor chunk that the browser caches across all pages.
- **Ultra-Light Preact Mode (`--preact`)**: Want microscopic client bundles? Pass `--preact` to alias client hydration to `preact/compat`. You still write standard React JSX, but the shared runtime shrinks by **90%** down to **~24 KB uncompressed (~8 KB gzipped)**!

```bash
# Build with Preact ultra-light runtime
react-html build --preact
```

---

## 💻 Programmatic API

You can also run `react-html` programmatically from your Node.js scripts:

```ts
import { build } from 'react-html';

const result = await build({
  root: process.cwd(),
  pagesDir: 'src/pages',
  outDir: 'dist',
  minify: true
});

console.log(`Compiled ${result.pages.length} pages and ${result.islands.length} reactive islands.`);
```

---

## 🧪 Testing

Run the automated test suite powered by Node.js test runner:

```bash
npm test
```

---

## 🚢 CI/CD & Automated Publishing

This repository includes a GitHub Actions workflow (`.github/workflows/publish.yml`) that automatically tests, builds, and publishes the package to npm whenever changes are pushed to the `main` branch.

### How It Works
1. Runs on every `push` to `main` (and via manual `workflow_dispatch`).
2. Checks out the code and sets up Node.js 22.
3. Installs dependencies (`npm ci`), runs the test suite (`npm test`), and builds the package (`npm run build`).
4. **Idempotent check**: Inspects whether the local `package.json` version is already published on npm.
   - If the version has already been published, publishing is safely skipped without failing the pipeline.
   - If a new version is detected, it runs `npm publish --access public --provenance`.

### Setup Requirements (Repository Secrets)
To enable automated publishing, configure the `NPM_TOKEN` secret in GitHub:
1. Generate an npm access token on [npmjs.com](https://www.npmjs.com) (Account Settings -> **Access Tokens** -> **Generate New Token** with **Automation** or granular package write permissions).
2. Go to your GitHub repository: **Settings** -> **Secrets and variables** -> **Actions**.
3. Click **New repository secret**, name it `NPM_TOKEN`, and paste your token value.

### Releasing a New Version
To publish a new version to npm:
```bash
# Bump version (patch, minor, or major)
npm version patch

# Push the commit and tag to main
git push origin main --follow-tags
```
The GitHub Actions workflow will automatically verify tests and publish the new release to npm.

---

## 📄 License

MIT

