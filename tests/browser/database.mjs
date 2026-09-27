import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir,realpath} from 'node:fs/promises';
import {basename,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixtureStateFile,sessionId} from './fixture.mjs';

export async function fixtureDatabase() {
  const {project}=JSON.parse(await readFile(fixtureStateFile,'utf8'));
  const scratch=await realpath(dirname(fileURLToPath(fixtureStateFile)));
  const selected=await realpath(project);
  if(dirname(selected)!==scratch || !basename(selected).startsWith('browser-'))throw new Error('Refusing to open a database outside the disposable browser fixture.');
  const directory=resolve(selected,'state/v3/d1/miniflare-D1DatabaseObject');
  const files=(await readdir(directory)).filter(name=>name.endsWith('.sqlite'));
  const matches=[];
  // Wrangler also keeps metadata.sqlite here. Inspect candidates read-only and
  // select only the application database containing our disposable session.
  for(const name of files){
    const path=resolve(directory,name),candidate=new DatabaseSync(path,{readOnly:true});
    try {
      const table=candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admin_sessions'").get();
      if(table&&candidate.prepare('SELECT id FROM admin_sessions WHERE id = ?').get(sessionId))matches.push(path);
    } finally {candidate.close();}
  }
  if(matches.length!==1)throw new Error('Expected exactly one database containing the browser fixture session.');
  return new DatabaseSync(matches[0]);
}
