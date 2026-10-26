import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  createReaderZip,
  createReaderEpub,
  installReaderFixture,
  readerURL,
  readerBookId,
  readerSeriesId,
} from "./reader-production-fixture.mjs";

const bootstrap = "/assets/js/reader-bootstrap.js?v=2.11.0";
const voices = [
  { id: "en-US-BrianMultilingualNeural", locale: "en-US", gender: "Male" },
  { id: "en-US-EmmaMultilingualNeural", locale: "en-US", gender: "Female" },
  { id: "en-US-GuyNeural", locale: "en-US", gender: "Male" },
  { id: "en-GB-SoniaNeural", locale: "en-GB", gender: "Female" },
  { id: "fr-FR-DeniseNeural", locale: "fr-FR", gender: "Female" },
  { id: "ja-JP-NanamiNeural", locale: "ja-JP", gender: "Female" },
];
// Original 440 Hz test tone: ffmpeg lavfi sine, 24 kHz mono, 48 kbit MP3, 3 s.
const testAudio = Buffer.from(
  await readFile(
    new URL("../fixtures/reader-speech-tone.base64", import.meta.url),
    "utf8",
  ),
  "base64",
);
async function publication() {
  const zip = await createReaderZip();
  await zip.loadAsync(
    await createReaderEpub({ chapterCount: 3, paragraphCount: 2 }),
  );
  zip.file(
    "chapter0.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Chapter zero</title></head><body><h1>Chapter zero</h1><p id="first">First spoken paragraph. <em>Emphasis</em> remains readable.</p><p hidden="hidden">Hidden prose must not be read.</p><p id="second">Second spoken paragraph with <ruby>漢字<rt>かんじ</rt></ruby> and café.</p><aside epub:type="footnote"><p>Footnote must not be read.</p></aside><p><img src="art.svg" alt="Illustration must not be spoken"/></p><p id="last">Last paragraph of chapter zero.</p></body></html>',
  );
  zip.file(
    "chapter1.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Artwork</title></head><body><img src="art.svg" alt="Skip this whole image chapter"/></body></html>',
  );
  zip.file(
    "chapter2.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter two</title></head><body><h1>Chapter two</h1><p id="final">Final spoken paragraph.</p></body></html>',
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
async function mediaFixture(page) {
  await page.addInitScript(() => {
    window.__speechEvents = { plays: 0, pauses: 0, revoked: [] };
    HTMLMediaElement.prototype.play = function () {
      if (this.id === "speechAudio") {
        window.__speechEvents.plays++;
        this.dataset.playing = "true";
        return Promise.resolve();
      }
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      if (this.id === "speechAudio") {
        window.__speechEvents.pauses++;
        this.dataset.playing = "false";
      }
    };
    HTMLMediaElement.prototype.load = function () {};
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.__speechEvents.revoked.push(url);
      revoke(url);
    };
  });
}
async function speechState(page) {
  return page.evaluate(
    async (bootstrap) =>
      (await import(bootstrap)).readerRuntime.current.speech.state,
    bootstrap,
  );
}
async function open(page, flow, { mockMedia = true, epub, adult = false } = {}) {
  if (mockMedia) await mediaFixture(page);
  await installReaderFixture(page, { flow, publication: epub || await publication() });
  if(adult) await page.addInitScript(()=>localStorage.setItem('sg-adult-ack','1'));
  if(adult) await page.route('**/media/shadow-garden/data/adult-catalog.json',route=>route.fulfill({json:{series:[{id:readerSeriesId,title:'Original speech fixture',volumes:[{bookId:readerBookId,file:readerBookId,title:'Original speech fixture',number:1}]}]}}));
  await page.route("**/tts", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { ok: true, voices } });
    return route.fulfill({ contentType: "audio/mpeg", body: testAudio });
  });
  await page.goto(readerURL+(adult?'&scope=adult':''));
  await expect(page.locator("#readerLoading")).toBeHidden({ timeout: 60000 });
  await page.locator("#tocToggle").click();
  await page
    .locator('#tocPanel .toc-entry-link[data-href="chapter0.xhtml"]')
    .click();
  await expect(page.locator("#viewer")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  await page.locator("#speechToggle").click();
  await expect(page.locator("#speechDrawer")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(page.locator("#speechVoice option")).toHaveCount(4);
}
async function position(page, id) {
  return page.evaluate(
    async ({ bootstrap, id }) => {
      const reader = (await import(bootstrap)).readerRuntime.current,
        section = reader.state.book.spine.get("chapter0.xhtml");
      const { withSectionSource } = await import(
        "/assets/js/reader/section-source.js"
      );
      const cfi = await withSectionSource(
        section,
        reader.state.book.load.bind(reader.state.book),
        (doc) => {
          const range = doc.createRange();
          range.selectNodeContents(doc.getElementById(id));
          return section.cfiFromRange(range);
        },
      );
      const { createSpeechSource } = await import(
        "/assets/js/reader/speech-source.js"
      );
      const cursor = await createSpeechSource({
        getBook: () => reader.state.book,
        getCfi: () => cfi,
        getSpineIndex: () => section.index,
      }).current();
      return {
        current: cursor.entries[cursor.index].text,
        entries: cursor.entries.map((e) => e.text),
      };
    },
    { bootstrap, id },
  );
}
async function options(page) {
  if (!(await page.locator("#speechDrawer").getAttribute("class")).includes("open"))
    await page.locator("#speechToggle").click();
  await expect(page.locator("#speechDrawer")).toHaveAttribute("aria-hidden", "false");
}
async function pressSpeech(page, id) {
  await options(page);
  await page.locator("#" + id).click();
}
async function closeOptions(page) {
  if ((await page.locator("#speechDrawer").getAttribute("class")).includes("open"))
    await page.locator("#speechDrawer [data-close]").click();
}
async function positionPublication() {
  const zip = await createReaderZip();
  await zip.loadAsync(await createReaderEpub({chapterCount:3,paragraphCount:3}));
  const prose = 'A quiet original passage checks narration and a comfortable reading position. ';
  zip.file('chapter0.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Spoken positions</title></head><body>
    <h1>Spoken positions</h1>
    ${Array.from({length:30},(_,i)=>`<p id="lead-${i}">Passage ${i}. ${prose}</p>`).join('')}
    <p id="long">${('An original long passage with inline <em>emphasis</em> and   varied\n whitespace. ').repeat(48)}</p>
    ${Array.from({length:20},(_,i)=>`<p>Following passage ${i}. ${prose}</p>`).join('')}
    </body></html>`);
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
async function markedPosition(page) {
  return page.evaluate(async bootstrap => {
    const reader=(await import(bootstrap)).readerRuntime.current;
    const manager=reader.state.rendition.manager,viewport=manager.container.getBoundingClientRect();
    for(const frame of document.querySelectorAll('#viewer iframe')) {
      const doc=frame.contentDocument,win=doc?.defaultView;
      const mark=win?.CSS?.highlights?.get('sg-reader-speech');
      if(!mark?.size)continue;
      const range=[...mark][0],frameRect=frame.getBoundingClientRect();
      const allRects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);
      if(!allRects.length)continue;
      const visible=allRects.filter(r=>frameRect.left+r.right>viewport.left+1 && frameRect.left+r.left<viewport.right-1);
      const rects=visible.length?visible:allRects;
      const top=Math.min(...rects.map(r=>r.top)),bottom=Math.max(...rects.map(r=>r.bottom));
      const middle=bottom-top<=viewport.height*.7?(top+bottom)/2:(rects[0].top+rects[0].bottom)/2;
      const color=win.getComputedStyle(range.startContainer.parentElement,'::highlight(sg-reader-speech)').backgroundColor;
      const context=doc.createElement('canvas').getContext('2d');
      context.fillStyle=color;context.fillRect(0,0,1,1);
      const view=manager.views.all().find(v=>v.contents?.document===doc);
      return {cfi:view.section.cfiFromRange(range),text:range.toString().replace(/\s+/g,' ').trim(),
        distance:visible.length?Math.abs(frameRect.top+middle-(viewport.top+viewport.height/2)):99999,
        color:[...context.getImageData(0,0,1,1).data],cssColor:color,
        centeredPage:manager.container.classList.contains('sg-speech-centered-page'),
        scrollTop:manager.container.scrollTop,html:doc.getElementById('lead-0')?.innerHTML};
    }
    return null;
  },bootstrap);
}
test('English voices replace a saved non-English choice and the floating controls navigate passages', async ({page}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('sg-reader-speech-settings'))
      localStorage.setItem('sg-reader-speech-settings', JSON.stringify({voice:'fr-FR-DeniseNeural',speed:1,follow:true}));
  });
  await open(page,'scrolled-doc');
  await expect(page.locator('#speechVoice')).toHaveValue('en-US-BrianMultilingualNeural');
  expect(await page.locator('#speechVoice option').evaluateAll(options => options.map(o=>o.value).sort())).toEqual([
    'en-GB-SoniaNeural','en-US-BrianMultilingualNeural','en-US-EmmaMultilingualNeural','en-US-GuyNeural',
  ]);
  await page.locator('#speechVoice').selectOption('en-GB-SoniaNeural');
  await pressSpeech(page,'speechPlay');
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  await expect(page.locator('#speechMiniPlay .speech-icon-pause')).toBeVisible();
  await expect(page.locator('#speechMiniPlay .speech-icon-play')).toBeHidden();
  await expect(page.locator('#speechMiniPlay')).toHaveAccessibleName('Pause read aloud');
  await page.locator('#speechMiniPlay').click();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('paused');
  await expect(page.locator('#speechMiniPlay .speech-icon-play')).toBeVisible();
  await expect(page.locator('#speechMiniPlay .speech-icon-pause')).toBeHidden();
  await expect(page.locator('#speechMiniPlay')).toHaveAccessibleName('Resume read aloud');
  await page.locator('#speechMiniPlay').click();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  await expect(page.locator('#speechMiniPlay .speech-icon-pause')).toBeVisible();
  while((await speechState(page)).index>0){await page.locator('#speechMiniPrevious').click();await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');}
  await expect(page.locator('#speechPassage')).toHaveText('Chapter zero');
  await page.locator('#speechMiniNext').click();
  await expect(page.locator('#speechPassage')).toHaveText('First spoken paragraph. Emphasis remains readable.');
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  await page.locator('#speechMiniPrevious').click();
  await expect(page.locator('#speechPassage')).toHaveText('Chapter zero');
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  expect(await page.locator('#speechMini > button').evaluateAll(buttons=>buttons.map(b=>b.id))).toEqual([
    'speechMiniFollow','speechMiniPrevious','speechMiniPlay','speechMiniNext','speechMiniStop','speechMiniSettings',
  ]);
  for(const width of [320,393,1280]) {
    await page.setViewportSize({width,height:800});
    const boxes=await page.locator('#speechMini > button').evaluateAll(buttons=>buttons.map(b=>{
      const r=b.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
    }));
    expect(boxes[0].left).toBeGreaterThanOrEqual(0);
    expect(boxes.at(-1).right).toBeLessThanOrEqual(width);
    boxes.forEach((box,i)=>{
      expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width);
      if(i && box.top < boxes[i-1].bottom)expect(box.left).toBeGreaterThanOrEqual(boxes[i-1].right);
    });
    if(width<420)expect(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom);
    else expect(boxes.every(box=>box.top===boxes[0].top)).toBe(true);
    await test.info().attach(`speech-floating-controls-${width}`,{body:await page.screenshot(),contentType:'image/png'});
  }
  await page.locator('#speechMiniFollow').focus();
  for(const id of ['speechMiniPrevious','speechMiniPlay','speechMiniNext','speechMiniStop','speechMiniSettings']) {
    await page.keyboard.press('Tab');await expect(page.locator('#'+id)).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await expect(page.locator('#speechDrawer')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#speechPlay .speech-icon-pause')).toBeVisible();
  await expect(page.locator('#speechPlay .speech-icon-play')).toBeHidden();
  await expect(page.locator('#speechPlay .speech-play-label')).toHaveText('Pause');
  await expect(page.locator('#speechStop')).toHaveAccessibleName('Exit read aloud');
  await expect(page.locator('#speechMiniStop')).toHaveAccessibleName('Exit read aloud');
  await closeOptions(page);
  await page.locator('#speechMiniStop').click();
  await expect(page.locator('#speechMini')).toBeHidden();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('idle');
  await page.reload();
  await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  await page.locator('#speechToggle').click();
  await expect(page.locator('#speechVoice')).toHaveValue('en-GB-SoniaNeural');
  await expect(page.locator('#speechMini')).toBeHidden();
});

async function ornamentPublication() {
  const zip = await createReaderZip();
  await zip.loadAsync(await createReaderEpub({chapterCount:3,paragraphCount:1}));
  zip.file('chapter0.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Dividers</title></head><body><h1>Readable start</h1><p>Before the divider.</p><p>❦</p><p>✦ ❧ ⁂</p><p>***</p><p>— … —</p><p id="ornament-prose">After ❦ the <em>divider</em>: café, 漢字, 20°C &amp; $5.</p></body></html>');
  zip.file('chapter1.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Scene break</title></head><body><p>❦ ❧</p><p>※</p></body></html>');
  zip.file('chapter2.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Readable end</title></head><body><h1>Next readable chapter</h1><p>Final paragraph.</p></body></html>');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
for (const flow of ['paginated','scrolled-doc'])
  test(`${flow}: ornamental dividers never interrupt speech or preload and original highlighting stays intact`, async ({page}) => {
    test.setTimeout(120000);
    await open(page,flow,{epub:await ornamentPublication()});
    const requests=[];
    await page.route('**/tts', async route => {
      if(route.request().method()==='GET')return route.fallback();
      const {text}=route.request().postDataJSON();
      requests.push(text);
      // Model the reported provider failure instead of returning audio for
      // every input: standalone separators and inline fleurons get no audio.
      if(!/[\p{L}\p{N}]/u.test(text)||/[❦❧✦⁂※]/u.test(text))
        return route.fulfill({status:503,json:{error:'No speech audio received'}});
      return route.fulfill({contentType:'audio/mpeg',body:testAudio});
    });
    await pressSpeech(page,'speechPlay');
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    while((await speechState(page)).index>0) {
      await page.locator('#speechMiniPrevious').click();
      await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    }
    const original='After ❦ the divider: café, 漢字, 20°C & $5.';
    for(const text of ['Readable start','Before the divider.',original,'Next readable chapter','Final paragraph.']) {
      await expect(page.locator('#speechPassage')).toHaveText(text);
      await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
      if(text===original)await expect.poll(()=>markedPosition(page).then(p=>p?.text)).toBe(original);
      if(text==='Next readable chapter')expect((await speechState(page)).spineIndex).toBe(3);
      await ended(page);
    }
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('complete');
    expect(requests).toContain('After the divider: café, 漢字, 20°C & $5.');
    expect(requests.every(text=>/[\p{L}\p{N}]/u.test(text)&&!/[❦❧✦⁂※]/u.test(text))).toBe(true);
    expect(await page.evaluate(async bootstrap=>{
      const reader=(await import(bootstrap)).readerRuntime.current;
      const {withSectionSource}=await import('/assets/js/reader/section-source.js');
      return withSectionSource(reader.state.book.spine.get('chapter0.xhtml'),reader.state.book.load.bind(reader.state.book),doc=>{
        const paragraph=doc.getElementById('ornament-prose');
        return {text:paragraph.textContent,emphasis:paragraph.querySelector('em')?.textContent};
      });
    },bootstrap)).toEqual({text:original,emphasis:'divider'});
  });

async function followMotion(page, {pause = false} = {}) {
  return page.evaluate(async ({bootstrap,pause}) => {
    const r=(await import(bootstrap)).readerRuntime.current;
    const container=r.state.rendition.manager.container;
    const start=container.scrollTop,samples=[];
    let pausedAt=null,displays=0;
    const display=r.state.rendition.display;
    r.state.rendition.display=function(...args){displays++;return display.apply(this,args);};
    document.getElementById('speechAudio').dispatchEvent(new Event('ended'));
    try {
      await new Promise(resolve=>{
        const started=performance.now();
        function sample(time){
          const top=container.scrollTop;
          samples.push(top);
          if(pause && pausedAt===null && Math.abs(top-start)>2){
            document.getElementById('speechMiniPlay').click();pausedAt=container.scrollTop;
          }
          if(time-started>=700)resolve();else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
    } finally {r.state.rendition.display=display;}
    return {start,samples,pausedAt,end:container.scrollTop,displays};
  },{bootstrap,pause});
}
for(const flow of ['paginated','scrolled-doc'])
  test(`${flow}: following animates one movement and pause cancels the remaining frames`,async({page})=>{
    await open(page,flow);
    await pressSpeech(page,'speechPlay');
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
    const motion=await followMotion(page);
    expect(motion.displays).toBe(0);
    const distance=motion.end-motion.start;
    expect(Math.abs(distance)).toBeGreaterThan(12);
    expect(new Set(motion.samples.map(v=>Math.round(v))).size).toBeGreaterThan(4);
    const steps=motion.samples.map((v,i)=>v-(i?motion.samples[i-1]:motion.start));
    expect(Math.max(...steps.map(Math.abs))).toBeLessThan(Math.abs(distance)*0.6);
    expect(steps.every(v=>v*Math.sign(distance)>=-1)).toBe(true);
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
    const stopped=await followMotion(page,{pause:true});
    expect(stopped.pausedAt).not.toBeNull();
    expect(stopped.end).toBeCloseTo(stopped.pausedAt,0);
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('paused');
    expect(await markedPosition(page)).not.toBeNull();
    await page.locator('#speechMiniStop').click();
    await expect(page.locator('.sg-speech-centered-page,.sg-speech-centered-scroll')).toHaveCount(0);
  });
test('reduced motion follows a passage without an animated scroll',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page,'scrolled-doc');
  await pressSpeech(page,'speechPlay');
  await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
  const motion=await followMotion(page);
  expect(motion.displays).toBe(0);
  expect(Math.abs(motion.end-motion.start)).toBeGreaterThan(12);
  const intermediate=motion.samples.filter(v=>Math.abs(v-motion.start)>1 && Math.abs(v-motion.end)>1);
  expect(intermediate).toEqual([]);
  await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
});

for(const flow of ['paginated','scrolled-doc'])
  test(`${flow}: the first and last spoken passages can be centered without cover or trailing content`,async({page})=>{
    test.setTimeout(90000);
    const zip=await createReaderZip();
    await zip.loadAsync(await createReaderEpub({chapterCount:2,paragraphCount:1}));
    zip.file('book.opf',(await zip.file('book.opf').async('string')).replace('<itemref idref="cover"/>',''));
    zip.file('chapter0.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First</title></head><body><h1>First boundary heading</h1><p>First original boundary passage.</p></body></html>');
    zip.file('chapter1.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Last</title></head><body><h1>Final boundary heading</h1><p>Final original boundary passage.</p></body></html>');
    await open(page,flow,{epub:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});
    await pressSpeech(page,'speechPlay');
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    while((await speechState(page)).index>0){await pressSpeech(page,'speechPrevious');await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');}
    await expect(page.locator('#speechPassage')).toHaveText('First boundary heading');
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance),{timeout:10000}).toBeLessThan(8);
    await test.info().attach(`speech-boundary-${flow}-first`,{body:await page.screenshot(),contentType:'image/png'});
    for(let step=0;step<4 && ((await speechState(page)).spineIndex<1 || (await speechState(page)).index<1);step++){
      await ended(page);await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    }
    await expect(page.locator('#speechPassage')).toHaveText('Final original boundary passage.');
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance),{timeout:10000}).toBeLessThan(8);
    await test.info().attach(`speech-boundary-${flow}-last`,{body:await page.screenshot(),contentType:'image/png'});
    await page.locator('#speechMiniStop').click();
    expect(await markedPosition(page)).toBeNull();
    await expect(page.locator('.sg-speech-centered-page,.sg-speech-centered-scroll')).toHaveCount(0);
  });
async function ended(page) {
  await page
    .locator("#speechAudio")
    .evaluate((audio) => audio.dispatchEvent(new Event("ended")));
}

async function browseAway(page, { iframe = false, type = 'wheel' } = {}) {
  return page.evaluate(async ({bootstrap,iframe,type}) => {
    const r=(await import(bootstrap)).readerRuntime.current;
    const container=r.state.rendition.manager.container;
    const doc=iframe?r.state.rendition.getContents()[0].document:document;
    const target=iframe?doc.body:document.getElementById('viewer');
    const win=doc.defaultView;
    const event=type==='keydown'?new win.KeyboardEvent(type,{key:'PageDown',bubbles:true}):
      type==='wheel'?new win.WheelEvent(type,{bubbles:true,deltaY:160}):new win.Event(type,{bubbles:true});
    target.dispatchEvent(event);
    container.scrollTop+=160;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return {top:container.scrollTop,source:document.getElementById('speechAudio').getAttribute('src'),...window.__speechEvents};
  },{bootstrap,iframe,type});
}
for(const flow of ['paginated','scrolled-doc'])
  test(`${flow}: browsing keeps speech playing and the status control rejoins the current passage`,async({page})=>{
    await open(page,flow,{epub:await positionPublication()});
    await pressSpeech(page,'speechPlay');
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
    const original=await page.locator('#speechAudio').getAttribute('src');
    const pauses=await page.evaluate(()=>window.__speechEvents.pauses);
    const away=await browseAway(page);
    await expect.poll(()=>speechState(page).then(s=>s.following)).toBe(false);
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    expect(away.source).toBe(original);expect(away.pauses).toBe(pauses);
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeGreaterThan(60);
    const spoken=await page.locator('#speechPassage').textContent();
    await ended(page);
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    await expect(page.locator('#speechPassage')).not.toHaveText(spoken);
    expect((await markedPosition(page)).scrollTop).toBeCloseTo(away.top,0);
    const beforeReturn=await page.evaluate(()=>({source:document.getElementById('speechAudio').getAttribute('src'),...window.__speechEvents}));
    await page.locator('#speechMiniFollow').click();
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
    expect((await speechState(page)).following).toBe(true);
    await expect(page.locator('#speechDrawer')).toHaveAttribute('aria-hidden','true');
    expect(await page.locator('#speechAudio').getAttribute('src')).toBe(beforeReturn.source);
    expect(await page.evaluate(()=>window.__speechEvents.plays)).toBe(beforeReturn.plays);
    expect(await page.evaluate(()=>window.__speechEvents.pauses)).toBe(beforeReturn.pauses);
    await ended(page);
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
    // EPUB documents have their own event boundary. Touch, pointer, wheel and
    // keyboard input must all detach following without changing playback.
    for(const type of ['wheel','touchstart','pointerdown','keydown']) {
      const pauses=await page.evaluate(()=>window.__speechEvents.pauses);
      await browseAway(page,{iframe:true,type});
      expect((await speechState(page)).status).toBe('playing');
      expect((await speechState(page)).following,`Browsing input: ${type}`).toBe(false);
      expect(await page.evaluate(()=>window.__speechEvents.pauses)).toBe(pauses);
      await page.locator('#speechMiniFollow').click();
      await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
    }
    await browseAway(page);
    await page.locator('#speechMiniPlay').click();
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('paused');
    await browseAway(page);
    await page.locator('#speechMiniFollow').click();
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
    expect((await speechState(page)).status).toBe('paused');
    await page.locator('#speechMiniStop').click();
  });

test('native scrolling stays detached through narration chapter changes until the status control is tapped',async({page,browserName,isMobile})=>{
  await open(page,'scrolled-doc');
  await pressSpeech(page,'speechPlay');
  await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
  const bounds=await page.locator('#viewer').boundingBox();
  const pauses=await page.evaluate(()=>window.__speechEvents.pauses);
  if(browserName==='webkit' && isMobile) {
    // Mobile WebKit exposes no mouse-wheel input in Playwright. Exercise its
    // native scroll event path without an EPUB document callback instead.
    await page.locator('#viewer .epub-container').evaluate(container=>container.scrollBy(0,500));
  } else {
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    await page.mouse.wheel(0,500);
  }
  await expect.poll(()=>speechState(page).then(s=>s.following)).toBe(false);
  expect((await speechState(page)).status).toBe('playing');
  expect(await page.evaluate(()=>window.__speechEvents.pauses)).toBe(pauses);
  const start=await speechState(page);
  for(let i=0;i<5 && (await speechState(page)).spineIndex===start.spineIndex;i++) {
    await ended(page);await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  }
  expect((await speechState(page)).spineIndex).toBeGreaterThan(start.spineIndex);
  expect((await speechState(page)).following).toBe(false);
  await page.locator('#speechMiniFollow').click();
  await expect.poll(()=>markedPosition(page).then(p=>p?.distance),{timeout:15000}).toBeLessThan(8);
  expect((await speechState(page)).following).toBe(true);
  await page.locator('#speechMiniSettings').click();
  await expect(page.locator('#speechDrawer')).toHaveAttribute('aria-hidden','false');
  expect((await speechState(page)).status).toBe('playing');
});

test('Brian is the default and four ready passages play through a chapter boundary after the network fails', async ({page}) => {
  await open(page, 'scrolled-doc');
  await expect(page.locator('#speechVoice')).toHaveValue('en-US-BrianMultilingualNeural');
  const calls = [], ready = new Set();
  let online = true;
  await page.route('**/tts', async route => {
    if(route.request().method() === 'GET') return route.fulfill({json:{voices}});
    const body = route.request().postDataJSON();
    calls.push(body);
    if(!online) return route.fulfill({status:503,json:{error:'Network unavailable'}});
    await route.fulfill({contentType:'audio/mpeg',body:testAudio});
    ready.add(body.text);
  });
  await pressSpeech(page, 'speechPlay');
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  const all = ['Chapter zero', 'First spoken paragraph. Emphasis remains readable.',
    'Second spoken paragraph with 漢字 and café.', 'Last paragraph of chapter zero.',
    'Chapter two', 'Final spoken paragraph.'];
  const start = all.indexOf(await page.locator('#speechPassage').textContent());
  expect(start).toBeGreaterThanOrEqual(0);
  const ahead = all.slice(start + 1, start + 5);
  expect(ahead).toContain('Chapter two');
  await expect.poll(()=>ahead.every(text=>ready.has(text))).toBe(true);
  expect(calls).toHaveLength(1 + ahead.length);
  expect(calls.every(c=>c.voice === 'en-US-BrianMultilingualNeural')).toBe(true);
  online = false;
  await page.locator('#speechMiniPlay').click();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('paused');
  await page.locator('#speechMiniPlay').click();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  expect(calls).toHaveLength(1 + ahead.length);
  for(const text of ahead) {
    await ended(page);
    await expect(page.locator('#speechPassage')).toHaveText(text);
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    expect(calls.filter(c=>c.text === text)).toHaveLength(1);
  }
  await page.locator('#speechMiniStop').click();
});

test('pause and resume retain in-flight preloads and advancement waits for the original request', async ({page}) => {
  await open(page, 'scrolled-doc');
  const calls = [];
  let release;
  const gate = new Promise(resolve=>{release = resolve;});
  await page.route('**/tts', async route => {
    if(route.request().method() === 'GET') return route.fulfill({json:{voices}});
    calls.push(route.request().postDataJSON().text);
    if(calls.length > 1) await gate;
    await route.fulfill({contentType:'audio/mpeg',body:testAudio}).catch(()=>{});
  });
  await pressSpeech(page, 'speechPlay');
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  await expect.poll(()=>calls.length).toBe(3);
  const next = calls[1];
  await page.locator('#speechMiniPlay').click();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('paused');
  await page.locator('#speechMiniPlay').click();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  expect(calls).toHaveLength(3);
  await ended(page);
  await expect(page.locator('#speechPassage')).toHaveText(next);
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('loading');
  expect(calls.filter(text=>text === next)).toHaveLength(1);
  release();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  expect(calls.filter(text=>text === next)).toHaveLength(1);
  await page.locator('#speechMiniStop').click();
});

for(const flow of ['paginated','scrolled-doc'])
  test(`${flow}: spoken passages stay centered, follow the theme and close options on start/resume`,async({page})=>{
    test.setTimeout(150000);
    await open(page,flow,{epub:await positionPublication()});
    await expect.poll(()=>page.evaluate(async bootstrap=>(await import(bootstrap)).readerRuntime.current.state.pageMap.map()?.totalPages||0,bootstrap),{timeout:60000}).toBeGreaterThan(0);
    const mapBefore=await page.evaluate(async bootstrap => {
      const r=(await import(bootstrap)).readerRuntime.current;
      const section=r.state.book.spine.get('chapter0.xhtml');
      const {withSectionSource}=await import('/assets/js/reader/section-source.js');
      const cfi=await withSectionSource(section,r.state.book.load.bind(r.state.book),doc=>{
        const range=doc.createRange();range.selectNodeContents(doc.getElementById('lead-24'));
        return section.cfiFromRange(range);
      });
      const {navigateRendition}=await import('/assets/js/reader/navigation-state.js');
      await navigateRendition(r.state.rendition,cfi);
      return r.state.pageMap.map()?.totalPages;
    },bootstrap);
    await pressSpeech(page,'speechPlay');
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    await expect(page.locator('#speechDrawer')).toHaveAttribute('aria-hidden','true');
    await expect(page.locator('#speechToggle')).toHaveAttribute('aria-expanded','false');
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance),{timeout:30000}).toBeLessThan(8);
    const first=await markedPosition(page);
    expect(first.text).toBe(await page.locator('#speechPassage').textContent());
    expect(first.centeredPage).toBe(flow==='paginated');
    await options(page);
    await ended(page);
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    await expect.poll(()=>markedPosition(page).then(p=>p?.text)).not.toBe(first.text);
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance),{timeout:30000}).toBeLessThan(8);
    // Automatic chunk transitions must not dismiss options the reader reopened.
    await expect(page.locator('#speechDrawer')).toHaveAttribute('aria-hidden','false');
    await pressSpeech(page,'speechPlay');
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('paused');
    expect(await markedPosition(page)).not.toBeNull();
    await pressSpeech(page,'speechPlay');
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    await expect(page.locator('#speechDrawer')).toHaveAttribute('aria-hidden','true');
    const palette={garden:[185,168,227],night:[157,176,234],paper:[83,110,85],black:[185,168,227]};
    for(const theme of ['night','paper','black','garden']) {
      await page.locator('#settingsToggle').click();
      await page.locator('#themeSelect').selectOption(theme);
      await expect.poll(()=>markedPosition(page).then(p=>p?Math.max(...p.color.slice(0,3).map((v,i)=>Math.abs(v-palette[theme][i]))):999)).toBeLessThanOrEqual(3);
      expect((await markedPosition(page)).color[3]).toBeGreaterThan(60);
      expect((await markedPosition(page)).html).toBe(first.html);
      await page.locator('#settingsDrawer [data-close]').click();
      await test.info().attach(`speech-highlight-${flow}-${theme}`,{body:await page.screenshot(),contentType:'image/png'});
    }
    const chunks=await page.evaluate(async bootstrap=>{
      const r=(await import(bootstrap)).readerRuntime.current,section=r.state.book.spine.get('chapter0.xhtml');
      const {withSectionSource}=await import('/assets/js/reader/section-source.js');
      const {speechPassages}=await import('/assets/js/reader/speech-source.js');
      return withSectionSource(section,r.state.book.load.bind(r.state.book),doc=>{
        const long=speechPassages(doc,section).filter(e=>e.text.startsWith('An original')||e.text.includes('long passage'));
        const contents=r.state.rendition.getContents().find(c=>c.document.getElementById('long'));
        return long.map(e=>({cfi:e.cfi,text:e.text,range:contents.range(e.cfi).toString().replace(/\s+/g,' ').trim()}));
      });
    },bootstrap);
    expect(chunks.length).toBeGreaterThan(2);
    expect(new Set(chunks.map(e=>e.cfi)).size).toBe(chunks.length);
    for(const chunk of chunks){expect(chunk.range).toBe(chunk.text);expect(chunk.text.length).toBeLessThanOrEqual(1000);}
    for(let i=0;i<35&&!(await markedPosition(page))?.text.includes('long passage');i++){
      await ended(page);await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    }
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance),{timeout:30000}).toBeLessThan(8);
    const longBefore=await markedPosition(page);expect(longBefore.text).toContain('long passage');
    await ended(page);await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    await expect.poll(()=>markedPosition(page).then(p=>p?.cfi)).not.toBe(longBefore.cfi);
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance),{timeout:30000}).toBeLessThan(8);
    await options(page);await page.locator('#speechFollow').uncheck();
    await page.locator('#speechFollow').check();
    if(flow==='paginated')await expect(page.locator('.sg-speech-centered-page')).toHaveCount(1);
    await expect.poll(()=>markedPosition(page).then(p=>p?.distance),{timeout:30000}).toBeLessThan(8);
    await page.locator('#speechFollow').uncheck();
    const before=await page.evaluate(async bootstrap=>(await import(bootstrap)).readerRuntime.current.state.rendition.manager.container.scrollTop,bootstrap);
    await pressSpeech(page,'speechNext');
    await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
    await expect.poll(()=>markedPosition(page).then(p=>p?.text)).toBe(await page.locator('#speechPassage').textContent());
    expect((await markedPosition(page)).scrollTop).toBeCloseTo(before,0);
    await page.locator('#speechMiniStop').click();
    expect(await markedPosition(page)).toBeNull();
    const after=await page.evaluate(async bootstrap=>{
      const r=(await import(bootstrap)).readerRuntime.current;
      return {pages:r.state.pageMap.map()?.totalPages,center:r.state.rendition.manager.container.classList.contains('sg-speech-centered-page')};
    },bootstrap);
    expect(after.center).toBe(false);expect(after.pages).toBe(mapBefore);
  });

test('Adult read aloud uses rose highlights and keeps the paused passage until stopped',async({page})=>{
  await open(page,'scrolled-doc',{adult:true});
  await expect(page.locator('body')).toHaveClass(/adult-reader/);
  await pressSpeech(page,'speechPlay');
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  for(const theme of ['garden','black']){
    if(theme==='black'){
      await page.locator('#settingsToggle').click();
      await page.locator('#themeSelect').selectOption(theme);
      await page.locator('#settingsDrawer [data-close]').click();
    }
    await expect.poll(()=>markedPosition(page).then(p=>p?Math.max(...p.color.slice(0,3).map((v,i)=>Math.abs(v-[210,154,169][i]))):999)).toBeLessThanOrEqual(3);
    await test.info().attach(`speech-adult-${theme}`,{body:await page.screenshot(),contentType:'image/png'});
  }
  await page.locator('#speechMiniPlay').click();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('paused');
  expect(await markedPosition(page)).not.toBeNull();
  await page.locator('#speechMiniStop').click();
  expect(await markedPosition(page)).toBeNull();
});

test('compatible SVG highlighting follows the theme when Custom Highlight is unavailable',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'Highlight',{configurable:true,value:undefined});
    const supports=CSS.supports.bind(CSS);
    CSS.supports=(...args)=>String(args[0]).includes('::highlight')?false:supports(...args);
  });
  await open(page,'scrolled-doc');
  await pressSpeech(page,'speechPlay');
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  await expect(page.locator('.sg-reader-speech-highlight')).toHaveCount(1);
  for(const theme of ['garden','paper']){
    if(theme==='paper'){
      await page.locator('#settingsToggle').click();
      await page.locator('#themeSelect').selectOption(theme);
      await page.locator('#settingsDrawer [data-close]').click();
    }
    await expect.poll(()=>page.evaluate(()=>{
      const mark=document.querySelector('.sg-reader-speech-highlight');
      const context=document.createElement('canvas').getContext('2d');
      const rgba=color=>{context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].join(',');};
      return mark&&rgba(getComputedStyle(mark).fill)===rgba(getComputedStyle(document.body).getPropertyValue('--leaf'));
    })).toBe(true);
    await test.info().attach(`speech-compatible-${theme}`,{body:await page.screenshot(),contentType:'image/png'});
  }
  await page.locator('#speechMiniStop').click();
  await expect(page.locator('.sg-reader-speech-highlight')).toHaveCount(0);
});

for (const flow of ["paginated", "scrolled-doc"])
  test(`${flow}: Edge narration starts at the current passage, pauses, follows chapters and cleans up`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, flow);
    const source = await position(page, "second");
    expect(source.current).toBe("Second spoken paragraph with 漢字 and café.");
    expect(source.entries).toEqual([
      "Chapter zero",
      "First spoken paragraph. Emphasis remains readable.",
      "Second spoken paragraph with 漢字 and café.",
      "Last paragraph of chapter zero.",
    ]);
    await pressSpeech(page, "speechPlay");
    await expect
      .poll(() => speechState(page).then((s) => s.status))
      .toBe("playing");
    expect(source.entries).toContain(
      await page.locator("#speechPassage").textContent(),
    );
    while ((await speechState(page)).index > 0) {
      await pressSpeech(page, "speechPrevious");
      await expect
        .poll(() => speechState(page).then((s) => s.status))
        .toBe("playing");
    }
    await expect(page.locator("#speechPassage")).toHaveText("Chapter zero");
    await pressSpeech(page, "speechNext");
    await expect(page.locator("#speechPassage")).toHaveText(
      "First spoken paragraph. Emphasis remains readable.",
    );
    await expect
      .poll(() => speechState(page).then((s) => s.status))
      .toBe("playing");
    await pressSpeech(page, "speechNext");
    await expect
      .poll(() => speechState(page).then((s) => s.status))
      .toBe("playing");
    await expect(page.locator("#speechPassage")).toHaveText(
      "Second spoken paragraph with 漢字 and café.",
    );
    await pressSpeech(page, "speechPlay");
    await expect
      .poll(() => speechState(page).then((s) => s.status))
      .toBe("paused");
    const audioSource = await page.locator("#speechAudio").getAttribute("src");
    await pressSpeech(page, "speechPlay");
    await expect
      .poll(() => speechState(page).then((s) => s.status))
      .toBe("playing");
    expect(await page.locator("#speechAudio").getAttribute("src")).toBe(
      audioSource,
    );
    await test.info().attach(`speech-drawer-${flow}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await options(page);
    await page.locator("#speechSpeed").selectOption("1.5");
    expect(
      await page.locator("#speechAudio").evaluate((a) => a.playbackRate),
    ).toBe(1.5);
    await ended(page);
    await expect(page.locator("#speechPassage")).toHaveText(
      "Last paragraph of chapter zero.",
    );
    await expect
      .poll(() => speechState(page).then((s) => s.status))
      .toBe("playing");
    await ended(page);
    await expect(page.locator("#speechPassage")).toHaveText("Chapter two");
    await expect
      .poll(() => speechState(page).then((s) => s.status))
      .toBe("playing");
    await expect
      .poll(() => speechState(page).then((s) => s.spineIndex))
      .toBe(3);
    await options(page);
    await page.locator("#speechVoice").selectOption("en-US-GuyNeural");
    await expect
      .poll(() => speechState(page).then((s) => s.status))
      .toBe("paused");
    await pressSpeech(page, "speechPlay");
    await expect
      .poll(() => speechState(page).then((s) => s.status))
      .toBe("playing");
    await closeOptions(page);
    await expect(page.locator("#speechMini")).toBeVisible();
    await expect(page.locator("#speechToggle")).toBeFocused();
    await test.info().attach(`speech-${flow}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await page.locator("#speechMiniStop").click();
    await expect(page.locator("#speechMini")).toBeHidden();
    expect(await page.locator("#speechAudio").getAttribute("src")).toBeNull();
    expect(
      await page.evaluate(() => window.__speechEvents.revoked.length),
    ).toBeGreaterThan(2);
    await page.reload();
    await expect(page.locator("#readerLoading")).toBeHidden({ timeout: 60000 });
    await page.locator("#speechToggle").click();
    await expect(page.locator("#speechVoice")).toHaveValue("en-US-GuyNeural");
    await expect(page.locator("#speechSpeed")).toHaveValue("1.5");
    await expect(page.locator("#speechMini")).toBeHidden();
    expect(errors).toEqual([]);
  });

test("stopping pending audio and navigation cannot restart stale speech; provider errors can retry", async ({
  page,
}) => {
  test.setTimeout(120000);
  await open(page, "scrolled-doc");
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let requests = 0;
  await page.route("**/tts", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { voices } });
    requests++;
    await gate;
    await route
      .fulfill({ contentType: "audio/mpeg", body: testAudio })
      .catch(() => {});
  });
  await pressSpeech(page, "speechPlay");
  await expect.poll(() => requests).toBe(3);
  await closeOptions(page);
  await browseAway(page);
  expect((await speechState(page)).status).toBe('loading');
  expect((await speechState(page)).wantPlay).toBe(true);
  await page.locator('#speechMiniFollow').click();
  await expect.poll(()=>markedPosition(page).then(p=>p?.distance)).toBeLessThan(8);
  expect((await speechState(page)).status).toBe('loading');
  expect(requests).toBe(3);
  await pressSpeech(page, "speechStop");
  release();
  await expect.poll(() => speechState(page).then((s) => s.status)).toBe("idle");
  expect(await page.locator("#speechAudio").getAttribute("src")).toBeNull();
  let fail = true;
  await page.route("**/tts", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { voices } })
      : fail
        ? route.fulfill({
            status: 503,
            json: { error: "Edge TTS is temporarily unavailable." },
          })
        : route.fulfill({ contentType: "audio/mpeg", body: testAudio }),
  );
  await pressSpeech(page, "speechPlay");
  await expect(page.locator("#speechStatus")).toHaveText(
    "Edge TTS is temporarily unavailable.",
  );
  fail = false;
  await pressSpeech(page, "speechPlay");
  await expect
    .poll(() => speechState(page).then((s) => s.status))
    .toBe("playing");
  await closeOptions(page);
  await page.locator("#tocToggle").click();
  await page
    .locator('#tocPanel .toc-entry-link[data-href="chapter2.xhtml"]')
    .click();
  await expect.poll(() => speechState(page).then((s) => s.status)).toBe("idle");
  expect(await page.locator("#speechAudio").getAttribute("src")).toBeNull();
  await page.evaluate(
    async (bootstrap) => (await import(bootstrap)).readerRuntime.dispose(),
    bootstrap,
  );
  await expect(page.locator("#speechMini")).toBeHidden();
});

test("hidden-tab narration advances without rendering and follows the final passage on return", async ({
  page,
}) => {
  test.setTimeout(120000);
  await open(page, "scrolled-doc");
  await pressSpeech(page, "speechPlay");
  await expect
    .poll(() => speechState(page).then((s) => s.status))
    .toBe("playing");
  while ((await speechState(page)).index < 3) {
    await pressSpeech(page, "speechNext");
    await expect
      .poll(() => speechState(page).then((s) => s.status))
      .toBe("playing");
  }
  await expect(page.locator("#viewer")).not.toHaveAttribute(
    "aria-busy",
    "true",
    { timeout: 30000 },
  );
  // Finish the last visible follow and its relocation report before freezing
  // animation frames. A late report of the old chapter is not hidden narration.
  await expect.poll(()=>markedPosition(page).then(p=>p?.distance??Infinity),{timeout:30000}).toBeLessThan(2);
  await page.evaluate(async bootstrap=>{
    const rendition=(await import(bootstrap)).readerRuntime.current.state.rendition;
    const container=rendition.manager.container;
    await new Promise(resolve=>{
      let previous,stable=0;
      function settle(){
        const top=container.scrollTop;
        stable=top===previous?stable+1:0;
        previous=top;
        if(stable>=4)resolve();else requestAnimationFrame(settle);
      }
      requestAnimationFrame(settle);
    });
    await new Promise(resolve=>{
      rendition.once('relocated',resolve);
      rendition.reportLocation();
    });
  },bootstrap);
  const visibleSpineIndex = await page.evaluate(async (bootstrap) => {
    const reader = (await import(bootstrap)).readerRuntime.current;
    const raf = window.requestAnimationFrame.bind(window),
      cancel = window.cancelAnimationFrame.bind(window),
      frames = new Map();
    let serial = 0;
    window.__speechTabHidden = true;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => window.__speechTabHidden,
    });
    window.requestAnimationFrame = (callback) => {
      if (!window.__speechTabHidden) return raf(callback);
      const id = --serial;
      frames.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      if (frames.has(id)) frames.delete(id);
      else cancel(id);
    };
    window.__showSpeechTab = () => {
      window.__speechTabHidden = false;
      window.requestAnimationFrame = raf;
      window.cancelAnimationFrame = cancel;
      for (const callback of frames.values()) raf(callback);
      frames.clear();
      document.dispatchEvent(new Event("visibilitychange"));
    };
    document.dispatchEvent(new Event("visibilitychange"));
    // Centering can leave the viewport's tracking line in the preceding cover.
    // Hidden playback must preserve that actual visible position, whichever
    // chapter the viewport tracks when the tab is hidden.
    return reader.state.currentSpineIndex;
  }, bootstrap);
  await ended(page);
  await expect
    .poll(() => speechState(page).then((s) => s.status))
    .toBe("playing");
  await expect(page.locator("#speechPassage")).toHaveText("Chapter two");
  await ended(page);
  await expect
    .poll(() => speechState(page).then((s) => s.status))
    .toBe("playing");
  await expect(page.locator("#speechPassage")).toHaveText(
    "Final spoken paragraph.",
  );
  await ended(page);
  await expect
    .poll(() => speechState(page).then((s) => s.status))
    .toBe("complete");
  expect(
    await page.evaluate(
      async (bootstrap) =>
        (await import(bootstrap)).readerRuntime.current.state.currentSpineIndex,
      bootstrap,
    ),
  ).toBe(visibleSpineIndex);
  await page.evaluate(() => window.__showSpeechTab());
  await expect
    .poll(
      () =>
        page.evaluate(
          async (bootstrap) =>
            (await import(bootstrap)).readerRuntime.current.state
              .currentSpineIndex,
          bootstrap,
        ),
      { timeout: 30000 },
    )
    .toBe(3);
  await expect(page.locator("#speechStatus")).toHaveText("Volume finished.");
  await expect(page.locator("#speechMini")).toBeHidden();
});

test("native audio decodes MP3 and resumes its paused offset without regenerating speech", async ({
  page,
  browserName,
}) => {
  test.setTimeout(120000);
  await open(page, "paginated", { mockMedia: false });
  // Firefox creates an OS audio sink for unmuted playback; the headless CI
  // container has no output device. Muting keeps the real MP3 decoder, media
  // events and time progression while avoiding that unrelated device failure.
  if (browserName === "firefox")
    await page.locator("#speechAudio").evaluate((audio) => {
      audio.muted = true;
    });
  await page.locator("#speechFollow").uncheck();
  await pressSpeech(page, "speechPlay");
  await expect
    .poll(() => speechState(page).then((s) => s.status))
    .toMatch(/playing|paused/);
  if ((await speechState(page)).status === "paused")
    await pressSpeech(page, "speechPlay");
  await expect
    .poll(() => page.locator("#speechAudio").evaluate((a) => a.currentTime))
    .toBeGreaterThan(0.15);
  await pressSpeech(page, "speechPlay");
  await expect
    .poll(() => speechState(page).then((s) => s.status))
    .toBe("paused");
  const paused = await page.locator("#speechAudio").evaluate((a) => ({
    time: a.currentTime,
    duration: a.duration,
    source: a.src,
    paused: a.paused,
  }));
  expect(paused.paused).toBe(true);
  expect(paused.duration).toBeGreaterThan(2.5);
  await pressSpeech(page, "speechPlay");
  await expect
    .poll(() => page.locator("#speechAudio").evaluate((a) => a.currentTime))
    .toBeGreaterThan(paused.time + 0.1);
  expect(await page.locator("#speechAudio").evaluate((a) => a.src)).toBe(
    paused.source,
  );
  await pressSpeech(page, "speechStop");
  expect(await page.locator("#speechAudio").getAttribute("src")).toBeNull();
  await page.route("**/tts", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { voices } })
      : route.fulfill({
          contentType: "audio/mpeg",
          body: Buffer.from([255, 251, 1, 2, 3]),
        }),
  );
  await pressSpeech(page, "speechPlay");
  await expect
    .poll(() => speechState(page).then((s) => s.status))
    .toBe("error");
  await expect(page.locator("#speechStatus")).toContainText(
    "Audio could not play.",
  );
  await pressSpeech(page, "speechStop");
});
