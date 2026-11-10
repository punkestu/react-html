# 📖 react-html Complete Manual & Documentation

A high-performance static engine to compile React/JSX to **pure, semantic HTML** with selective reactive compilation for interactive components via an **Islands Architecture**.

> 💡 **Terminal UI Access**: You can also browse this documentation interactively in your terminal by running:
> ```bash
> npx react-html docs
> # Or print a specific section:
> npx react-html docs islands
> ```

---

## Table of Contents

1. [Overview & Philosophy](#1-overview--philosophy)
2. [Getting Started & Setup](#2-getting-started--setup)
3. [Modular HTML with React](#3-modular-html-with-react)
4. [Reactive Islands Architecture](#4-reactive-islands-architecture-auto-discovery)
5. [Pure Vanilla DOM Islands (Zero-React Client)](#5-pure-vanilla-dom-islands-zero-react-client)
6. [Hydration Directives](#6-hydration-directives)
7. [Island Size Optimization (Code Splitting & Preact)](#7-island-size-optimization-code-splitting--preact)
8. [CLI Commands & Options](#8-cli-commands--options)
9. [Programmatic API Reference](#9-programmatic-api-reference)
10. [Server App Integration (Express, Fastify, Node HTTP)](#10-server-app-integration-express-fastify-node-http)
11. [Best Practices & Troubleshooting](#11-best-practices--troubleshooting)

---

## 1. Overview & Philosophy

Modern web development often forces a painful choice:
- **Write raw HTML/handlebars/nunjucks**: You lose type safety, component modularity, and rich JSX composition.
- **Use modern React frameworks (Next.js, CRA, Remix)**: You inadvertently ship massive megabytes of JavaScript, client routers, and heavy hydration runtimes even for mostly static pages.

**`react-html` gives you the best of both worlds**:
1. **Zero JavaScript by Default**:
   Pages without interactive islands output 100% pure, clean HTML5. No client-side React runtime, no `data-reactroot` attributes, and 0 KB JavaScript sent to visitors.
2. **Modular & DRY Components**:
   Compose your pages with `<Layout>`, `<Header>`, `<Card>`, `<Footer>`, loops, and conditionals using standard React and TypeScript.
3. **Selective Reactivity**:
   Interactive components (counters, carousels, modals, filters) are marked as **Islands**. The engine pre-renders their initial markup for instant paint and bundles only that component into a standalone client script using `esbuild`.

---

## 2. Getting Started & Setup

### Prerequisites
- Standard **Node.js v20.0.0 or higher** with `npm` (no Bun dependencies).

### Installation
```bash
npm install react-html
```

Or clone and link locally:
```bash
git clone https://github.com/microapes/react-html.git
cd react-html
npm install
npm run build
npm link
```

### Recommended Directory Structure

```text
my-project/
├── package.json
├── public/                     # Static files copied to dist/ verbatim
│   ├── favicon.ico
│   └── styles.css
└── src/
    ├── components/             # Reusable modular UI components
    │   ├── Layout.tsx          # Master HTML wrapper (<head>, <body>)
    │   ├── Header.tsx          # Navigation header
    │   ├── Footer.tsx          # Footer component
    │   └── Counter.island.tsx  # Interactive island component
    └── pages/                  # Page entrypoints
        ├── index.tsx           # -> dist/index.html
        ├── about.tsx           # -> dist/about.html
        └── docs/
            └── guide.tsx       # -> dist/docs/guide.html
```

---

## 3. Modular HTML with React

Eliminate repetitive HTML across your project by creating reusable layout components:

```tsx
// src/components/Layout.tsx
import React, { ReactNode } from 'react';
import { Header } from './Header.js';
import { Footer } from './Footer.js';

export interface LayoutProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export function Layout({
  title = 'Default Title',
  description = 'My static site',
  children
}: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <Header />
        <main className="container">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

Now, every page simply wraps its content without repeating `<head>`, stylesheets, or `<header>`/`<footer>`:

```tsx
// src/pages/about.tsx
import React from 'react';
import { Layout } from '../components/Layout.js';

export const title = 'About Us';

export default function AboutPage() {
  return (
    <Layout title={title}>
      <h1>About Our Project</h1>
      <p>This entire page compiles into pure static HTML with 0 KB JavaScript!</p>
    </Layout>
  );
}
```

---

## 4. Reactive Islands Architecture (Auto-Discovery)

When a component needs client-side state (`useState`, `useEffect`, event listeners):

### Zero-Boilerplate Island Auto-Discovery

Simply name your file `*.island.tsx` (or place it in an `islands/` directory) and **export default** your standard React component:

```tsx
// src/components/Counter.island.tsx (or src/islands/Counter.tsx)
import React, { useState } from 'react';

export interface CounterProps {
  initialCount?: number;
  step?: number;
}

export default function Counter({ initialCount = 0, step = 1 }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="counter">
      <p>Current: {count}</p>
      <button onClick={() => setCount(c => c - step)}>- {step}</button>
      <button onClick={() => setCount(c => c + step)}>+ {step}</button>
    </div>
  );
}
```

The engine automatically discovers the island, infers its name, and prepares it for server rendering and client hydration.

### Step 2: Use in Any Page

```tsx
// src/pages/index.tsx
import React from 'react';
import { Layout } from '../components/Layout.js';
import Counter from '../components/Counter.island.js';
// Named import also works: import { Counter } from '../components/Counter.island.js';

export default function HomePage() {
  return (
    <Layout title="Home">
      <h1>Interactive Page</h1>
      {/* Pre-rendered to HTML for instant paint, then hydrated with tiny JS */}
      <Counter initialCount={10} step={2} />
    </Layout>
  );
}
```

> 💡 **Manual Island Wrapping**: You can also manually wrap components using `island(MyComponent, import.meta.url, 'MyComponent')` or use the `<Island component={...} />` wrapper if desired. Both approaches are fully supported.

### What Happens Behind the Scenes:
1. **Server Phase**: The island is pre-rendered with `renderToString` and placed inside a container `<div data-island="Counter" data-props="...">`.
2. **Bundler Phase**: `esbuild` extracts and bundles only `CounterComponent` into `dist/assets/islands/Counter.js`.
3. **Injection Phase**: `<script type="module" src="/assets/islands/Counter.js"></script>` is injected right before `</body>`.
4. **Client Hydration**: The script queries `[data-island="Counter"]` and attaches listeners using React 19's `hydrateRoot`.

---

## 5. Pure Vanilla DOM Islands (Zero-React Client)

If you love authoring layouts and components in React JSX on the server, but want **absolute zero React/VDOM runtime on the client**, you can build a **Pure Vanilla DOM Island**!

### How to Author a Vanilla Island

In your island file, provide both:
1. `export default function`: The standard React JSX markup rendered on the server into pure HTML.
2. `export function client(element, props)`: A pure native DOM controller that attaches event listeners directly to the DOM.

```tsx
// src/components/VanillaCounter.island.tsx
import React from 'react';

// Server-side: React JSX for modular HTML composition
export default function VanillaCounter({ initialCount = 0, step = 1 }: { initialCount?: number; step?: number }) {
  return (
    <div className="counter-box">
      <span className="counter-value">{initialCount}</span>
      <div className="actions">
        <button data-action="dec">- {step}</button>
        <button data-action="reset">Reset</button>
        <button data-action="inc">+ {step}</button>
      </div>
    </div>
  );
}

// Client-side: Pure native DOM controller (No React/VDOM bundled!)
export function client(el: HTMLElement, props: { initialCount?: number; step?: number }) {
  let count = props.initialCount || 0;
  const step = props.step || 1;
  const display = el.querySelector('.counter-value');

  el.querySelector('[data-action="dec"]')?.addEventListener('click', () => {
    count -= step;
    if (display) display.textContent = String(count);
  });

  el.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    count = 0;
    if (display) display.textContent = '0';
  });

  el.querySelector('[data-action="inc"]')?.addEventListener('click', () => {
    count += step;
    if (display) display.textContent = String(count);
  });
}
```

### Key Advantages
- **0 KB React / 0 KB ReactDOM / 0 KB Preact**: React is completely stubbed out during the client build pass.
- **Zero Framework Chunks**: Generates a self-contained, standalone `.js` file with 0 chunk imports (~1.2 KB uncompressed, ~450 B gzipped).
- **Zero VDOM Overhead**: Directly binds native event listeners to existing server-rendered HTML nodes with zero hydration lag.
- **Directives Supported**: Directives (`client="load"`, `client="idle"`, `client="visible"`) execute the `client` function at the exact right moment.

---

## 6. Hydration Directives

Fine-tune client performance using the `client` prop:

| Directive | Code Example | When It Hydrates |
| :--- | :--- | :--- |
| `load` *(default)* | `<Counter client="load" />` | Immediately upon `DOMContentLoaded`. Ideal for primary UI. |
| `idle` | `<Counter client="idle" />` | During browser idle time via `requestIdleCallback`. Ideal for background widgets. |
| `visible` | `<Counter client="visible" />` | When scrolled into view via `IntersectionObserver`. Ideal for below-the-fold content. |

---

## 7. Island Size Optimization (Code Splitting & Preact)

By default, `react-html` optimizes your client-side bundles using two strategies:

### 1. Multi-Entry Code Splitting (Default)
When bundling islands, `esbuild` performs a single multi-entry compilation pass with `splitting: true`.
- Component-specific code (`Counter.js`, `Tabs.js`) drops down to **~800 bytes to 1 KB** each!
- Common runtime code is extracted into a shared chunk (`chunks/chunk-[hash].js`).
- The browser downloads the framework chunk once and caches it across all pages and islands.

### 2. Preact Ultra-Light Mode (`--preact`)
If you want ultra-compact bundles for mobile or low-bandwidth environments, you can enable Preact mode:

```bash
# Build with Preact ultra-light client runtime (~24 KB total chunk!)
react-html build --preact
```

Programmatic usage:
```ts
const result = await build({
  clientRuntime: 'preact', // 'react' (default) or 'preact'
});
```
Your component code remains 100% standard React JSX—the compiler automatically aliases `react` and `react-dom` to `preact/compat` for client-side hydration!

---

## 8. CLI Commands & Options

```bash
# Build static site to dist/
react-html build

# Build with Preact ultra-light mode
react-html build --preact

# Customize directories
react-html build --pages src/pages --out dist --root .

# Start local preview server with auto-rebuild on file changes
react-html dev --port 3000 --host localhost

# Terminal UI documentation viewer
react-html docs
react-html docs --all
react-html docs islands
```

---

## 9. Programmatic API Reference

You can import and trigger `react-html` within custom build scripts or Node.js services:

```ts
import { build, renderPageToHtml, createDevServer } from 'react-html';

// 1. Run static build
const result = await build({
  root: process.cwd(),
  pagesDir: 'src/pages',
  outDir: 'dist',
  minify: true,
  clientRuntime: 'preact' // optional ultra-light mode
});
console.log(`Generated ${result.pages.length} pages.`);

// 2. Programmatic dev server
const server = await createDevServer({
  port: 8080,
  host: '127.0.0.1'
});
```

---

## 10. Server App Integration (Express, Fastify, Node HTTP)

You can import and use `react-html` directly inside your backend server application:

```ts
import express from 'express';
import { createEngine } from 'react-html';
// or: import { createEngine } from 'react-html/server';

const app = express();

const engine = createEngine({
  pagesDir: 'src/pages',
  distDir: 'dist',
  // Automatically detects process.env.NODE_ENV === 'production'
});

// 1. Connect / Express Middleware
// In Production: finds and serves pre-built static HTML from dist/
// In Development: dynamically rebuilds TSX on the fly and returns the fresh HTML string!
app.use(engine.middleware);

// 2. Programmatic Route Rendering
app.get('/dashboard', async (req, res) => {
  const html = await engine.render('dashboard', { user: req.user });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// 3. Native Node HTTP Server
import http from 'node:http';
const server = http.createServer(engine.handle);
server.listen(3000);
```

### Environment Behavior:
- **`process.env.NODE_ENV === 'production'`**:
  - Automatically searches for pre-built `.html` files in `distDir` (`dist/index.html`, `dist/about.html`).
  - Streams them immediately to clients with 0 rebuild overhead.
  - Serves static assets (`dist/assets/islands/*.js`, `dist/styles.css`).
- **`process.env.NODE_ENV !== 'production'` (Development)**:
  - Dynamically rebuilds the corresponding `.tsx` page on each request.
  - Bundles any reactive islands on-the-fly.
  - Returns the fresh HTML string directly in the response—code edits in `src/pages` or `src/components` are reflected instantly on reload without server restarts!

---

## 11. Best Practices & Troubleshooting

### Preventing Hydration Mismatches (React Error #418)
- **Do not read browser globals during initial render**: Avoid `window.innerWidth` or `localStorage.getItem()` directly in the component body. Read them inside a `useEffect()`.
- **Props consistency**: Ensure initial props passed from the page match what the component expects.
- **Protected formatting**: `react-html` automatically preserves the exact inner markup of islands so whitespace insertion does not invalidate React's DOM reconciliation.

