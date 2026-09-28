import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {baseURL,adminToken,sessionSecret,sessionId,bookId,seriesId} from './fixture.mjs';
import {fixtureDatabase} from './database.mjs';

function cookie(name,kind,claims={}) {
  const data=Buffer.from(JSON.stringify({...claims,kind,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  return {name,value:`${data}.${createHmac('sha256',sessionSecret).update(data).digest('base64url')}`,
    domain:'127.0.0.1',path:'/',secure:true,httpOnly:true,sameSite:'Strict'};
}
const auth={authorization:`Bearer ${adminToken}`};
const post=(request,path,data,revision)=>request.post(path,{headers:{...auth,'if-match':String(revision)},data});

async function capture(page,name,{fullPage=true}={}) {
  // Keep successful render evidence as well as failure screenshots. Reviewers
  // can inspect the real recovered layouts even when local Chromium is absent.
  await page.evaluate(async()=>{
    await window.__sgPageReveal;
    window.scrollTo(0,0);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    await Promise.allSettled(document.getAnimations().filter(animation=>Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation=>animation.finished));
  });
  await test.info().attach(name,{body:await page.screenshot({fullPage,animations:'disabled'}),contentType:'image/png'});
}

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    // Cross-document view transitions can expose a blank compositor frame even
    // after DOM visibility checks pass. Await their actual completion in captures.
    window.__sgPageReveal=Promise.resolve();
    window.addEventListener('pagereveal',event=>{
      window.__sgPageReveal=event.viewTransition?.finished.catch(()=>{})||Promise.resolve();
    });
  });
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.__runtimeErrors=errors;
  // Fonts/analytics are outside this recovery test; all application requests use
  // the real Pages runtime. No API responses are intercepted or fabricated.
  await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.fulfill({status:204,body:''}));
});
test.afterEach(async({page})=>expect(page.__runtimeErrors).toEqual([]));

async function openKeeper(page,context) {
  await context.addCookies([cookie('__Host-sg_admin','admin',{sid:sessionId})]);
  await page.goto('/admin',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>Boolean(window.ShadowGardenKeeperReady))).toBe(true);
  await page.locator('#adminToken').fill(adminToken);
  // Establishing a session with live Turnstile remains a separate integration
  // gate. The fixture session is signed normally and checked by real D1 here.
  await page.evaluate(async()=>{
    const keeper=window.ShadowGardenKeeper;
    await keeper.client.verifySession();
    keeper.client.markUnlocked();keeper.state.unlocked=true;
    document.querySelector('#lockedView').classList.add('hidden');
    document.querySelector('#dashboardView').classList.remove('hidden');
    keeper.events.dispatchEvent(new Event('session:unlocked'));
  });
  await expect(page.locator('[data-manager-open]')).toHaveCount(1);
}

test('public pages and catalog are served by Pages with the recovered empty main library',async({page,request})=>{
  const response=await page.goto('/',{waitUntil:'domcontentloaded'});
  expect(response.status()).toBe(200);
  await expect(page.locator('#emptyState')).toBeVisible();
  await expect(page.locator('#headerVolumes')).toHaveText('0');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await capture(page,'empty-main-library');
  const catalog=await request.get('/media/shadow-garden/data/adult-catalog.json');
  expect(catalog.status()).toBe(200);
  const data=await catalog.json();expect(data.series).toHaveLength(1);expect(data.series[0].volumes).toHaveLength(5);
  expect(JSON.stringify(data)).not.toContain('epubKey');
  expect((await request.get('/admin-api/library')).status()).toBe(401);
  expect((await request.get('/book-access')).status()).toBe(405);
  const missing=await request.get('/no-such-recovered-page');expect(missing.status()).toBe(404);
});

test('adult acknowledgement returns to the recovered series with five readable links and cover assets',async({page})=>{
  await page.goto(`/series?id=${seriesId}`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#adultGate')).toBeVisible();
  // Catalog initialization rewrites the filter URL. Return navigation must still
  // work when acknowledgement happens afterwards, including on mobile.
  await expect(page.locator('#headerVolumes')).toHaveText('5');
  await capture(page,'adult-acknowledgement',{fullPage:false});
  await page.locator('#adultEnter').click();
  await expect(page.locator('#seriesRoot .volume-card')).toHaveCount(5);
  const links=page.locator('.volume-card a.read[data-volume-action="open"]');
  await expect(links).toHaveCount(5);
  for(const link of await links.all())expect(await link.getAttribute('href')).toMatch(/\/reader\.html\?book=bk_/);
  const cover=page.locator('.volume-card img').first();await cover.scrollIntoViewIfNeeded();
  await expect.poll(()=>cover.evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  await capture(page,'recovered-series');
});

test('the reader reports missing recovered mappings without serving private bytes',async({page,context})=>{
  await context.addCookies([cookie('__Host-sg_human','human')]);
  await page.addInitScript(()=>localStorage.setItem('sg-adult-ack','1'));
  const ticket=page.waitForResponse(response=>new URL(response.url()).pathname==='/book-access');
  await page.goto(`/reader?book=${bookId}&series=${seriesId}`,{waitUntil:'domcontentloaded'});
  const response=await ticket;
  expect(response.status()).toBe(503);expect((await response.json()).code).toBe('book_mapping_missing');
  await expect(page.locator('#readerLoading')).toContainText('Shadow Garden could not authorize this EPUB.');
  // Reproduce background preparation arriving after the terminal error. Its
  // progress messages must not replace the recovery advice or restore loading.
  await page.evaluate(()=>window.__sgVisualPageCache.prepare('/media/shadow-garden/books/missing-visual-fixture.epub'));
  await expect(page.locator('.reader-failure p')).toHaveText('The protected book link could not be prepared. Try again; if the problem continues, return to the series and reopen the volume.');
  await expect(page.locator('#bookTitle')).toHaveText('Unable to open volume');
  await capture(page,'missing-book-reader');
  expect((await context.request.get('/media/shadow-garden/books/missing.epub')).status()).toBe(404);
});

test('the real admin form rejects stale edits after background reads and saves after reload',async({page,context})=>{
  await openKeeper(page,context);
  await page.locator('[data-manager-open]').click();
  await expect(page.locator('#manageBanner')).toBeEnabled();
  await expect(page.locator('#seriesSaveState')).toHaveText('No changes');
  await capture(page,'keeper-series-editor',{fullPage:false});
  const initial=await (await context.request.get('/admin-api/library',{headers:auth})).json();
  const original=initial.adult[0].title;
  const changed=await post(context.request,'/admin-api/library',{action:'update-series',id:seriesId,title:'External fixture edit'},initial.revision);
  expect(changed.status()).toBe(200);
  await page.evaluate(()=>window.ShadowGardenKeeper.client.request('/admin-api/maintenance'));
  await page.locator('#manageTitle').fill('Stale form edit');
  const denied=page.waitForResponse(response=>response.url().endsWith('/admin-api/library')&&response.request().method()==='POST');
  const alert=page.waitForEvent('dialog').then(async dialog=>{const message=dialog.message();await dialog.accept();return message});
  await page.locator('#saveSeries').click();
  expect(await alert).toMatch(/catalog changed/i);
  expect((await denied).status()).toBe(409);
  await expect(page.locator('#seriesEditor')).toBeVisible();
  await page.evaluate(async()=>{
    document.querySelector('#seriesEditor').close();
    await window.ShadowGardenKeeper.workflows.get('library').instance.refresh();
  });
  await page.locator('[data-manager-open]').click();
  await expect(page.locator('#manageTitle')).toHaveValue('External fixture edit');
  await expect(page.locator('#seriesSaveState')).toHaveText('No changes');
  await page.locator('#manageTitle').fill(original);
  const saved=page.waitForResponse(response=>response.url().endsWith('/admin-api/library')&&response.request().method()==='POST');
  await page.locator('#saveSeries').click();expect((await saved).status()).toBe(200);
  await expect(page.locator('#seriesEditor')).not.toBeVisible();
  expect((await (await context.request.get('/admin-api/library',{headers:auth})).json()).adult[0].title).toBe(original);
});

test('trash restore and permanent purge preserve retained media in real D1',async({page,context})=>{
  await openKeeper(page,context);
  const initial=await (await context.request.get('/admin-api/library',{headers:auth})).json();
  const removed=await post(context.request,'/admin-api/library',{action:'delete-volume',id:seriesId,volumeIndex:0},initial.revision);
  expect(removed.status()).toBe(200);
  const after=await removed.json();expect(after.counts.volumes).toBe(4);
  const maintenance=await (await context.request.get('/admin-api/maintenance',{headers:auth})).json();
  const restored=await post(context.request,'/admin-api/maintenance',{action:'restore-trash',id:maintenance.trash[0].id},maintenance.revision);
  expect(restored.status()).toBe(200);const current=await restored.json();expect(current.health.counts.volumes).toBe(5);
  const deleted=await post(context.request,'/admin-api/library',{action:'delete-volume',id:seriesId,volumeIndex:0},current.revision);expect(deleted.status()).toBe(200);
  await page.locator('#openMaintenance').click();
  const purge=page.locator('[data-purge-trash]').first();await expect(purge).toBeEnabled();
  page.once('dialog',dialog=>dialog.accept());
  const purged=page.waitForResponse(response=>response.url().endsWith('/admin-api/maintenance')&&response.request().method()==='POST');
  await purge.click();const response=await purged;expect([200,202]).toContain(response.status());
  let data=await response.json();expect(data.trash).toHaveLength(0);expect(data.purge.failed).toBe(0);
  // Cover references embedded in old Trash metadata can span several bounded batches.
  while(data.purge.pending){
    const continued=page.waitForResponse(response=>response.url().endsWith('/admin-api/maintenance')&&response.request().method()==='POST');
    await page.locator(`[data-continue-purge="${data.purge.id}"]`).click();data=await (await continued).json();
  }
  expect(data.purge.complete).toBe(true);expect(data.purge.staticAssets).toBeGreaterThan(0);
  await expect(page.locator('#trashCleanupJobs')).toContainText('Cleanup complete');
  await page.locator('#trashCleanupJobs').scrollIntoViewIfNeeded();await capture(page,'keeper-trash-cleanup',{fullPage:false});
  const saved=data.backups.find(entry=>entry.reason==='delete-volume'&&entry.counts?.volumes===5);
  expect((await post(context.request,'/admin-api/maintenance',{action:'restore-backup',id:saved.id},data.revision)).status()).toBe(200);
  await page.evaluate(()=>window.ShadowGardenKeeper.workflows.get('library').instance.refresh());
  await expect(page.locator('#manageVolumeCount')).toHaveText('5');
});

test('Catalog History marks damaged snapshots and permits deleting only the selected backup',async({page,context})=>{
  await openKeeper(page,context);
  await page.locator('#openMaintenance').click();
  const id=`damaged-${test.info().project.name}`;
  const restore=page.locator(`[data-restore-backup="${id}"]`),remove=page.locator(`[data-delete-backup="${id}"]`);
  await expect(restore).toBeDisabled();await expect(restore).toHaveText('Cannot restore');
  await expect(restore.locator('xpath=../..')).toContainText('Damaged snapshot');
  await expect(remove).toBeEnabled();await remove.scrollIntoViewIfNeeded();
  await capture(page,'keeper-damaged-snapshot',{fullPage:false});
  const before=await (await context.request.get('/admin-api/library',{headers:auth})).json();
  page.once('dialog',dialog=>dialog.accept());
  const deleted=page.waitForResponse(response=>response.url().endsWith('/admin-api/backup'));
  await remove.click();expect((await deleted).status()).toBe(200);
  await expect(restore).toHaveCount(0);
  expect(await (await context.request.get('/admin-api/library',{headers:auth})).json()).toEqual(before);
});

test('Keeper restores a damaged live catalog through snapshot recovery in the real Pages runtime',async({page,context})=>{
  await openKeeper(page,context);
  const initial=await (await context.request.get('/admin-api/library',{headers:auth})).json();
  const reason=`recovery-ui-${test.info().project.name}`;
  const created=await post(context.request,'/admin-api/maintenance',{action:'create-backup',reason},initial.revision);
  expect(created.status()).toBe(200);
  const id=(await created.json()).backups.find(entry=>entry.reason===reason).id;
  const database=await fixtureDatabase(),before=database.prepare('SELECT * FROM library_state WHERE id = 1').get();
  try {
    database.prepare("UPDATE library_state SET document = '{}', revision = revision+1 WHERE id = 1").run();
    await page.locator('#openMaintenance').click();
    await expect(page.locator('#gardenHealthIssues')).toContainText('Live catalog is unreadable');
    await expect(page.locator('#maintenanceVolumes')).toHaveText('—');
    await expect(page.locator('#createCatalogBackup')).toBeDisabled();
    await expect(page.locator('#deepHealthCheck')).toBeDisabled();
    await expect(page.locator('#taxonomyMaintenanceState')).toHaveText('UNAVAILABLE');
    await expect(page.locator('#coverMaintenanceState')).toHaveText('UNAVAILABLE');
    await expect(page.locator('#trashList')).toContainText('Trash cannot be read');
    await page.locator('#checkRecoveryReadiness').click();
    await expect(page.locator('#recoveryReadinessState')).toHaveText('RECOVER NOW');
    await page.locator('#gardenHealthCard').scrollIntoViewIfNeeded();
    await capture(page,'keeper-catalog-recovery',{fullPage:false});
    const restore=page.locator("#restoreRecoverySnapshot");await expect(restore).toBeEnabled();
    await restore.scrollIntoViewIfNeeded();await capture(page,"keeper-recovery-snapshot",{fullPage:false});
    page.once('dialog',dialog=>dialog.accept());
    const restored=page.waitForResponse(response=>response.url().endsWith('/admin-api/recovery')&&response.request().method()==='POST');
    await restore.click();expect((await restored).status()).toBe(200);
    await expect(page.locator('#maintenanceVolumes')).toHaveText('5');
    await expect(page.locator('#createCatalogBackup')).toBeEnabled();
    await expect(page.locator('#trashCount')).toHaveText('0');
    await expect(page.locator('#trashList .maintenance-good')).toBeVisible();
    expect((await (await context.request.get('/admin-api/library',{headers:auth})).json()).adult).toEqual(initial.adult);
    const safety=database.prepare("SELECT document FROM snapshots WHERE reason = 'before-recovery' ORDER BY created_at DESC LIMIT 1").get();expect(safety.document).toBe('{}');
  } finally {
    // A failed assertion must not leave the shared fixture broken for later cases.
    if(database.prepare('SELECT document FROM library_state WHERE id = 1').get().document==='{}')database.prepare('UPDATE library_state SET document = ?, revision = revision+1 WHERE id = 1').run(before.document);
    database.close();
  }
});
