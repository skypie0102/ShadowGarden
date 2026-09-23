window.ShadowGardenData=(()=>{
  let sourcePromise;
  let domainPromise;
  const catalogPromises=new Map();
  const catalogSnapshots=new Map();
  const catalogShareNext=new Set();
  const statuses=['Complete','Ongoing','Hiatus','Dropped'];
  const statusAliases=new Map([
    ['complete','Complete'],['completed','Complete'],['finished','Complete'],
    ['ongoing','Ongoing'],['publishing','Ongoing'],['active','Ongoing'],['current','Ongoing'],
    ['hiatus','Hiatus'],['on hiatus','Hiatus'],['paused','Hiatus'],
    ['dropped','Dropped'],['cancelled','Dropped'],['canceled','Dropped'],['discontinued','Dropped']
  ]);
  const loadDomain=()=>domainPromise||(domainPromise=import('/assets/js/domain/index.js?v=2.11.0'));
  /* Synchronous compatibility export for older Keeper code. Actual catalog normalization
     and legacy state migration are owned by domain/catalog.js. */
  function normalizeStatus(value){return statusAliases.get(String(value||'').trim().toLowerCase())||'Ongoing'}
  async function getSource(){
    if(!sourcePromise){
      sourcePromise=fetch('/data/source.json',{cache:'default'})
        .then(r=>r.ok?r.json():{mode:'local'})
        .catch(()=>({mode:'local'}));
    }
    return sourcePromise;
  }
  async function catalogUrl(adult=false){
    const source=await getSource();
    if(source.mode==='b2'||source.mode==='b2-private'){
      const url=adult?source.adultCatalogUrl:source.catalogUrl;
      if(url)return url;
    }
    return adult?'/data/adult-catalog.json':'/data/catalog.json';
  }
  async function normalizeCatalog(catalog){
    const domain=await loadDomain();
    return domain.catalog.normalizeCatalog(catalog);
  }
  async function loadCatalog(adult=false,{reuse=false,shareNext=false}={}){
    const key=adult?'adult':'main';
    if(!reuse&&catalogShareNext.has(key)&&catalogSnapshots.has(key)){
      catalogShareNext.delete(key);
      return catalogSnapshots.get(key);
    }
    if(reuse&&catalogSnapshots.has(key))return catalogSnapshots.get(key);
    const pending=catalogPromises.get(key);
    if(pending)return pending;
    const request=(async()=>{
      const url=await catalogUrl(adult);
      const r=await fetch(url,{cache:'default',mode:'cors'});
      if(!r.ok)throw new Error(`Catalog request failed: ${r.status}`);
      return normalizeCatalog(await r.json());
    })();
    catalogPromises.set(key,request);
    try{
      const catalog=await request;
      catalogSnapshots.set(key,catalog);
      if(reuse&&shareNext)catalogShareNext.add(key);
      return catalog;
    }finally{if(catalogPromises.get(key)===request)catalogPromises.delete(key)}
  }
  return{getSource,catalogUrl,loadCatalog,normalizeCatalog,normalizeStatus,statuses};
})();