import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

/**
 * Checks whether a given file path should be treated as a reactive island.
 * Matches:
 * - *.island.tsx, *.island.jsx, *.island.ts, *.island.js
 * - Any component located in an `islands/` or `src/islands/` folder
 */
export function isIslandFile(filePath: string): boolean {
  if (filePath.includes('node_modules') || filePath.includes('.test.')) {
    return false;
  }

  const isIslandExt = /\.island\.(tsx|ts|jsx|js)$/i.test(filePath);
  const isInIslandsDir = /(?:^|[\\/])islands[\\/].*?\.(tsx|ts|jsx|js)$/i.test(filePath);

  return isIslandExt || isInIslandsDir;
}

/**
 * Derives a clean PascalCase island identifier name from a file path.
 * e.g. "Counter.island.tsx" -> "Counter"
 * e.g. "dropdown-menu.island.jsx" -> "DropdownMenu"
 */
export function getIslandName(filePath: string): string {
  const base = path.basename(filePath)
    .replace(/\.island\.(tsx|ts|jsx|js)$/i, '')
    .replace(/\.(tsx|ts|jsx|js)$/i, '');

  // Convert kebab-case or snake_case to PascalCase
  const pascal = base.replace(/(?:^|[-_])([a-z0-9])/gi, (_, char) => char.toUpperCase());

  // Ensure it is a valid JavaScript identifier
  return pascal.replace(/[^a-zA-Z0-9_$]/g, '') || 'AnonymousIsland';
}

/**
 * Transforms an island component source code to automatically wrap its default export
 * with `island(...)` for server-side rendering, if not already wrapped.
 */
export function transformIslandSource(code: string, filePath: string): string {
  // If the file already manually uses island() or createIsland(), preserve it as is
  if (/\bisland\s*\(/i.test(code) || /\bcreateIsland\s*\(/i.test(code)) {
    return code;
  }

  // Must have an export default to auto-wrap
  if (!code.includes('export default')) {
    return code;
  }

  const islandName = getIslandName(filePath);
  const fileUrl = pathToFileURL(path.resolve(filePath)).href;

  let transformed = code;
  let targetIdentifier = '__react_html_island_target__';

  // Case 1: export default function [Name](...) or export default function(...)
  const fnMatch = transformed.match(/export\s+default\s+function(?:\s+([a-zA-Z0-9_$]+))?\s*\(/);
  if (fnMatch) {
    const existingName = fnMatch[1];
    if (existingName) {
      targetIdentifier = existingName;
      transformed = transformed.replace(
        /export\s+default\s+function\s+([a-zA-Z0-9_$]+)/,
        'function $1'
      );
    } else {
      transformed = transformed.replace(
        /export\s+default\s+function\s*\(/,
        `function ${targetIdentifier}(`
      );
    }
  }
  // Case 2: export default class [Name]
  else if (/export\s+default\s+class\s+([a-zA-Z0-9_$]+)/.test(transformed)) {
    const classMatch = transformed.match(/export\s+default\s+class\s+([a-zA-Z0-9_$]+)/);
    targetIdentifier = classMatch![1];
    transformed = transformed.replace(
      /export\s+default\s+class\s+([a-zA-Z0-9_$]+)/,
      'class $1'
    );
  }
  // Case 3: export default Identifier;
  else if (/export\s+default\s+([a-zA-Z0-9_$]+)\s*;?$/.test(transformed.trim())) {
    const idMatch = transformed.trim().match(/export\s+default\s+([a-zA-Z0-9_$]+)\s*;?$/);
    if (idMatch) {
      targetIdentifier = idMatch[1];
      transformed = transformed.replace(
        new RegExp(`export\\s+default\\s+${targetIdentifier}\\s*;?`),
        ''
      );
    }
  }
  // Case 4: export default <Expression> (e.g. arrow function or memo call)
  else {
    transformed = transformed.replace(
      /export\s+default\s+/,
      `const ${targetIdentifier} = `
    );
  }

  const islandHelperPath = fileURLToPath(new URL('./island.js', import.meta.url));

  // Append island wrapping code
  const wrapperCode = `
import { island as __react_html_auto_island__ } from ${JSON.stringify(islandHelperPath)};
const __react_html_wrapped_island__ = __react_html_auto_island__(
  ${targetIdentifier},
  ${JSON.stringify(fileUrl)},
  ${JSON.stringify(islandName)}
);
export default __react_html_wrapped_island__;
export { __react_html_wrapped_island__ as ${islandName} };
`;

  return `${transformed}\n${wrapperCode}`;
}
