import {test,expect} from '@playwright/test';

test.setTimeout(90000);
const snapshots=(offset,count,prefix='snapshot')=>Array.from({length:count},(_,i)=>({
  id:`${prefix}-${offset+i}`,reason:`${prefix} ${offset+i}`,createdAt:'2026-10-19T00:00:00.000Z',
  counts:{mainSeries:1,adultSeries:0,volumes:1},restorable:true,integrity:{status:'valid'}
}));
const pageData=(backups,nextCursor,total=25)=>({ok:true,revision:0,catalog:{readable:true},backups,history:{total,pageSize:10,nextCursor}});
const report=(backups=snapshots(0,10),nextCursor='older')=>({
  ...pageData(backups,nextCursor),health:{status:'healthy',counts:{series:0,volumes:0},metrics:{},issues:[],objectKeys:[],optimizationCandidates:[]},
  taxonomy:{readable:true,totalSeries:0,affectedSeries:0,preview:[]},trash:[],purgeJobs:[]
});

async function installKeeper(page,{maintenance=()=>report(),history}={}){
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.__maintenanceErrors=errors;
  // Entirely disposable API responses: this fixture also works against deployed
  // frontend files without a real login, server mutation or third-party challenge.
  await page.route('**/admin-api/**',route=>route.fulfill({status:500,json:{error:'Unexpected disposable API request'}}));
  await page.route('**/admin-api/status',route=>route.fulfill({json:{ok:true,authorized:true,revision:0,catalogReadable:true}}));
  await page.route('**/admin-api/library',route=>route.fulfill({json:{ok:true,revision:0,main:[],adult:[],counts:{series:0,volumes:0}}}));
  await page.route('**/admin-api/maintenance',async route=>route.fulfill({json:await maintenance()}));
  if(history)await page.route('**/admin-api/backup*',history);
  await page.goto('/admin');
  await expect.poll(()=>page.evaluate(()=>Boolean(window.ShadowGardenKeeperReady)),{timeout:60000}).toBe(true);
  await page.locator('#adminToken').fill('disposable-maintenance-key');
  await page.evaluate(async()=>{
    const keeper=window.ShadowGardenKeeper;await keeper.client.verifySession();keeper.client.markUnlocked();keeper.state.unlocked=true;
    document.querySelector('#lockedView').classList.add('hidden');document.querySelector('#dashboardView').classList.remove('hidden');keeper.events.dispatchEvent(new Event('session:unlocked'));
  });
  await page.locator('#openMaintenance').click();await expect(page.locator('#backupList .maintenance-item')).toHaveCount(10);
}
test.afterEach(async({page})=>expect(page.__maintenanceErrors||[]).toEqual([]));

test('Catalog History loads older pages, keeps rows after a failed page and refreshes its boundary',async({page})=>{
  let olderRequests=0,maintenanceRequests=0;
  await installKeeper(page,{maintenance:()=>{maintenanceRequests++;return report()},history:async route=>{
    const cursor=new URL(route.request().url()).searchParams.get('cursor');
    if(cursor==='older'){
      olderRequests++;if(olderRequests===1)return route.fulfill({status:503,json:{error:'Disposable history outage'}});
      return route.fulfill({json:pageData(snapshots(10,10),'oldest')});
    }
    return route.fulfill({json:cursor==='oldest'?pageData(snapshots(20,5),null):pageData(snapshots(0,10),'older')});
  }});
  await expect(page.locator('#backupCount')).toHaveText('25');
  await page.locator('#loadMoreBackups').click();
  await expect(page.locator('#backupHistoryStatus')).toHaveText('Disposable history outage');
  await expect(page.locator('#backupList .maintenance-item')).toHaveCount(10);
  await expect(page.locator('#loadMoreBackups')).toHaveText('Retry older snapshots');
  await page.locator('#loadMoreBackups').click();await expect(page.locator('#backupList .maintenance-item')).toHaveCount(20);
  await page.locator('#loadMoreBackups').click();await expect(page.locator('#backupList .maintenance-item')).toHaveCount(25);
  await expect(page.locator('#loadMoreBackups')).toBeHidden();
  await page.locator('#refreshCatalogHistory').click();await expect(page.locator('#backupList .maintenance-item')).toHaveCount(10);
  await expect(page.locator('#loadMoreBackups')).toBeVisible();expect(maintenanceRequests).toBe(1);expect(olderRequests).toBe(2);
});

test('a refreshed maintenance report cancels an older history page and cannot append its stale rows',async({page})=>{
  let release,start,finish,maintenanceRequests=0;
  const blocked=new Promise(resolve=>{release=resolve}),started=new Promise(resolve=>{start=resolve}),finished=new Promise(resolve=>{finish=resolve});
  await installKeeper(page,{maintenance:()=>++maintenanceRequests===1?report():report(snapshots(0,10,'fresh'),'fresh-older'),history:async route=>{
    start();await blocked;
    try{await route.fulfill({json:pageData(snapshots(10,10,'obsolete'),null)})}
    catch(error){if(!route.request().failure())throw error}
    finally{finish()}
  }});
  await page.locator('#loadMoreBackups').click();await started;
  await expect(page.locator('#backupList')).toHaveAttribute('aria-busy','true');
  await page.locator('#refreshMaintenance').click();
  await expect(page.locator('#backupList')).toContainText('fresh 0');
  release();await finished;
  await expect(page.locator('#backupList .maintenance-item')).toHaveCount(10);
  await expect(page.locator('#backupList')).not.toContainText('obsolete');
  await expect(page.locator('#backupList')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#loadMoreBackups')).toBeEnabled();
});

test('a time-limited readiness result stays unverified and offers a retry without claiming missing media',async({page})=>{
  await installKeeper(page);
  await page.route('**/admin-api/recovery-readiness',route=>route.fulfill({json:{
    ok:true,revision:0,summary:{total:25,verified:1,damaged:0},live:{entries:[{scope:'main',readable:true},{scope:'adult',readable:true}]},
    readiness:{status:'not-ready',anchor:null,candidate:{...snapshots(0,1)[0],mediaStatus:'unverified'},staleSnapshots:0,uncertainSnapshots:25,
      budget:{limitMs:20000,exhausted:true},detail:'The recovery check reached its time limit before a complete snapshot could be proven. Try again or inspect Catalog History.'}
  }}));
  await page.locator('#checkRecoveryReadiness').click();await expect(page.locator('#recoveryReadinessState')).toHaveText('NOT READY');
  await expect(page.locator('#recoveryReadinessDetail')).toContainText('time limit');
  await expect(page.locator('#recoveryReadinessList')).toContainText('Media availability has not been verified.');
  await expect(page.locator('#recoveryReadinessList')).not.toContainText('Missing media must be supplied separately.');
  await expect(page.locator('#checkRecoveryReadiness')).toBeEnabled();await expect(page.locator('#checkRecoveryReadiness')).toHaveText('Check again');
});
