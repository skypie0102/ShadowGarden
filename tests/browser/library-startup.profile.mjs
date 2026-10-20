import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir,platform,arch} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {baseURL} from './fixture.mjs';

test.setTimeout(180000);
const root=fileURLToPath(new URL('../../',import.meta.url));
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
const reference=process.env.SG_STARTUP_BASELINE_REF||'HEAD';
if(!/^(HEAD|[a-f0-9]{40})$/.test(reference))throw Error('Use HEAD or a full commit SHA for SG_STARTUP_BASELINE_REF.');
const baselineSha=execFileSync('git',['rev-parse','--verify',reference+'^{commit}'],{cwd:root,encoding:'utf8'}).trim();

test('measure cold Library startup and duplicate module requests against an immutable baseline',async({browser})=>{
  const temporary=await mkdtemp(join(tmpdir(),'sg-library-profile-'));
  const samples=[];
  try{
    const archive=execFileSync('git',['archive',baselineSha,'public'],{cwd:root,maxBuffer:64*1024*1024});
    execFileSync('tar',['-x','-C',temporary],{input:archive});
    const snapshots={baseline:join(temporary,'public'),current:join(root,'dist')};
    // Preload source bytes before timing so filesystem/Git work cannot become a
    // request's apparent network latency. Only public HTML and first-party JS
    // are substituted; the real Pages fixture supplies the remaining assets.
    const sourceCache=new Map();
    const source=async(variant,path)=>{
      const key=variant+':'+path;
      if(!sourceCache.has(key)){
        const target=resolve(snapshots[variant],'.'+path);
        if(!target.startsWith(snapshots[variant]+sep))throw Error('Profile source escapes its snapshot.');
        sourceCache.set(key,await readFile(target));
      }
      return sourceCache.get(key);
    };
    const {readdir}=await import('node:fs/promises');
    async function preload(variant,directory='assets/js'){
      for(const item of await readdir(join(snapshots[variant],directory),{withFileTypes:true})){
        if(item.isDirectory()){if(item.name!=='vendor')await preload(variant,directory+'/'+item.name);}
        else if(item.name.endsWith('.js'))await source(variant,'/'+directory+'/'+item.name);
      }
    }
    for(const variant of ['baseline','current']){
      await preload(variant);await source(variant,'/index.html');await source(variant,'/nsfw.html');
    }
    for(const delayMs of [0,80])for(const adult of [false,true])for(let repetition=0;repetition<3;repetition++){
      for(const variant of repetition%2?['current','baseline']:['baseline','current']){
        const context=await browser.newContext({viewport:{width:1280,height:900},ignoreHTTPSErrors:true});
        try{
          const page=await context.newPage();
          const errors=[];page.on('pageerror',error=>errors.push(error.message));
          await page.addInitScript(()=>{
            localStorage.setItem('sg-adult-ack','1');
            const observer=new MutationObserver(()=>{
              if(!document.querySelector('#catalogGrid .series-card'))return;
              window.libraryProfileReadyMs=performance.now();observer.disconnect();
            });
            observer.observe(document,{childList:true,subtree:true});
          });
          for(const shelf of ['main','adult']){
            const bookId='bk_'+(shelf==='main'?'A':'B').repeat(22);
            const catalog={generatedAt:'2026-10-20T00:00:00.000Z',series:[{id:'startup-'+shelf,title:'Startup fixture '+shelf,author:'Technical fixture',volumes:[{bookId,title:'Disposable volume',number:1}]}]};
            const path='/media/shadow-garden/data/'+(shelf==='main'?'catalog.json':'adult-catalog.json');
            await page.route('**'+path,route=>route.fulfill({json:catalog}));
          }
          await page.route(url=>url.origin===new URL(baseURL).origin&&(['/', '/nsfw'].includes(url.pathname)||url.pathname.startsWith('/assets/js/')&&!url.pathname.includes('/vendor/')&&url.pathname.endsWith('.js')),async route=>{
            const path=new URL(route.request().url()).pathname;
            const html=path==='/'||path==='/nsfw';
            const bytes=await source(variant,html?(path==='/'?'/index.html':'/nsfw.html'):path);
            if(!html&&delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));
            await route.fulfill({body:bytes,contentType:html?'text/html':'application/javascript',headers:{'cache-control':'no-cache'}});
          });
          await page.goto(baseURL+(adult?'/nsfw':'/'));
          await expect(page.locator('#catalogGrid .series-card')).toHaveCount(1);
          await expect(page.locator('#resultCount')).toContainText('1 series');
          await page.waitForLoadState('networkidle');
          const result=await page.evaluate(()=>({readyMs:window.libraryProfileReadyMs,scripts:performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname.startsWith('/assets/js/')&&new URL(entry.name).pathname.endsWith('.js')).map(entry=>({path:new URL(entry.name).pathname+new URL(entry.name).search,startMs:entry.startTime,endMs:entry.responseEnd,durationMs:entry.duration}))}));
          expect(errors).toEqual([]);expect(result.readyMs).toBeGreaterThan(0);
          const variants=new Map();for(const script of result.scripts){const path=script.path.split('?')[0];if(!variants.has(path))variants.set(path,new Set());variants.get(path).add(script.path);}
          const duplicates=[...variants].filter(([,urls])=>urls.size>1).map(([path,urls])=>({path,urls:[...urls].sort()}));
          samples.push({variant,shelf:adult?'adult':'main',delayMs,repetition,readyMs:result.readyMs,scriptRequests:result.scripts.length,duplicateModulePaths:duplicates,scripts:result.scripts});
        }finally{await context.close();}
      }
    }
    const summary=[];
    for(const shelf of ['main','adult'])for(const delayMs of [0,80]){
      const group=variant=>samples.filter(sample=>sample.variant===variant&&sample.shelf===shelf&&sample.delayMs===delayMs);
      const baselineMs=median(group('baseline').map(sample=>sample.readyMs)),currentMs=median(group('current').map(sample=>sample.readyMs));
      summary.push({shelf,delayMs,baselineMedianReadyMs:baselineMs,currentMedianReadyMs:currentMs,differenceMs:currentMs-baselineMs,baselineScriptRequests:group('baseline').map(sample=>sample.scriptRequests),currentScriptRequests:group('current').map(sample=>sample.scriptRequests),baselineDuplicatePaths:group('baseline').map(sample=>sample.duplicateModulePaths.length),currentDuplicatePaths:group('current').map(sample=>sample.duplicateModulePaths.length)});
    }
    const report={measuredAt:new Date().toISOString(),baselineSha,currentSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),environment:{browser:browser.version(),node:process.version,platform:platform(),architecture:arch()},scenario:'Three fresh contexts per variant/shelf/delay, interleaved order; disposable one-series catalogs; first-party JS receives a controlled 0 or 80 ms delay per response. This is not a network/CPU/mobile emulation or a production Core Web Vitals measurement.',summary,samples};
    await mkdir(join(root,'library-startup-results'),{recursive:true});
    await writeFile(join(root,'library-startup-results/report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({baselineSha,summary},null,2));
  }finally{await rm(temporary,{recursive:true,force:true});}
});
