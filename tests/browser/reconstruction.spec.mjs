import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {baseURL,adminToken,sessionSecret,sessionId,bookId,seriesId} from './fixture.mjs';

function cookie(name,kind,claims={}) {
  const data=Buffer.from(JSON.stringify({...claims,kind,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  return {name,value:`${data}.${createHmac('sha256',sessionSecret).update(data).digest('base64url')}`,
    domain:'127.0.0.1',path:'/',secure:true,httpOnly:true,sameSite:'Strict'};
}
const auth={authorization:`Bearer ${adminToken}`};
const post=(request,path,data,revision)=>request.post(path,{headers:{...auth,'if-match':String(revision)},data});

test.beforeEach(async({page})=>{
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
  await page.locator('#adultEnter').click();
  await expect(page.locator('#seriesRoot .volume-card')).toHaveCount(5);
  const links=page.locator('.volume-card a[data-volume-action="open"]');
  await expect(links).toHaveCount(5);
  for(const link of await links.all())expect(await link.getAttribute('href')).toMatch(/\/reader\.html\?book=bk_/);
  const cover=page.locator('.volume-card img').first();await cover.scrollIntoViewIfNeeded();
  await expect.poll(()=>cover.evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
});

test('the reader reports missing recovered mappings without serving private bytes',async({page,context})=>{
  await context.addCookies([cookie('__Host-sg_human','human')]);
  await page.addInitScript(()=>localStorage.setItem('sg-adult-ack','1'));
  const ticket=page.waitForResponse(response=>new URL(response.url()).pathname==='/book-access');
  await page.goto(`/reader?book=${bookId}&series=${seriesId}`,{waitUntil:'domcontentloaded'});
  const response=await ticket;
  expect(response.status()).toBe(503);expect((await response.json()).code).toBe('book_mapping_missing');
  await expect(page.locator('#readerLoading')).toContainText('Shadow Garden could not authorize this EPUB.');
  expect((await context.request.get('/media/shadow-garden/books/missing.epub')).status()).toBe(404);
});

test('the real admin form rejects stale edits after background reads and saves after reload',async({page,context})=>{
  await openKeeper(page,context);
  await page.locator('[data-manager-open]').click();
  await expect(page.locator('#manageBanner')).toBeEnabled();
  const initial=await (await context.request.get('/admin-api/library',{headers:auth})).json();
  const original=initial.adult[0].title;
  const changed=await post(context.request,'/admin-api/library',{action:'update-series',id:seriesId,title:'External fixture edit'},initial.revision);
  expect(changed.status()).toBe(200);
  await page.evaluate(()=>window.ShadowGardenKeeper.client.request('/admin-api/maintenance'));
  await page.locator('#manageTitle').fill('Stale form edit');
  const denied=page.waitForResponse(response=>response.url().endsWith('/admin-api/library')&&response.request().method()==='POST');
  const alert=page.waitForEvent('dialog');
  await page.locator('#saveSeries').click();
  const dialog=await alert;expect(dialog.message()).toMatch(/catalog changed/i);await dialog.accept();
  expect((await denied).status()).toBe(409);
  await expect(page.locator('#seriesEditor')).toBeVisible();
  await page.evaluate(async()=>{
    document.querySelector('#seriesEditor').close();
    await window.ShadowGardenKeeper.workflows.get('library').instance.refresh();
  });
  await page.locator('[data-manager-open]').click();
  await expect(page.locator('#manageTitle')).toHaveValue('External fixture edit');
  await page.locator('#manageTitle').fill(original);
  const saved=page.waitForResponse(response=>response.url().endsWith('/admin-api/library')&&response.request().method()==='POST');
  await page.locator('#saveSeries').click();expect((await saved).status()).toBe(200);
  await expect(page.locator('#seriesEditor')).not.toBeVisible();
  expect((await (await context.request.get('/admin-api/library',{headers:auth})).json()).adult[0].title).toBe(original);
});

test('trash restore preserves the five-volume catalog in real D1 and permanent purge stays unavailable',async({page,context})=>{
  await openKeeper(page,context);
  const initial=await (await context.request.get('/admin-api/library',{headers:auth})).json();
  const removed=await post(context.request,'/admin-api/library',{action:'delete-volume',id:seriesId,volumeIndex:0},initial.revision);
  expect(removed.status()).toBe(200);
  const after=await removed.json();expect(after.counts.volumes).toBe(4);
  const maintenance=await (await context.request.get('/admin-api/maintenance',{headers:auth})).json();
  const restored=await post(context.request,'/admin-api/maintenance',{action:'restore-trash',id:maintenance.trash[0].id},maintenance.revision);
  expect(restored.status()).toBe(200);const current=await restored.json();expect(current.health.counts.volumes).toBe(5);
  expect((await post(context.request,'/admin-api/maintenance',{action:'purge-trash',ids:[]},current.revision)).status()).toBe(501);
  await page.evaluate(()=>window.ShadowGardenKeeper.workflows.get('library').instance.refresh());
  await expect(page.locator('#manageVolumeCount')).toHaveText('5');
});
