import {createEpubCompatibilityExtension} from '../reader-epub-adapter.js';
import {createFootnotesExtension} from '../reader-footnotes.js';
import {createInternalLinksExtension} from '../reader-internal-links.js';
import {createVisualPageCacheExtension} from '../reader-visual-cache.js';
import {createPaginatedVisualFitExtension} from '../reader-paginated-visual-fit.js';
import {createContinuousCoreExtension} from '../reader-continuous-core.js';
import {installEpubLifecyclePatch} from './epub-lifecycle.js';
import {readerInstanceScope} from './lifecycle.js';
import {disposeRenditionNavigation} from './navigation-state.js';
import {ownLocationSources} from './section-source.js';

// This is the only production owner of EPUB creation and extension order.
// Keep vendor methods/version-specific fixes within the integration extensions;
// application controllers consume createBook() rather than replacing window.ePub.
const engines=new WeakMap();
let applicationEngine=null;

function requireSupportedRuntime(epub){
  if(typeof epub!=='function'||String(epub.VERSION)!=='0.3'
    ||typeof epub.Book?.prototype?.renderTo!=='function'
    ||typeof epub.Rendition?.prototype?.requireManager!=='function'){
    throw new Error('Unsupported EPUB.js runtime for Reader integration');
  }
}

export function initializeReaderEngine(epub=globalThis.ePub){
  requireSupportedRuntime(epub);
  const existing=engines.get(epub);
  if(existing){applicationEngine=existing;return existing;}

  if(!installEpubLifecyclePatch(epub)){
    throw new Error('EPUB.js lifecycle integration could not initialize');
  }
  // Order preserves the recovered behavior while making each installation
  // explicit. Opening a book calls the original vendor factory exactly once.
  const extensions=[
    createEpubCompatibilityExtension(),
    createFootnotesExtension(),
    createInternalLinksExtension(),
    createVisualPageCacheExtension(),
    createPaginatedVisualFitExtension(),
    createContinuousCoreExtension()
  ];
  const engine=Object.freeze({
    runtimeVersion:String(epub.VERSION),
    extensions:Object.freeze(extensions.map(extension=>extension.name)),
    visualPages:extensions.find(extension=>extension.visualPages)?.visualPages,
    settleNavigation:rendition=>extensions.find(extension=>extension.settleNavigation)?.settleNavigation(rendition),
    createBook(...args){
      let book=epub(...args);
      if(!book||typeof book.renderTo!=='function')throw new Error('EPUB.js did not create a readable book');
      const scope=readerInstanceScope(book),renderTo=book.renderTo;
      ownLocationSources(book);
      book.renderTo=function(...renderArgs){
        if(scope.disposed)throw new Error('EPUB book is disposed');
        const rendition=renderTo.apply(this,renderArgs),lifetime=readerInstanceScope(rendition);
        const release=scope.add(()=>rendition.destroy());
        lifetime.add(release.forget);
        lifetime.add(()=>disposeRenditionNavigation(rendition));
        return rendition;
      };
      try{for(const extension of extensions)book=extension.attachBook(book)}
      catch(error){book.destroy();throw error}
      return book;
    }
  });
  engines.set(epub,engine);
  applicationEngine=engine;
  return engine;
}

export function getReaderEngine(){
  if(!applicationEngine)throw new Error('Reader engine has not initialized');
  return applicationEngine;
}
