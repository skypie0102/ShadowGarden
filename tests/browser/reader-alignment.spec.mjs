import {test,expect} from '@playwright/test';
import {createReaderZip,createReaderEpub,installReaderFixture,readerURL,readerBookPath} from './reader-production-fixture.mjs';

const bootstrap='/assets/js/reader-bootstrap.js?v=2.11.0';

async function publication(){
  const zip=await createReaderZip();
  await zip.loadAsync(await createReaderEpub({chapterCount:2,paragraphCount:8}));
  const prose='Original paragraph text checks alignment, authored styles, reading layout and restored preferences. '.repeat(5);
  for(const index of [0,1])zip.file(`chapter${index}.xhtml`,`<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${index}</title><style>
    body{text-align:justify}.book #class-align{text-align:center!important}
    img{width:64px;height:64px}
    </style></head><body class="book" data-alignment-chapter="${index}">
    <h1 style="text-align:center!important">Chapter ${index}</h1>
    <p id="class-align">${prose}</p>
    <p id="inline-align" style="text-align:right!important;text-align-last:right!important">${prose}</p>
    <p id="inherited-align">${prose}</p>
    <p id="media-align" style="text-align:center!important"><img src="art.svg" alt="Fixture artwork"/></p>
    ${Array.from({length:8},()=>`<p>${prose}</p>`).join('')}
    </body></html>`);
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}

async function openSettings(page){
  await page.locator('#settingsToggle').focus();await page.locator('#settingsToggle').click();
  await expect(page.locator('#settingsDrawer')).toHaveClass(/\bopen\b/);
}
async function closeSettings(page){
  await page.locator('#settingsDrawer [data-close]').click();
}
async function chapter(page,index){
  await page.locator('#tocToggle').focus();await page.locator('#tocToggle').click();
  await page.locator(`#tocPanel .toc-entry-link[data-href="chapter${index}.xhtml"]`).click();
  await expect(page.locator('#tocDrawer')).not.toHaveClass(/\bopen\b/);
  await expect.poll(()=>page.evaluate(index=>[...document.querySelectorAll('#viewer iframe')].some(frame=>
    frame.contentDocument?.body?.dataset.alignmentChapter===String(index)),index)).toBe(true);
  await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true');
}
async function painted(page,alignment){
  const expected=alignment==='default'?['center','right','justify']:Array(3).fill(alignment);
  await expect.poll(()=>page.evaluate(()=>{
    const doc=[...document.querySelectorAll('#viewer iframe')].map(frame=>frame.contentDocument).find(doc=>doc?.getElementById('class-align'));
    if(!doc)return null;
    return ['class-align','inline-align','inherited-align'].map(id=>doc.defaultView.getComputedStyle(doc.getElementById(id)).textAlign);
  })).toEqual(expected);
  const retained=await page.evaluate(()=>{
    const doc=[...document.querySelectorAll('#viewer iframe')].map(frame=>frame.contentDocument).find(doc=>doc?.getElementById('class-align'));
    const style=node=>doc.defaultView.getComputedStyle(node).textAlign;
    return {heading:style(doc.querySelector('h1')),art:style(doc.getElementById('media-align')),
      inlineLast:doc.getElementById('inline-align').style.getPropertyValue('text-align-last'),
      classInline:doc.getElementById('class-align').style.getPropertyValue('text-align')};
  });
  expect(retained.heading).toBe('center');expect(retained.art).toBe('center');
  expect(retained.inlineLast).toBe(alignment==='default'?'right':'auto');
  expect(retained.classInline).toBe(alignment==='default'?'':alignment);
}
async function mapReady(page,alignment){
  await expect.poll(()=>page.evaluate(async({bootstrap,alignment})=>{
    const reader=(await import(bootstrap)).readerRuntime.current,map=reader.state.pageMap;
    return map.map()?.settings.alignment===alignment&&map.fingerprint()===map.currentFingerprint()&&!map.isGenerating();
  },{bootstrap,alignment}),{timeout:60000}).toBe(true);
  return page.evaluate(()=>window.__sgCanonicalPageMap.fingerprint);
}

for(const flow of ['paginated','scrolled-doc'])test(`${flow}: paragraph alignment restores EPUB styles, persists and measures the selected layout`,async({page})=>{
  test.setTimeout(150000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installReaderFixture(page,{flow,publication:await publication()});
  await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  await chapter(page,0);await painted(page,'default');
  const original=await mapReady(page,'default'),fingerprints=new Set([original]);
  await openSettings(page);
  const select=page.getByRole('combobox',{name:'Paragraph alignment',exact:true});
  await expect(select).toHaveValue('default');
  expect(await select.locator('option').allTextContents()).toEqual(['Default','Left','Justify','Right']);
  for(const alignment of ['left','justify','right','default']){
    await select.selectOption(alignment);await painted(page,alignment);
    const fingerprint=await mapReady(page,alignment);fingerprints.add(fingerprint);
    if(alignment==='default')expect(fingerprint).toBe(original);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sg-reader-settings')).alignment)).toBe(alignment);
  }
  expect(fingerprints.size).toBe(4);
  await select.selectOption('right');await painted(page,'right');await mapReady(page,'right');
  await select.scrollIntoViewIfNeeded();
  await test.info().attach(`alignment-${flow}`,{body:await page.screenshot(),contentType:'image/png'});
  // The canonical sandbox must apply the same inline-important override, not
  // merely label an unchanged publication with a new settings fingerprint.
  expect(await page.evaluate(async({bookUrl,bootstrap})=>{
    const {createSandbox,mapSection,destroySandbox}=await import('/assets/js/reader/page-map-measurement.js');
    const settings=(await import(bootstrap)).readerRuntime.current.settings.get();
    const sandbox=await createSandbox({bookUrl,metrics:{width:500,height:700,spread:'single'},paginatedTheme:{},paragraphAlignment:settings.alignment});
    try{
      const section=sandbox.book.spine.get('chapter0.xhtml');
      await mapSection({rendition:sandbox.rendition,frame:sandbox.frame,section});
      const doc=sandbox.rendition.getContents()[0].document;
      return ['class-align','inline-align','inherited-align'].map(id=>doc.defaultView.getComputedStyle(doc.getElementById(id)).textAlign);
    }finally{destroySandbox(sandbox)}
  },{bookUrl:readerBookPath,bootstrap})).toEqual(['right','right','right']);
  await closeSettings(page);await chapter(page,1);await painted(page,'right');
  await page.reload();await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  await chapter(page,1);await painted(page,'right');await openSettings(page);
  await expect(select).toHaveValue('right');
  // A new rendition and newly loaded chapters use the same persisted choice.
  await page.locator('#flowSelect').selectOption(flow==='paginated'?'scrolled-doc':'paginated');
  await closeSettings(page);await chapter(page,0);await painted(page,'right');
  await openSettings(page);await page.locator('#resetReader').click();
  await expect(select).toHaveValue('default');
  await closeSettings(page);await chapter(page,0);await painted(page,'default');
  await mapReady(page,'default');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sg-reader-settings')).alignment)).toBe('default');
  expect(errors).toEqual([]);
});
