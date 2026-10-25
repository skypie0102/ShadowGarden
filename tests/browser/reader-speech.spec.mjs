import {test,expect} from '@playwright/test';
import {createReaderZip,createReaderEpub,installReaderFixture,readerURL} from './reader-production-fixture.mjs';

const bootstrap='/assets/js/reader-bootstrap.js?v=2.11.0';
const voices=[{id:'en-US-EmmaMultilingualNeural',locale:'en-US',gender:'Female'},{id:'en-US-GuyNeural',locale:'en-US',gender:'Male'}];
async function publication(){
  const zip=await createReaderZip();await zip.loadAsync(await createReaderEpub({chapterCount:3,paragraphCount:2}));
  zip.file('chapter0.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Chapter zero</title></head><body><h1>Chapter zero</h1><p id="first">First spoken paragraph. <em>Emphasis</em> remains readable.</p><p hidden="hidden">Hidden prose must not be read.</p><p id="second">Second spoken paragraph with <ruby>漢字<rt>かんじ</rt></ruby> and café.</p><aside epub:type="footnote"><p>Footnote must not be read.</p></aside><p><img src="art.svg" alt="Illustration must not be spoken"/></p><p id="last">Last paragraph of chapter zero.</p></body></html>');
  zip.file('chapter1.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Artwork</title></head><body><img src="art.svg" alt="Skip this whole image chapter"/></body></html>');
  zip.file('chapter2.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter two</title></head><body><h1>Chapter two</h1><p id="final">Final spoken paragraph.</p></body></html>');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
async function mediaFixture(page){
  await page.addInitScript(()=>{
    window.__speechEvents={plays:0,pauses:0,revoked:[]};
    HTMLMediaElement.prototype.play=function(){if(this.id==='speechAudio'){window.__speechEvents.plays++;this.dataset.playing='true';return Promise.resolve()}return Promise.resolve()};
    HTMLMediaElement.prototype.pause=function(){if(this.id==='speechAudio'){window.__speechEvents.pauses++;this.dataset.playing='false'}};
    HTMLMediaElement.prototype.load=function(){};
    const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.__speechEvents.revoked.push(url);revoke(url)};
  });
}
async function speechState(page){return page.evaluate(async bootstrap=>(await import(bootstrap)).readerRuntime.current.speech.state,bootstrap)}
async function open(page,flow){
  await mediaFixture(page);await installReaderFixture(page,{flow,publication:await publication()});
  await page.route('**/tts',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{ok:true,voices}});
    return route.fulfill({contentType:'audio/mpeg',body:Buffer.from([255,251,1,2,3])});
  });
  await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  await page.locator('#tocToggle').click();await page.locator('#tocPanel .toc-entry-link[data-href="chapter0.xhtml"]').click();
  await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true');
  await page.locator('#speechToggle').click();await expect(page.locator('#speechDrawer')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#speechVoice option')).toHaveCount(2);
}
async function position(page,id){
  await page.evaluate(async({bootstrap,id})=>{
    const reader=(await import(bootstrap)).readerRuntime.current,section=reader.state.book.spine.get('chapter0.xhtml');
    const {withSectionSource}=await import('/assets/js/reader/section-source.js');
    const cfi=await withSectionSource(section,reader.state.book.load.bind(reader.state.book),doc=>{
      const range=doc.createRange();range.selectNodeContents(doc.getElementById(id));return section.cfiFromRange(range);
    });
    const {navigateRendition}=await import('/assets/js/reader/navigation-state.js');
    await navigateRendition(reader.state.rendition,cfi);
  },{bootstrap,id});
}
async function ended(page){await page.locator('#speechAudio').evaluate(audio=>audio.dispatchEvent(new Event('ended')))}

for(const flow of ['paginated','scrolled-doc'])test(`${flow}: Edge narration starts at the current passage, pauses, follows chapters and cleans up`,async({page})=>{
  test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,flow);
  await position(page,'second');
  await page.locator('#speechPlay').click();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  await expect(page.locator('#speechPassage')).toHaveText('Second spoken paragraph with 漢字 and café.');
  await page.locator('#speechPlay').click();await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('paused');
  const source=await page.locator('#speechAudio').getAttribute('src');
  await page.locator('#speechPlay').click();await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  expect(await page.locator('#speechAudio').getAttribute('src')).toBe(source);
  await page.locator('#speechSpeed').selectOption('1.5');
  expect(await page.locator('#speechAudio').evaluate(a=>a.playbackRate)).toBe(1.5);
  await ended(page);await expect(page.locator('#speechPassage')).toHaveText('Last paragraph of chapter zero.');
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  await ended(page);await expect(page.locator('#speechPassage')).toHaveText('Chapter two');
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  await expect.poll(()=>speechState(page).then(s=>s.spineIndex)).toBe(3);
  await page.locator('#speechVoice').selectOption('en-US-GuyNeural');
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('paused');
  await page.locator('#speechPlay').click();await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  await page.locator('#speechDrawer [data-close]').click();
  await expect(page.locator('#speechMini')).toBeVisible();await expect(page.locator('#speechToggle')).toBeFocused();
  await test.info().attach(`speech-${flow}`,{body:await page.screenshot(),contentType:'image/png'});
  await page.locator('#speechMiniStop').click();await expect(page.locator('#speechMini')).toBeHidden();
  expect(await page.locator('#speechAudio').getAttribute('src')).toBeNull();
  expect(await page.evaluate(()=>window.__speechEvents.revoked.length)).toBeGreaterThan(2);
  await page.reload();await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  await page.locator('#speechToggle').click();await expect(page.locator('#speechVoice')).toHaveValue('en-US-GuyNeural');
  await expect(page.locator('#speechSpeed')).toHaveValue('1.5');await expect(page.locator('#speechMini')).toBeHidden();
  expect(errors).toEqual([]);
});

test('stopping pending audio and navigation cannot restart stale speech; provider errors can retry',async({page})=>{
  test.setTimeout(120000);await open(page,'scrolled-doc');
  let release;const gate=new Promise(resolve=>release=resolve);let requests=0;
  await page.route('**/tts',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{voices}});
    requests++;await gate;await route.fulfill({contentType:'audio/mpeg',body:Buffer.from([255,251,1,2,3])}).catch(()=>{});
  });
  await page.locator('#speechPlay').click();await expect.poll(()=>requests).toBe(1);
  await page.locator('#speechStop').click();release();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('idle');
  expect(await page.locator('#speechAudio').getAttribute('src')).toBeNull();
  let fail=true;
  await page.route('**/tts',route=>route.request().method()==='GET'?route.fulfill({json:{voices}}):fail?route.fulfill({status:503,json:{error:'Edge TTS is temporarily unavailable.'}}):route.fulfill({contentType:'audio/mpeg',body:Buffer.from([255,251,1,2,3])}));
  await page.locator('#speechPlay').click();await expect(page.locator('#speechStatus')).toHaveText('Edge TTS is temporarily unavailable.');
  fail=false;await page.locator('#speechPlay').click();await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('playing');
  await page.locator('#speechDrawer [data-close]').click();await page.locator('#tocToggle').click();await page.locator('#tocPanel .toc-entry-link[data-href="chapter2.xhtml"]').click();
  await expect.poll(()=>speechState(page).then(s=>s.status)).toBe('idle');
  expect(await page.locator('#speechAudio').getAttribute('src')).toBeNull();
  await page.evaluate(async bootstrap=>(await import(bootstrap)).readerRuntime.dispose(),bootstrap);
  await expect(page.locator('#speechMini')).toBeHidden();
});
