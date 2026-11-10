import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatHtml } from '../dist/core/formatter.js';

describe('formatHtml Unit Tests', () => {
  test('formats nested HTML tags with correct indentation', () => {
    const raw = '<div><ul><li>\nItem 1\n</li><li>\nItem 2\n</li></ul></div>';
    const formatted = formatHtml(raw);

    const expected = [
      '<div>',
      '  <ul>',
      '    <li>',
      '      Item 1',
      '    </li>',
      '    <li>',
      '      Item 2',
      '    </li>',
      '  </ul>',
      '</div>',
      ''
    ].join('\n');

    assert.equal(formatted, expected);
  });

  test('correctly handles void tags without increasing indentation', () => {
    const raw = '<head><meta charset="utf-8"><link rel="stylesheet" href="style.css"><title>Hello</title></head>';
    const formatted = formatHtml(raw);

    assert.ok(formatted.includes('  <meta charset="utf-8">\n'));
    assert.ok(formatted.includes('  <link rel="stylesheet" href="style.css">\n'));
    assert.ok(formatted.includes('  <title>Hello</title>\n'));
    assert.ok(formatted.endsWith('</head>\n'));
  });

  test('keeps inline tags and text on the same line', () => {
    const raw = '<p>Click <strong>here</strong> or <code>code</code> for info.</p>';
    const formatted = formatHtml(raw);

    assert.ok(formatted.includes('<strong>here</strong>'));
    assert.ok(formatted.includes('<code>code</code>'));
  });

  test('preserves reactive island markup verbatim across hydration boundaries', () => {
    const islandInner = '<button data-count="0">\n  <span>Click Me</span>\n</button>';
    const raw = `<main><!--__ISLAND_START__-->${islandInner}<!--__ISLAND_END__--></main>`;
    const formatted = formatHtml(raw);

    assert.ok(formatted.includes(islandInner), 'Inner island markup must remain exact without modification');
  });

  test('strips React comment markers outside islands', () => {
    const raw = '<div><!-- -->Hello<!-- --> <span>World</span></div>';
    const formatted = formatHtml(raw);

    assert.ok(!formatted.includes('<!-- -->'), 'React comment artifacts must be stripped');
    assert.ok(formatted.includes('Hello'));
    assert.ok(formatted.includes('<span>World</span>'));
  });

  test('preserves DOCTYPE header at top level', () => {
    const raw = '<!DOCTYPE html><html><head><title>Test</title></head><body></body></html>';
    const formatted = formatHtml(raw);

    assert.ok(formatted.startsWith('<!DOCTYPE html>\n'));
  });
});
