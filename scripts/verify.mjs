import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSkill } from './validate-skill.mjs';
if (!globalThis.Bun) throw new Error('Run this script with Bun');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const result = Bun.spawnSync([process.execPath,'test','./tests'],{cwd:root,stdout:'inherit',stderr:'inherit',env:process.env});
if (result.exitCode !== 0) process.exit(result.exitCode);
console.log('PASS: test suite');
console.log(validateSkill(path.join(root,'skills/harness-kit')));
