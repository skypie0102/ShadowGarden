import {test,expect} from '@playwright/test';
import {fixtureHTML} from './reader-focus-fixture.mjs';


async function settle(page){
  await page.evaluate(async()=>{
    const manager=window.focusFixture.rendition.manager;
    for(let i=0;i<3;i++){
      await manager.__sgBufferPromise;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }
  });
}

async function position(page){
  return page.evaluate(()=>{
    const manager=window.focusFixture.rendition.manager;
    const view=manager.views.all().find(view=>view.section.index===7);
    const rect=view.contents.document.querySelector('#art-7').getBoundingClientRect(),frame=view.iframe.getBoundingClientRect();
    return{top:frame.top+rect.top,left:frame.left+rect.left,width:rect.width,height:rect.height,scrollTop:manager.container.scrollTop};
  });
}

async function openImage(page){
  await settle(page);
  await page.evaluate(()=>{
    const manager=window.focusFixture.rendition.manager,view=manager.views.all().find(view=>view.section.index===7);
    const art=view.contents.document.querySelector('#art-7');
    manager.container.scrollTop+=view.iframe.getBoundingClientRect().top+art.getBoundingClientRect().top-manager.container.getBoundingClientRect().top-150;
  });
  await settle(page);
  const before=await position(page);
  const point={x:before.left+before.width/2,y:before.top+before.height/2};
  if(test.info().project.name.startsWith('mobile'))await page.touchscreen.tap(point.x,point.y);
  else await page.mouse.click(point.x,point.y);
  await expect(page.locator('#imageFocus')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.id)).toBe('imageFocusClose');
  return before;
}

async function expectPosition(page,before){
  await expect(page.locator('#imageFocus')).toBeHidden();
  await settle(page);
  await expect.poll(async()=>Math.abs((await position(page)).top-before.top)).toBeLessThan(2);
  // Allow the core's deferred trim/scroll tasks to run too, not just the first frame.
  await page.waitForTimeout(1550);
  expect(Math.abs((await position(page)).top-before.top)).toBeLessThan(2);
}

test.beforeEach(async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.__focusErrors=errors;
  await page.route('**/__reader-focus',route=>route.fulfill({contentType:'text/html',body:fixtureHTMLCache}));
  await page.goto('/__reader-focus');
  await expect.poll(()=>page.evaluate(()=>window.focusFixtureError||Boolean(window.focusFixture))).toBe(true);
});
test.afterEach(async({page})=>expect(page.__focusErrors).toEqual([]));
const fixtureHTMLCache=await fixtureHTML();

test('zoom and pan then X returns to the same illustration despite a focus scroll',async({page})=>{
  const before=await openImage(page),viewport=page.locator('#imageFocusViewport');
  await viewport.dispatchEvent('wheel',{deltaY:-650,ctrlKey:true,clientX:150,clientY:200});
  expect(await page.evaluate(()=>window.focusFixture.focus.isZoomed())).toBe(true);
  // Wheel zoom and pointer pan use the production controller, with real layout.
  if(test.info().project.name.startsWith('mobile')){
    const session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:220}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:210,y:260}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await session.detach();
  }else{
    await page.mouse.move(170,220);await page.mouse.down();await page.mouse.move(210,260);await page.mouse.up();
  }
  await viewport.dispatchEvent('wheel',{deltaY:1800,ctrlKey:true,clientX:150,clientY:200});
  expect(await page.evaluate(()=>window.focusFixture.focus.isZoomed())).toBe(false);
  await page.evaluate(()=>{window.focusFixture.rendition.manager.container.scrollTop+=430});
  await page.locator('#imageFocusClose').click();
  await expectPosition(page,before);
});

test('double-click or touch return preserves position across repeated image visits',async({page})=>{
  for(let i=0;i<2;i++){
    const before=await openImage(page);
    if(test.info().project.name.startsWith('mobile'))await page.locator('#imageFocusViewport').tap({position:{x:180,y:280}});
    else await page.locator('#imageFocusViewport').dblclick({position:{x:180,y:280}});
    await expectPosition(page,before);
  }
});

test('image return preserves its viewport position after chapter content expands',async({page})=>{
  const before=await openImage(page);
  await page.evaluate(async()=>{
    const manager=window.focusFixture.rendition.manager,view=manager.views.all().find(view=>view.section.index===7);
    const space=view.contents.document.createElement('div');space.style.height='640px';
    view.contents.document.querySelector('figure').before(space);view.expand(true);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  await page.locator('#imageFocusClose').click();
  await expectPosition(page,before);
});
