#!/usr/bin/env node
import { runCli } from './cli.js';

runCli(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
