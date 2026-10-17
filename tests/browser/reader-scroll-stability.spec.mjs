import {test,expect} from '@playwright/test';
import {createReaderEpub,installReaderFixture,readerURL} from './reader-production-fixture.mjs';

test.describe('Continuous scroll stability',()=>{
  test.setTimeout(90000);
  test.beforeEach(async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));page.__scrollErrors=errors;
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
  test.afterEach(async({page})=>expect(page.__scrollErrors).toEqual([]));

  test('fast upward scrolling does not reverse when earlier chapters render',async({page},testInfo)=>{
    test.skip(testInfo.project.name==='mobile-webkit','Playwright does not support native wheel or touch scrolling in mobile WebKit.');
    await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const {captureContinuousScrollPosition}=await import('/assets/js/reader/rendition.js');
      const manager=readerRuntime.current.state.rendition.manager;
      const state={active:true,samples:[],resizes:[],first:manager.views.first().section.index};
      window.scrollStability=state;
      // Observe resize payloads without adding layout reads to those callbacks.
      const watched=new Set(),listeners=[];
      const watch=view=>{
        if(!view||watched.has(view))return;
        watched.add(view);
        const resized=size=>{if(state.active)state.resizes.push({atMs:performance.now(),index:view.section.index,
          width:size?.width,height:size?.height,displayed:view.displayed})};
        view.on('resized',resized);listeners.push([view,resized]);
      };
      manager.views.all().forEach(watch);
      const create=manager.createView;
      const tracedCreate=function(...args){const view=create.apply(this,args);watch(view);return view};
      manager.createView=tracedCreate;
      Object.defineProperty(state,'stop',{value:()=>{
        state.active=false;
        if(manager.createView===tracedCreate)manager.createView=create;
        for(const [view,resized] of listeners)view.off('resized',resized);
      }});
      let previous=null;
      const sample=()=>{
        if(!state.active)return;
        const snapshot=captureContinuousScrollPosition(readerRuntime.current.state.rendition);
        const view=manager.views.all().find(view=>view.section.index===snapshot?.index);
        const node=snapshot?.contentNode,frame=view?.iframe;
        if(snapshot&&node&&frame){
          // Reuse the original sampler's geometry reads for the extra evidence.
          const frameRect=frame.getBoundingClientRect(),nodeRect=node.getBoundingClientRect();
          const y=frameRect.top+nodeRect.top;
          const connected=previous?.node.isConnected&&previous.frame.isConnected;
          const priorFrame=connected?previous.frame.getBoundingClientRect():null;
          const priorNode=connected?previous.node.getBoundingClientRect():null;
          const delta=priorFrame?priorFrame.top+priorNode.top-previous.y:null;
          state.samples.push({index:snapshot.index,block:snapshot.native?.blockIndex,top:snapshot.top,delta,
            atMs:performance.now(),frameTop:frameRect.top,frameHeight:frameRect.height,
            prior:previous?{index:previous.index,block:previous.block,
              frameTopBefore:previous.frameTop,frameTopAfter:priorFrame?.top??null,
              nodeTopBefore:previous.nodeTop,nodeTopAfter:priorNode?.top??null,
              frameHeightBefore:previous.frameHeight,frameHeightAfter:priorFrame?.height??null}:null});
          previous={node,frame,y,index:snapshot.index,block:snapshot.native?.blockIndex,
            frameTop:frameRect.top,frameHeight:frameRect.height,nodeTop:nodeRect.top};
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const box=await page.locator('#viewer').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/3);
    // Native wheel input continues while real EPUB views load, theme and resize.
    // Track each previously visible block across the next paint, then sample a
    // fresh visible block. This avoids mixing incomparable block offsets at a
    // paragraph boundary or harmless changes to distant offscreen chapters.
    for(let index=0;index<32;index++){
      await page.mouse.wheel(0,-180);await page.waitForTimeout(12);
    }
    await page.waitForTimeout(500);
    const result=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const state=window.scrollStability;state.stop();
      return{...state,last:readerRuntime.current.state.rendition.manager.views.first().section.index};
    });
    expect(result.last).toBeLessThan(result.first);
    expect(result.samples.at(-1).index).toBeLessThan(result.samples[0].index);
    await testInfo.attach('visible-passage-trace',{body:JSON.stringify(result),contentType:'application/json'});
    const reversals=result.samples.map(position=>position.delta).filter(delta=>delta!==null&&delta< -3);
    expect(reversals,'Earlier-view rendering must not move the reader back down during upward input').toEqual([]);
    const beforeTrim=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const {captureContinuousScrollPosition}=await import('/assets/js/reader/rendition.js');
      const rendition=readerRuntime.current.state.rendition,snapshot=captureContinuousScrollPosition(rendition);
      window.trimScrollAnchor={node:snapshot.contentNode,frame:rendition.manager.views.all().find(view=>view.section.index===snapshot.index).iframe};
      return window.trimScrollAnchor.frame.getBoundingClientRect().top+window.trimScrollAnchor.node.getBoundingClientRect().top;
    });
    await page.waitForTimeout(2300);
    const afterTrim=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const {node,frame}=window.trimScrollAnchor;
      return{connected:node.isConnected&&frame.isConnected,top:frame.getBoundingClientRect().top+node.getBoundingClientRect().top,views:readerRuntime.current.state.rendition.manager.views.all().length};
    });
    expect(afterTrim.connected).toBe(true);expect(Math.abs(afterTrim.top-beforeTrim)).toBeLessThanOrEqual(2);
    expect(afterTrim.views).toBeLessThanOrEqual(12);
  });

  test('a previously prepended chapter growing below the viewport does not move it',async({page})=>{
    const shift=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const {getReaderEngine}=await import('/assets/js/reader/engine.js');
      const rendition=readerRuntime.current.state.rendition,manager=rendition.manager;
      const anchor=manager.views.all().find(view=>view.section.href==='chapter18.xhtml');
      manager.container.scrollTop+=anchor.element.getBoundingClientRect().top-manager.container.getBoundingClientRect().top+150;
      await getReaderEngine().settleNavigation(rendition);
      const below=manager.views.all().find(view=>view.section.href==='chapter19.xhtml');
      const before=anchor.element.getBoundingClientRect().top;
      const block=below.contents.document.createElement('div');block.style.height='320px';
      below.contents.document.body.appendChild(block);below.expand(true);
      return anchor.element.getBoundingClientRect().top-before;
    });
    expect(Math.abs(shift),'Growth below the visible passage must not shift it').toBeLessThanOrEqual(2);
  });

  test('unchanged chapter heights agree across vendor expansion and media reconciliation',async({page},testInfo)=>{
    const measure=()=>page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const manager=readerRuntime.current.state.rendition.manager;
      return manager.views.all().filter(view=>view.displayed).map(view=>({index:view.section.index,
        height:view.iframe.getBoundingClientRect().height,
        intrinsic:Math.round(view.contents.document.body.getBoundingClientRect().bottom+view.contents.window.scrollY)}));
    });
    const expand=()=>page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      for(const view of readerRuntime.current.state.rendition.manager.views.all())if(view.displayed)view.expand(true);
    });
    await expand();const vendor=await measure();
    await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const view=readerRuntime.current.state.rendition.manager.views.all().find(view=>view.displayed);
      view.contents.document.querySelector('img').dispatchEvent(new Event('load'));
    });
    await page.waitForTimeout(200);const media=await measure();
    await expand();const repeated=await measure();
    await testInfo.attach('continuous-height-contract',{body:JSON.stringify({vendor,media,repeated}),contentType:'application/json'});
    for(const phase of [vendor,media,repeated]){
      expect(phase.length).toBeGreaterThan(0);
      for(const view of phase)expect(Math.abs(view.height-view.intrinsic),`Chapter ${view.index} must include its body extent`).toBeLessThanOrEqual(1);
    }
  });

  test('real artwork shrinkage reduces the frame and preserves the following passage',async({page})=>{
    const before=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const manager=readerRuntime.current.state.rendition.manager;
      const view=manager.views.all().find(view=>view.section.href==='chapter20.xhtml');
      const node=view.contents.document.querySelector('#passage-20-after-0');
      const image=view.contents.document.querySelector('#art-20');
      const viewport=manager.container.getBoundingClientRect();
      manager.container.scrollTop+=view.iframe.getBoundingClientRect().top+node.getBoundingClientRect().top-viewport.top-viewport.height*.3;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      window.shrinkPassage={view,node,image};
      return{top:view.iframe.getBoundingClientRect().top+node.getBoundingClientRect().top,
        frame:view.iframe.getBoundingClientRect().height,image:image.getBoundingClientRect().height};
    });
    await page.evaluate(()=>{
      const {view,image}=window.shrinkPassage;
      image.style.setProperty('height',`${image.getBoundingClientRect().height-120}px`,'important');
      view.expand(true);
    });
    await page.waitForTimeout(250);
    const after=await page.evaluate(()=>{
      const {view,node,image}=window.shrinkPassage;
      return{top:view.iframe.getBoundingClientRect().top+node.getBoundingClientRect().top,
        frame:view.iframe.getBoundingClientRect().height,image:image.getBoundingClientRect().height};
    });
    expect(before.image-after.image).toBeGreaterThanOrEqual(119);
    expect(before.frame-after.frame).toBeGreaterThanOrEqual(119);
    expect(Math.abs(after.top-before.top)).toBeLessThanOrEqual(2);
  });

  test('late artwork growth above the passage within its own chapter preserves the passage',async({page})=>{
    const before=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const manager=readerRuntime.current.state.rendition.manager;
      const view=manager.views.all().find(view=>view.section.href==='chapter20.xhtml');
      const node=view.contents.document.querySelector('#passage-20-after-0');
      const viewport=manager.container.getBoundingClientRect();
      manager.container.scrollTop+=view.iframe.getBoundingClientRect().top+node.getBoundingClientRect().top-viewport.top-viewport.height*.3;
      window.lateArtworkPassage={view,node};
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return view.iframe.getBoundingClientRect().top+node.getBoundingClientRect().top;
    });
    await page.evaluate(()=>{
      const {view}=window.lateArtworkPassage;
      const image=view.contents.document.querySelector('#art-20');
      const height=image.getBoundingClientRect().height;
      image.style.setProperty('height',`${height+320}px`,'important');
      image.style.setProperty('max-height','none','important');view.expand(true);
      window.lateArtworkPassage.growth=image.getBoundingClientRect().height-height;
    });
    await page.waitForTimeout(250);
    const after=await page.evaluate(()=>{const {view,node}=window.lateArtworkPassage;return view.iframe.getBoundingClientRect().top+node.getBoundingClientRect().top});
    expect(await page.evaluate(()=>window.lateArtworkPassage.growth)).toBeGreaterThanOrEqual(319);
    expect(Math.abs(after-before),'Late media layout inside the visible chapter must not displace the passage').toBeLessThanOrEqual(2);
    const moved=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const manager=readerRuntime.current.state.rendition.manager,{view}=window.lateArtworkPassage;
      // Move into the illustration and resize it before another scroll event
      // can refresh the old paragraph anchor. The latest movement still wins.
      manager.container.scrollTop-=240;
      const image=view.contents.document.querySelector('#art-20');
      const top=view.iframe.getBoundingClientRect().top+image.getBoundingClientRect().top;
      image.style.setProperty('height',`${image.getBoundingClientRect().height+320}px`,'important');view.expand(true);
      return top;
    });
    await page.waitForTimeout(250);
    const current=await page.evaluate(()=>{const {view}=window.lateArtworkPassage;return view.iframe.getBoundingClientRect().top+view.contents.document.querySelector('#art-20').getBoundingClientRect().top});
    expect(Math.abs(current-moved),'A previous paragraph anchor must not undo newer movement into the illustration').toBeLessThanOrEqual(2);
  });

  test('height-only viewport changes retain the live Continuous passage',async({page})=>{
    const before=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const manager=readerRuntime.current.state.rendition.manager;
      window.heightResizeView=manager.views.all().find(view=>view.section.href==='chapter20.xhtml');
      manager.container.scrollTop+=250;
      return window.heightResizeView.element.getBoundingClientRect().top;
    });
    const size=page.viewportSize();await page.setViewportSize({...size,height:size.height-100});
    await page.waitForTimeout(500);
    const after=await page.evaluate(()=>({connected:window.heightResizeView.element.isConnected,top:window.heightResizeView.element.getBoundingClientRect().top}));
    expect(after.connected,'Revealing browser chrome must not destroy and reopen the live chapter').toBe(true);
    expect(Math.abs(after.top-before)).toBeLessThanOrEqual(2);
  });

  test('native scrolling wins over a suspended-position restore waiting for access',async({page},testInfo)=>{
    test.skip(testInfo.project.name==='mobile-webkit','Playwright does not support native wheel or touch scrolling in mobile WebKit; the continuing-scroll case covers native offset events.');
    await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const reader=readerRuntime.current,manager=reader.state.rendition.manager;
      window.resumeScrollView=manager.views.all().find(view=>view.section.href==='chapter20.xhtml');
      manager.container.scrollTop+=300;
      await reader.resume.capture({semantic:false});
      reader.session.renewAccess=()=>new Promise(resolve=>{window.releaseScrollRenewal=resolve});
      window.scrollResumeResult=null;
      void reader.resume.restore().then(result=>{window.scrollResumeResult=result});
    });
    await expect.poll(()=>page.evaluate(()=>typeof window.releaseScrollRenewal)).toBe('function');
    const box=await page.locator('#viewer').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/3);
    await page.mouse.wheel(0,-180);
    const moved=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const {getReaderEngine}=await import('/assets/js/reader/engine.js');
      const {captureContinuousScrollPosition}=await import('/assets/js/reader/rendition.js');
      const rendition=readerRuntime.current.state.rendition,manager=rendition.manager;
      await getReaderEngine().settleNavigation(rendition);
      let previous=manager.container.scrollTop,quiet=0;
      // WebKit may still animate native wheel input after 100 ms. Compare a
      // settled visible block, not a wrapper top while that input is in flight.
      for(let frame=0;frame<120&&quiet<5;frame++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const top=manager.container.scrollTop;quiet=Math.abs(top-previous)<.25?quiet+1:0;previous=top;
      }
      if(quiet<5)throw Error('Native scrolling did not settle');
      const snapshot=captureContinuousScrollPosition(rendition);
      const view=manager.views.all().find(view=>view.section.index===snapshot?.index);
      if(!snapshot?.contentNode||!view)throw Error('No visible passage after native scrolling');
      window.resumeScrollPassage={node:snapshot.contentNode,frame:view.iframe};
      return view.iframe.getBoundingClientRect().top+snapshot.contentNode.getBoundingClientRect().top;
    });
    await page.evaluate(()=>window.releaseScrollRenewal());
    await expect.poll(()=>page.evaluate(()=>window.scrollResumeResult)).not.toBeNull();
    expect(await page.evaluate(()=>window.scrollResumeResult)).toBe(false);
    await page.waitForTimeout(150);
    const current=await page.evaluate(()=>{
      const {node,frame}=window.resumeScrollPassage;
      if(!node.isConnected||!frame.isConnected)throw Error('The visible passage was replaced');
      return frame.getBoundingClientRect().top+node.getBoundingClientRect().top;
    });
    expect(Math.abs(current-moved)).toBeLessThanOrEqual(2);
  });

  test('reporting a Continuous location leaves publication layout untouched',async({page})=>{
    const result=await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const manager=readerRuntime.current.state.rendition.manager;
      let formats=0;const originalLayouts=new Map();
      const observers=manager.views.all().map(view=>{
        originalLayouts.set(view,view.setLayout);
        view.setLayout=function(...args){formats++;return originalLayouts.get(view).apply(this,args)};
        const observer=new MutationObserver(()=>{});
        observer.observe(view.contents.document.documentElement,{attributes:true,subtree:true,attributeFilter:['style']});
        return observer;
      });
      const location=manager.currentLocation();
      let writes=0;for(const observer of observers){writes+=observer.takeRecords().length;observer.disconnect()}
      for(const [view,setLayout] of originalLayouts)view.setLayout=setLayout;
      return{writes,formats,locations:location.length};
    });
    expect(result.locations).toBeGreaterThan(0);
    expect(result.writes,'A reading-position query must not reformat every buffered chapter').toBe(0);
    expect(result.formats).toBe(0);
  });

  test('scroll continuation without another input event cancels stale resume work',async({page})=>{
    await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const reader=readerRuntime.current,manager=reader.state.rendition.manager;
      await reader.resume.capture({semantic:false});
      reader.session.renewAccess=()=>new Promise(resolve=>{window.releaseMomentumRenewal=resolve});
      window.momentumResumeResult=null;
      void reader.resume.restore().then(result=>{window.momentumResumeResult=result});
      await new Promise(resolve=>requestAnimationFrame(resolve));
      // Touch inertia and scrollbar dragging deliver scroll events after their
      // initiating input. Change the native scroll offset without a new gesture.
      manager.container.scrollTop+=180;
    });
    await expect.poll(()=>page.evaluate(()=>typeof window.releaseMomentumRenewal)).toBe('function');
    await page.waitForTimeout(80);
    await page.evaluate(()=>window.releaseMomentumRenewal());
    await expect.poll(()=>page.evaluate(()=>window.momentumResumeResult)).toBe(false);
  });

  test('movement during a slow prepend receives a fresh neighborhood without another gesture',async({page})=>{
    await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const manager=readerRuntime.current.state.rendition.manager;
      const prepend=manager.prepend;let delayed=false;
      manager.prepend=function(...args){
        const view=prepend.apply(this,args);
        if(!delayed){
          delayed=true;const display=view.display;
          view.display=async function(...args){
            await new Promise(resolve=>{window.releaseSlowPrepend=resolve});
            return display.apply(this,args);
          };
        }
        return view;
      };
      const view=manager.views.all().find(view=>view.section.href==='chapter18.xhtml');
      manager.container.scrollTop+=view.element.getBoundingClientRect().top-manager.container.getBoundingClientRect().top+100;
      manager.check();
    });
    await expect.poll(()=>page.evaluate(()=>typeof window.releaseSlowPrepend)).toBe('function');
    await page.evaluate(async()=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const manager=readerRuntime.current.state.rendition.manager;
      const view=manager.views.all().find(view=>view.section.href==='chapter16.xhtml');
      manager.container.scrollTop+=view.element.getBoundingClientRect().top-manager.container.getBoundingClientRect().top+100;
      // Wait for the queued scroll request while the earlier neighborhood is loading.
    });
    await page.waitForTimeout(80);
    const result=await page.evaluate(async()=>{
      window.releaseSlowPrepend();
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const {pendingContinuousBuffer}=await import('/assets/js/reader/continuous-state.js');
      const manager=readerRuntime.current.state.rendition.manager;
      await pendingContinuousBuffer(manager);
      const views=manager.views.all(),viewport=manager.container.getBoundingClientRect();
      const index=views.findIndex(view=>view.element.getBoundingClientRect().bottom>viewport.top+viewport.height*.3);
      return{index,href:views[index].section.href,displayed:views.slice(0,index).every(view=>view.displayed)};
    });
    expect(result.displayed).toBe(true);
    expect(result.href).toBe('chapter16.xhtml');
    expect(result.index,'The final visible chapter needs its own preceding buffer').toBeGreaterThanOrEqual(4);
  });

  for(const stage of ['section','iframe'])test(`a removed chapter during ${stage} loading cannot publish late work`,async({page})=>{
    const result=await page.evaluate(async stage=>{
      const {readerRuntime}=await import('/assets/js/reader-bootstrap.js?v=2.11.0');
      const rendition=readerRuntime.current.state.rendition,manager=rendition.manager;
      const section=manager.views.first().section.prev(),render=section.render;
      let release;const gate=new Promise(resolve=>{release=resolve});
      if(stage==='section')section.render=async function(...args){await gate;return render.apply(this,args)};
      const view=manager.prepend(section);let events=0;
      if(stage==='iframe'){
        const load=view.load;
        view.load=function(...args){
          const pending=load.apply(this,args);manager.erase(view,true);release();return pending;
        };
      }
      const rendered=(_section,item)=>{if(item===view)events++};rendition.on('rendered',rendered);
      const displaying=view.display(manager.request).then(()=> 'displayed',error=>error.name);
      await Promise.resolve();
      if(stage==='section')manager.erase(view,true);
      const status=await Promise.race([displaying,new Promise(resolve=>setTimeout(()=>resolve('pending'),1000))]);
      release();
      await new Promise(resolve=>setTimeout(resolve,100));
      rendition.off('rendered',rendered);section.render=render;
      return{status,displayed:view.displayed,retainedFrame:Boolean(view.iframe),events};
    },stage);
    expect(result).toEqual({status:'AbortError',displayed:false,retainedFrame:false,events:0});
  });
});
