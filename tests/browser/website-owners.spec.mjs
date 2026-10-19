import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {sessionSecret,sessionId,adminToken} from './fixture.mjs';
import {createReaderEpub,installReaderFixture} from './reader-production-fixture.mjs';

test.setTimeout(90000);

test('Library owns URL state, direct empty copy and unchanged midnight/rose themes',async({page})=>{
  await page.addInitScript(()=>{window.originalConfirm=window.confirm;window.originalAlert=window.alert;localStorage.setItem('sg-adult-ack','1')});
  await installReaderFixture(page);
  await page.goto('/?q=fixture&view=compact');
  await expect(page.locator('#headerVolumes')).toHaveText('1');
  await expect(page.locator('#catalogGrid .series-card')).toHaveCount(1);
  await expect(page.locator('#catalogGrid')).toHaveClass(/compact/);
  // Mobile filters start collapsed; use the same public expansion control.
  const toggle=page.locator('#filterToggle');
  if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  await page.locator('#authorSelect').selectOption('Technical fixture');
  await expect(page).toHaveURL(/author=Technical/);
  await page.goBack();
  await expect(page.locator('#authorSelect')).toHaveValue('');
  await expect(page.locator('#searchInput')).toHaveValue('fixture');
  await page.locator('#searchInput').fill('no-matching-technical-title');
  await expect(page.locator('#emptyMessage')).toHaveText('No shelf answers the current path.');
  expect(await page.evaluate(()=>window.confirm===window.originalConfirm&&window.alert===window.originalAlert)).toBe(true);
  expect(await page.locator('body').evaluate(body=>getComputedStyle(body).getPropertyValue('--panel').trim())).toBe('#13101a');
  await page.goto('/nsfw');
  await expect(page.locator('body')).toHaveClass(/adult-library/);
  expect(await page.locator('body').evaluate(body=>getComputedStyle(body).getPropertyValue('--panel').trim())).toBe('#171014');
});

async function openKeeper(page,context){
  const data=Buffer.from(JSON.stringify({kind:'admin',sid:sessionId,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  await context.addCookies([{name:'__Host-sg_admin',value:`${data}.${createHmac('sha256',sessionSecret).update(data).digest('base64url')}`,domain:'127.0.0.1',path:'/',secure:true,httpOnly:true,sameSite:'Strict'}]);
  await page.addInitScript(()=>{
    window.originalConfirm=window.confirm;window.originalAlert=window.alert;
    document.addEventListener('DOMContentLoaded',()=>{window.initialUploadButton=document.querySelector('#uploadButton');window.initialFileInput=document.querySelector('#epubFile')},{once:true});
  });
  await page.goto('/admin');
  await expect.poll(()=>page.evaluate(()=>Boolean(window.ShadowGardenKeeperReady))).toBe(true);
  await page.locator('#adminToken').fill(adminToken);
  await page.evaluate(async()=>{
    const keeper=window.ShadowGardenKeeper;await keeper.client.verifySession();keeper.client.markUnlocked();keeper.state.unlocked=true;
    document.querySelector('#lockedView').classList.add('hidden');document.querySelector('#dashboardView').classList.remove('hidden');keeper.events.dispatchEvent(new Event('session:unlocked'));
  });
  await expect(page.locator('[data-manager-open]')).toHaveCount(1);
  await page.locator('#openNewBooks').click();
  expect(await page.evaluate(()=>document.querySelector('#uploadButton')===window.initialUploadButton&&document.querySelector('#epubFile')===window.initialFileInput)).toBe(true);
  expect(await page.evaluate(()=>window.confirm===window.originalConfirm&&window.alert===window.originalAlert)).toBe(true);
}

test('Keeper preflight, queue removal and retry use explicit state events',async({page,context})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openKeeper(page,context);
  const epub=await createReaderEpub({chapterCount:2,paragraphCount:2});
  await page.locator('#epubFile').setInputFiles([{name:'first.epub',mimeType:'application/epub+zip',buffer:epub},{name:'invalid.epub',mimeType:'application/epub+zip',buffer:Buffer.from('invalid technical publication')}]);
  await expect(page.locator('#batchList .batch-item')).toHaveCount(2);
  await expect(page.locator('#batchList')).toContainText('Reader integration fixture');
  await expect.poll(()=>page.evaluate(()=>window.ShadowGardenKeeper.state.batch.items.some(item=>item.status==='checking'))).toBe(false);
  await expect(page.locator('#batchList .batch-item').nth(1)).toContainText('FAIL');
  await page.locator('#batchList .batch-item').nth(1).getByRole('button',{name:'Remove EPUB from upload queue'}).click();
  await expect(page.locator('#batchList .batch-item')).toHaveCount(1);
  await expect(page.locator('#batchSummary')).toContainText('1 selected');
  let uploads=0,catalogWrites=0;
  await page.route('**/admin-api/upload**',route=>{
    uploads++;
    return route.fulfill({status:uploads===1?503:200,json:uploads===1?{error:'Disposable upload failure'}:{ok:true}});
  });
  await page.route('**/admin-api/catalog',route=>{catalogWrites++;return route.fulfill({json:{ok:true,seriesId:'reader-integration-fixture',revision:100}})});
  await expect(page.locator('#uploadButton')).toBeEnabled();await page.locator('#uploadButton').click();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('Some books need attention.');
  await page.getByRole('button',{name:'Review upload queue'}).click();
  await expect(page.locator('#uploadButton')).toBeEnabled();await page.locator('#uploadButton').click();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('The new books have taken root.');
  await expect(page.locator('#uploadWorkflowStage')).toContainText('1 book was uploaded successfully');
  expect(catalogWrites).toBe(1);expect(uploads).toBeGreaterThan(1);
  expect(await page.evaluate(()=>window.ShadowGardenKeeper.state.batch.items.length)).toBe(0);
  await page.getByRole('button',{name:'Upload another batch'}).click();
  await expect(page.locator('#filePickerTitle')).toHaveText('Choose EPUBs from this device');
  expect(errors).toEqual([]);
});

test('the shared verification loader retries a failed script without leaving a dead widget',async({page})=>{
  let loads=0;
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',route=>{
    loads++;
    return loads===1?route.abort('failed'):route.fulfill({contentType:'application/javascript',body:'window.turnstile={render:()=>"retry-widget",remove:()=>{},reset:()=>{}};'});
  });
  await page.goto('/series?id=fixture');
  expect(await page.evaluate(()=>window.ShadowGardenBookAccess.ensureHumanAccess({siteKey:'fixture-key'}).catch(error=>error.message))).toContain('could not be loaded');
  await page.evaluate(()=>{window.retriedGate=window.ShadowGardenBookAccess.ensureHumanAccess({siteKey:'fixture-key'}).catch(error=>error.message)});
  const gate=page.getByRole('dialog',{name:'Pass the Garden Gate'});await expect(gate).toBeVisible();
  await gate.getByRole('button',{name:'Cancel'}).click();
  expect(await page.evaluate(()=>window.retriedGate)).toBe('Human verification was cancelled.');
  expect(loads).toBe(2);
});

test('Keeper can unlock again after locking a completed verification widget',async({page,context})=>{
  await page.addInitScript(()=>{
    let active=null;
    window.turnstile={
      render(host,options){
        const button=document.createElement('button');button.textContent='Complete disposable verification';
        button.onclick=()=>{button.disabled=true;options.callback('disposable-check')};host.appendChild(button);active=button;return 'disposable-widget';
      },
      reset(){if(active)active.disabled=false},
      remove(){active?.remove();active=null}
    };
  });
  // Keep the disposable pre-authenticated session; no real challenge is bypassed.
  await page.route('**/admin-access',route=>route.fulfill({json:route.request().method()==='GET'?{siteKey:'disposable-key',action:'admin_access'}:{ok:true}}));
  await openKeeper(page,context);
  await page.locator('#closeAddBooks').click();
  for(let attempt=0;attempt<2;attempt++){
    await page.locator('#lockButton').click();
    await expect(page.locator('#lockedView')).toBeVisible();
    await page.locator('#adminToken').fill(adminToken);await expect(page.locator('#unlockButton')).toBeEnabled();await page.locator('#unlockButton').click();
    const complete=page.getByRole('button',{name:'Complete disposable verification'});
    await expect(complete).toBeEnabled();await complete.click();
    await expect(page.locator('#dashboardView')).toBeVisible();
  }
});
