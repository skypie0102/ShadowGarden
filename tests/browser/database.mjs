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
  if(files.length!==1)throw new Error('Expected exactly one disposable fixture database.');
  const database=new DatabaseSync(resolve(directory,files[0]),{open:true});
  const session=database.prepare('SELECT id FROM admin_sessions WHERE id = ?').get(sessionId);
  if(!session){database.close();throw new Error('The selected database does not contain the browser fixture session.');}
  return database;
}
