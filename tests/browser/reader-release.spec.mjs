import {test,expect} from '@playwright/test';
import {createReaderEpub,createReaderZip,installReaderFixture,readerURL,readerBookId} from './reader-production-fixture.mjs';

async function releasePublication({damagedArtwork=false}={}){
  const zip=await createReaderZip();
  await zip.loadAsync(await createReaderEpub({chapterCount:6,paragraphCount:9}));
  const first='Text/Chapter 0.xhtml',last='Text/Appendix.xhtml';
  let opf=await zip.file('book.opf').async('string');
  opf=opf.replace('version="3.0"','version="2.0"')
    .replace('<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>',
      '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>')
    .replace('properties="cover-image"','').replace('<spine>','<spine toc="ncx">')
    .replace('href="chapter0.xhtml"','href="Text/Chapter%200.xhtml"')
    .replace('href="chapter4.xhtml"',`href="${last}"`);
  zip.file('book.opf',opf);zip.remove('nav.xhtml');
  const hrefs=['cover.xhtml','Text/Chapter%200.xhtml','chapter1.xhtml','chapter2.xhtml','chapter3.xhtml',last,'chapter5.xhtml'];
  zip.file('toc.ncx',`<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="reader-integration-fixture-v1"/></head><docTitle><text>Release fixture</text></docTitle><navMap>${hrefs.map((href,index)=>`<navPoint id="n${index}" playOrder="${index+1}"><navLabel><text>${index?`Chapter ${index-1}`:'Cover'}</text></navLabel><content src="${href}"/></navPoint>`).join('')}</navMap></ncx>`);
  for(let i=0;i<6;i++){
    let text=await zip.file(`chapter${i}.xhtml`).async('string');
    text=text.replace('chapter4.xhtml#target-4',`${i===0?'../':''}${last}#target-4`);
    if(i===0){
      text=text.replace('src="art.svg"','src="../art.svg"').replace('</h1>',
        '</h1><p id="ruby-example"><ruby>漢字<rt>かんじ</rt></ruby> — café, Ελληνικά, العربية.</p><table id="table-example"><tr><th>Item</th><th>Value</th></tr><tr><td>Release marker</td><td>42</td></tr></table>');
    }
    if(i===4)text=text.replace('src="art.svg"','src="../art.svg"');
    const path=i===0?first:i===4?last:`chapter${i}.xhtml`;
    if(path!==`chapter${i}.xhtml`)zip.remove(`chapter${i}.xhtml`);
    zip.file(path,text);
  }
  if(damagedArtwork)zip.file('art.svg','Corrupt disposable illustration bytes');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}

async function chapter(page,label){
  await page.locator('#tocToggle').focus();await page.locator('#tocToggle').click();
  await page.locator('#tocPanel').getByRole('link',{name:label,exact:true}).click();
  await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true',{timeout:30000});
  await expect(page.locator('#chapterTitle')).toContainText(label);
}

async function liveFrame(page,selector){
  let match;
  await expect.poll(async()=>{
    for(const iframe of await page.locator('#viewer iframe').elementHandles()){
      const frame=await iframe.contentFrame();
      try{if(frame&&!frame.isDetached()&&await frame.locator(selector).count()){match=frame;return true}}
      catch(error){if(!frame?.isDetached())throw error}
    }
    return false;
  }).toBe(true);
  return match;
}

test.describe('reader release publications',()=>{
  test.setTimeout(120000);
  test.beforeEach(async({page})=>{
    page.__readerErrors=[];page.on('pageerror',error=>page.__readerErrors.push(error.message));
  });
  test.afterEach(async({page})=>expect(page.__readerErrors).toEqual([]));

  test('EPUB 2 NCX, encoded nested paths, multilingual markup, notes and saved identities survive reopening',async({page})=>{
    await installReaderFixture(page,{publication:await releasePublication()});
    await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await chapter(page,'Chapter 0');
    const frame=await liveFrame(page,'#ruby-example');
    await expect(frame.locator('#ruby-example ruby rt')).toHaveText('かんじ');
    await expect(frame.locator('#table-example')).toContainText('Release marker');
    await frame.locator('#note-link-0').click();
    await expect(page.locator('#readerNoteDialog')).toBeVisible();
    await expect(page.locator('#readerNoteBody')).toContainText('Original fixture footnote for chapter 0.');
    await page.locator('#readerNoteClose').click();
    await frame.locator('#jump-0').click();
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 4',{timeout:20000});
    await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true',{timeout:30000});
    await page.locator('#bookmarkButton').focus();await page.locator('#bookmarkButton').click();
    await expect(page.locator('#bookmarkButton')).toHaveAttribute('aria-pressed','true');
    await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('sg-progress:'+id))?.cfi,readerBookId)).toMatch(/^epubcfi\(/);
    const saved=await page.evaluate(id=>Object.keys(localStorage).filter(key=>key.includes(id)).sort(),readerBookId);
    await page.reload();await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 4',{timeout:20000});
    expect(await page.evaluate(id=>Object.keys(localStorage).filter(key=>key.includes(id)).sort(),readerBookId)).toEqual(saved);
    await page.locator('#tocToggle').focus();await page.locator('#tocToggle').click();
    await page.locator('[data-panel="bookmarks"]').click();
    await expect(page.locator('#bookmarksPanel')).toContainText('Chapter 4');
  });

  test('damaged embedded artwork falls back without blocking prose or distant chapter navigation',async({page})=>{
    await installReaderFixture(page,{publication:await releasePublication({damagedArtwork:true})});
    await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await chapter(page,'Chapter 0');
    const frame=await liveFrame(page,'#ruby-example');
    await expect(frame.locator('#ruby-example')).toContainText('café');
    await chapter(page,'Chapter 5');
    await expect((await liveFrame(page,'#target-5')).locator('#target-5')).toBeInViewport();
    await expect(page.locator('.reader-failure')).toHaveCount(0);
  });

  test('book text search across released chapter sources navigates to its matching passage',async({page})=>{
    await installReaderFixture(page,{publication:await releasePublication()});
    await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await page.locator('#tocToggle').focus();await page.locator('#tocToggle').click();
    await page.getByRole('button',{name:'Search contents and book',exact:true}).click();
    await page.getByRole('searchbox',{name:'Search contents and book',exact:true}).fill('Chapter 5, passage 8');
    const match=page.locator('.book-search-result').first();
    await expect(match).toBeVisible({timeout:30000});await match.click();
    await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true',{timeout:30000});
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 5');
    const frame=await liveFrame(page,'#passage-5-before-8');
    await expect(frame.locator('#passage-5-before-8')).toBeInViewport();
  });
});
