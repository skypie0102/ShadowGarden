import {test,expect} from '@playwright/test';
import {installKeeper} from './keeper-volume-fixture.mjs';
import {installReaderFixture,readerBookId,readerSeriesId,readerTitle} from './reader-production-fixture.mjs';

test.setTimeout(90000);
const stylesheet='link[href="/assets/css/visual-accessibility.css?v=2.29.1"]';
const identity='bk_A2yCOKedG1g4xXTJJhbEzA';
const cover='/test/phase4-cover.svg';
const items=[0,1].map(i=>({id:`phase4-${i}`,title:i?'A second Garden story':'A carefully preserved Garden with a longer title',
  author:'Disposable author',year:2026,status:'Ongoing',cover,genres:['Fantasy'],tags:['Review'],
  description:'Original fixture prose. The cover, details, reading and pin actions keep their released arrangement.',
  volumes:[{bookId:identity,file:identity,number:1,title:'A longer volume title for the existing reading and download controls',cover,added:'2026-10-24T00:00:00Z'}]}));

async function prepare(page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
}
async function publicFixture(page,adult){
  await prepare(page);await page.addInitScript(()=>localStorage.setItem('sg-adult-ack','1'));
  await page.route(`**${cover}`,r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#30263e"/><path d="M0 220 200 60V300H0Z" fill="#655378"/></svg>'}));
  for(const scope of [false,true])await page.route(`**/media/shadow-garden/data/${scope?'adult-catalog':'catalog'}.json`,r=>r.fulfill({json:{series:scope===adult?items.map(item=>({...item,nsfw:adult})):[]}}));
}
async function library(page,adult){
  await page.goto(adult?'/nsfw':'/');await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy','false');
}
async function pageMapReady(page){
  await expect.poll(()=>page.evaluate(async()=>{
    const src=document.querySelector('script[src*="reader-bootstrap.js"]').getAttribute('src');
    return(await import(src)).readerRuntime.current.state.pageMap.hasCompleteMap();
  }),{timeout:45000}).toBe(true);
  await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy','true',{timeout:20000});
}
async function geometry(page){
  return page.evaluate(async()=>{
    await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const selectors='a,button,input,select,textarea,img,.filters,.search-field,.catalog-grid,.series-hero-inner,.series-heading,.series-actions,.tag-row,.volume-card,.volume-list-row,.empty-state,.catalog-skeleton-card,.admin-toast,.series-editor-save-state,#viewer';
    const properties=['display','position','margin','padding','gap','font-family','font-size','font-weight','line-height','border-top-width','border-radius','grid-template-columns','flex-direction','flex-wrap'];
    return{overflow:document.documentElement.scrollWidth>innerWidth,nodes:[...document.querySelectorAll(selectors)].flatMap(e=>{
      const b=e.getBoundingClientRect(),c=getComputedStyle(e);if(!b.width||!b.height||c.visibility==='hidden')return[];
      return[{tag:e.tagName,id:e.id,classes:e.className?.baseVal??e.className,
        box:[b.x,b.y,b.width,b.height].map(v=>Math.round(v*100)/100),style:Object.fromEntries(properties.map(p=>[p,c.getPropertyValue(p)]))}];
    })};
  });
}
async function preserveGeometry(page,label){
  // All released styles and markup remain intact. Disabling the one new sheet
  // reproduces v2.29.0 on the same DOM, with identical font/data/focus state.
  await expect(page.locator(stylesheet)).toHaveCount(1);
  await page.mouse.move(0,0);const candidate=await geometry(page);
  await page.locator(stylesheet).evaluate(link=>{link.disabled=true;});
  let baseline;try{baseline=await geometry(page);}finally{await page.locator(stylesheet).evaluate(link=>{link.disabled=false;});}
  const restored=await geometry(page);
  expect(candidate,label+': released layout').toEqual(baseline);
  expect(restored,label+': restored cascade').toEqual(candidate);
  await test.info().attach(label+'-geometry',{contentType:'application/json',body:JSON.stringify({nodes:candidate.nodes.length,overflow:candidate.overflow,baseline:'v2.29.0 / 64c58af3eb0d841c745b7c9866f7b466e3f68212',unchanged:true})});
}
function channels(color){const values=color.match(/[\d.]+/g)?.map(Number);if(!values||values.length<3)throw Error('Unsupported measured color: '+color);return values.slice(0,3);}
function luminance(color){return channels(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
async function focus(page,locator){
  await page.keyboard.press('Tab');await locator.focus();await expect(locator).toBeFocused();
  await expect(locator).toHaveCSS('outline-style','solid');await expect(locator).toHaveCSS('outline-width','2px');
  await locator.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const css=await locator.evaluate(e=>{const c=getComputedStyle(e);return{style:c.outlineStyle,width:parseFloat(c.outlineWidth),color:c.outlineColor};});
  expect(css.style).toBe('solid');expect(css.width).toBeGreaterThanOrEqual(2);return css;
}

for(const adult of [false,true]){
  const scope=adult?'Adult':'Main';
  test(`${scope} readable filters retain keyboard reach and released geometry`,async({page},info)=>{
    await publicFixture(page,adult);
    for(const width of [320,761,1280]){
      await page.setViewportSize({width,height:850});await library(page,adult);
      if(width===320){
        await expect(page.locator('#authorSelect')).toBeHidden();
        const toggle=page.locator('#filterToggle');await focus(page,toggle);
        const tabIds=async count=>{const ids=[];for(let i=0;i<count;i++){await page.keyboard.press('Tab');ids.push(await page.evaluate(()=>document.activeElement.id));}return ids;};
        expect(await tabIds(5)).not.toContain('authorSelect');
        await focus(page,toggle);await page.keyboard.press('Space');
        await expect(toggle).toHaveAttribute('aria-expanded','true');
        await expect(page.locator('#authorSelect')).toBeVisible();
        expect(await tabIds(4)).toContain('authorSelect');
      }
      await focus(page,page.locator('#searchInput'));await focus(page,page.locator('#authorSelect'));
      const colors=await page.evaluate(()=>{
        const select=getComputedStyle(document.getElementById('authorSelect')),placeholder=getComputedStyle(document.getElementById('searchInput'),'::placeholder');
        return{background:select.backgroundColor,border:select.borderTopColor,placeholder:placeholder.color,opacity:placeholder.opacity,
          metadata:getComputedStyle(document.querySelector('.card-meta')).color,status:getComputedStyle(document.getElementById('resultCount')).color};
      });
      const conservativePanel=adult?'rgb(35,20,26)':'rgb(32,26,40)';
      expect(contrast(colors.placeholder,colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(colors.opacity).toBe('1');expect(contrast(colors.border,colors.background)).toBeGreaterThanOrEqual(3);
      for(const color of [colors.metadata,colors.status])expect(contrast(color,conservativePanel)).toBeGreaterThanOrEqual(4.5);
      await info.attach(`${scope}-${width}-contrast`,{contentType:'application/json',body:JSON.stringify({placeholder:contrast(colors.placeholder,colors.background),boundary:contrast(colors.border,colors.background),metadataAgainstConservativePanel:contrast(colors.metadata,conservativePanel),statusAgainstConservativePanel:contrast(colors.status,conservativePanel)})});
      await preserveGeometry(page,`${scope}-library-${width}`);
      expect((await geometry(page)).overflow).toBe(false);
      if(width===761)await info.attach('tablet-filters',{contentType:'image/png',body:await page.screenshot({fullPage:true,animations:'disabled'})});
      await page.locator('#searchInput').fill('No matching original fixture');await expect(page.locator('#emptyState')).toBeVisible();
      await focus(page,page.locator('.empty-filter-actions button').first());
      await preserveGeometry(page,`${scope}-empty-${width}`);
    }
    await page.evaluate(()=>sessionStorage.setItem('phase4-larger-text','1'));
    await page.addInitScript(()=>{if(sessionStorage.getItem('phase4-larger-text'))document.documentElement.style.fontSize='125%';});
    // Set larger text before the new document's first layout. WebKit can retain
    // stale inherited computed font sizes after changing the root on a live page.
    await page.setViewportSize({width:320,height:850});await library(page,adult);
    await expect(page.locator('html')).toHaveCSS('font-size','20px');
    await preserveGeometry(page,`${scope}-increased-text`);
    expect((await geometry(page)).overflow).toBe(false);
    await info.attach('increased-text',{contentType:'image/png',body:await page.screenshot({fullPage:true,animations:'disabled'})});
    await page.evaluate(()=>sessionStorage.removeItem('phase4-larger-text'));
    for(const outcome of ['empty','failure']){
      let release,requested=false;const pending=new Promise(r=>{release=r;});
      await page.route(`**/media/shadow-garden/data/${adult?'adult-catalog':'catalog'}.json`,async route=>{
        requested=true;await pending;await route.fulfill(outcome==='failure'?{status:503,json:{error:'Disposable visual review outage'}}:{json:{series:[]}});
      });
      await page.goto(adult?'/nsfw':'/',{waitUntil:'domcontentloaded'});await expect.poll(()=>requested).toBe(true);
      await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy','true');
      await expect(page.locator('.catalog-skeleton-card').first()).toBeVisible();
      const duration=await page.locator('.catalog-skeleton-cover').first().evaluate(e=>getComputedStyle(e,'::after').animationDuration);
      expect(parseFloat(duration)).toBeLessThanOrEqual(.01);
      await preserveGeometry(page,`${scope}-loading-${outcome}`);release();
      await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy','false');
      if(outcome==='empty')await expect(page.locator('#emptyState')).toBeVisible();
      else await expect(page.locator('#resultCount')).toHaveText('Could not load catalog');
      await preserveGeometry(page,`${scope}-${outcome}-feedback`);
      await info.attach(`${outcome}-feedback`,{contentType:'image/png',body:await page.screenshot({fullPage:true,animations:'disabled'})});
    }
  });

  test(`${scope} Series reading/download, pin and Grid/List keep their released layout`,async({page},info)=>{
    await publicFixture(page,adult);
    for(const width of [320,393,761,1280]){
      await page.setViewportSize({width,height:850});await page.goto(`/series?id=phase4-0&scope=${adult?'adult':'main'}`);
      await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy','false');
      await page.locator('.series-cover').evaluate(e=>e.decode());
      for(const view of ['grid','list']){
        await page.locator(`[data-series-view="${view}"]`).click();
        await preserveGeometry(page,`${scope}-series-${view}-${width}`);
        const controls=()=>page.locator('.series-actions > *, .volume-actions a').evaluateAll(nodes=>nodes.map(e=>{
          const c=getComputedStyle(e);return{text:e.textContent,color:c.color,background:c.background,border:c.border,padding:c.padding,font:c.font};
        }));
        const after=await controls();await page.locator(stylesheet).evaluate(e=>{e.disabled=true;});
        const before=await controls();await page.locator(stylesheet).evaluate(e=>{e.disabled=false;});
        expect(after,'released reading/download and hero button appearance').toEqual(before);
        expect((await geometry(page)).overflow).toBe(false);
      }
      if(width===393)await info.attach('mobile-series',{contentType:'image/png',body:await page.screenshot({fullPage:true,animations:'disabled'})});
    }
  });

  test(`${scope} contrast themes distinguish selected views without moving controls`,async({page},info)=>{
    await publicFixture(page,adult);await page.emulateMedia({forcedColors:'active'});
    test.skip(!await page.evaluate(()=>matchMedia('(forced-colors: active)').matches),'This engine does not emulate forced colors.');
    await page.setViewportSize({width:761,height:850});await library(page,adult);
    const compact=page.locator('[data-view="compact"]');await focus(page,compact);await page.keyboard.press('Space');
    await expect(compact).toHaveAttribute('aria-pressed','true');await expect(page.locator('#catalogGrid')).toHaveClass(/compact/);
    await page.locator('#searchInput').focus();
    await expect(compact).toHaveCSS('outline-style','solid');await expect(compact).toHaveCSS('text-decoration-line','underline');
    await expect(page.locator('[data-view="grid"]')).toHaveAttribute('aria-pressed','false');
    await preserveGeometry(page,`${scope}-forced-colors`);
    await info.attach('contrast-theme',{contentType:'image/png',body:await page.screenshot({fullPage:true,animations:'disabled'})});
  });

  test(`${scope} Reader focus follows all four interface themes without reflowing settings`,async({page},info)=>{
    await prepare(page);await installReaderFixture(page,{flow:'paginated'});
    await page.addInitScript(()=>localStorage.setItem('sg-adult-ack','1'));
    const id=adult?'adult-phase4-reader':readerSeriesId;
    for(const scope of [false,true])await page.route(`**/media/shadow-garden/data/${scope?'adult-catalog':'catalog'}.json`,r=>r.fulfill({json:{series:scope===adult?[{id,title:readerTitle,nsfw:adult,volumes:[{bookId:readerBookId,file:readerBookId,number:1,title:readerTitle}]}]:[]}}));
    await page.goto(`/reader.html?book=${readerBookId}&series=${id}&scope=${adult?'adult':'main'}`);
    await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});await pageMapReady(page);await page.locator('#settingsToggle').click();
    for(const theme of ['garden','night','black','paper']){
      await page.locator('#themeSelect').selectOption(theme);await expect(page.locator('body')).toHaveClass(new RegExp(`reader-theme-${theme}`));
      await pageMapReady(page);
      const ring=await focus(page,page.locator('#themeSelect'));
      const panel=await page.locator('#settingsDrawer').evaluate(e=>getComputedStyle(e).backgroundColor);
      expect(contrast(ring.color,panel)).toBeGreaterThanOrEqual(3);
      await preserveGeometry(page,`${scope}-reader-${theme}`);
    }
    await info.attach('paper-settings',{contentType:'image/png',body:await page.screenshot({animations:'disabled'})});
  });
}

test('Keeper dialog actions retain geometry and show keyboard focus without catalog writes',async({page},info)=>{
  await prepare(page);const f=await installKeeper(page);await page.locator('[data-manager-open="a"]').click();
  for(const width of [320,761,1280]){
    await page.locator('#manageTitle').fill('Series a');
    await page.setViewportSize({width,height:850});await focus(page,page.locator('#deleteSeries'));
    await preserveGeometry(page,`keeper-dialog-${width}`);
    await expect(page.locator('#saveSeries')).toBeDisabled();
    await focus(page,page.locator('#manageTitle'));await page.locator('#manageTitle').fill('An unsaved title with clear keyboard feedback');
    await expect(page.locator('#saveSeries')).toBeEnabled();await focus(page,page.locator('#saveSeries'));
    await preserveGeometry(page,`keeper-dirty-${width}`);
  }
  await info.attach('keeper-keyboard',{contentType:'image/png',body:await page.screenshot({animations:'disabled'})});
  expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
});

test('Keeper saving and success feedback retain their released presentation',async({page},info)=>{
  await prepare(page);let release;const pending=new Promise(r=>{release=r;});
  const f=await installKeeper(page,async()=>{await pending;return false;});
  await page.locator('[data-manager-open="a"]').click();await page.locator('#manageTitle').fill('Original visual review title');
  await page.locator('#saveSeries').click();await expect(page.locator('#saveSeries')).toHaveText('Saving…');
  await expect(page.locator('#saveSeries')).toBeDisabled();await preserveGeometry(page,'keeper-saving');
  release();await expect(page.locator('#seriesEditor')).not.toBeVisible();
  const toast=page.locator('.admin-toast.success');await expect(toast).toContainText('Saved “Original visual review title”.');
  await preserveGeometry(page,'keeper-success');
  await info.attach('keeper-success',{contentType:'image/png',body:await page.screenshot({animations:'disabled'})});
  expect(f.writes).toHaveLength(1);expect(f.writes[0].payload.action).toBe('update-series');expect(f.errors).toEqual([]);
});
