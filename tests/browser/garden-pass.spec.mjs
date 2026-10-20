import {test,expect} from '@playwright/test';

const widgetURL='https://keyboard-widget.invalid/controls';

async function openGate(page,{renderError=false}={}){
  // A disposable cross-origin iframe inside a closed shadow root matches the
  // focus boundary observed in the real widget, without completing a CAPTCHA.
  await page.route(widgetURL,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable keyboard widget</title><button>First widget control</button><button>Last widget control</button>'}));
  await page.addInitScript(({widgetURL,renderError})=>{
    window.turnstile={
      render(host,options){
        if(renderError)throw Error('Disposable widget render failure');
        const owner=document.createElement('div');host.appendChild(owner);
        const shadow=owner.attachShadow({mode:'closed'}),frame=document.createElement('iframe');
        frame.title='Disposable keyboard widget';frame.src=widgetURL;shadow.appendChild(frame);
        window.gateOptions=options;
        return 'disposable-widget';
      },
      remove(){window.gateRemovals=(window.gateRemovals||0)+1;},reset(){}
    };
  },{widgetURL,renderError});
  await page.goto('/series?id=fixture');
  const opener=page.locator('.brand-mark');
  await opener.focus();
  await page.evaluate(()=>{window.gateResult=window.ShadowGardenBookAccess.ensureHumanAccess({siteKey:'disposable-key'}).catch(error=>error.message);});
  const gate=page.getByRole('dialog',{name:'Pass the Garden Gate'});
  if(!renderError){
    await expect(gate).toBeVisible();
    await expect(gate.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
    await expect.poll(()=>Boolean(page.frame({url:widgetURL}))).toBe(true);
    await expect(page.frame({url:widgetURL}).getByRole('button',{name:'First widget control'})).toBeVisible();
  }
  return {gate,opener,frame:page.frame({url:widgetURL})};
}

test('Garden Pass blocks background focus and supports Tab through a closed-shadow cross-origin widget',async({page})=>{
  const {gate,opener,frame}=await openGate(page),cancel=gate.getByRole('button',{name:'Cancel',exact:true});
  // Before the fix this successfully focuses the background navigation button.
  await opener.focus();
  await expect(cancel).toBeFocused();
  await cancel.press('Shift+Tab');
  await expect(frame.getByRole('button',{name:'Last widget control'})).toBeFocused();
  await frame.getByRole('button',{name:'Last widget control'}).press('Shift+Tab');
  await expect(frame.getByRole('button',{name:'First widget control'})).toBeFocused();
  await frame.getByRole('button',{name:'First widget control'}).press('Tab');
  await expect(frame.getByRole('button',{name:'Last widget control'})).toBeFocused();
  await frame.getByRole('button',{name:'Last widget control'}).press('Tab');
  await expect(cancel).toBeFocused();
  // Browser chrome may receive Tab. Background page controls must stay inert.
  for(let i=0;i<8;i++){
    await page.keyboard.press('Tab');
    expect(await page.evaluate(()=>document.activeElement===document.body||Boolean(document.activeElement?.closest('.sg-human-gate')))).toBe(true);
  }
  await cancel.click();await expect(gate).toHaveCount(0);await expect(opener).toBeFocused();
  expect(await page.evaluate(()=>window.gateResult)).toBe('Human verification was cancelled.');
  expect(await page.evaluate(()=>window.gateRemovals)).toBe(1);
});

test('Escape in the cross-origin widget dismisses the gate and restores background interaction',async({page})=>{
  const {gate,opener,frame}=await openGate(page);
  await frame.getByRole('button',{name:'First widget control'}).focus();
  await frame.getByRole('button',{name:'First widget control'}).press('Escape');
  await expect(gate).toHaveCount(0);await expect(opener).toBeFocused();
  expect(await page.evaluate(()=>window.gateResult)).toBe('Human verification was cancelled.');
  await opener.click();await expect(opener).toHaveAttribute('aria-expanded','true');
});

test('successful verification closes the modal, removes the widget once and restores the opener',async({page})=>{
  await page.route('**/human-access',route=>route.fulfill({json:{ok:true}}));
  const {gate,opener}=await openGate(page);
  await page.evaluate(()=>window.gateOptions.callback('disposable-response'));
  await expect(gate).toHaveCount(0);await expect(opener).toBeFocused();
  expect(await page.evaluate(()=>window.gateResult)).toBe(true);
  expect(await page.evaluate(()=>window.gateRemovals)).toBe(1);
});

test('a widget render error releases modality and restores the opener',async({page})=>{
  const {gate,opener}=await openGate(page,{renderError:true});
  await expect(gate).toHaveCount(0);await expect(opener).toBeFocused();
  expect(await page.evaluate(()=>window.gateResult)).toBe('Disposable widget render failure');
  await opener.click();await expect(opener).toHaveAttribute('aria-expanded','true');
});
