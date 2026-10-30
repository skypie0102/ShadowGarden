import {test,expect} from '@playwright/test';
import {createReaderEpub,createReaderZip,installReaderFixture,readerURL} from './reader-production-fixture.mjs';

async function fixture(){
  const zip=await createReaderZip();await zip.loadAsync(await createReaderEpub());
  zip.file('book.opf',(await zip.file('book.opf').async('string')).replace('href="nav.xhtml"','href="Navigation/nav.xhtml"'));
  zip.remove('nav.xhtml');
  zip.file('Navigation/nav.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="../chapter6.xhtml#passage-6-before-5">Chapter six passage</a></li><li><a href="../chapter2.xhtml#target-2">Chapter two</a></li></ol></nav></body></html>');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}

for(const flow of ['paginated','scrolled-doc'])test(`${flow} opens a relative chapter fragment from a nested EPUB navigation document`,async({page},info)=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installReaderFixture(page,{flow,publication:await fixture()});
  await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  await page.locator('#tocToggle').click();
  const entry=page.getByRole('button',{name:'Chapter six passage',exact:true});await expect(entry).toBeVisible();
  if(info.project.use.hasTouch)await entry.tap();else await entry.click();
  await expect(page.locator('#tocDrawer')).not.toHaveClass(/\bopen\b/,{timeout:20000});
  await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true',{timeout:30000});
  await expect.poll(()=>page.evaluate(()=>{
    const viewport=document.getElementById('viewer').getBoundingClientRect();
    return [...document.querySelectorAll('#viewer iframe')].some(frame=>{
      const target=frame.contentDocument?.querySelector('#passage-6-before-5');if(!target)return false;
      const box=target.getBoundingClientRect(),outer=frame.getBoundingClientRect();
      return outer.top+box.bottom>viewport.top&&outer.top+box.top<viewport.bottom&&outer.left+box.right>viewport.left&&outer.left+box.left<viewport.right;
    });
  }),{timeout:20000}).toBe(true);
  await expect(page.getByRole('button',{name:'Navigation help',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
});
