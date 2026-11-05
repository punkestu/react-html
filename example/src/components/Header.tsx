import React from 'react';

export interface HeaderProps {
  currentPath?: string;
}

export function Header({ currentPath = '/' }: HeaderProps) {
  return (
    <header>
      <div className="container header-inner">
        <a href="/" className="logo">⚛️ react-html</a>
        <nav>
          <a href="/" className={currentPath === '/' ? 'active' : ''}>Home (Interactive)</a>
          <a href="/pure.html" className={currentPath === '/pure' ? 'active' : ''}>Pure HTML (0 KB JS)</a>
        </nav>
      </div>
    </header>
  );
}

