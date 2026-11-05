import React from 'react';
import { Layout } from '../components/Layout.js';
import { Card } from '../components/Card.js';

export const title = '100% Pure HTML - react-html';
export const description = 'Demonstration of zero JavaScript pure HTML output';

export default function PurePage() {
  const features = [
    {
      title: 'Zero Runtime JS',
      icon: '🛡️',
      desc: 'This entire page is compiled to semantic HTML. There are no <script> tags, no React runtime, and no client-side JavaScript sent over the wire.'
    },
    {
      title: 'Modular & DRY',
      icon: '🧩',
      desc: 'Built using React components like <Layout />, <Header />, <Card />, and <Footer />. No copy-pasting HTML boilerplate!'
    },
    {
      title: 'Fast TTFB & Paint',
      icon: '⚡',
      desc: 'Browsers parse pure HTML almost instantly. Perfect for documentation, blogs, landing pages, and marketing sites.'
    }
  ];

  return (
    <Layout title={title} description={description} currentPath="/pure">
      <h1>Pure Static HTML</h1>
      <p className="subtitle">
        Compiled from React JSX with <strong>0 KB client JavaScript</strong>.
      </p>

      <div className="grid">
        {features.map((item, idx) => (
          <Card key={idx} title={item.title} icon={item.icon}>
            <p>{item.desc}</p>
          </Card>
        ))}
      </div>

      <div className="card">
        <h3>Inspect the Source Code</h3>
        <p>
          Right-click and select "View Page Source". You will notice:
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem', color: '#94a3b8' }}>
          <li>Clean, indented, semantic HTML5 markup.</li>
          <li>No <code>data-reactroot</code> or React internal comments.</li>
          <li>Zero <code>&lt;script&gt;</code> tags.</li>
        </ul>
      </div>
    </Layout>
  );
}

