// Browser-only instrumentation; no production hooks or fixture endpoints.
export async function installReaderProfiling(page){
  await page.addInitScript(()=>{
    const stats={conversions:0,visualReadyMs:0};
    window.readerProfile=stats;
    document.addEventListener('sg-visual-pages-ready',()=>stats.visualReadyMs=performance.now());
    const convert=HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob=function(...args){stats.conversions++;return convert.apply(this,args)};
    let factory;
    Object.defineProperty(window,'ePub',{configurable:true,get:()=>factory,set(epub){
      factory=epub;
      const unpack=epub.Book.prototype.unpack;
      epub.Book.prototype.unpack=function(...args){
        const result=unpack.apply(this,args),book=this;
        const role=window.frameElement?.dataset.sgPageMapSandbox?'map':'reader';
        const owner={role,loads:0,peakSources:0,peakViews:0};
        (parent.readerProfile?.books||(parent.readerProfile.books=[])).push(owner);
        const sample=()=>{
          const count=book.spine?.spineItems?.filter(section=>section.document).length||0;
          owner.peakSources=Math.max(owner.peakSources,count);
          owner.peakViews=Math.max(owner.peakViews,book.rendition?.manager?.views?.all?.()?.length||0);
        };
        for(const section of book.spine.spineItems){
          const load=section.load,unload=section.unload;
          section.load=function(...values){owner.loads++;return Promise.resolve(load.apply(this,values)).then(value=>{sample();return value})};
          section.unload=function(...values){const value=unload.apply(this,values);sample();return value};
        }
        return result;
      };
    }});
  });
}
