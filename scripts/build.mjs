import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Build-time dependency only. Distributed CLI and hook runtimes are standalone.
export async function buildCLI(entry=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../bin/harness.mjs')) {
  const {build}=await import('esbuild');
  const result=await build({absWorkingDir:path.dirname(entry),entryPoints:[entry],tsconfigRaw:{},bundle:true,write:false,platform:'node',target:'node22.12',format:'esm',charset:'utf8',external:['esbuild'],define:{HARNESS_BUNDLED:'true'},legalComments:'inline',banner:{js:"import {createRequire as harnessCreateRequire} from 'node:module'; const require=harnessCreateRequire(import.meta.url);"}});
  return Buffer.from(result.outputFiles[0].contents);
}
