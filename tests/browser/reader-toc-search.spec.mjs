import {test,expect} from '@playwright/test';

const fixturePath='/toc-search-fixture.html';
const searchInput=page=>page.getByRole('searchbox',{name:'Search contents and book',exact:true});
const status=page=>page.locator('.book-search-status');
const hit=(name,extra={})=>({cfi:`epubcfi(${name})`,href:'chapter2.xhtml',sectionIndex:2,excerpt:name,...extra});

async function startSearch(page,value){
  await searchInput(page).fill(value);
  await page.clock.runFor(180);
}

async function complete(page,index,result){
  await page.evaluate(({index,result})=>window.tocFixture.requests[index].resolve(result),{index,result});
}

test.describe('TOC book-search presentation',()=>{
  test.beforeEach(async({page})=>{
    page.__tocErrors=[];page.on('pageerror',error=>page.__tocErrors.push(error.message));
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
    await page.route(`**${fixturePath}`,route=>route.fulfill({contentType:'text/html',body:`<!doctype html>
      <html lang="en"><meta charset="utf-8"><title>TOC search fixture</title>
      <aside class="reader-drawer"><div class="drawer-tabs">
      <button class="active" data-panel="toc">Contents</button><button data-panel="bookmarks">Bookmarks</button>
      </div><div id="tocPanel"></div></aside></html>`}));
    await page.goto(fixturePath);
    await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
    await page.evaluate(async()=>{
      const {createTocController}=await import('/assets/js/reader/toc.js');
      const state={requests:[],navigation:[],closed:0,cancelled:0,retired:[]};
      state.items=[{label:'Act I',subitems:[
        {label:'Résumé text',href:'chapter2.xhtml'},
        {label:'Other chapter',href:'chapter3.xhtml'}
      ]}];
      state.controller=createTocController({panel:document.querySelector('#tocPanel'),
        getBook:()=>({spine:{spineItems:[{index:2,href:'chapter2.xhtml'},{index:3,href:'chapter3.xhtml'}]}}),
        navigate:target=>new Promise((resolve,reject)=>state.navigation.push({target,resolve,reject})),
        closeDrawers:()=>{state.closed++},
        bookSearch:{minQueryLength:3,cancel(){state.cancelled++},
          search:(query,{onProgress})=>new Promise(resolve=>state.requests.push({query,onProgress,resolve}))}
      });
      state.controller.render(state.items);state.controller.openSearch();window.tocFixture=state;
    });
  });
  test.afterEach(async({page})=>{
    await page.evaluate(()=>window.tocFixture?.controller.dispose());
    expect(page.__tocErrors).toEqual([]);
  });

  test('combined search keeps contents normalization and the book-query debounce distinct',async({page})=>{
    await searchInput(page).fill('  RESUME text  ');
    await expect(page.locator('.toc-node').filter({has:page.locator('.toc-entry-link[data-href="chapter2.xhtml"]')}).first()).toBeVisible();
    await expect(page.locator('.toc-entry-link[data-href="chapter3.xhtml"]')).toBeHidden();
    await searchInput(page).fill('  RÉSUMÉ   text  ');
    await expect(page.locator('.toc-entry-link[data-href="chapter2.xhtml"]')).toBeHidden();
    await page.clock.runFor(179);
    expect(await page.evaluate(()=>window.tocFixture.requests.length)).toBe(0);
    await page.clock.runFor(1);
    expect(await page.evaluate(()=>window.tocFixture.requests.map(request=>request.query))).toEqual(['RÉSUMÉ text']);
    await page.evaluate(()=>window.tocFixture.requests[0].onProgress({scanned:1,total:3,count:2}));
    await expect(status(page)).toHaveText('Searching 1 of 3 sections… 2 matches');
    await complete(page,0,{hits:[hit('<b>literal excerpt</b>')]});
    await expect(status(page)).toHaveText('1 book-text match.');
    await expect(page.locator('.book-search-result-chapter')).toHaveText('Résumé text');
    await expect(page.locator('.book-search-result-excerpt')).toHaveText('<b>literal excerpt</b>');
    await expect(page.locator('.book-search-result-excerpt b')).toHaveCount(0);
  });

  test('a newer query rejects stale progress and results even when the provider ignores cancellation',async({page})=>{
    await startSearch(page,'first query');await startSearch(page,'latest query');
    await complete(page,1,{hits:[hit('latest result')]});
    await expect(page.locator('.book-search-result')).toHaveText('Résumé textlatest result');
    await page.evaluate(()=>window.tocFixture.requests[0].onProgress({scanned:99,total:99,count:99}));
    await complete(page,0,{hits:[hit('stale result')]});
    await expect(status(page)).toHaveText('1 book-text match.');
    await expect(page.locator('.book-search-result')).toHaveText('Résumé textlatest result');
  });

  test('minimum, unavailable, empty and capped results keep their accessible status and fallbacks',async({page})=>{
    await searchInput(page).fill('ab');await page.clock.runFor(180);
    await expect(status(page)).toHaveText('Enter at least 3 characters to search book text.');
    expect(await page.evaluate(()=>window.tocFixture.requests.length)).toBe(0);
    await expect(status(page)).toHaveAttribute('role','status');
    await expect(status(page)).toHaveAttribute('aria-live','polite');
    await startSearch(page,'unavailable');await complete(page,0,{hits:[],unavailable:true});
    await expect(status(page)).toHaveText('Book text search is unavailable for this EPUB.');
    await startSearch(page,'empty query');await complete(page,1,{hits:[]});
    await expect(status(page)).toHaveText('No matching book text.');
    await startSearch(page,'capped query');
    await complete(page,2,{hits:[hit('first',{href:'missing.xhtml',sectionIndex:-1,excerpt:''}),hit('second',{href:'',sectionIndex:-1})],capped:true});
    await expect(status(page)).toHaveText('2+ book-text matches · Refine your search for more precise results.');
    await expect(page.locator('.book-search-result-chapter')).toHaveText(['missing.xhtml','Result 2']);
    await expect(page.locator('.book-search-result-excerpt').first()).toHaveText('Matching text');
    await searchInput(page).fill('');
    await expect(page.locator('.toc-book-search-section')).toBeHidden();
    await expect(page.locator('.book-search-result')).toHaveCount(0);
    await expect(page.locator('.toc-entry-link[data-href="chapter3.xhtml"]')).toBeVisible();
  });

  test('cancel, rerender and disposal release timers, retired controls and late query work',async({page})=>{
    await searchInput(page).fill('cancel before debounce');
    await page.evaluate(()=>window.tocFixture.controller.cancelSearch());await page.clock.runFor(180);
    expect(await page.evaluate(()=>window.tocFixture.requests.length)).toBe(0);
    await startSearch(page,'cancel after start');
    await page.evaluate(()=>window.tocFixture.controller.cancelSearch());
    await page.evaluate(()=>window.tocFixture.requests[0].onProgress({scanned:1,total:1,count:1}));
    await complete(page,0,{hits:[hit('cancelled result')]});
    await expect(status(page)).toHaveText('Searching book text…');
    await expect(page.locator('.book-search-result')).toHaveCount(0);
    await startSearch(page,'visible result');await complete(page,1,{hits:[hit('retired result')]});
    await page.evaluate(()=>window.tocFixture.retired.push(document.querySelector('.book-search-result')));
    await startSearch(page,'pending rerender');
    await page.evaluate(()=>{
      const state=window.tocFixture;state.items[0].subitems[0].label='Replacement chapter';
      state.controller.render(state.items);state.retired[0].click();state.controller.openSearch();
      state.requests[2].onProgress({scanned:1,total:1,count:1});state.requests[2].resolve({hits:[{cfi:'epubcfi(stale)',excerpt:'stale result'}]});
    });
    await expect(page.locator('.toc-search-toggle')).toHaveCount(1);
    await expect(page.locator('.book-search-result')).toHaveCount(0);
    await expect(status(page)).toHaveText('');
    expect(await page.evaluate(()=>window.tocFixture.navigation.length)).toBe(0);
    await startSearch(page,'fresh controls');await complete(page,3,{hits:[hit('fresh result')]});
    await expect(page.locator('.book-search-result-chapter')).toHaveText('Replacement chapter');
    await page.locator('.book-search-result').click();
    expect(await page.evaluate(()=>window.tocFixture.navigation.map(move=>move.target))).toEqual(['epubcfi(fresh result)']);
    await page.evaluate(()=>window.tocFixture.navigation[0].resolve());
    await startSearch(page,'pending dispose');
    await page.evaluate(()=>{
      const state=window.tocFixture;state.retired.push(document.querySelector('.toc-search'));
      state.controller.dispose();state.retired[1].value='after disposal';state.retired[1].dispatchEvent(new Event('input'));
      state.requests[4].onProgress({scanned:1,total:1,count:1});state.requests[4].resolve({hits:[]});
    });
    await page.clock.runFor(180);await expect(page.locator('#tocPanel')).toBeEmpty();
    expect(await page.evaluate(()=>window.tocFixture.requests.length)).toBe(5);
  });

  test('chapter selection closes immediately and does not close a subsequently reopened drawer',async({page})=>{
    await page.locator('.toc-entry-link[data-href="chapter2.xhtml"]').click();
    expect(await page.evaluate(()=>({targets:window.tocFixture.navigation.map(move=>move.target),closed:window.tocFixture.closed})))
      .toEqual({targets:['chapter2.xhtml'],closed:1});
    await page.evaluate(()=>window.tocFixture.navigation[0].resolve());
    expect(await page.evaluate(()=>window.tocFixture.closed)).toBe(1);
  });

  test('clicking the page number activates its chapter',async({page})=>{
    await page.evaluate(()=>window.tocFixture.controller.setPageResolver(()=>42));
    const row=page.locator('.toc-row').filter({has:page.locator('.toc-entry-link[data-href="chapter2.xhtml"]')});
    await row.locator('.toc-page-number').click();
    expect(await page.evaluate(()=>({targets:window.tocFixture.navigation.map(move=>move.target),closed:window.tocFixture.closed})))
      .toEqual({targets:['chapter2.xhtml'],closed:1});
    await page.evaluate(()=>window.tocFixture.navigation[0].resolve());
  });

  test('result navigation waits for the shared owner and cannot close drawers after disposal',async({page})=>{
    await startSearch(page,'navigation');await complete(page,0,{hits:[hit('destination')]});
    await page.locator('.book-search-result').click();
    expect(await page.evaluate(()=>({targets:window.tocFixture.navigation.map(move=>move.target),closed:window.tocFixture.closed})))
      .toEqual({targets:['epubcfi(destination)'],closed:0});
    await page.evaluate(()=>window.tocFixture.navigation[0].resolve());
    expect(await page.evaluate(()=>window.tocFixture.closed)).toBe(1);
    await page.locator('.book-search-result').click();
    await page.evaluate(()=>window.tocFixture.navigation[1].reject(new Error('Fixture navigation failure')));
    expect(await page.evaluate(async()=>{
      const {getReaderDiagnostics}=await import('/assets/js/reader/diagnostics.js');
      return getReaderDiagnostics().counts['navigation.searchFailed'];
    })).toBe(1);
    expect(await page.evaluate(()=>window.tocFixture.closed)).toBe(1);
    await page.locator('.book-search-result').click();
    await page.evaluate(()=>{window.tocFixture.controller.dispose();window.tocFixture.navigation[2].resolve()});
    expect(await page.evaluate(()=>window.tocFixture.closed)).toBe(1);
  });

  for(const kind of ['chapter','search'])test(`${kind} navigation reports active failures but stays quiet after disposal`,async({page})=>{
    const code=kind==='chapter'?'navigation.tocFailed':'navigation.searchFailed';
    if(kind==='search'){
      await startSearch(page,'navigation');await complete(page,0,{hits:[hit('destination')]});
    }
    const button=kind==='chapter'?page.locator('.toc-entry-link[data-href="chapter2.xhtml"]'):page.locator('.book-search-result');
    await button.click();
    await page.evaluate(()=>window.tocFixture.navigation[0].reject(new DOMException('Active navigation failure','AbortError')));
    const count=()=>page.evaluate(async code=>{
      const {getReaderDiagnostics}=await import('/assets/js/reader/diagnostics.js');
      return getReaderDiagnostics().counts[code]||0;
    },code);
    expect(await count()).toBe(1);
    await button.click();
    await page.evaluate(()=>{
      window.tocFixture.controller.dispose();
      window.tocFixture.navigation[1].reject(new DOMException('Reader disposed','AbortError'));
    });
    expect(await count()).toBe(1);
    expect(await page.evaluate(()=>window.tocFixture.closed)).toBe(kind==='chapter'?2:0);
  });
});
