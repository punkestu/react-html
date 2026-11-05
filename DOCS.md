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
4. [Reactive Islands Architecture](#4-reactive-islands-architecture)
5. [Hydration Directives](#5-hydration-directives)
6. [CLI Commands & Options](#6-cli-commands--options)
7. [Programmatic API Reference](#7-programmatic-api-reference)
8. [Best Practices & Troubleshooting](#8-best-practices--troubleshooting)

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

## 4. Reactive Islands Architecture

When a component needs client-side state (`useState`, `useEffect`, event listeners):

### Step 1: Wrap Component with `island()`

```tsx
// src/components/Counter.island.tsx
import React, { useState } from 'react';
import { island } from 'react-html';

export interface CounterProps {
  initialCount?: number;
  step?: number;
}

function CounterComponent({ initialCount = 0, step = 1 }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="counter">
      <p>Current: {count}</p>
      <button onClick={() => setCount(c => c - step)}>- {step}</button>
      <button onClick={() => setCount(c => c + step)}>+ {step}</button>
    </div>
  );
}

// Wrap with island helper providing Component, source path, and identifier
export const Counter = island(CounterComponent, import.meta.url, 'Counter');
export default Counter;
```

### Step 2: Use in Any Page

```tsx
// src/pages/index.tsx
import React from 'react';
import { Layout } from '../components/Layout.js';
import { Counter } from '../components/Counter.island.js';

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

### What Happens Behind the Scenes:
1. **Server Phase**: The island is pre-rendered with `renderToString` and placed inside a container `<div data-island="Counter" data-props="...">`.
2. **Bundler Phase**: `esbuild` extracts and bundles only `CounterComponent` into `dist/assets/islands/Counter.js`.
3. **Injection Phase**: `<script type="module" src="/assets/islands/Counter.js"></script>` is injected right before `</body>`.
4. **Client Hydration**: The script queries `[data-island="Counter"]` and attaches listeners using React 19's `hydrateRoot`.

---

## 5. Hydration Directives

Fine-tune client performance using the `client` prop:

| Directive | Code Example | When It Hydrates |
| :--- | :--- | :--- |
| `load` *(default)* | `<Counter client="load" />` | Immediately upon `DOMContentLoaded`. Ideal for primary UI. |
| `idle` | `<Counter client="idle" />` | During browser idle time via `requestIdleCallback`. Ideal for background widgets. |
| `visible` | `<Counter client="visible" />` | When scrolled into view via `IntersectionObserver`. Ideal for below-the-fold content. |

---

## 6. CLI Commands & Options

```bash
# Build static site to dist/
react-html build

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

## 7. Programmatic API Reference

You can import and trigger `react-html` within custom build scripts or Node.js services:

```ts
import { build, renderPageToHtml, createDevServer } from 'react-html';

// 1. Run static build
const result = await build({
  root: process.cwd(),
  pagesDir: 'src/pages',
  outDir: 'dist',
  minify: true
});
console.log(`Generated ${result.pages.length} pages.`);

// 2. Programmatic dev server
const server = await createDevServer({
  port: 8080,
  host: '127.0.0.1'
});
```

---

## 8. Best Practices & Troubleshooting

### Preventing Hydration Mismatches (React Error #418)
- **Do not read browser globals during initial render**: Avoid `window.innerWidth` or `localStorage.getItem()` directly in the component body. Read them inside a `useEffect()`.
- **Props consistency**: Ensure initial props passed from the page match what the component expects.
- **Protected formatting**: `react-html` automatically preserves the exact inner markup of islands so whitespace insertion does not invalidate React's DOM reconciliation.

