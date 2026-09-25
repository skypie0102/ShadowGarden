// Start an isolated Pages app with its own disposable D1 database. No remote CLI
// commands, real credentials, developer state or production configuration used.
import {cp,mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {adminToken,sessionSecret,sessionId} from '../tests/browser/fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(resolve(root,'.wrangler'),{recursive:true});
const project=await mkdtemp(resolve(root,'.wrangler/browser-'));
const wrangler=resolve(root,'node_modules/wrangler/bin/wrangler.js');
let child,stopping=false;
async function stop(signal='SIGTERM') {
  if(stopping)return;stopping=true;
  if(child&&child.exitCode===null)child.kill(signal);
}
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop('SIGINT'));
async function run(args) {
  if(stopping)throw new Error('Browser preview stopped');
  child=spawn(process.execPath,[wrangler,...args],{cwd:project,stdio:'inherit',env:{
    PATH:process.env.PATH,HOME:process.env.HOME,CI:'true',WRANGLER_SEND_METRICS:'false',
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'
  }});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
  if(code!==0&&!stopping)throw new Error(`Browser preview command failed (${code})`);
}
try {
  for(const folder of ['dist','functions','server','public'])await cp(resolve(root,folder),resolve(project,folder),{recursive:true});
  await writeFile(resolve(project,'wrangler.json'),JSON.stringify({
    name:'shadowgarden-browser-test',pages_build_output_dir:'./dist',compatibility_date:'2026-09-23',
    d1_databases:[{binding:'DB',database_name:'browser-fixture',database_id:'00000000-0000-0000-0000-000000000000'}],
    vars:{ADMIN_TOKEN:adminToken,SESSION_SECRET:sessionSecret,BOOK_SIGNING_SECRET:'browser-fixture-book-secret-not-for-deployment',
      TURNSTILE_SITE_KEY:'browser-fixture-site-key',TURNSTILE_SECRET_KEY:'browser-fixture-secret-key'}
  }));
  const migration=await readFile(resolve(root,'migrations/0001_reconstructed.sql'),'utf8');
  const seed=await readFile(resolve(root,'recovery-info/seed.sql'),'utf8');
  await writeFile(resolve(project,'fixture.sql'),`${migration}\n${seed}\nINSERT INTO admin_sessions(id,expires_at) VALUES('${sessionId}',${Math.floor(Date.now()/1000)+3600});\n`);
  const persist=resolve(project,'state');
  await run(['d1','execute','DB','--local','--file','fixture.sql','--persist-to',persist]);
  await run(['pages','dev','dist','--ip','127.0.0.1','--port','4173','--local-protocol','https','--persist-to',persist]);
} finally {
  await rm(project,{recursive:true,force:true});
}
