import readline from 'node:readline';
import { DOC_SECTIONS, DocSection } from './docs-content.js';

// ANSI escape sequences
const CLEAR = '\x1b[2J\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const INVERT = '\x1b[7m';

function formatLine(line: string): string {
  if (line.startsWith('# ')) {
    return `${BOLD}${CYAN}${line}${RESET}`;
  }
  if (line.startsWith('* ')) {
    return `${BOLD}${GREEN}${line}${RESET}`;
  }
  if (line.startsWith('//') || line.startsWith('  $ ')) {
    return `${YELLOW}${line}${RESET}`;
  }
  if (line.includes('├──') || line.includes('└──') || line.includes('│')) {
    return `${DIM}${line}${RESET}`;
  }
  return line;
}

export function printSectionDirect(section: DocSection): void {
  console.log(`\n${BOLD}${CYAN}=== ${section.title} ===${RESET}\n`);
  for (const line of section.content) {
    console.log(formatLine(line));
  }
  console.log('');
}

export function printAllDocs(): void {
  console.log(`\n${BOLD}${CYAN}====================================================${RESET}`);
  console.log(`${BOLD}${CYAN}          ⚛️  REACT-HTML COMPLETE MANUAL           ${RESET}`);
  console.log(`${BOLD}${CYAN}====================================================${RESET}\n`);
  for (const sec of DOC_SECTIONS) {
    printSectionDirect(sec);
    console.log(`${DIM}${'─'.repeat(60)}${RESET}\n`);
  }
}

export async function launchDocsTui(initialArg?: string): Promise<void> {
  // If specific section or --all requested non-interactively
  if (initialArg === '--all' || initialArg === '-a') {
    printAllDocs();
    return;
  }

  if (initialArg) {
    const match = DOC_SECTIONS.find(
      (s, idx) =>
        s.id.toLowerCase() === initialArg.toLowerCase() ||
        String(idx + 1) === initialArg ||
        s.title.toLowerCase().includes(initialArg.toLowerCase())
    );
    if (match) {
      printSectionDirect(match);
      return;
    }
  }

  // Non-TTY fallback
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    printAllDocs();
    return;
  }

  let selectedIndex = 0;
  let viewMode: 'menu' | 'reader' = 'menu';
  let scrollOffset = 0;

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdout.write(HIDE_CURSOR);

  function cleanup() {
    process.stdout.write(SHOW_CURSOR);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    console.clear();
  }

  function renderMenu() {
    const termWidth = Math.max(process.stdout.columns || 80, 60);
    const border = '═'.repeat(Math.min(termWidth - 2, 70));

    let out = CLEAR;
    out += `${CYAN}╔${border}╗${RESET}\n`;
    out += `${CYAN}║${BOLD}          ⚛️  REACT-HTML TERMINAL DOCUMENTATION (TUI)           ${RESET}${CYAN}║${RESET}\n`;
    out += `${CYAN}║${DIM}   Modular pure HTML with selective reactive islands compilation   ${RESET}${CYAN}║${RESET}\n`;
    out += `${CYAN}╚${border}╝${RESET}\n\n`;

    out += `${BOLD}Select a topic using arrow keys and press [Enter]:${RESET}\n\n`;

    DOC_SECTIONS.forEach((sec, idx) => {
      const isSelected = idx === selectedIndex;
      if (isSelected) {
        out += `  ${BOLD}${CYAN}▶ ${INVERT} ${sec.title} ${RESET}\n`;
        out += `    ${DIM}${sec.summary}${RESET}\n\n`;
      } else {
        out += `    ${BOLD}${sec.title}${RESET}\n`;
        out += `    ${DIM}${sec.summary}${RESET}\n\n`;
      }
    });

    out += `\n${DIM}${'─'.repeat(Math.min(termWidth - 2, 70))}${RESET}\n`;
    out += `${BOLD}[↑/↓ or j/k]${RESET} Navigate   ${BOLD}[Enter]${RESET} Read   ${BOLD}[q / Ctrl+C]${RESET} Exit\n`;

    process.stdout.write(out);
  }

  function renderReader() {
    const sec = DOC_SECTIONS[selectedIndex];
    const termHeight = Math.max(process.stdout.rows || 24, 15);
    const termWidth = Math.max(process.stdout.columns || 80, 60);
    const contentRows = termHeight - 8;

    const visibleLines = sec.content.slice(scrollOffset, scrollOffset + contentRows);

    let out = CLEAR;
    out += `${CYAN}${BOLD}⚛️  react-html :: ${sec.title}${RESET}\n`;
    out += `${DIM}${'═'.repeat(Math.min(termWidth - 2, 70))}${RESET}\n\n`;

    for (const line of visibleLines) {
      out += formatLine(line) + '\n';
    }

    // Fill blank lines if content is short
    for (let i = visibleLines.length; i < contentRows; i++) {
      out += '\n';
    }

    const maxScroll = Math.max(0, sec.content.length - contentRows);
    const scrollInfo = maxScroll > 0 ? ` [Line ${scrollOffset + 1}/${sec.content.length}]` : '';

    out += `\n${DIM}${'─'.repeat(Math.min(termWidth - 2, 70))}${RESET}\n`;
    out += `${BOLD}[↑/↓ or j/k]${RESET} Scroll${scrollInfo}   ${BOLD}[b / Esc]${RESET} Back to Menu   ${BOLD}[q]${RESET} Quit\n`;

    process.stdout.write(out);
  }

  function draw() {
    if (viewMode === 'menu') {
      renderMenu();
    } else {
      renderReader();
    }
  }

  draw();

  return new Promise((resolve) => {
    process.stdin.on('keypress', (str, key) => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        cleanup();
        resolve();
        return;
      }

      if (viewMode === 'menu') {
        if (key.name === 'up' || key.name === 'k') {
          selectedIndex = (selectedIndex - 1 + DOC_SECTIONS.length) % DOC_SECTIONS.length;
          draw();
        } else if (key.name === 'down' || key.name === 'j') {
          selectedIndex = (selectedIndex + 1) % DOC_SECTIONS.length;
          draw();
        } else if (key.name === 'return' || key.name === 'space') {
          viewMode = 'reader';
          scrollOffset = 0;
          draw();
        }
      } else if (viewMode === 'reader') {
        const sec = DOC_SECTIONS[selectedIndex];
        const termHeight = Math.max(process.stdout.rows || 24, 15);
        const contentRows = termHeight - 8;
        const maxScroll = Math.max(0, sec.content.length - contentRows);

        if (key.name === 'escape' || key.name === 'b' || key.name === 'backspace') {
          viewMode = 'menu';
          draw();
        } else if (key.name === 'up' || key.name === 'k') {
          if (scrollOffset > 0) {
            scrollOffset--;
            draw();
          }
        } else if (key.name === 'down' || key.name === 'j') {
          if (scrollOffset < maxScroll) {
            scrollOffset++;
            draw();
          }
        } else if (key.name === 'pageup') {
          scrollOffset = Math.max(0, scrollOffset - 5);
          draw();
        } else if (key.name === 'pagedown') {
          scrollOffset = Math.min(maxScroll, scrollOffset + 5);
          draw();
        }
      }
    });
  });
}

