import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function summarizeScrollDiagnostics(report){
  const traces=[];
  function visit(value,title=''){
    if(Array.isArray(value)){for(const item of value)visit(item,title);return}
    if(!value||typeof value!=='object')return;
    title=value.title||title;
    for(const attachment of value.attachments||[]){
      if(attachment.name==='visible-passage-trace'&&attachment.body){
        traces.push({title,trace:JSON.parse(Buffer.from(attachment.body,'base64').toString('utf8'))});
      }
    }
    for(const [key,child] of Object.entries(value))if(key!=='attachments')visit(child,title);
  }
  visit(report);
  const summary={traceCount:traces.length,recordedTraceCount:0,sampleCount:0,anchorTransactions:0,scrollWrites:0,
    shrink56Count:0,ySnapshotGaps:0,ownerDocumentMismatches:0,reversals:[],perTrace:[]};
  for(const {title,trace} of traces){
    const events=trace.transactions||[],samples=trace.samples||[];
    if(Array.isArray(trace.transactions))summary.recordedTraceCount++;
    summary.sampleCount+=samples.length;
    const starts=events.filter(event=>event.type==='begin');
    summary.anchorTransactions+=starts.length;
    summary.scrollWrites+=events.filter(event=>event.type==='scrollWrite').length;
    const heights=new Map();
    for(const resize of trace.resizes||[]){
      if(heights.get(resize.index)-resize.height===56)summary.shrink56Count++;
      heights.set(resize.index,resize.height);
    }
    for(const [index,sample] of samples.entries()){
      if(Number.isFinite(sample.y)&&Math.abs(sample.y-sample.top)>.01)summary.ySnapshotGaps++;
      if(sample.ownerMatches===false)summary.ownerDocumentMismatches++;
      if(sample.delta!==null&&sample.delta< -3){
        const near=event=>Number.isFinite(sample.atMs)&&Math.abs(event.atMs-sample.atMs)<=60;
        summary.reversals.push({title,sample:index,delta:sample.delta,
          samples:samples.slice(Math.max(0,index-2),index+3),
          events:events.filter(near),resizes:(trace.resizes||[]).filter(near)});
      }
    }
    summary.perTrace.push({title,samples:samples.length,anchorTransactions:starts.length,
      minimumDelta:Math.min(...samples.map(sample=>sample.delta).filter(Number.isFinite))});
  }
  return summary;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [input,output]=process.argv.slice(2);
  if(!input||!output)throw new Error('Pass report.json and summary.json paths');
  const summary=summarizeScrollDiagnostics(JSON.parse(await readFile(input,'utf8')));
  await writeFile(output,JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({...summary,reversals:summary.reversals.length,perTrace:undefined}));
  if(!summary.recordedTraceCount)throw new Error('No recorded scroll traces found; investigation is incomplete');
}
