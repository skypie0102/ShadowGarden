// Run from a disposable target checkout. The harness can come from a newer ref
// than the target source, allowing identical probes on the original and main.
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const harness=new URL('../',import.meta.url);
if(!process.argv[2])throw new Error('Pass the path to a disposable target checkout');
const target=resolve(process.argv[2]);
if(target===resolve(fileURLToPath(harness)))throw new Error('Target must be a separate disposable checkout');
execFileSync('git',['diff','--exit-code','HEAD','--','tests/browser/reader-scroll-stability.spec.mjs'],{cwd:target,stdio:'pipe'});
const repetitions=Number(process.env.SG_SCROLL_REPETITIONS||30);
if(!Number.isInteger(repetitions)||repetitions<1||repetitions>100)throw new Error('Repetitions must be 1–100');
const current=await readFile(new URL('tests/browser/reader-scroll-stability.spec.mjs',harness),'utf8');
const start=current.indexOf("  test('fast upward scrolling does not reverse when earlier chapters render'");
const end=current.indexOf("  test('a previously prepended chapter growing below the viewport does not move it'");
if(start<0||end<=start)throw new Error('Native test boundaries changed');
let prefix=current.slice(0,start),test=current.slice(start,end);
const replace=(text,before,after)=>{
  if(text.split(before).length!==2)throw new Error('Native diagnostic seam changed: '+before);
  return text.replace(before,after);
};
prefix="import {installScrollDiagnostics} from './scroll-diagnostics.mjs';\n"+prefix;
const partialHook=`
  test.afterEach(async({page},testInfo)=>{
    if(testInfo.status===testInfo.expectedStatus)return;
    try{
      const partial=await page.evaluate(()=>({samples:window.scrollStability?.samples,resizes:window.scrollStability?.resizes,transactions:window.__sgScrollProbe?.events}));
      await testInfo.attach('partial-scroll-diagnostics',{body:JSON.stringify(partial),contentType:'application/json'});
    }catch{} // A closed or crashed page still retains Playwright's failure trace.
  });
`;
prefix+=partialHook;
prefix=replace(prefix,'test.beforeEach(async({page})=>{','test.beforeEach(async({page})=>{\n    await installScrollDiagnostics(page);');
test=replace(test,"'fast upward scrolling does not reverse when earlier chapters render'","'diagnostic upward repetition '+repetition");
test=replace(test,'window.scrollStability=state;','window.scrollStability=state;\n      window.__sgScrollProbe.start(manager);');
test=replace(test,'state.active=false;','state.active=false;\n        window.__sgScrollProbe.stop();');
test=replace(test,'return{...state,last:', 'return{...state,transactions:window.__sgScrollProbe.events,last:');
const attached="await testInfo.attach('visible-passage-trace',{body:JSON.stringify(result),contentType:'application/json'});";
test=replace(test,attached,attached+`
    const starts=result.transactions.filter(event=>event.type==='begin');
    expect(starts.length,'Probe must observe anchor transactions').toBeGreaterThan(0);
    expect(result.transactions.filter(event=>event.type==='end').map(event=>event.id)).toEqual(starts.map(event=>event.id));`);
await copyFile(new URL('tests/browser/scroll-diagnostics.mjs',harness),resolve(target,'tests/browser/scroll-diagnostics.mjs'));
const nativeName='fast upward scrolling does not reverse when earlier chapters render';
const targetSuitePath=resolve(target,'tests/browser/reader-scroll-stability.spec.mjs');
const targetSuite=await readFile(targetSuitePath,'utf8');
const targetStart=targetSuite.indexOf("  test('fast upward scrolling does not reverse when earlier chapters render'");
const targetEnd=targetSuite.indexOf("  test('a previously prepended chapter growing below the viewport does not move it'");
if(targetStart<0||targetEnd<=targetStart)throw new Error('Target native case boundaries changed');
let nativePrefix="import {installScrollDiagnostics} from './scroll-diagnostics.mjs';\n"+targetSuite.slice(0,targetStart);
nativePrefix=replace(nativePrefix,'test.beforeEach(async({page})=>{',`test.beforeEach(async({page},testInfo)=>{\n    if(testInfo.title===${JSON.stringify(nativeName)})await installScrollDiagnostics(page);`);
nativePrefix+=partialHook;
const nativeProbe=replace(test,"'diagnostic upward repetition '+repetition",JSON.stringify(nativeName));
await writeFile(targetSuitePath,nativePrefix+nativeProbe+targetSuite.slice(targetEnd));
await writeFile(resolve(target,'tests/browser/zz-scroll-diagnostics.spec.mjs'),prefix+`\n  for(let repetition=0;repetition<${repetitions};repetition++){\n`+test+'\n  }\n});\n');
await writeFile(resolve(target,'playwright.scroll-diagnostics.config.mjs'),`import config from './playwright.config.mjs';
export default {...config,outputDir:'scroll-diagnostic-results/tests',reporter:[['list'],['json',{outputFile:'scroll-diagnostic-results/report.json'}],['html',{outputFolder:'scroll-diagnostic-results/html',open:'never'}]]};\n`);
await mkdir(resolve(target,'scroll-diagnostic-results'),{recursive:true});
const hash=text=>createHash('sha256').update(text).digest('hex');
const layout=await readFile(resolve(target,'public/assets/js/reader/continuous-layout.js'),'utf8');
const {instrumentContinuousLayout}=await import(new URL('tests/browser/scroll-diagnostics.mjs',harness));
instrumentContinuousLayout(layout); // Fail before the browser starts if target seams drift.
await writeFile(resolve(target,'scroll-diagnostic-results/provenance.json'),JSON.stringify({
  harnessCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(harness),encoding:'utf8'}).trim(),
  targetCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:target,encoding:'utf8'}).trim(),
  layoutSha256:hash(layout),targetSuiteBeforeInstrumentationSha256:hash(targetSuite),nativeTestSha256:hash(current.slice(start,end)),repetitions,
  browserProject:'mobile-chromium',nativeInput:{steps:32,deltaY:-180,waitAfterEachMs:12,finalWaitMs:500,reversalThresholdPx:-3},
  scope:'Native case in its original suite position and appended warm probes route an instrumented layout response. Other cases are unchanged. Logging can affect scheduling.'
},null,2)+'\n');
console.log('Prepared',repetitions,'warm scroll probes in',target);
