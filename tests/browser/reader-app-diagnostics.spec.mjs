import {test,expect} from '@playwright/test';
import {installReaderFixture,readerURL,readerTitle} from './reader-production-fixture.mjs';

const bootstrap='/assets/js/reader-bootstrap.js?v=2.11.0';
const diagnostics='/assets/js/reader/diagnostics.js';

async function counts(page){
  return page.evaluate(async url=>(await import(url)).getReaderDiagnostics().counts,diagnostics);
}
async function released(page){
  await expect(page.locator('#viewer')).toBeEmpty();
  await expect(page.locator('.reader-failure')).toHaveCount(0);
  expect(await page.evaluate(async url=>JSON.stringify((await import(url)).getReaderDiagnostics()),diagnostics)).not.toContain('Private');
}

test.describe('production app callback diagnostics',()=>{
  test.setTimeout(120000);
  test.beforeEach(async({page})=>{
    page.__appErrors=[];page.on('pageerror',error=>page.__appErrors.push(error.message));
    await installReaderFixture(page);
    await page.goto(readerURL);
    await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect(page.locator('#bookTitle')).toHaveText(readerTitle);
  });
  test.afterEach(async({page})=>{
    await page.evaluate(async url=>(await import(url)).readerRuntime.dispose(),bootstrap);
    expect(page.__appErrors).toEqual([]);
  });

  test('TOC rejection reports an active failure and stays quiet after startup disposal',async({page})=>{
    const before=(await counts(page))['navigation.tocUnavailable']||0;
    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),prototype=window.ePub.Book.prototype,open=prototype.open;
      readerRuntime.dispose();
      try{
        prototype.open=function(...args){
          const opening=open.apply(this,args);
          this.loaded.navigation=Promise.reject(new DOMException('Private active TOC failure','AbortError'));
          return opening;
        };
        await readerRuntime.open();
      }finally{prototype.open=open}
    },bootstrap);
    await expect(page.locator('#readerLoading')).toBeHidden();
    expect((await counts(page))['navigation.tocUnavailable']).toBe(before+1);
    expect(await page.evaluate(async url=>(await import(url)).readerRuntime.current.state.navigation.toc,bootstrap)).toEqual([]);

    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),prototype=window.ePub.Book.prototype,open=prototype.open;
      let reject,entered;
      const waiting=new Promise(resolve=>{entered=resolve});
      readerRuntime.dispose();
      try{
        prototype.open=function(...args){
          const opening=open.apply(this,args);
          this.loaded.navigation=new Promise((_resolve,fail)=>{reject=fail});
          entered(this);return opening;
        };
        const opening=readerRuntime.open(),book=await waiting;
        // Only the substituted TOC promise remains pending at disposal. Allow
        // the real vendor package parsing to finish before destroying its book.
        await book.opened;await book.ready;
        readerRuntime.dispose();reject(new Error('Private obsolete TOC failure'));
        if(await opening!==null)throw Error('Disposed startup unexpectedly opened');
      }finally{prototype.open=open}
    },bootstrap);
    expect((await counts(page))['navigation.tocUnavailable']).toBe(before+1);
    await released(page);
  });

  test('page-map refresh rejection reports an active failure and stays quiet after disposal',async({page})=>{
    const before=(await counts(page))['pageMap.refreshFailed']||0;
    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),map=readerRuntime.current.state.pageMap;
      const requests=[];window.appMapRequests=requests;
      map.ensure=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
    },bootstrap);
    const request=async index=>{
      // Reapply the current setting through the real app callback without
      // introducing a font change into this lifetime regression.
      await page.locator('#fontSelect').dispatchEvent('change');
      await expect.poll(()=>page.evaluate(()=>window.appMapRequests.length)).toBe(index+1);
    };
    await request(0);
    await page.evaluate(()=>window.appMapRequests[0].reject(new DOMException('Private active map failure','AbortError')));
    await expect.poll(async()=>((await counts(page))['pageMap.refreshFailed']||0)).toBe(before+1);
    await request(1);
    await page.evaluate(async url=>{
      (await import(url)).readerRuntime.dispose();
      window.appMapRequests[1].reject(new Error('Private obsolete map failure'));
    },bootstrap);
    expect((await counts(page))['pageMap.refreshFailed']).toBe(before+1);
    await expect(page.locator('#readerLoading')).toBeHidden();
    await released(page);
  });

  test('saved-page startup correction reports an active failure and stays quiet after disposal',async({page})=>{
    await expect.poll(()=>page.evaluate(async url=>Boolean((await import(url)).readerRuntime.current.state.pageMap.map()?.totalPages),bootstrap),{timeout:60000}).toBe(true);
    const before=(await counts(page))['navigation.canonicalFallback']||0;
    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),{createReaderStorage}=await import('/assets/js/reader/storage.js');
      const reader=readerRuntime.current,session=reader.session;
      const saved={cfi:'',page:3,totalPages:reader.state.pageMap.map().totalPages,pageMapFingerprint:reader.state.pageMap.fingerprint(),updatedAt:Date.now()};
      const storage=createReaderStorage({sourceIdentity:session.sourcePath,publicIdentity:session.publicBookId});
      const frame=window.requestAnimationFrame;
      readerRuntime.dispose();storage.saveProgress(saved);
      try{
        window.requestAnimationFrame=function(...args){
          if(new Error().stack.includes('correctCanonicalPosition'))throw new DOMException('Private active correction failure','AbortError');
          return frame.apply(this,args);
        };
        await readerRuntime.open();
      }finally{window.requestAnimationFrame=frame}
      // Disposal may save a newer CFI. Seed the same supported page-only resume
      // record after each disposal so both attempts enter canonical correction.
      readerRuntime.dispose();storage.saveProgress({...saved,updatedAt:Date.now()});
    },bootstrap);
    expect((await counts(page))['navigation.canonicalFallback']).toBe(before+1);
    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),frame=window.requestAnimationFrame;
      let entered;
      const waiting=new Promise(resolve=>{entered=resolve});
      try{
        window.requestAnimationFrame=function(callback){
          if(new Error().stack.includes('correctCanonicalPosition')){
            entered();return frame.call(this,()=>{});
          }
          return frame.call(this,callback);
        };
        const opening=readerRuntime.open();await waiting;
        readerRuntime.dispose();
        if(await opening!==null)throw Error('Disposed correction unexpectedly opened');
      }finally{window.requestAnimationFrame=frame}
    },bootstrap);
    expect((await counts(page))['navigation.canonicalFallback']).toBe(before+1);
    await released(page);
  });

  test('active flow switch and recovery failures remain visible for AbortError',async({page})=>{
    const before=await counts(page);
    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),state=readerRuntime.current.state;
      window.appFlowState=state;
      state.book.renderTo=()=>{throw new DOMException('Private active flow failure','AbortError')};
      const select=document.querySelector('#flowSelect');
      select.value='paginated';select.dispatchEvent(new Event('change',{bubbles:true}));
    },bootstrap);
    await expect.poll(()=>page.evaluate(()=>window.appFlowState.switchingFlow)).toBe(false);
    const after=await counts(page);
    expect(after['flow.switchFailed']).toBe((before['flow.switchFailed']||0)+1);
    expect(after['flow.recoveryFailed']).toBe((before['flow.recoveryFailed']||0)+1);
    await expect(page.locator('#readerLoading')).toBeVisible();
    await expect(page.locator('#readerLoading')).toHaveText('Shadow Garden could not restore the reader.');
    expect(await page.evaluate(async url=>JSON.stringify((await import(url)).getReaderDiagnostics()),diagnostics)).not.toContain('Private');
  });

  test('disposal during flow recovery cannot report or resurrect its failure UI',async({page})=>{
    const before=await counts(page);
    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),state=readerRuntime.current.state,book=state.book,render=book.renderTo;
      let calls=0,reject,entered;
      const waiting=new Promise(resolve=>{entered=resolve});
      window.appFlowState=state;
      book.renderTo=function(...args){
        if(++calls===1)throw new Error('Private active switch failure');
        const rendition=render.apply(this,args);
        // Keep the vendor's normal attach-before-display queue ordering.
        rendition.display=()=>rendition.q.enqueue(()=>new Promise((_resolve,fail)=>{reject=fail;entered()}));
        return rendition;
      };
      const select=document.querySelector('#flowSelect');
      select.value='paginated';select.dispatchEvent(new Event('change',{bubbles:true}));
      await waiting;readerRuntime.dispose();
      // Settle the underlying provider too; scope.wait cancels independently.
      reject(new Error('Private obsolete recovery failure'));
    },bootstrap);
    await expect.poll(()=>page.evaluate(()=>window.appFlowState.switchingFlow)).toBe(false);
    const after=await counts(page);
    expect(after['flow.switchFailed']).toBe((before['flow.switchFailed']||0)+1);
    expect(after['flow.recoveryFailed']||0).toBe(before['flow.recoveryFailed']||0);
    await expect(page.locator('#readerLoading')).toBeHidden();
    await expect(page.locator('#readerLoading')).not.toContainText('could not restore');
    await released(page);
    await page.evaluate(async url=>{await(await import(url)).readerRuntime.open()},bootstrap);
    await expect(page.locator('#readerLoading')).toBeHidden();
    await expect(page.locator('#viewer > .epub-container')).toHaveCount(1);
  });
});
