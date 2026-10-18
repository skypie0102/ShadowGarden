import {test,expect} from '@playwright/test';

test.describe('bookmark navigation diagnostics',()=>{
  test.beforeEach(async({page})=>{
    page.__bookmarkErrors=[];page.on('pageerror',error=>page.__bookmarkErrors.push(error.message));
    await page.route('**/bookmarks-fixture.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html>
      <html lang="en"><meta charset="utf-8"><title>Bookmark fixture</title>
      <div id="bookmarksPanel"></div><p id="toast" role="status"></p></html>`}));
    await page.goto('/bookmarks-fixture.html');
    await page.evaluate(async()=>{
      const {createBookmarksController}=await import('/assets/js/reader/bookmarks-controller.js');
      const state={lookups:[],moves:[],closed:0};
      state.controller=createBookmarksController({
        storage:{loadBookmarks:()=>[{cfi:'epubcfi(saved)',page:3,totalPages:10,pageMapFingerprint:'fixture-map',label:'Saved passage'}]},
        elements:{bookmarksPanel:document.querySelector('#bookmarksPanel')},
        getPageMap:()=>({fingerprint:()=> 'fixture-map',targetForPosition:()=>new Promise((resolve,reject)=>state.lookups.push({resolve,reject}))}),
        navigate:target=>new Promise((resolve,reject)=>state.moves.push({target,resolve,reject})),
        closeDrawers:()=>state.closed++,toast:message=>{document.querySelector('#toast').textContent=message}
      });
      window.bookmarkFixture=state;
    });
  });
  test.afterEach(async({page})=>{
    await page.evaluate(()=>window.bookmarkFixture?.controller.dispose());
    expect(page.__bookmarkErrors).toEqual([]);
  });

  for(const stage of ['lookup','navigation'])test(`${stage} rejection reports an active failure and stays quiet after disposal`,async({page})=>{
    const open=page.getByRole('button',{name:'Open bookmark 1',exact:true});
    const count=()=>page.evaluate(async()=>{
      const {getReaderDiagnostics}=await import('/assets/js/reader/diagnostics.js');
      return getReaderDiagnostics().counts['navigation.bookmarkFailed']||0;
    });
    const enter=async index=>{
      await open.click();
      if(stage==='navigation')await page.evaluate(index=>window.bookmarkFixture.lookups[index].resolve('epubcfi(mapped)'),index);
      await expect.poll(()=>page.evaluate(stage=>window.bookmarkFixture[stage==='lookup'?'lookups':'moves'].length,stage)).toBe(index+1);
    };
    await enter(0);
    await page.evaluate(stage=>window.bookmarkFixture[stage==='lookup'?'lookups':'moves'][0].reject(new DOMException('Private active bookmark failure','AbortError')),stage);
    await expect(page.locator('#toast')).toHaveText('Could not open bookmark');
    expect(await count()).toBe(1);
    expect(await page.evaluate(()=>window.bookmarkFixture.closed)).toBe(0);
    await page.evaluate(()=>{document.querySelector('#toast').textContent=''});
    await enter(1);
    await page.evaluate(stage=>{
      const state=window.bookmarkFixture;state.controller.dispose();
      state[stage==='lookup'?'lookups':'moves'][1].reject(new Error('Private obsolete bookmark failure'));
    },stage);
    // The rejection continuation runs before this next browser evaluation.
    expect(await count()).toBe(1);
    await expect(page.locator('#toast')).toBeEmpty();
    await expect(page.locator('#bookmarksPanel')).toBeEmpty();
    expect(await page.evaluate(()=>window.bookmarkFixture.closed)).toBe(0);
    expect(await page.evaluate(async()=>JSON.stringify((await import('/assets/js/reader/diagnostics.js')).getReaderDiagnostics())))
      .not.toContain('Private');
  });
});
