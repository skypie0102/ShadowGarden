import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {installReaderProfiling} from './reader-performance-fixture.mjs';
import {createReaderEpub,installReaderFixture,readerURL} from './reader-production-fixture.mjs';

// Timing is reported, not used as a CI threshold. Source/view counts provide the
// deterministic bounds. Instrumentation runs only in this disposable browser.
test.setTimeout(240000);
for(const fixture of [
  {name:'long-prose',chapterCount:80,paragraphCount:48,visualEvery:0},
  {name:'repeated-plates',chapterCount:40,paragraphCount:24,visualEvery:2},
  {name:'unique-plates',chapterCount:40,paragraphCount:24,visualEvery:2,uniqueVisuals:true}
])test(fixture.name,async({page},info)=>{
  await installReaderProfiling(page);
  const publication=await createReaderEpub(fixture);
  await installReaderFixture(page,{publication});
  await page.goto(readerURL);
  await expect(page.locator('#readerLoading')).toBeHidden({timeout:120000});
  const startupMs=await page.evaluate(()=>performance.now());
  await expect.poll(()=>page.evaluate(()=>window.__sgCanonicalPageMap?.totalPages||0),{timeout:120000}).toBeGreaterThan(0);
  const mapReadyMs=await page.evaluate(()=>performance.now());
  for(const index of [5,15,25,fixture.chapterCount-1]){
    await page.locator('#tocToggle').focus();await page.locator('#tocToggle').click();
    await page.locator(`#tocPanel .toc-entry-link[data-href="chapter${index}.xhtml"]`).click();
    await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true',{timeout:30000});
    await page.waitForTimeout(900);
  }
  const result=await page.evaluate(()=>({
    ...window.readerProfile,
    totalPages:window.__sgCanonicalPageMap?.totalPages,
    retainedViews:document.querySelectorAll('#viewer iframe').length
  }));
  expect(result.books?.some(book=>book.role==='map')).toBe(true);
  await page.reload();
  await expect(page.locator('#readerLoading')).toBeHidden({timeout:120000});
  const warm=await page.evaluate(()=>({startupMs:Math.round(performance.now()),conversions:window.readerProfile.conversions}));
  expect(warm.conversions).toBe(0);
  const report={fixture:fixture.name,chapterCount:fixture.chapterCount,paragraphCount:fixture.paragraphCount,warm,
    startupMs:Math.round(startupMs),mapReadyMs:Math.round(mapReadyMs),...result};
  console.log('READER_PROFILE '+JSON.stringify(report));
  const path=info.outputPath('reader-profile.json');
  await writeFile(path,JSON.stringify(report,null,2));await info.attach('reader-profile',{path,contentType:'application/json'});
});
