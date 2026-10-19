import {test} from '@playwright/test';

export async function activateImage(page,{x,y}){
  if(test.info().project.use.hasTouch){
    await page.touchscreen.tap(x,y);
    await page.touchscreen.tap(x,y);
  }else await page.mouse.dblclick(x,y);
}
