import {test,expect} from '@playwright/test';

for(const path of ['/','/nsfw.html']){
  test(`deployment version and commit are visible in the ${path==='/'?'main':'NSFW'} footer`,async({page,request})=>{
    const response=await request.get('/data/version.json');expect(response.ok()).toBe(true);
    const metadata=await response.json();
    await page.addInitScript(()=>localStorage.setItem('sg-adult-ack','1'));
    await page.goto(path);
    const footer=page.locator('footer #libraryVersion');
    await expect(footer).toHaveText(` · v${metadata.version} · ${metadata.shortCommit}`);
    await footer.scrollIntoViewIfNeeded();await expect(footer).toBeInViewport();
    await expect(footer).toHaveAttribute('title',new RegExp(metadata.commit));
    await expect(footer).toHaveAttribute('title',new RegExp(metadata.branch));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await test.info().attach('deployed-version-footer',{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
  });
}
