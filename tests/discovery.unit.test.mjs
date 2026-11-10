import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isIslandFile,
  getIslandName,
  transformIslandSource
} from '../dist/core/island-discovery.js';

describe('island-discovery Unit Tests', () => {
  describe('isIslandFile', () => {
    test('identifies *.island.(tsx|jsx|ts|js) files correctly', () => {
      assert.equal(isIslandFile('/src/components/Counter.island.tsx'), true);
      assert.equal(isIslandFile('/src/components/Modal.island.jsx'), true);
      assert.equal(isIslandFile('/src/components/Tabs.island.ts'), true);
      assert.equal(isIslandFile('/src/components/Toggle.island.js'), true);
    });

    test('identifies components placed inside islands/ directory', () => {
      assert.equal(isIslandFile('/src/islands/Counter.tsx'), true);
      assert.equal(isIslandFile('/project/islands/nested/Button.jsx'), true);
    });

    test('rejects non-island files', () => {
      assert.equal(isIslandFile('/src/components/Button.tsx'), false);
      assert.equal(isIslandFile('/src/pages/index.tsx'), false);
      assert.equal(isIslandFile('/src/islands/Counter.test.tsx'), false);
      assert.equal(isIslandFile('/node_modules/pkg/islands/Foo.tsx'), false);
    });
  });

  describe('getIslandName', () => {
    test('converts island file paths to clean PascalCase identifiers', () => {
      assert.equal(getIslandName('/src/components/Counter.island.tsx'), 'Counter');
      assert.equal(getIslandName('/src/islands/shopping-cart.island.tsx'), 'ShoppingCart');
      assert.equal(getIslandName('/src/islands/user_profile_card.tsx'), 'UserProfileCard');
      assert.equal(getIslandName('/src/islands/navigation-menu.island.jsx'), 'NavigationMenu');
    });

    test('handles edge case names cleanly', () => {
      assert.equal(getIslandName('/src/islands/simple.tsx'), 'Simple');
      assert.equal(getIslandName('/src/islands/123-item.tsx'), '123Item');
    });
  });

  describe('transformIslandSource', () => {
    test('does not transform if island(...) is already present', () => {
      const code = `
        import { island } from 'react-html';
        function Counter() { return null; }
        export default island(Counter, import.meta.url, 'Counter');
      `;
      assert.equal(transformIslandSource(code, '/Counter.island.tsx'), code);
    });

    test('does not transform if export default is missing', () => {
      const code = `export function helper() { return 42; }`;
      assert.equal(transformIslandSource(code, '/helper.island.ts'), code);
    });

    test('auto-wraps named export default function', () => {
      const code = `
export default function InteractiveButton(props) {
  return <button {...props} />;
}
      `.trim();

      const transformed = transformIslandSource(code, '/src/components/InteractiveButton.island.tsx');

      assert.ok(transformed.includes('function InteractiveButton(props)'));
      assert.ok(transformed.includes('__react_html_auto_island__'));
      assert.ok(transformed.includes('export default __react_html_wrapped_island__;'));
      assert.ok(transformed.includes('"InteractiveButton"'));
    });

    test('auto-wraps anonymous export default function', () => {
      const code = `
export default function(props) {
  return <div>{props.text}</div>;
}
      `.trim();

      const transformed = transformIslandSource(code, '/src/islands/text-box.island.tsx');

      assert.ok(transformed.includes('function __react_html_island_target__(props)'));
      assert.ok(transformed.includes('__react_html_auto_island__'));
      assert.ok(transformed.includes('export default __react_html_wrapped_island__;'));
      assert.ok(transformed.includes('"TextBox"'));
    });

    test('auto-wraps export default identifier', () => {
      const code = `
const Counter = () => <button>Click</button>;
export default Counter;
      `.trim();

      const transformed = transformIslandSource(code, '/src/islands/counter.island.tsx');

      assert.ok(transformed.includes('__react_html_auto_island__'));
      assert.ok(transformed.includes('export default __react_html_wrapped_island__;'));
      assert.ok(transformed.includes('"Counter"'));
    });
  });
});
