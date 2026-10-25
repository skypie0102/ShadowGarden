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
  { id: "en-US-EmmaMultilingualNeural", locale: "en-US", gender: "Female" },
  { id: "en-US-GuyNeural", locale: "en-US", gender: "Male" },
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
  await expect(page.locator("#speechVoice option")).toHaveCount(2);
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
async function ended(page) {
  await page
    .locator("#speechAudio")
    .evaluate((audio) => audio.dispatchEvent(new Event("ended")));
}

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
  await expect.poll(() => requests).toBe(1);
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
  await page.evaluate(() => {
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
  });
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
  ).toBe(1);
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
