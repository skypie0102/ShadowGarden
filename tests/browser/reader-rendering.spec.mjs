import {test,expect} from '@playwright/test';
import {createReaderEpub,installReaderFixture,readerURL,readerBookPath} from './reader-production-fixture.mjs';
import {installReaderProfiling} from './reader-performance-fixture.mjs';

test.describe('reader rendering bounds',()=>{
  test.setTimeout(120000);
  const errors=new WeakMap();
  test.beforeEach(async({page})=>{
    errors.set(page,[]);page.on('pageerror',error=>errors.get(page).push(error.message));
    await installReaderProfiling(page);
  });
  test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

  async function chapter(page,index){
    await page.locator('#tocToggle').focus();await page.locator('#tocToggle').click();
    await page.locator(`#tocPanel .toc-entry-link[data-href="chapter${index}.xhtml"]`).click();
    await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true',{timeout:30000});
    await expect(page.locator('#chapterTitle')).toContainText(`Chapter ${index}`);
  }

  test('page-map and live-reader sources stay bounded across distant chapter replacement',async({page})=>{
    await installReaderFixture(page,{publication:await createReaderEpub({chapterCount:32})});
    await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect.poll(()=>page.evaluate(()=>window.__sgCanonicalPageMap?.totalPages||0),{timeout:60000}).toBeGreaterThan(0);
    for(const index of [5,15,25,31])await chapter(page,index);
    const books=await page.evaluate(()=>window.readerProfile.books);
    expect(books.find(book=>book.role==='map').peakSources).toBeLessThanOrEqual(2);
    expect(books.find(book=>book.role==='reader').peakSources).toBeLessThanOrEqual(12);
    await expect(page.locator('#viewer iframe')).not.toHaveCount(0);
  });

  test('repeated visual plates share normalization, retain page metadata and reopen from cache',async({page})=>{
    await installReaderFixture(page,{publication:await createReaderEpub({chapterCount:16,visualEvery:2})});
    await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    expect(await page.evaluate(()=>window.readerProfile.conversions)).toBe(1);
    expect(await page.evaluate(()=>window.__sgVisualPageManifest.visualPages.length)).toBe(9);
    for(const index of [0,6,14]){
      await chapter(page,index);
      await expect.poll(async()=>{
        for(const frame of page.frames()){
          if(frame.parentFrame()!==page.mainFrame()||frame.isDetached())continue;
          try{
            const image=frame.locator(`.sg-synthetic-visual-page img[alt="Original fixture illustration ${index}"]`);
            if(await image.count())return image.evaluate(node=>node.complete&&node.naturalWidth>0);
          }catch(error){if(!frame.isDetached())throw error}
        }
        return false;
      }).toBe(true);
    }
    await expect.poll(()=>page.evaluate(()=>window.__sgCanonicalPageMap?.totalPages||0),{timeout:60000}).toBeGreaterThan(0);
    // Map availability precedes its non-blocking cache write. Wait for both
    // stores to commit before replacing their contents in this fault fixture.
    await expect.poll(()=>page.evaluate(async()=>{
      for(const [database,storeName] of [['shadow-garden-reader','page-maps'],['shadow-garden-visual-pages','books']]){
        const db=await new Promise(resolve=>{const request=indexedDB.open(database,1);request.onsuccess=()=>resolve(request.result)});
        const count=await new Promise(resolve=>{const request=db.transaction(storeName).objectStore(storeName).count();request.onsuccess=()=>resolve(request.result)});
        db.close();if(!count)return false;
      }
      return true;
    })).toBe(true);
    // Seed old versions, obsolete layouts and other publications directly into
    // the disposable caches. A normal cached reopen must prune these records.
    await page.evaluate(async()=>{
      for(const [database,storeName] of [['shadow-garden-reader','page-maps'],['shadow-garden-visual-pages','books']]){
        const db=await new Promise((resolve,reject)=>{
          const request=indexedDB.open(database,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
        });
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName),request=store.getAll();
          request.onsuccess=()=>{
            const base=request.result[0];
            if(!base){tx.abort();return}
            for(let index=0;index<35;index++)store.put({...base,
              key:'cache-fixture-'+index,bookUrl:index<8?'cache-fixture-same-book':'cache-fixture-book-'+index,
              createdAt:index===34?Date.now()-31*86400000:Date.now()-100000-index,
              version:index===33?1:base.version
            });
            const damaged={key:'cache-fixture-damaged',version:2,createdAt:Date.now()};
            damaged.self=damaged;
            if(storeName==='books')damaged.visuals=[{blob:{}}];
            store.put(damaged);
          };
          tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Fixture cache seeding failed'));
        });
        db.close();
      }
    });
    await page.reload();await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    const cached=await page.evaluate(async()=>({
      conversions:window.readerProfile.conversions,
      diagnostics:(await import('/assets/js/reader/diagnostics.js')).getReaderDiagnostics()
    }));
    expect(cached.conversions).toBe(0);
    expect(cached.diagnostics.counts['visual.cached']).toBe(1);
    expect(cached.diagnostics.counts['pageMap.cached']).toBe(1);
    expect(JSON.stringify(cached.diagnostics)).not.toContain('sig=');
    await expect(page.locator('iframe[data-sg-page-map-sandbox]')).toHaveCount(0);
    const caches=await page.evaluate(async()=>{
      const result=[];
      for(const [database,storeName] of [['shadow-garden-reader','page-maps'],['shadow-garden-visual-pages','books']]){
        const db=await new Promise(resolve=>{const request=indexedDB.open(database,1);request.onsuccess=()=>resolve(request.result)});
        const records=await new Promise(resolve=>{const request=db.transaction(storeName).objectStore(storeName).getAll();request.onsuccess=()=>resolve(request.result)});
        result.push({count:records.length,versions:records.map(record=>record.version),damaged:records.some(record=>record.key==='cache-fixture-damaged'),sameBook:records.filter(record=>record.bookUrl==='cache-fixture-same-book').length});
        db.close();
      }
      return result;
    });
    expect(caches[0].count).toBeLessThanOrEqual(24);expect(caches[0].sameBook).toBeLessThanOrEqual(4);
    expect(caches[1].count).toBeLessThanOrEqual(8);
    expect(caches[0].versions.every(version=>version===2)).toBe(true);
    expect(caches[1].versions.every(version=>version===3)).toBe(true);
    expect(caches.every(cache=>!cache.damaged)).toBe(true);
  });

  test('a failed sandbox open exits to usable reader navigation with sanitized diagnostics',async({page})=>{
    const messages=[];page.on('console',message=>{
      if(['warning','error'].includes(message.type()))messages.push(message.text());
    });
    await installReaderFixture(page);
    await page.route('**'+readerBookPath+'*',route=>{
      if(route.request().frame()!==page.mainFrame())return route.fulfill({contentType:'application/epub+zip',body:'Invalid disposable map archive'});
      return route.fallback();
    });
    await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect.poll(()=>page.evaluate(async()=>
      (await import('/assets/js/reader/diagnostics.js')).getReaderDiagnostics().counts['pageMap.failed']||0
    )).toBe(1);
    await expect(page.locator('iframe[data-sg-page-map-sandbox]')).toHaveCount(0);
    await chapter(page,5);
    expect(messages.some(message=>message.includes('Page-map generation failed'))).toBe(true);
    expect(messages.join('\n')).not.toContain(readerBookPath);
    expect(messages.join('\n')).not.toContain('sig=');
  });
});
