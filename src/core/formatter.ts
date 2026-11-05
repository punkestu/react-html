/**
 * Robust HTML formatter to output clean, readable HTML
 * Preserves exact inner markup inside reactive islands to ensure seamless React hydration.
 */
export function formatHtml(html: string): string {
  // Extract and preserve island contents verbatim
  const preservedIslands: string[] = [];
  let clean = html.replace(
    /<!--__ISLAND_START__-->([\s\S]*?)<!--__ISLAND_END__-->/g,
    (_, inner) => {
      const idx = preservedIslands.length;
      preservedIslands.push(inner);
      return `%%REACT_HTML_ISLAND_${idx}%%`;
    }
  );

  // Strip React comment artifacts outside islands if any
  clean = clean.replace(/<!-- -->/g, '');

  const tokens = clean.split(/(<[^>]+>)/g).filter((t) => t.trim().length > 0);
  let formatted = '';
  let indent = 0;
  const indentStr = '  ';

  // Void tags that don't need closing or indentation changes
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
  ]);

  // Tags where content is typically kept on the same line if brief
  const inlineTags = new Set([
    'title', 'span', 'strong', 'em', 'b', 'i', 'code', 'small', 'sub', 'sup'
  ]);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();

    if (token.startsWith('<!DOCTYPE') || token.startsWith('<!doctype')) {
      formatted += token + '\n';
      continue;
    }

    if (token.startsWith('</')) {
      // Closing tag
      const match = token.match(/<\/([a-zA-Z0-9\-]+)/);
      const tagName = match ? match[1].toLowerCase() : '';

      indent = Math.max(0, indent - 1);
      formatted += indentStr.repeat(indent) + token + '\n';
    } else if (token.startsWith('<') && !token.startsWith('<!--')) {
      // Opening or self-closing tag
      const match = token.match(/<([a-zA-Z0-9\-]+)/);
      const tagName = match ? match[1].toLowerCase() : '';
      const isSelfClosing = token.endsWith('/>') || voidTags.has(tagName);

      // Check if next token is text and next-next token is closing tag
      if (
        inlineTags.has(tagName) &&
        i + 2 < tokens.length &&
        !tokens[i + 1].trim().startsWith('<') &&
        tokens[i + 2].trim().toLowerCase() === `</${tagName}>`
      ) {
        const text = tokens[i + 1].trim();
        const closeTag = tokens[i + 2].trim();
        formatted += indentStr.repeat(indent) + `${token}${text}${closeTag}\n`;
        i += 2;
        continue;
      }

      formatted += indentStr.repeat(indent) + token + '\n';

      if (!isSelfClosing) {
        indent++;
      }
    } else {
      // Standalone text content
      formatted += indentStr.repeat(indent) + token + '\n';
    }
  }

  // Restore preserved island markup untouched
  let finalHtml = formatted.replace(
    /%%REACT_HTML_ISLAND_(\d+)%%/g,
    (_, idxStr) => {
      const idx = parseInt(idxStr, 10);
      return preservedIslands[idx] ?? '';
    }
  );

  return finalHtml.trim() + '\n';
}
