import {test,expect} from '@playwright/test';
import {installReaderFixture,readerURL,readerBookId} from './reader-production-fixture.mjs';
import {createReleaseEpub} from './reader-release-fixture.mjs';


async function chapter(page,label){
  await page.locator('#tocToggle').focus();await page.locator('#tocToggle').click();
  await page.locator('#tocPanel').getByRole('button',{name:label,exact:true}).click();
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
  test.use({actionTimeout:15000});
  test.beforeEach(async({page})=>{
    page.__readerErrors=[];page.on('pageerror',error=>page.__readerErrors.push(error.message));
  });
  test.afterEach(async({page})=>expect(page.__readerErrors).toEqual([]));

  test('EPUB 2 NCX, encoded nested paths, multilingual markup, notes and saved identities survive reopening',async({page})=>{
    await installReaderFixture(page,{publication:await createReleaseEpub()});
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
    await installReaderFixture(page,{publication:await createReleaseEpub({damagedArtwork:true})});
    await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await chapter(page,'Chapter 0');
    const frame=await liveFrame(page,'#ruby-example');
    await expect(frame.locator('#ruby-example')).toContainText('café');
    await chapter(page,'Chapter 5');
    await expect((await liveFrame(page,'#target-5')).locator('#target-5')).toBeInViewport();
    await expect(page.locator('.reader-failure')).toHaveCount(0);
  });

  test('book text search across released chapter sources navigates to its matching passage',async({page})=>{
    await installReaderFixture(page,{publication:await createReleaseEpub()});
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
