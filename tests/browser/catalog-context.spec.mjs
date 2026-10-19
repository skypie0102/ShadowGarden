import {test,expect} from '@playwright/test';
import {installReaderFixture,readerBookId,readerTitle} from './reader-production-fixture.mjs';

test.setTimeout(90000);
for(const adult of [false,true])test(`a series moved to ${adult?'Adult':'Main'} opens with its original identity and correct reader context`,async({page})=>{
  const id=adult?'original-main-id':'adult-original-id';
  await installReaderFixture(page);
  await page.addInitScript(()=>localStorage.setItem('sg-adult-ack','1'));
  const series={id,title:'Moved technical series',nsfw:adult,volumes:[{bookId:readerBookId,title:readerTitle,number:1}]};
  for(const scope of [false,true])await page.route(`**/media/shadow-garden/data/${scope?'adult-catalog':'catalog'}.json`,route=>route.fulfill({json:{series:scope===adult?[series]:[]}}));
  await page.goto(adult?'/nsfw':'/');
  const card=page.locator('#catalogGrid .series-card');await expect(card).toHaveCount(1);
  await card.click();await expect(page.locator('#seriesRoot h1')).toHaveText('Moved technical series');
  expect(await page.locator('body').evaluate(b=>b.classList.contains('adult-library'))).toBe(adult);
  // Saved pre-move deep links have no explicit scope and must resolve too.
  await page.goto('/series?id='+id);
  await expect(page.locator('#seriesRoot h1')).toHaveText('Moved technical series');
  await page.locator('a[data-volume-action]').first().click();
  await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  await expect(page.locator('#bookTitle')).toHaveText(readerTitle);
  expect(await page.locator('body').evaluate(b=>b.classList.contains('adult-reader'))).toBe(adult);
  const back=page.locator('#completeReturnLink');
  expect(new URL(await back.getAttribute('href'),'https://garden.test').searchParams.get('scope')).toBe(adult?'adult':'main');
});

test('series loading status stays busy until its catalog is ready',async({page})=>{
  let release;const waiting=new Promise(resolve=>{release=resolve});
  await installReaderFixture(page);
  await page.route('**/media/shadow-garden/data/catalog.json',async route=>{await waiting;await route.fulfill({json:{series:[{id:'busy-fixture',title:'Busy fixture',volumes:[]}]}})});
  await page.goto('/series?id=busy-fixture',{waitUntil:'domcontentloaded'});
  try{await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy','true')}
  finally{release()}
  await expect(page.locator('#seriesRoot h1')).toHaveText('Busy fixture');
  await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy','false');
});

test('an old reader link to a moved Adult series asks for acknowledgement before fetching the EPUB',async({page})=>{
  await installReaderFixture(page);
  const series={id:'moved-main-id',title:'Moved Adult fixture',nsfw:true,volumes:[{bookId:readerBookId,title:readerTitle,number:1}]};
  await page.route('**/media/shadow-garden/data/catalog.json',route=>route.fulfill({json:{series:[]}}));
  await page.route('**/media/shadow-garden/data/adult-catalog.json',route=>route.fulfill({json:{series:[series]}}));
  let epubRequests=0;page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('reader-integration-fixture.epub'))epubRequests++});
  let releaseGate;const gateModule=new Promise(resolve=>{releaseGate=resolve});
  await page.route('**/assets/js/library.js*',async route=>{await gateModule;await route.continue()});
  await page.goto(`/reader.html?book=${readerBookId}&series=${series.id}`);
  await expect(page).toHaveURL(/\/nsfw(?:\.html)?\?return=/);
  await expect(page.locator('body')).toHaveClass(/adult-locked/);expect(epubRequests).toBe(0);
  try{await expect(page.locator('#adultEnter')).toBeDisabled()}finally{releaseGate()}
  await expect(page.locator('#adultEnter')).toBeEnabled();
  await page.locator('#adultEnter').click();
  await expect(page).toHaveURL(/\/reader(?:\.html)?\?/);
  await expect(page.locator('#readerLoading')).toBeHidden({timeout:60000});
  await expect(page.locator('body')).toHaveClass(/adult-reader/);
});

test('source configuration failure shows an outage and never requests bundled archive catalogs',async({page})=>{
  let archived=0;
  page.on('request',request=>{if(['/data/catalog.json','/data/adult-catalog.json'].includes(new URL(request.url()).pathname))archived++});
  await page.route('**/data/source.json',route=>route.fulfill({status:503,json:{error:'Disposable source outage'}}));
  await page.goto('/');
  await expect(page.locator('#resultCount')).toHaveText('Could not load catalog');
  await expect(page.locator('#catalogGrid .series-card')).toHaveCount(0);expect(archived).toBe(0);
});
