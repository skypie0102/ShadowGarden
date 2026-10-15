import {test,expect} from '@playwright/test';
import {installReaderFixture,readerURL,readerTitle,readerBookId} from './reader-production-fixture.mjs';

test.describe('production reader integration',()=>{
  test.setTimeout(90000);

  test.beforeEach(async({page})=>{
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.__readerErrors=errors;
    await installReaderFixture(page);
    await page.goto(readerURL);
    await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect(page.locator('#bookTitle')).toHaveText(readerTitle);
  });
  test.afterEach(async({page})=>expect(page.__readerErrors).toEqual([]));

  async function chapter(page,index){
    await page.locator('#tocToggle').click();
    await page.locator(`#tocPanel .toc-entry-link[data-href="chapter${index}.xhtml"]`).click();
    await expect(page.locator('#tocDrawer')).not.toHaveClass(/\bopen\b/);
    await expect.poll(()=>page.evaluate(()=>document.querySelector('#chapterTitle')?.textContent)).toContain(`Chapter ${index}`);
    await expect.poll(async()=>{
      for(const frame of page.frames())if(await frame.locator(`#art-${index}`).count())return true;
      return false;
    }).toBe(true);
    return findChapter(page,index);
  }
  async function findChapter(page,index){
    for(const frame of page.frames())if(await frame.locator(`#art-${index}`).count())return frame;
    throw Error(`Chapter ${index} is not buffered`);
  }
  async function openImage(page,index=3){
    const frame=await chapter(page,index),image=frame.locator(`#art-${index}`);
    await image.scrollIntoViewIfNeeded();
    const before=await image.boundingBox();
    expect(before).not.toBeNull();
    if(test.info().project.name.startsWith('mobile'))await image.tap();else await image.click();
    await expect(page.locator('#imageFocus')).toBeVisible();
    return{image,before};
  }
  async function returned(page,image,before){
    await expect(page.locator('#imageFocus')).toBeHidden();
    await expect.poll(async()=>Math.abs((await image.boundingBox()).y-before.y)).toBeLessThan(3);
    await page.waitForTimeout(1600);
    expect(Math.abs((await image.boundingBox()).y-before.y)).toBeLessThan(3);
  }

  test('runs the complete adapter chain and prepares standalone artwork',async({page})=>{
    const report=await page.evaluate(()=>({
      visual:window.__sgVisualPageCache?.summary?.(),
      settings:JSON.parse(localStorage.getItem('sg-reader-settings')),
      progress:JSON.parse(localStorage.getItem('sg-progress:'+new URLSearchParams(location.search).get('book')))
    }));
    expect(report.visual?.error).toBeFalsy();
    expect(report.visual?.visualPages).toBeGreaterThan(0);
    expect(report.settings.flow).toBe('scrolled-doc');
    await chapter(page,3);
    await expect.poll(()=>page.evaluate(bookId=>JSON.parse(localStorage.getItem('sg-progress:'+bookId))?.cfi,readerBookId)).toMatch(/^epubcfi\(/);
  });

  test('zoom and X retain the image with every production adapter installed',async({page})=>{
    const {image,before}=await openImage(page);
    await page.locator('#imageFocusViewport').dispatchEvent('wheel',{deltaY:-650,ctrlKey:true,clientX:150,clientY:220});
    await expect(page.locator('#imageFocus')).toHaveClass(/reader-image-focus-zoomed/);
    await page.locator('#imageFocusClose').click();
    await returned(page,image,before);
  });

  test('double-click or touch return retains the image on repeated visits',async({page})=>{
    for(let i=0;i<2;i++){
      const {image,before}=await openImage(page);
      if(test.info().project.name.startsWith('mobile'))await page.locator('#imageFocusViewport').tap({position:{x:160,y:250}});
      else await page.locator('#imageFocusViewport').dblclick({position:{x:160,y:250}});
      await returned(page,image,before);
    }
  });

  test('mode switches and reopening retain the selected chapter',async({page})=>{
    await chapter(page,4);
    for(const flow of ['paginated','scrolled-doc']){
      await page.locator('#settingsToggle').click();
      await page.locator('#flowSelect').selectOption(flow);
      await page.locator('#settingsDrawer [data-close]').click();
      await expect(page.locator('body')).toHaveClass(flow==='paginated'?/reader-flow-paginated/:/reader-flow-scrolled/);
      await expect(page.locator('#chapterTitle')).toContainText('Chapter 4',{timeout:20000});
    }
    await page.reload();
    await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 4',{timeout:20000});
  });

  test('internal chapter links and footnotes work in the full reader',async({page})=>{
    let frame=await chapter(page,3);
    await frame.locator('#note-link-3').click();
    await expect(page.locator('#readerNoteDialog')).toBeVisible();
    await expect(page.locator('#readerNoteDialog')).toContainText('Original fixture footnote for chapter 3.');
    await page.keyboard.press('Escape');
    await frame.locator('#jump-3').click();
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 4',{timeout:15000});
    frame=await findChapter(page,4);
    await expect(frame.locator('#target-4')).toBeVisible();
  });
});
