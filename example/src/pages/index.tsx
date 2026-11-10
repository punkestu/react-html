import React from 'react';
import { Layout } from '../components/Layout.js';
import { Card } from '../components/Card.js';
import Counter from '../components/Counter.island.js';
import Tabs from '../components/Tabs.island.js';
import VanillaCounter from '../components/VanillaCounter.island.js';

export const title = 'react-html Demo - Pure HTML + Reactive Islands';
export const description = 'Modular HTML with React and selective reactive island compilation';

export default function HomePage() {
  return (
    <Layout title={title} description={description} currentPath="/">
      <h1>React to Pure HTML Engine</h1>
      <p className="subtitle">
        Write modular React components for static HTML, and compile only reactive components to minimal JavaScript.
      </p>

      <div className="grid">
        <Card title="Modular Components" icon="📦">
          <p>
            Build reusable UI parts like headers, navigation, cards, and footers with React. No repetitive HTML code.
          </p>
        </Card>
        <Card title="Zero-JS by Default" icon="🚀">
          <p>
            Static components render to 100% pure HTML. No client bundle is generated unless reactive islands are used.
          </p>
        </Card>
        <Card title="Selective Reactivity" icon="🏝️">
          <p>
            Interactive components are isolated as islands and bundled into tiny, dedicated client scripts using esbuild.
          </p>
        </Card>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Interactive Island Demos</h2>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Below are interactive islands embedded in pure static HTML:
      </p>

      {/* Pure Vanilla DOM Island (Zero React, Zero Preact, ~180 Bytes) */}
      <VanillaCounter initialCount={5} step={1} />

      {/* Reactive Counter Island (Preact/React) */}
      <Counter initialCount={10} step={2} />
      <Counter initialCount={10} step={2} />

      {/* Reactive Tabs Island */}
      <Tabs defaultTab="islands" />
    </Layout>
  );
}

