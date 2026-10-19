import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as catalog from '../public/assets/js/domain/catalog.js';
import * as urls from '../public/assets/js/domain/urls.js';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

for(const adult of [false,true])test(`moving a series to ${adult?'Adult':'Main'} preserves identity and changes route context`,async()=>{
  const id=adult?'original-main-id':'adult-original-id';
  const moved={id,title:'Moved series',nsfw:adult,volumes:[]};
  const load=async scope=>({series:scope===adult?[moved]:[]});
  assert.equal(catalog.isAdultSeries(moved),adult);
  const found=await catalog.findSeriesContext(load,id,{adult:!adult});
  assert.equal(found.series.id,id);assert.equal(found.adult,adult);
  const series=urls.seriesUrl(id,{adult}),reader=urls.readerUrl('bk_A2yCOKedG1g4xXTJJhbEzA',id,{adult});
  assert.equal(new URL(series,'https://garden.test').searchParams.get('scope'),adult?'adult':'main');
  assert.equal(catalog.adultRoute(id,new URL(reader,'https://garden.test').search),adult);
});

const dataSource=readFileSync(new URL('../public/assets/js/data-source.js',import.meta.url),'utf8');
function dataFixture(fetch){const window={};runInNewContext(dataSource,{window,fetch,console});return window.ShadowGardenData}

test('a failed source configuration request cannot fall back to an archived catalog and can retry',async()=>{
  let calls=0;
  const data=dataFixture(async()=>++calls===1?new Response(null,{status:503}):Response.json({mode:'b2-private',catalogUrl:'/media/shadow-garden/data/catalog.json'}));
  await assert.rejects(data.catalogUrl(false),/source|configuration/i);
  assert.equal(await data.catalogUrl(false),'/media/shadow-garden/data/catalog.json');assert.equal(calls,2);
});

test('only an explicit local source can select bundled catalogs',async()=>{
  const invalid=dataFixture(async()=>Response.json({}));
  await assert.rejects(invalid.catalogUrl(),/source|configuration/i);
  const local=dataFixture(async()=>Response.json({mode:'local'}));
  assert.equal(await local.catalogUrl(true),'/data/adult-catalog.json');
});
