#!/usr/bin/env node
import { runCli } from '../dist/cli/index.js';

runCli().catch((err) => {
  console.error('[react-html] Fatal error:', err);
  process.exit(1);
});

