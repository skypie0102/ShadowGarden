import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {summarizeScrollDiagnostics} from '../scripts/summarize-reader-scroll-diagnostics.mjs';

test('scroll diagnostic summary retains the known original failure without transaction data',async()=>{
  const witness=JSON.parse(await readFile(new URL('../docs/archive/evidence/reader-scroll-stress-m5a.json',import.meta.url),'utf8'));
  const report={suites:[{title:'original M5a witness',results:[{attachments:[{name:'visible-passage-trace',
    body:Buffer.from(JSON.stringify(witness.trace)).toString('base64')}]}]}]};
  const summary=summarizeScrollDiagnostics(report);
  assert.equal(summary.traceCount,1);
  assert.equal(summary.recordedTraceCount,0);
  assert.equal(summary.reversals.length,1);
  assert.equal(summary.reversals[0].sample,89);
  assert.equal(summary.reversals[0].delta,-56);
  assert.equal(summary.sampleCount,163);
});
