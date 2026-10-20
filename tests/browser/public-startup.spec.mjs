import {test,expect} from '@playwright/test';
import {installReaderFixture,readerSeriesId,readerTitle} from './reader-production-fixture.mjs';

for(const route of ['/', '/nsfw', '/series?id='+readerSeriesId])test(`public startup shares canonical module instances on ${route}`,async({page})=>{
  const paths=['/assets/js/domain/index.js','/assets/js/public/volume-actions.js'];
  if(!route.startsWith('/series'))paths.push('/assets/js/library-model.js');
  const requests=new Map(paths.map(path=>[path,new Set()]));
  page.on('request',request=>{const url=new URL(request.url());requests.get(url.pathname)?.add(url.pathname+url.search);});
  await page.addInitScript(()=>localStorage.setItem('sg-adult-ack','1'));
  await installReaderFixture(page);
  if(route==='/nsfw')await page.route('**/media/shadow-garden/data/adult-catalog.json',route=>route.fulfill({json:{series:[{id:'adult-startup-fixture',title:'Disposable adult-shelf fixture',volumes:[{bookId:'bk_'+('B'.repeat(22)),title:'Disposable volume',number:1}]}]}}));
  await page.goto(route);
  if(route.startsWith('/series')){await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy','false');await expect(page.locator('#seriesRoot')).toContainText(readerTitle);}
  else await expect(page.locator('#catalogGrid .series-card')).not.toHaveCount(0);
  for(const [path,urls] of requests)expect([...urls],path).toEqual([path]);
});
