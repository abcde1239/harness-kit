#!/usr/bin/env bun
import { main } from '../src/cli.mjs';
if (!globalThis.Bun) {
  console.error('Harness Kit requires Bun >= 1.3.4. Run: bun bin/harness.mjs');
  process.exitCode = 2;
} else process.exitCode = await main(process.argv.slice(2));
