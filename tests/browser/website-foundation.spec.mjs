import {test,expect} from '@playwright/test';
import {installReaderFixture,readerURL,readerTitle} from './reader-production-fixture.mjs';

test.setTimeout(90000);

const mobileProject=()=>test.info().project.name.startsWith('mobile');

test('reader reset restores device defaults and retains an explicit flow until reset',async({page})=>{
  const expected=mobileProject()?'scrolled-doc':'paginated';
  const chosen=mobileProject()?'paginated':'scrolled-doc';
  await installReaderFixture(page,{flow:chosen});
  await page.goto(readerURL);
  await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  await expect(page.locator('#bookTitle')).toHaveText(readerTitle);
  await page.locator('#settingsToggle').focus();await page.locator('#settingsToggle').click();
  await expect(page.locator('#flowSelect')).toHaveValue(chosen);
  await page.locator('#fontSizeRange').fill('125');
  await page.locator('#resetReader').click();
  await expect(page.locator('#flowSelect')).toHaveValue(expected);
  await expect(page.locator('#fontSizeRange')).toHaveValue('100');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sg-reader-settings')).flow)).toBe(expected);
  await page.reload();
  await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  await expect(page.locator('body')).toHaveClass(expected==='paginated'?/reader-flow-paginated/:/reader-flow-scrolled/);
});

for(const adult of [false,true])test(`Garden Pass uses the ${adult?'adult rose':'main midnight'} palette and cancels cleanly`,async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('sg-adult-ack','1');
    window.turnstile={render:()=> 'fixture-widget',remove:()=>{window.gateRemoved=true},reset:()=>{}};
  });
  await page.goto(adult?'/series?id=adult-fixture':'/series?id=fixture');
  await page.evaluate(()=>{
    window.gateResult=window.ShadowGardenBookAccess.ensureHumanAccess({siteKey:'fixture-key'}).catch(error=>error.message);
  });
  const gate=page.getByRole('dialog',{name:'Pass the Garden Gate'});
  await expect(gate).toBeVisible();
  const colors=await gate.locator('.sg-human-card').evaluate(card=>({background:getComputedStyle(card).backgroundImage,color:getComputedStyle(card.querySelector('.sg-human-kicker')).color}));
  expect(colors.background).toContain(adult?'31, 16, 23':'24, 20, 32');
  expect(colors.color).toBe(adult?'rgb(201, 130, 153)':'rgb(154, 134, 211)');
  await gate.getByRole('button',{name:'Cancel'}).press('Escape');
  await expect(gate).toHaveCount(0);
  expect(await page.evaluate(()=>window.gateResult)).toBe('Human verification was cancelled.');
  expect(await page.evaluate(()=>window.gateRemoved)).toBe(true);
});

test('Garden Pass coalesces requests, retries a rejected check and resumes ticket authorization',async({page})=>{
  let verified=false,checks=0,tickets=0;
  await page.addInitScript(()=>{
    window.turnstile={render:(host,options)=>{window.gateOptions=options;return 'fixture-widget'},remove:()=>{},reset:()=>{window.gateResets=(window.gateResets||0)+1}};
  });
  await page.route('**/book-access',route=>{
    tickets++;
    return route.fulfill({status:verified?200:428,json:verified?{ok:true,url:'/media/shadow-garden/books/fixture.epub?sig=fixture',expiresAt:Math.floor(Date.now()/1000)+3600}:{code:'human_verification_required',siteKey:'fixture-key'}});
  });
  await page.route('**/human-access',async route=>{
    expect(route.request().postDataJSON()).toEqual({token:'fixture-response'});
    checks++;verified=checks>1;
    await route.fulfill({status:verified?200:403,json:verified?{ok:true}:{code:'human_verification_failed',error:'Please try again.'}});
  });
  await page.goto('/series?id=fixture');
  await page.evaluate(()=>{window.ticketResult=window.ShadowGardenBookAccess.resolve('bk_A2yCOKedG1g4xXTJJhbEzA')});
  const gate=page.getByRole('dialog',{name:'Pass the Garden Gate'});
  await expect(gate).toBeVisible();
  await page.evaluate(()=>{
    const access=window.ShadowGardenBookAccess;
    window.sameGate=access.ensureHumanAccess({siteKey:'fixture-key'});
    window.gateOptions.callback('fixture-response');
  });
  await expect(gate.locator('[data-sg-human-status]')).toHaveText('Please try again.');
  expect(await page.evaluate(()=>window.gateResets)).toBe(1);
  await expect(page.locator('.sg-human-gate')).toHaveCount(1);
  await page.evaluate(()=>window.gateOptions.callback('fixture-response'));
  await expect(gate).toHaveCount(0);
  expect(await page.evaluate(()=>window.sameGate)).toBe(true);
  expect((await page.evaluate(()=>window.ticketResult)).url).toContain('?sig=fixture');
  expect(checks).toBe(2);expect(tickets).toBe(2);
});
