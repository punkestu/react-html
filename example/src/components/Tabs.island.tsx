import React, { useState } from 'react';
import { island } from '../../../src/index.js';

export interface TabItem {
  id: string;
  label: string;
  content: string;
}

export interface TabsProps {
  tabs?: TabItem[];
  defaultTab?: string;
}

const defaultTabs: TabItem[] = [
  {
    id: 'features',
    label: '✨ Features',
    content: 'Write modular React components with standard JSX. Reusable layouts, cards, buttons, with 0 repetitive boilerplate.'
  },
  {
    id: 'islands',
    label: '🏝️ Islands',
    content: 'Only reactive components compile to client-side JavaScript. Everything else is rendered to pure, clean, zero-JS HTML.'
  },
  {
    id: 'speed',
    label: '⚡ Speed',
    content: 'Ultra-fast builds powered by esbuild. Instant page loads for users because the browser only receives semantic HTML.'
  }
];

function TabsComponent({ tabs = defaultTabs, defaultTab = 'features' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div className="tabs-container">
      <div className="tabs-header">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        <p>{currentTab.content}</p>
      </div>
    </div>
  );
}

export const Tabs = island(TabsComponent, import.meta.url, 'Tabs');
export default Tabs;
