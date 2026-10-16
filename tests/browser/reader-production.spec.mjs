import {test,expect} from '@playwright/test';
import {installReaderFixture,readerURL,readerTitle,readerBookId} from './reader-production-fixture.mjs';

test.describe('production reader integration',()=>{
  test.setTimeout(90000);
  test.use({actionTimeout:15000});

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
    // The production mobile chrome auto-hides. Focusing its public control uses
    // the same accessibility path that reveals it for keyboard navigation.
    await page.locator('#tocToggle').focus();
    await page.locator('#tocToggle').click();
    await page.locator(`#tocPanel .toc-entry-link[data-href="chapter${index}.xhtml"]`).click();
    await expect(page.locator('#tocDrawer')).not.toHaveClass(/\bopen\b/,{timeout:20000});
    await expect.poll(()=>page.evaluate(()=>document.querySelector('#chapterTitle')?.textContent),{timeout:15000}).toContain(`Chapter ${index}`);
    await expect.poll(async()=>{
      for(const frame of page.frames()){
        if(frame.isDetached()||frame.parentFrame()!==page.mainFrame())continue;
        try{if(await frame.locator(`#art-${index}`).count())return true;}
        catch(error){if(!frame.isDetached())throw error;}
      }
      return false;
    }).toBe(true);
    await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true',{timeout:20000});
    return findChapter(page,index);
  }
  async function findChapter(page,index){
    for(const frame of page.frames()){
      if(frame.isDetached()||frame.parentFrame()!==page.mainFrame())continue;
      try{if(await frame.locator(`#art-${index}`).count())return frame;}
      catch(error){if(!frame.isDetached())throw error;}
    }
    throw Error(`Chapter ${index} is not buffered`);
  }
  async function openImage(page,index=3){
    const frame=await chapter(page,index),image=frame.locator(`#art-${index}`);
    await image.scrollIntoViewIfNeeded();
    const before=await image.boundingBox();
    expect(before).not.toBeNull();
    // WebKit's intentional parent hit surface receives the real user gesture.
    // Target screen coordinates so the check exercises that surface as well as
    // direct iframe image input, without bypassing it with a forced DOM click.
    const point={x:before.x+before.width/2,y:before.y+before.height/2};
    if(test.info().project.name.startsWith('mobile'))await page.touchscreen.tap(point.x,point.y);
    else await page.mouse.click(point.x,point.y);
    await expect(page.locator('#imageFocus')).toBeVisible();
    return{image,before};
  }
  async function returned(page,image,before){
    await expect(page.locator('#imageFocus')).toBeHidden();
    await expect.poll(async()=>Math.abs((await image.boundingBox()).y-before.y)).toBeLessThan(3);
    await page.waitForTimeout(1600);
    expect(Math.abs((await image.boundingBox()).y-before.y)).toBeLessThan(3);
  }

  async function setFlow(page,flow){
    await page.locator('#settingsToggle').focus();
    await page.locator('#settingsToggle').click();
    await page.locator('#flowSelect').selectOption(flow);
    await page.locator('#settingsDrawer [data-close]').click();
    await expect(page.locator('body')).toHaveClass(flow==='paginated'?/reader-flow-paginated/:/reader-flow-scrolled/);
  }

  async function visiblePassage(page,index,id){
    await expect.poll(async()=>{
      try{
        const frame=await findChapter(page,index);
        const box=await frame.locator(id).boundingBox(),viewer=await page.locator('#viewer').boundingBox();
        if(!box||!viewer)return 0;
        const left=Math.max(box.x,viewer.x),right=Math.min(box.x+box.width,viewer.x+viewer.width);
        const top=Math.max(box.y,viewer.y),bottom=Math.min(box.y+box.height,viewer.y+viewer.height);
        if(right<=left||bottom<=top)return 0;
        const iframe=await frame.frameElement();
        // Chromium's IntersectionObserver reports zero for visible paragraphs
        // in the vendor's horizontally translated multi-column iframe. Check
        // parent clipping and the actual hit surface at the visible point.
        return await iframe.evaluate((element,point)=>document.elementFromPoint(point.x,point.y)===element,
          {x:(left+right)/2,y:(top+bottom)/2})?1:0;
      }catch{return 0}
    },{timeout:20000}).toBeGreaterThan(0);
  }

  async function visibleAnchor(page,index){
    const frame=await findChapter(page,index),iframe=await frame.frameElement();
    const origin=await iframe.boundingBox(),viewer=await page.locator('#viewer').boundingBox();
    const blocks=await frame.locator('h1[id],p[id],img[id]').evaluateAll(elements=>elements.map(element=>{
      const box=element.getBoundingClientRect();return{id:element.id,x:box.x,y:box.y,width:box.width,height:box.height};
    }));
    const visible=blocks.map(box=>({...box,x:box.x+origin.x,y:box.y+origin.y})).filter(box=>
      box.y+box.height>viewer.y&&box.y<viewer.y+viewer.height&&box.x+box.width>viewer.x&&box.x<viewer.x+viewer.width);
    expect(visible.length).toBeGreaterThan(0);
    if(await page.locator('body').evaluate(body=>body.classList.contains('reader-flow-scrolled'))){
      const line=viewer.y+viewer.height*.30;
      const distance=box=>Math.max(box.y-line,line-(box.y+box.height),0);
      visible.sort((a,b)=>distance(a)-distance(b));
    }else{
      // Pagination preserves the beginning of the visible reading page; an
      // illustration can put a previously centered paragraph on its next page.
      const left=Math.min(...visible.map(box=>box.x));
      visible.splice(0,visible.length,...visible.filter(box=>box.x<left+viewer.width*.45).sort((a,b)=>a.y-b.y));
    }
    return '#'+visible[0].id;
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
    // The existing immersive zoom UI hides chrome until zoom returns to fit.
    await page.locator('#imageFocusViewport').dispatchEvent('wheel',{deltaY:1800,ctrlKey:true,clientX:150,clientY:220});
    await expect(page.locator('#imageFocus')).not.toHaveClass(/reader-image-focus-zoomed/);
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
      await page.locator('#settingsToggle').focus();
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
    for(let visit=0;visit<2;visit++){
      await frame.locator('#note-link-3').click();
      await expect(page.locator('#readerNoteDialog')).toBeVisible();
      await expect(page.locator('#readerNoteDialog')).toContainText('Original fixture footnote for chapter 3.');
      await page.keyboard.press('Escape');
    }
    await frame.locator('#jump-3').click();
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 4',{timeout:15000});
    frame=await findChapter(page,4);
    await expect(frame.locator('#target-4')).toBeInViewport();
    await page.waitForTimeout(1600);
    await expect(frame.locator('#target-4')).toBeInViewport();
    // Repeat from a retained source chapter: consuming its iframe marker must
    // neither replay an old navigation nor prevent another activation.
    frame=await chapter(page,3);
    await frame.locator('#jump-3').click();
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 4',{timeout:15000});
    frame=await findChapter(page,4);
    await expect(frame.locator('#target-4')).toBeInViewport();
  });

  test('the Continuous rail seeks to the end and back through the app navigator',async({page})=>{
    await chapter(page,3);
    await page.locator('#continuousSeek').press('End');
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 8',{timeout:20000});
    const last=await findChapter(page,8);
    await expect(last.locator('#note-8')).toBeInViewport({timeout:20000});
    await page.locator('#continuousSeek').press('Home');
    await expect(page.locator('#chapterTitle')).toHaveText('Cover',{timeout:20000});
    await expect.poll(()=>page.evaluate(()=>Number(document.querySelector('#progressRange').value))).toBeLessThan(100);
  });

  test('Continuous scroll reporting survives the vendor boolean scroll flag',async({page})=>{
    const reports=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const manager=readerRuntime.current.state.rendition.manager;let reports=0;
      const listener=()=>reports++;manager.on('scroll',listener);
      manager.scrolled=true;manager.__sgSuppressScrollUntil=0;manager._scrolled();
      await new Promise(resolve=>setTimeout(resolve,100));manager.off('scroll',listener);
      return reports;
    });
    expect(reports).toBeGreaterThan(0);
  });

  test('a chapter selection cancels a debounced seek before it can move the viewport',async({page})=>{
    await chapter(page,3);
    // Dispatch both public controls in the same event turn so the delayed seek
    // is still pending when the newer chapter request takes ownership.
    await page.evaluate(()=>{
      const range=document.getElementById('progressRange');range.value='950';
      range.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('#tocPanel .toc-entry-link[data-href="chapter6.xhtml"]').click();
    });
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 6',{timeout:20000});
    const frame=await findChapter(page,6);
    await expect(frame.locator('#target-6')).toBeInViewport();
    await page.waitForTimeout(1600);
    await expect(frame.locator('#target-6')).toBeInViewport();
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 6');
  });

  test('a debounced range input reaches the shared seek owner without a legacy capture listener',async({page})=>{
    await chapter(page,3);
    await page.evaluate(()=>{
      const range=document.getElementById('progressRange');range.value='1000';
      range.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 8',{timeout:20000});
    await visiblePassage(page,8,'#note-8');
  });

  test('chapter navigation wins while foreground access renewal is delayed',async({page})=>{
    await chapter(page,3);
    let release;
    const delayed=new Promise(resolve=>{release=resolve});
    await page.route('**/book-access',async route=>{await delayed;await route.fallback()});
    // Normal foregrounding deliberately reuses a valid ticket. Advance only
    // wall-clock time into its renewal window, leaving reader timers untouched.
    await page.clock.setSystemTime(new Date(Date.now()+3590*1000));
    const renewing=page.waitForRequest('**/book-access');
    await page.evaluate(()=>{
      window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
      window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
    });
    await renewing;
    let frame;
    try{
      frame=await chapter(page,6);
      await expect(frame.locator('#target-6')).toBeInViewport();
    }finally{release()}
    await page.waitForTimeout(1600);
    await expect(frame.locator('#target-6')).toBeInViewport();
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 6');
  });

  test('rapid mode requests during position capture settle on the last mode with one rendition',async({page})=>{
    await chapter(page,4);
    // Start every public mode request in the same event turn, before the first
    // queued semantic capture can complete. Only the latest mode may survive.
    await page.evaluate(()=>{
      const select=document.getElementById('flowSelect');
      for(const flow of ['paginated','scrolled-doc','paginated','scrolled-doc']){
        select.value=flow;select.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/);
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 4',{timeout:20000});
    await expect.poll(()=>page.locator('#viewer .epub-container').count()).toBe(1);
    await page.waitForTimeout(1600);
    await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/);
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 4');
  });

  test('a mode request waits for the chapter destination already being navigated to',async({page})=>{
    await chapter(page,3);
    await page.evaluate(()=>{
      document.querySelector('#tocPanel .toc-entry-link[data-href="chapter6.xhtml"]').click();
      const select=document.getElementById('flowSelect');select.value='paginated';
      select.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await expect(page.locator('body')).toHaveClass(/reader-flow-paginated/,{timeout:20000});
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 6',{timeout:20000});
    await visiblePassage(page,6,'#target-6');
    await page.waitForTimeout(1200);
    await visiblePassage(page,6,'#target-6');
  });

  test('chapter selection cancels a mode capture before it can destroy the active rendition',async({page})=>{
    await chapter(page,3);
    await page.evaluate(()=>{
      const select=document.getElementById('flowSelect');select.value='paginated';
      select.dispatchEvent(new Event('change',{bubbles:true}));
      document.querySelector('#tocPanel .toc-entry-link[data-href="chapter6.xhtml"]').click();
    });
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 6',{timeout:20000});
    const frame=await findChapter(page,6);
    await expect(frame.locator('#target-6')).toBeInViewport();
    await page.waitForTimeout(1600);
    await expect(frame.locator('#target-6')).toBeInViewport();
    await expect(page.locator('#viewer .epub-container')).toHaveCount(1);
    await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/);
  });

  test('mode changes retain a passage in the middle of a chapter',async({page})=>{
    let frame=await chapter(page,4);
    const id='#passage-4-after-5';
    await frame.locator(id).scrollIntoViewIfNeeded();
    await expect(frame.locator(id)).toBeInViewport();
    for(const flow of ['paginated','scrolled-doc']){
      const anchor=await visibleAnchor(page,4);
      await setFlow(page,flow);
      await expect(page.locator('#chapterTitle')).toContainText('Chapter 4',{timeout:20000});
      await visiblePassage(page,4,anchor);
      await page.waitForTimeout(1200);
      await visiblePassage(page,4,anchor);
    }
  });

  test('font and viewport changes retain the visible Continuous passage',async({page})=>{
    let frame=await chapter(page,4);
    const id='#passage-4-after-5';
    await frame.locator(id).scrollIntoViewIfNeeded();
    await page.locator('#settingsToggle').focus();await page.locator('#settingsToggle').click();
    await page.locator('#fontSizeRange').fill('130');
    await page.locator('#fontSizeRange').dispatchEvent('input');
    await page.locator('#settingsDrawer [data-close]').click();
    await visiblePassage(page,4,id);
    await page.waitForTimeout(1200);
    const viewport=page.viewportSize();
    await page.setViewportSize({width:viewport.width+60,height:viewport.height-90});
    await visiblePassage(page,4,id);
    await page.waitForTimeout(1600);
    await visiblePassage(page,4,id);
    await expect(page.locator('#chapterTitle')).toContainText('Chapter 4');
  });
});
