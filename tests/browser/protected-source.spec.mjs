import {test,expect} from '@playwright/test';
import {installReaderFixture,readerURL,readerBookPath} from './reader-production-fixture.mjs';

for(const legacy of [false,true]){
  test(`explicit protected transport opens ${legacy?'legacy':'opaque'} sources without replacing global fetch`,async({page})=>{
    test.setTimeout(120000);
    const reads=[],errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{window.__fixtureOriginalFetch=window.fetch});
    page.on('request',request=>{
      if(new URL(request.url()).pathname===readerBookPath)reads.push({type:request.resourceType(),sandbox:request.frame()!==page.mainFrame()});
    });
    await installReaderFixture(page);
    const url=new URL(readerURL,'https://fixture.test');
    if(legacy)url.searchParams.set('book',readerBookPath);
    await page.goto(url.pathname+url.search);
    await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect.poll(()=>page.evaluate(()=>window.__sgCanonicalPageMap?.totalPages||0),{timeout:60000}).toBeGreaterThan(0);
    expect(await page.evaluate(()=>window.fetch===window.__fixtureOriginalFetch)).toBe(true);
    expect(await page.evaluate(()=>window.__sgVisualPageManifest.visualPages.length)).toBeGreaterThan(0);
    expect(reads.some(read=>read.type==='fetch'&&!read.sandbox)).toBe(true);
    expect(reads.some(read=>read.type==='xhr'&&!read.sandbox)).toBe(true);
    expect(reads.some(read=>read.type==='xhr'&&read.sandbox)).toBe(true);
    expect(errors).toEqual([]);
  });
}
