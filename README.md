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
# Build static site to dist/
react-html build

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

### 2. Reactive Components (Islands Architecture)

When a component needs client-side state and interactivity, wrap it with `island()`:

```tsx
// src/components/Counter.island.tsx
import React, { useState } from 'react';
import { island } from 'react-html';

export interface CounterProps {
  initial?: number;
}

function CounterComponent({ initial = 0 }: CounterProps) {
  const [count, setCount] = useState(initial);

  return (
    <div className="counter">
      <button onClick={() => setCount(c => c - 1)}>-</button>
      <span>Count: {count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}

// Export the island with its unique name and source path
export const Counter = island(CounterComponent, import.meta.url, 'Counter');
export default Counter;
```

Now import and use it in any page just like a normal React component:

```tsx
// src/pages/index.tsx
import React from 'react';
import { Layout } from '../components/Layout.js';
import { Counter } from '../components/Counter.island.js';

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

**What the engine does:**
1. Renders the initial static markup during SSR for instant paint.
2. Compiles a dedicated micro-bundle `dist/assets/islands/Counter.js`.
3. Injects `<script type="module" src="/assets/islands/Counter.js"></script>` into `index.html`.
4. Hydrates only the island element in-place using React 19's `hydrateRoot`.

---

## 🛠️ Hydration Directives

`react-html` supports client loading directives to maximize performance:

| Directive | Syntax | Behavior |
| :--- | :--- | :--- |
| `load` (default) | `<Counter client="load" />` | Hydrates immediately on DOM ready |
| `idle` | `<Counter client="idle" />` | Hydrates during browser idle time (`requestIdleCallback`) |
| `visible` | `<Counter client="visible" />` | Hydrates when scrolled into view (`IntersectionObserver`) |

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

## 📄 License

MIT

