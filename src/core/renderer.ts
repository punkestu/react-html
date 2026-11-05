import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { runWithRenderContext, IslandInstance } from './island-registry.js';
import { formatHtml } from './formatter.js';

export interface RenderResult {
  html: string;
  islands: IslandInstance[];
}

export interface RenderOptions {
  pagePath: string;
  Component: React.ComponentType<any>;
  props?: Record<string, unknown>;
  metadata?: {
    title?: string;
    description?: string;
    lang?: string;
    [key: string]: unknown;
  };
  basePath?: string;
}

export function renderPageToHtml(options: RenderOptions): RenderResult {
  const { pagePath, Component, props = {}, metadata = {}, basePath = '' } = options;
  const islands: IslandInstance[] = [];

  const rawMarkup = runWithRenderContext(
    { pagePath, islands },
    () => renderToStaticMarkup(React.createElement(Component, props))
  );

  let finalHtml = rawMarkup;
  const hasHtmlTag = /<html[^>]*>/i.test(finalHtml);
  const hasDoctype = /<!DOCTYPE html>/i.test(finalHtml);

  // If component returned only body contents / fragments, wrap in standard HTML shell
  if (!hasHtmlTag) {
    const lang = metadata.lang || 'en';
    const titleTag = metadata.title ? `<title>${metadata.title}</title>` : '';
    const descTag = metadata.description ? `<meta name="description" content="${metadata.description}">` : '';

    finalHtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${titleTag}
  ${descTag}
</head>
<body>
  ${finalHtml}
</body>
</html>`;
  } else if (!hasDoctype) {
    finalHtml = `<!DOCTYPE html>\n${finalHtml}`;
  }

  // If there are islands, inject script tags before </body> or at the end of the file
  if (islands.length > 0) {
    // Collect unique island names
    const uniqueIslands = Array.from(new Set(islands.map(i => i.name)));
    const assetPrefix = basePath ? (basePath.endsWith('/') ? basePath : `${basePath}/`) : '/';
    const scriptTags = uniqueIslands
      .map(name => `<script type="module" src="${assetPrefix}assets/islands/${name}.js"></script>`)
      .join('\n');

    if (/<\/body>/i.test(finalHtml)) {
      finalHtml = finalHtml.replace(/<\/body>/i, `${scriptTags}\n</body>`);
    } else {
      finalHtml = `${finalHtml}\n${scriptTags}`;
    }
  }

  return {
    html: formatHtml(finalHtml),
    islands
  };
}

