import React, { ReactNode } from 'react';
import { Header } from './Header.js';
import { Footer } from './Footer.js';

export interface LayoutProps {
  title?: string;
  description?: string;
  currentPath?: string;
  children: ReactNode;
}

export function Layout({
  title = 'react-html Demo',
  description = 'Modular pure HTML generated with React',
  currentPath = '/',
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
        <Header currentPath={currentPath} />
        <main>
          <div className="container">
            {children}
          </div>
        </main>
        <Footer />
      </body>
    </html>
  );
}

