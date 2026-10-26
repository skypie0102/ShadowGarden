import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { createSpeechBuffer } from "../public/assets/js/reader/speech-buffer.js";

const voice = "en-US-BrianMultilingualNeural";
async function until(check) {
  for (let i = 0; i < 30; i++) {
    if (check()) return;
    await setImmediate();
  }
  assert.ok(check(), "speech work did not reach the expected state");
}
function fixture() {
  // The next spoken chapter follows an illustration-only section.
  const positions = [1, 3, 4].flatMap(spineIndex => {
    const entries = Array.from({ length: 3 }, (_, index) => ({ text: `${spineIndex}/${index}` }));
    return entries.map((_, index) => ({ entries, index, spineIndex }));
  });
  const calls = [], moves = [];
  const source = { async move(cursor, direction, { signal }) {
    signal.throwIfAborted();
    moves.push(cursor);
    return positions[positions.indexOf(cursor) + direction] || null;
  } };
  const fetchAudio = (text, selectedVoice, signal) => new Promise((resolve, reject) => {
    calls.push({ text, voice: selectedVoice, signal,
      resolve: () => resolve(new Blob([`${selectedVoice}:${text}`])), reject });
  });
  return { buffer: createSpeechBuffer({ source, fetchAudio }), positions, calls, moves };
}
test("four future passages preload across chapter boundaries and are reused in order", async () => {
  const { buffer, positions, calls, moves } = fixture(), controller = new AbortController();
  const current = buffer.read(positions[0], voice, { signal: controller.signal });
  await until(() => calls.length === 3);
  assert.deepEqual(calls.map(c => c.text), ["1/0", "1/1", "1/2"]);
  calls[0].resolve();
  await current;
  calls[2].resolve(); // A later response arriving first cannot reorder narration.
  await until(() => calls.length === 4);
  calls[1].resolve();
  await until(() => calls.length === 5);
  calls[3].resolve(); calls[4].resolve();
  await setImmediate();
  assert.deepEqual(calls.map(c => c.text), ["1/0", "1/1", "1/2", "3/0", "3/1"]);
  const traversals = moves.length;
  buffer.prefetch(positions[0], voice); // Resume keeps completed audio.
  await setImmediate();
  assert.equal(calls.length, 5);
  assert.equal(moves.length, traversals);
  const second = await buffer.read(positions[1], voice, { signal: controller.signal });
  assert.equal(await second.text(), `${voice}:1/1`);
  await until(() => calls.length === 6);
  assert.equal(calls[5].text, "3/2");
  calls[5].resolve();
  for (const position of positions.slice(2, 5)) {
    const blob = await buffer.read(position, voice, { signal: controller.signal });
    assert.equal(await blob.text(), `${voice}:${position.entries[position.index].text}`);
  }
  assert.equal(calls.filter(c => c.text === "3/0").length, 1);
  buffer.clear();
});
test("background concurrency is two and the window stops at four until playback advances", async () => {
  const { buffer, positions, calls } = fixture();
  const task = buffer.read(positions[0], voice, { signal: new AbortController().signal });
  await until(() => calls.length === 3);
  await setImmediate();
  assert.equal(calls.length, 3); // One foreground, two speculative requests.
  calls[0].resolve(); await task;
  calls[1].resolve(); await until(() => calls.length === 4);
  calls[2].resolve(); await until(() => calls.length === 5);
  calls[3].resolve(); calls[4].resolve();
  await setImmediate();
  assert.equal(calls.length, 5);
  buffer.clear();
});
test("a failed speculative fetch retries when needed without discarding other ready audio", async () => {
  const { buffer, positions, calls } = fixture(), signal = new AbortController().signal;
  const current = buffer.read(positions[0], voice, { signal });
  await until(() => calls.length === 3);
  calls[0].resolve(); await current;
  calls[1].reject(new Error("temporary connection failure"));
  calls[2].resolve();
  await until(() => calls.length === 5);
  calls[3].resolve(); calls[4].resolve();
  const next = buffer.read(positions[1], voice, { signal });
  await until(() => calls.filter(c => c.text === "1/1").length === 2);
  calls.findLast(c => c.text === "1/1").resolve();
  assert.equal(await (await next).text(), `${voice}:1/1`);
  assert.equal(await (await buffer.read(positions[2], voice, { signal })).text(), `${voice}:1/2`);
  buffer.clear();
});
test("stop aborts a consumed in-flight preload; late responses cannot refill a replaced voice", async () => {
  const { buffer, positions, calls } = fixture(), signal = new AbortController().signal;
  const initial = buffer.read(positions[0], voice, { signal });
  await until(() => calls.length === 3);
  calls[0].resolve(); await initial;
  const controller = new AbortController();
  const advancing = buffer.read(positions[1], voice, { signal: controller.signal });
  controller.abort(); buffer.clear();
  await assert.rejects(advancing, { name: "AbortError" });
  assert.ok(calls.slice(1).every(c => c.signal.aborted));
  const replacementVoice = "en-GB-SoniaNeural";
  const replacement = buffer.read(positions[0], replacementVoice, { signal, preload: false });
  await until(() => calls.some(c => c.voice === replacementVoice));
  const oldCount = calls.filter(c => c.voice === voice).length;
  calls.filter(c => c.voice === voice).forEach(c => c.resolve());
  await setImmediate();
  assert.equal(calls.filter(c => c.voice === voice).length, oldCount);
  calls.find(c => c.voice === replacementVoice).resolve();
  assert.equal(await (await replacement).text(), `${replacementVoice}:1/0`);
  buffer.clear();
});
test("stopping during a slow chapter lookup cannot enqueue late speech", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; }), calls = [];
  const cursor = { spineIndex: 0, index: 0, entries: [{ text: "Current" }] };
  const buffer = createSpeechBuffer({
    source: { move: () => gate },
    fetchAudio: async text => { calls.push(text); return new Blob([text]); },
  });
  await buffer.read(cursor, voice, { signal: new AbortController().signal });
  buffer.clear();
  release({ ...cursor, spineIndex: 1, entries: [{ text: "Late chapter" }] });
  await setImmediate();
  assert.deepEqual(calls, ["Current"]);
});

test('streaming peeks reuse the four-passage window without advancing or regenerating it',async()=>{
  const {buffer,positions,calls}=fixture(),signal=new AbortController().signal;
  const current=buffer.read(positions[0],voice,{signal});
  await until(()=>calls.length===3);calls[0].resolve();await current;
  calls[1].resolve();calls[2].resolve();await until(()=>calls.length===5);
  calls[3].resolve();calls[4].resolve();
  for(const position of positions.slice(1,5))
    assert.equal(await(await buffer.peek(position,voice,{signal})).text(),`${voice}:${position.entries[position.index].text}`);
  assert.equal(calls.length,5);
  assert.equal(await(await buffer.read(positions[1],voice,{signal})).text(),`${voice}:1/1`);
  await until(()=>calls.length===6);
  assert.equal(calls.filter(c=>c.text==='1/1').length,1);
  buffer.clear();
});
