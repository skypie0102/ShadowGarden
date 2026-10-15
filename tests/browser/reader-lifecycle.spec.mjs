import {test,expect} from '@playwright/test';
import {installReaderFixture,readerURL,readerTitle} from './reader-production-fixture.mjs';

const bootstrap='/assets/js/reader-bootstrap.js?v=2.11.0';

test.describe('production reader lifecycle',()=>{
  test.setTimeout(120000);
  test.beforeEach(async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));page.__readerErrors=errors;
    // Track resources allocated by the new ownership layer. The installed vendor
    // prototypes and page-level dialogs are intentionally outside session disposal.
    await page.addInitScript(()=>{
      const listeners=[],intervals=new Set(),observers=new Set(),urls=new Set();
      const owned=()=>new Error().stack.split('\n').slice(2,4).some(line=>line.includes('/assets/js/reader/'));
      const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener=function(type,fn,options){
        const capture=options===true||Boolean(options?.capture);
        if(owned()&&!listeners.some(row=>row.target===this&&row.type===type&&row.fn===fn&&row.capture===capture))listeners.push({target:this,type,fn,capture,stack:new Error().stack});
        return add.call(this,type,fn,options);
      };
      EventTarget.prototype.removeEventListener=function(type,fn,options){
        const capture=options===true||Boolean(options?.capture),index=listeners.findIndex(row=>row.target===this&&row.type===type&&row.fn===fn&&row.capture===capture);
        if(index>=0)listeners.splice(index,1);
        return remove.call(this,type,fn,options);
      };
      const interval=window.setInterval,clear=window.clearInterval;
      window.setInterval=function(...args){const id=interval(...args);if(owned())intervals.add(id);return id};
      window.clearInterval=function(id){intervals.delete(id);return clear(id)};
      const observe=MutationObserver.prototype.observe,disconnect=MutationObserver.prototype.disconnect;
      MutationObserver.prototype.observe=function(...args){if(owned())observers.add(this);return observe.apply(this,args)};
      MutationObserver.prototype.disconnect=function(){observers.delete(this);return disconnect.call(this)};
      const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
      URL.createObjectURL=function(blob){const url=create(blob);if(new Error().stack.includes('reader-visual-cache.js'))urls.add(url);return url};
      URL.revokeObjectURL=function(url){urls.delete(url);return revoke(url)};
      window.readerResourceDetails=()=>listeners.map(({target,type,stack})=>({target:target.constructor.name,type,stack}));
      window.readerResourceCounts=()=>({listeners:listeners.length,intervals:intervals.size,observers:observers.size,urls:urls.size});
    });
    await installReaderFixture(page);
    await page.goto(readerURL);
    await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect(page.locator('#bookTitle')).toHaveText(readerTitle);
  });
  test.afterEach(async({page})=>expect(page.__readerErrors).toEqual([]));

  async function dispose(page){await page.evaluate(async url=>(await import(url)).readerRuntime.dispose(),bootstrap)}
  async function reopen(page){
    await page.evaluate(async url=>{await(await import(url)).readerRuntime.open()},bootstrap);
    await expect(page.locator('#readerLoading')).toBeHidden();
    await expect(page.locator('#viewer > .epub-container')).toHaveCount(1);
  }
  async function released(page){
    await expect(page.locator('#viewer')).toBeEmpty();
    await expect(page.locator('iframe[data-sg-page-map-sandbox],.reader-image-focus-hit')).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>{
      const counts=window.readerResourceCounts();
      return counts.listeners?{...counts,remaining:window.readerResourceDetails()}:counts;
    })).toEqual({listeners:0,intervals:0,observers:0,urls:0});
  }

  test('repeated open/dispose releases session resources and attaches input only once',async({page})=>{
    for(let cycle=0;cycle<3;cycle++){
      await expect.poll(()=>page.evaluate(()=>window.readerResourceCounts().intervals)).toBe(2);
      await dispose(page);await released(page);
      // Events delivered after closure must not resurrect a drawer or reader.
      await page.evaluate(()=>{
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'t',bubbles:true}));
        window.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('pageshow'));
      });
      await expect(page.locator('#tocDrawer')).not.toHaveClass(/\bopen\b/);
      if(cycle<2){
        await reopen(page);
        await page.locator('#bookmarkButton').click();
        await expect(page.locator('#bookmarkButton')).toHaveAttribute('aria-pressed','true');
        await page.locator('#bookmarkButton').click();
        await expect(page.locator('#bookmarkButton')).toHaveAttribute('aria-pressed','false');
      }
    }
  });

  test('disposal cancels a pending mode change without creating a replacement rendition',async({page})=>{
    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),select=document.querySelector('#flowSelect');
      select.value='paginated';select.dispatchEvent(new Event('change',{bubbles:true}));
      readerRuntime.dispose();
    },bootstrap);
    await released(page);
    await page.waitForTimeout(250);
    await expect(page.locator('#viewer')).toBeEmpty();
    await reopen(page);
  });

  test('a failed partial startup releases handlers and can retry in the same page',async({page})=>{
    await dispose(page);await released(page);
    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),create=document.createElement;
      // Fault injection after authorization/book creation, while TOC rendering
      // mounts its UI. The real controller and vendor cleanup paths still run.
      document.createElement=function(...args){
        if(new Error().stack.includes('/reader/toc.js'))throw Error('Fixture interrupted TOC startup');
        return create.apply(this,args);
      };
      try{await readerRuntime.open()}finally{document.createElement=create}
    },bootstrap);
    await expect(page.locator('.reader-failure')).toBeVisible();
    await expect(page.locator('#viewer')).toBeEmpty();
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect(page.locator('#viewer > .epub-container')).toHaveCount(1);
    await dispose(page);await released(page);
  });

  test('disposing during publication startup cancels late preparation and allows reopening',async({page})=>{
    await dispose(page);await released(page);
    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),visual=window.__sgVisualPageCache,prepare=visual.prepare;
      let release,entered;
      const waiting=new Promise(resolve=>{entered=resolve});
      visual.prepare=()=>{entered();return new Promise(resolve=>{release=resolve})};
      try{
        const opening=readerRuntime.open();await waiting;
        readerRuntime.dispose();await opening;release(null);
      }finally{visual.prepare=prepare}
    },bootstrap);
    await released(page);await reopen(page);
  });

  test('disposing the reader cancels its open Read Again confirmation',async({page})=>{
    await page.evaluate(async url=>{
      const {readerRuntime}=await import(url),{confirmReadAgain}=await import('/assets/js/public/volume-actions.js');
      const confirming=confirmReadAgain('Fixture volume',{signal:readerRuntime.current.signal});
      if(!document.querySelector('#readAgainDialog').open)throw Error('Confirmation did not open');
      readerRuntime.dispose();
      if(await confirming)throw Error('Disposed reader confirmed a restart');
    },bootstrap);
    await expect(page.locator('#readAgainDialog')).not.toBeVisible();
    await released(page);await reopen(page);
  });

  test('a failed EPUB open exits startup and can retry after the source recovers',async({page})=>{
    await dispose(page);await released(page);
    const unavailable=route=>route.fulfill({status:503,body:'Disposable publication failure'});
    await page.route('**/media/shadow-garden/books/reader-integration-fixture.epub*',unavailable);
    await page.evaluate(async url=>{await(await import(url)).readerRuntime.open()},bootstrap);
    await expect(page.locator('.reader-failure')).toBeVisible();
    await expect(page.locator('#viewer')).toBeEmpty();
    await page.unroute('**/media/shadow-garden/books/reader-integration-fixture.epub*',unavailable);
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect(page.locator('#viewer > .epub-container')).toHaveCount(1);
    await dispose(page);await released(page);
  });

  test('BFCache pagehide keeps the live reader and its artwork usable',async({page})=>{
    const before=await page.evaluate(()=>window.readerResourceCounts());
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
    await expect(page.locator('#viewer > .epub-container')).toHaveCount(1);
    expect(await page.evaluate(()=>window.readerResourceCounts().urls)).toBe(before.urls);
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await expect(page.locator('#viewer > .epub-container')).toHaveCount(1);
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
    await released(page);
  });
});
