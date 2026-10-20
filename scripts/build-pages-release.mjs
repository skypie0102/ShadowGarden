import {readFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {assertReleaseBindings,readWorkerMetadata} from './pages-release-guard.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const output=resolve(root,process.argv[2]||'.wrangler/release-check');
await mkdir(output,{recursive:true});
// This repository's wrangler.jsonc is strict JSON. Reject invalid configuration
// before packaging; never infer production bindings from a successful compile.
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const bundle=resolve(output,'_worker.bundle');
execFileSync(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),
  'pages','functions','build','functions',
  // The pinned Wrangler ignores configuration unless BOTH flags are present.
  '--project-directory',root,'--build-metadata-path',resolve(output,'build-metadata.json'),
  '--outfile',bundle,'--output-config-path',resolve(output,'functions-filepath-routing-config.json'),
  '--output-routes-path',resolve(output,'_routes.json'),'--build-output-directory',resolve(root,'dist')
],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
assertReleaseBindings(await readWorkerMetadata(await readFile(bundle)),config);
console.log('Compiled Pages release and verified D1, variables, compatibility date and flags.');
