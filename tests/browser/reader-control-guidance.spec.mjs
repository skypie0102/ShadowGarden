import {test,expect} from '@playwright/test';
import {installReaderFixture,createReaderEpub,createReaderZip,readerBookId,readerSeriesId,readerTitle} from './reader-production-fixture.mjs';
import {activateImage} from './image-focus-input.mjs';

test.setTimeout(90000);
const seenKey='sg-reader-image-focus-tip-seen';

async function open(page,{adult=false,flow='scrolled-doc',publication}={}){
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
  await installReaderFixture(page,{flow,publication});
  await page.addInitScript(()=>{
    localStorage.setItem('sg-adult-ack','1');
    if(!localStorage.getItem('sg-bookmarks:unrelated-volume'))localStorage.setItem('sg-bookmarks:unrelated-volume','[{"cfi":"preserved"}]');
  });
  const id=adult?'adult-control-guidance':readerSeriesId;
  for(const scope of [false,true])await page.route(`**/media/shadow-garden/data/${scope?'adult-catalog':'catalog'}.json`,route=>route.fulfill({json:{series:scope===adult?[{id,title:readerTitle,nsfw:adult,volumes:[{file:readerBookId,bookId:readerBookId,number:1,title:readerTitle}]}]:[]}}));
  await page.goto(`/reader.html?book=${readerBookId}&series=${id}&scope=${adult?'adult':'main'}`);
  await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  return errors;
}

async function contents(page){
  await page.locator('#tocToggle').focus();await page.locator('#tocToggle').click();
  await expect(page.locator('#tocDrawer')).toHaveAttribute('aria-hidden','false');
}
async function navigationFinished(page){
  // Continuous can finish buffered chapter styling after the requested text
  // appears. Use the same completion budget as production integration cases.
  await expect(page.locator('#tocDrawer')).toHaveAttribute('aria-hidden','true',{timeout:20000});
  await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true',{timeout:20000});
}
async function pageMapReady(page){
  return page.evaluate(async()=>{
    const entry=document.querySelector('script[src*="reader-bootstrap.js"]').getAttribute('src');
    const reader=(await import(entry)).readerRuntime.current;
    return Boolean(reader.state.pageMap?.hasCompleteMap());
  });
}
async function visibleChapter(page,index){
  await expect.poll(()=>page.evaluate(index=>{
    const viewport=document.getElementById('viewer').getBoundingClientRect();
    return [...document.querySelectorAll('#viewer iframe')].some(frame=>{
      const target=frame.contentDocument?.querySelector(`#target-${index}`);
      if(!target)return false;
      const box=target.getBoundingClientRect(),outer=frame.getBoundingClientRect();
      return outer.top+box.bottom>viewport.top&&outer.top+box.top<viewport.bottom&&outer.left+box.right>viewport.left&&outer.left+box.left<viewport.right;
    });
  },index),{timeout:20000}).toBe(true);
}

for(const adult of [false,true])for(const flow of ['paginated','scrolled-doc']){
  const label=`${adult?'Adult':'Main'} ${flow}`;
  test(`${label} explains volume progress and keeps chapter, search and bookmarks usable`,async({page},info)=>{
    const errors=await open(page,{adult,flow});
    await expect(page.locator('body')).toHaveClass(flow==='paginated'?/reader-flow-paginated/:/reader-flow-scrolled/);
    await expect.poll(()=>pageMapReady(page),{timeout:45000}).toBe(true);
    await contents(page);
    await expect(page.locator('#readerVolumeProgress')).toContainText(/Page \d+ of \d+ · \d+% of volume/);
    await info.attach('navigation-compact',{body:await page.screenshot(),contentType:'image/png'});
    await expect(page.getByRole('button',{name:'Navigation help',exact:true})).toHaveCount(0);
    await page.locator('#tocPanel [data-href="chapter2.xhtml"]').click();
    await navigationFinished(page);await visibleChapter(page,2);
    await page.locator('#bookmarkButton').focus();await page.locator('#bookmarkButton').click();
    await expect(page.locator('#bookmarkButton')).toHaveAttribute('aria-pressed','true');
    await contents(page);
    await expect(page.locator('#readerCurrentChapter')).toContainText('Chapter 2');
    const volume=await page.locator('#readerVolumeProgress').textContent();await expect(page.locator('#progressText')).toContainText(volume);
    await page.getByRole('tab',{name:'Bookmarks',exact:true}).click();
    await expect(page.locator('#bookmarksPanel .bookmark-row')).toHaveCount(1);
    await page.getByRole('tab',{name:'Contents',exact:true}).click();
    await page.getByRole('button',{name:'Search contents and book',exact:true}).click();
    await page.getByRole('searchbox',{name:'Search contents and book'}).fill('Chapter 4');
    await page.locator('#tocPanel .toc-entry-link[data-href="chapter4.xhtml"]').click();
    await navigationFinished(page);await visibleChapter(page,4);
    await contents(page);
    for(const width of [320,768,1280]){
      await page.setViewportSize({width,height:850});
      await expect.poll(()=>page.locator('#tocDrawer').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
      if(width!==768)await info.attach(`navigation-${width}`,{body:await page.screenshot(),contentType:'image/png'});
    }
    await info.attach('navigation-context',{body:await page.screenshot(),contentType:'image/png'});
    await page.keyboard.press('Escape');await expect(page.locator('#tocToggle')).toBeFocused();
    expect(await page.evaluate(()=>localStorage.getItem('sg-bookmarks:unrelated-volume'))).toBe('[{"cfi":"preserved"}]');
    expect(errors).toEqual([]);
  });

  test(`${label} discovers image focus once, retains real activation and restores the reading view`,async({page},info)=>{
    const errors=await open(page,{adult,flow}),tip=page.locator('#imageFocusGuidance');
    try{await expect(tip).toBeVisible()}catch(error){
      await info.attach('tip-startup-state',{contentType:'application/json',body:JSON.stringify(await page.evaluate(key=>({
        seen:localStorage.getItem(key),loading:document.getElementById('readerLoading').className,hidden:document.hidden,
        blockers:[...document.querySelectorAll('.reader-drawer.open,dialog[open]')].map(el=>el.id),copy:document.getElementById('imageFocusGuidanceText').textContent,
        images:[...document.querySelectorAll('#viewer iframe')].map(frame=>({frame:frame.getBoundingClientRect().toJSON(),images:[...frame.contentDocument.querySelectorAll('img')].map(image=>({naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,connected:image.isConnected,box:image.getBoundingClientRect().toJSON()}))}))
      }),seenKey))});throw error;
    }
    await expect(tip).toContainText(info.project.use.hasTouch?'Double-tap':'Double-click');
    await expect(page.locator('#imageFocus')).toBeHidden();
    await info.attach('first-image-tip',{body:await page.screenshot(),contentType:'image/png'});
    const image=page.frameLocator('#viewer iframe').first().locator('img').first();
    const before=await image.boundingBox();expect(before).not.toBeNull();
    await activateImage(page,{x:before.x+before.width/2,y:before.y+before.height/2});
    await expect(page.locator('#imageFocus')).toBeVisible();await expect(tip).toBeHidden();
    expect(await page.evaluate(key=>localStorage.getItem(key),seenKey)).toBe('1');
    await page.locator('#imageFocusClose').click();await expect(page.locator('#imageFocus')).toBeHidden();
    await expect.poll(async()=>Math.abs((await image.boundingBox()).y-before.y)).toBeLessThan(2);
    await page.reload();await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect(page.frameLocator('#viewer iframe').first().locator('img').first()).toBeVisible();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await expect(tip).toBeHidden();expect(errors).toEqual([]);
  });
}

test('offscreen buffered illustrations do not consume the first-use tip; dismissal preserves position',async({page})=>{
  const zip=await createReaderZip();await zip.loadAsync(await createReaderEpub());
  zip.file('cover.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cover</title></head><body><h1>Prose before the illustration</h1><div style="height:2600px">Original prose.</div><img id="late-art" src="art.svg" alt="Later illustration" style="width:200px;height:300px"/></body></html>');
  const errors=await open(page,{publication:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});
  const image=page.frameLocator('#viewer iframe').first().locator('#late-art'),tip=page.locator('#imageFocusGuidance');
  await image.evaluate(image=>image.decode());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(tip).toBeHidden();expect(await page.evaluate(key=>localStorage.getItem(key),seenKey)).toBeNull();
  await image.scrollIntoViewIfNeeded();await expect(tip).toBeVisible();
  await contents(page);await expect(tip).toBeHidden();
  expect(await page.evaluate(key=>localStorage.getItem(key),seenKey)).toBeNull();
  await page.keyboard.press('Escape');await expect(tip).toBeVisible();
  const before=await image.boundingBox();
  await page.getByRole('button',{name:'Dismiss illustration tip'}).click();await expect(tip).toBeHidden();
  expect(await page.evaluate(key=>localStorage.getItem(key),seenKey)).toBe('1');
  expect(Math.abs((await image.boundingBox()).y-before.y)).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test('the illustration tip times out discreetly and still dismisses when its storage write is rejected',async({page})=>{
  await page.addInitScript(key=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name,value){if(name===key)throw new DOMException('Blocked tip preference','QuotaExceededError');return original.call(this,name,value)};
  },seenKey);
  const errors=await open(page),tip=page.locator('#imageFocusGuidance');
  await expect(tip).toBeVisible();await expect(tip).toBeHidden({timeout:12000});
  expect(await page.evaluate(key=>localStorage.getItem(key),seenKey)).toBeNull();
  await contents(page);await page.locator('#tocPanel [data-href="chapter3.xhtml"]').click();
  await navigationFinished(page);
  await expect(tip).toBeHidden();expect(errors).toEqual([]);
});

test('learning image focus in another tab dismisses the tip without changing saved bookmarks',async({page,context})=>{
  const errors=await open(page),tip=page.locator('#imageFocusGuidance');await expect(tip).toBeVisible();
  const writer=await context.newPage();
  try{
    await writer.goto('/404.html');
    await writer.evaluate(key=>localStorage.setItem(key,'1'),seenKey);
    await expect(tip).toBeHidden();
    expect(await page.evaluate(()=>localStorage.getItem('sg-bookmarks:unrelated-volume'))).toBe('[{"cfi":"preserved"}]');
  }finally{await writer.close()}
  await page.bringToFront();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(tip).toBeHidden();
  expect(errors).toEqual([]);
});
