import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordReaderDiagnostic,measureReaderOperation,getReaderDiagnostics} from '../public/assets/js/reader/diagnostics.js';

test('diagnostics retain only known codes and finite numeric measurements',()=>{
  const privateText='private chapter https://reader.invalid/book?sig=secret';
  recordReaderDiagnostic('visual.ready',{durationMs:12.345,assets:2,scanned:Infinity,pages:-1,href:privateText,error:Error(privateText),sources:privateText});
  recordReaderDiagnostic(privateText,{pages:1});
  const report=getReaderDiagnostics(),event=report.events.at(-1);
  assert.equal(event.code,'visual.ready');assert.equal(event.durationMs,12.35);assert.equal(event.assets,2);
  assert.equal(event.scanned,undefined);assert.equal(event.pages,undefined);assert.equal(event.sources,undefined);
  assert.ok(!JSON.stringify(report).includes(privateText));
});

test('diagnostic history is bounded and returned snapshots do not mutate retained data',()=>{
  for(let i=0;i<150;i++)recordReaderDiagnostic('source.released');
  const report=getReaderDiagnostics();assert.equal(report.events.length,report.limit);
  report.events[0].code='mutated';report.counts['source.released']=0;
  const next=getReaderDiagnostics();assert.equal(next.counts['source.released'],150);assert.notEqual(next.events[0].code,'mutated');
});

test('expected cancellation is quiet and actionable fallback logs a fixed message once',t=>{
  const warn=console.warn,lines=[];console.warn=(...values)=>lines.push(values);t.after(()=>console.warn=warn);
  recordReaderDiagnostic('pageMap.cancelled');
  recordReaderDiagnostic('pageMap.sectionFallback',{error:Error('signed source URL')});
  recordReaderDiagnostic('pageMap.sectionFallback');
  assert.equal(lines.length,1);assert.equal(lines[0].length,1);assert.ok(!String(lines).includes('signed source URL'));
});

test('a measurement completes once even when its finally block reports cancellation',()=>{
  const before=getReaderDiagnostics().counts['continuous.buffered']||0,finish=measureReaderOperation('continuous.buffered');
  finish({views:9});finish({},'continuous.cancelled');
  assert.equal(getReaderDiagnostics().counts['continuous.buffered'],before+1);
  assert.equal(getReaderDiagnostics().events.at(-1).views,9);
});
