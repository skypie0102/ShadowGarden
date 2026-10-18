import {test,expect} from '@playwright/test';
import {createReaderEpub,installReaderFixture,readerURL} from './reader-production-fixture.mjs';
import {installScrollDiagnostics} from './scroll-diagnostics.mjs';

test.describe('Continuous view-anchor fallback',()=>{
  test.setTimeout(90000);
  test.beforeEach(async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));page.__fallbackErrors=errors;
    await installScrollDiagnostics(page);
    await installReaderFixture(page,{publication:await createReaderEpub({chapterCount:32,paragraphCount:3})});
    await page.goto(readerURL);await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
    await page.locator('#tocToggle').focus();await page.locator('#tocToggle').click();
    await page.locator('#tocPanel .toc-entry-link[data-href="chapter20.xhtml"]').click();
    await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true',{timeout:30000});
    await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const {getReaderEngine}=await import('/assets/js/reader/engine.js');
      await getReaderEngine().settleNavigation(readerRuntime.current.state.rendition);
    });
  });

  test.afterEach(async({page})=>expect(page.__fallbackErrors).toEqual([]));

  for(const change of [-56,56])test(`pending upward scroll retains its passage when an earlier view changes ${change}px`,async({page},testInfo)=>{
    const result=await page.evaluate(async change=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const {captureContinuousScrollPosition}=await import('/assets/js/reader/rendition.js');
      const {rememberContinuousLayout,preserveContinuousLayout}=await import('/assets/js/reader/continuous-layout.js');
      const manager=readerRuntime.current.state.rendition.manager;
      const target=manager.views.all().find(view=>view.section.href==='chapter20.xhtml');
      manager.container.scrollTop+=target.iframe.getBoundingClientRect().top-manager.container.getBoundingClientRect().top+600;
      rememberContinuousLayout(manager);
      window.__sgScrollProbe.start(manager);
      // A structural mutation can run before the pending native scroll event
      // refreshes the saved block. Keep this ordering synchronous and explicit.
      manager.container.scrollTop-=400;
      const snapshot=captureContinuousScrollPosition(readerRuntime.current.state.rendition);
      const views=manager.views.all(),view=views.find(view=>view.section.index===snapshot.index);
      const earlier=views[views.indexOf(view)-1];
      if(!earlier?.displayed)throw new Error('Expected a rendered preceding chapter');
      const node=snapshot.contentNode,frame=view.iframe;
      const before=frame.getBoundingClientRect().top+node.getBoundingClientRect().top;
      const previousHeight=earlier.element.getBoundingClientRect().height;
      preserveContinuousLayout(manager,()=>earlier.reframe(earlier.width(),previousHeight+change));
      const after=frame.getBoundingClientRect().top+node.getBoundingClientRect().top;
      window.fallbackProbe={manager,node,frame,before};
      return{before,after,index:snapshot.index,previousHeight,
        height:earlier.element.getBoundingClientRect().height,transactions:window.__sgScrollProbe.events.slice()};
    },change);
    await page.waitForTimeout(350);
    const settled=await page.evaluate(()=>{
      const {node,frame,before}=window.fallbackProbe;
      window.__sgScrollProbe.stop();
      return{connected:node.isConnected&&frame.isConnected,before,
        after:frame.getBoundingClientRect().top+node.getBoundingClientRect().top,
        transactions:window.__sgScrollProbe.events};
    });
    await testInfo.attach('view-anchor-fallback',{body:JSON.stringify({change,result,settled}),contentType:'application/json'});
    const first=result.transactions.find(event=>event.type==='begin');
    expect(first.anchorKind,'Exercise the actual view fallback without replacing its selector').toBe('view');
    expect(first.anchorIndex).toBe(result.index);
    expect(result.height-result.previousHeight).toBe(change);
    expect(Math.abs(result.after-result.before)).toBeLessThanOrEqual(2);
    expect(settled.connected).toBe(true);
    expect(Math.abs(settled.after-settled.before)).toBeLessThanOrEqual(2);
  });
  test('a chapter boundary resize cycle retains the nearby preceding passage',async({page},testInfo)=>{
    const result=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const {rememberContinuousLayout}=await import('/assets/js/reader/continuous-layout.js');
      const {captureContinuousLayoutAnchor}=await import('/assets/js/reader/rendition.js');
      const manager=readerRuntime.current.state.rendition.manager;
      const view=manager.views.all().find(view=>view.section.href==='chapter20.xhtml');
      const height=view.element.getBoundingClientRect().height;
      const viewport=manager.container.getBoundingClientRect(),line=viewport.top+viewport.height*.3;
      manager.container.scrollTop+=view.element.getBoundingClientRect().bottom-line-52;
      rememberContinuousLayout(manager);
      const anchor=captureContinuousLayoutAnchor(manager),node=anchor.node,frame=anchor.view.iframe;
      const before=frame.getBoundingClientRect().top+node.getBoundingClientRect().top;
      window.__sgScrollProbe.start(manager);
      const body=view.contents.document.body;
      const padding=body.style.paddingBottom,priority=body.style.getPropertyPriority('padding-bottom'),margin=node.style.marginBottom;
      body.style.setProperty('padding-bottom','0px','important');node.style.marginBottom='0px';
      view.expand();
      const shrunkHeight=view.element.getBoundingClientRect().height;
      const shrunk=frame.getBoundingClientRect().top+node.getBoundingClientRect().top;
      body.style.setProperty('padding-bottom',padding,priority);node.style.marginBottom=margin;
      view.expand();
      const restoredHeight=view.element.getBoundingClientRect().height;
      const after=frame.getBoundingClientRect().top+node.getBoundingClientRect().top;
      window.__sgScrollProbe.stop();
      window.boundaryProbe={node,frame};
      return{before,shrunk,after,height,shrunkHeight,restoredHeight,section:anchor.view.section.index,transactions:window.__sgScrollProbe.events};
    });
    await page.waitForTimeout(350);
    const settled=await page.evaluate(()=>{
      const {node,frame}=window.boundaryProbe;
      return{connected:node.isConnected&&frame.isConnected,top:frame.getBoundingClientRect().top+node.getBoundingClientRect().top};
    });
    await testInfo.attach('boundary-resize-cycle',{body:JSON.stringify({...result,settled}),contentType:'application/json'});
    expect(settled.connected).toBe(true);
    expect(Math.abs(settled.top-result.before)).toBeLessThanOrEqual(2);
    expect(result.shrunkHeight-result.height).toBe(-56);
    expect(result.restoredHeight).toBe(result.height);
    expect(Math.abs(result.shrunk-result.before)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.after-result.before)).toBeLessThanOrEqual(2);
  });

});
