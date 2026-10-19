import {test,expect} from '@playwright/test';

async function install(page){
  await page.evaluate(async()=>{
    const [reading,progress,bookmarks,storageModule]=await Promise.all([
      import('/assets/js/domain/reading-state.js'),import('/assets/js/domain/progress.js'),
      import('/assets/js/domain/bookmarks.js'),import('/assets/js/reader/storage.js')
    ]);
    const book='bk_0123456789012345678901',source='/media/shadow-garden/books/storage-fixture.epub';
    const volume={bookId:book,file:source,number:1,title:'Persistence fixture'},series={id:'fixture',volumes:[volume]};
    const reader=storageModule.createReaderStorage(source,{publicIdentity:book});
    const f={reading,progress,bookmarks,book,source,reader,series,aliases:reading.volumeAliases(series.id,volume,0),events:[]};
    window.persistenceFixture=f;window.ShadowGardenData={loadCatalog:async()=>({series:[series]})};
    const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
    Storage.prototype.setItem=function(key,value){if(key===f.rejectSet){f.rejectSet=null;throw new DOMException('Injected quota failure','QuotaExceededError')}return set.call(this,key,value)};
    Storage.prototype.removeItem=function(key){if(key===f.rejectRemove){f.rejectRemove=null;throw new DOMException('Injected blocked removal','SecurityError')}return remove.call(this,key)};
    f.snapshot=()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]));
    const event=()=>f.events.push({finished:reading.isAnyFinished(f.aliases),progress:progress.progressForAliases(f.aliases)});
    window.addEventListener(reading.EVENT,event);window.addEventListener(progress.PROGRESS_EVENT,event);
    document.querySelector('#restart').onclick=async()=>{
      const {resetFinishedVolume}=await import('/assets/js/public/volume-actions.js');
      f.reset=await resetFinishedVolume(series.id,book);
      document.querySelector('#status').textContent=f.reset?'Restart saved':'Could not restart';
    };
  });
}

test.beforeEach(async({page})=>{
  page.__persistenceErrors=[];page.on('pageerror',error=>page.__persistenceErrors.push(error.message));
  await page.route('**/persistence-fixture.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="en"><meta charset="utf-8"><title>Persistence fixture</title>
    <button id="bookmark">Bookmark current passage</button><button id="restart">Read Again</button>
    <div id="bookmarksPanel"></div><p id="status" role="status"></p>
    <div id="viewerShell"><section id="volumeEndPage" class="volume-end-page"><div class="volume-complete-actions"></div></section></div></html>`}));
  await page.goto('/persistence-fixture.html');await install(page);
});
test.afterEach(async({page})=>expect(page.__persistenceErrors).toEqual([]));

test('failed bookmark save retains both aliases, the visible row and the reloaded bookmark',async({page})=>{
  const before=await page.evaluate(async()=>{
    const f=window.persistenceFixture;f.reader.saveBookmarks([{cfi:'old',at:1,label:'Original bookmark'}]);
    const {createBookmarksController}=await import('/assets/js/reader/bookmarks-controller.js');
    f.controller=createBookmarksController({storage:f.reader,elements:{bookmarksPanel:document.querySelector('#bookmarksPanel')},getCfi:()=> 'new',getPosition:()=>({cfi:'new'}),toast:message=>document.querySelector('#status').textContent=message});
    document.querySelector('#bookmark').onclick=()=>f.controller.toggle();f.rejectSet=f.bookmarks.bookmarkKey(f.book);return f.snapshot();
  });
  await page.getByRole('button',{name:'Bookmark current passage'}).click();
  await expect(page.getByRole('status')).toContainText('Could not save bookmarks');
  await expect(page.locator('#bookmarksPanel .bookmark-label')).toHaveText('Original bookmark');
  expect(await page.evaluate(()=>window.persistenceFixture.snapshot())).toEqual(before);
  await page.reload();await install(page);
  expect(await page.evaluate(()=>window.persistenceFixture.reader.loadBookmarks().map(b=>b.cfi))).toEqual(['old']);
});

test('Read Again failure survives reload and a successful retry clears both states together',async({page})=>{
  const before=await page.evaluate(()=>{
    const f=window.persistenceFixture;f.reading.setAliasesFinished(f.aliases,true);f.progress.writeProgressAliases(f.aliases,{page:9,updatedAt:10});f.reader.saveBookmarks([{cfi:'kept'}]);
    f.events=[];f.rejectRemove=f.progress.progressKey(f.source);return f.snapshot();
  });
  await page.getByRole('button',{name:'Read Again',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Could not restart');
  expect(await page.evaluate(()=>window.persistenceFixture.snapshot())).toEqual(before);
  expect(await page.evaluate(()=>window.persistenceFixture.events)).toEqual([]);
  await page.reload();await install(page);
  expect(await page.evaluate(()=>{const f=window.persistenceFixture;return {finished:f.reading.isAnyFinished(f.aliases),page:f.reader.loadProgress().page}})).toEqual({finished:true,page:9});
  await page.getByRole('button',{name:'Read Again',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Restart saved');
  expect(await page.evaluate(()=>{const f=window.persistenceFixture;return {finished:f.reading.isAnyFinished(f.aliases),progress:f.reader.loadProgress(),bookmarks:f.reader.loadBookmarks(),events:f.events}}))
    .toEqual({finished:false,progress:null,bookmarks:[{cfi:'kept'}],events:[{finished:false,progress:null},{finished:false,progress:null}]});
});

test('a failed completion switch restores the visible state and retains unrelated Finished books',async({page})=>{
  const before=await page.evaluate(async()=>{
    const f=window.persistenceFixture;f.reading.setFinished('unrelated',true);
    const {createCompletionController}=await import('/assets/js/reader/completion.js');
    f.completion=await createCompletionController({session:{seriesId:'fixture',publicBookId:f.book,requested:f.book,sourcePath:f.source,adult:false},elements:{volumeEndPage:document.querySelector('#volumeEndPage'),viewerShell:document.querySelector('#viewerShell')},toast:message=>document.querySelector('#status').textContent=message});
    f.events=[];f.rejectSet=f.reading.MARKER_PREFIX+f.source;return f.snapshot();
  });
  const toggle=page.getByRole('switch');await toggle.click();
  await expect(page.getByRole('status')).toHaveText('Could not save reading status');await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(()=>window.persistenceFixture.snapshot())).toEqual(before);
  expect(await page.evaluate(()=>window.persistenceFixture.events)).toEqual([]);
  await page.reload();await install(page);
  expect(await page.evaluate(()=>{const f=window.persistenceFixture;return {finished:f.reading.isAnyFinished(f.aliases),other:f.reading.isFinished('unrelated')}})).toEqual({finished:false,other:true});
});
