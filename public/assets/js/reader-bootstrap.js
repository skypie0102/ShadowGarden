import {recordReaderDiagnostic} from './reader/diagnostics.js';
/* Shadow Garden — protected Reader runtime and startup ownership. */
import {createAuthorizedBookSession,finalizeBookSession} from "./reader/book-session.js";
import {startReader} from "./reader/app.js";
import {showReaderFailure} from "./reader/error-presentation.js";
import {initializeReaderEngine} from "./reader/engine.js";
import {installReaderInteractionController} from "./reader/interaction-controller.js";
import {installImageFocusTouchCompatibility} from "./reader/image-focus-touch-compat.js";
import {createReaderScope} from "./reader/lifecycle.js";
import {urls} from "./domain/index.js";

const invalidPackagePreparation=/central directory|is this a zip file|missing container\.xml|missing package document|corrupt|unexpected end|end of data/i;

function visualPreparationFailure(){
  const message=String(window.__sgVisualPageCache?.summary?.()?.error||"");
  return invalidPackagePreparation.test(message)?new Error("Invalid EPUB archive"):null;
}

export function createReaderRuntime(){
  let lifetime=null,current=null,failure=null;
  function dispose(){
    lifetime?.dispose();lifetime=null;current=null;failure?.dispose();failure=null;
  }
  async function open(){
    dispose();
    const scope=createReaderScope();lifetime=scope;
    const loading=document.getElementById("readerLoading");
    if(loading){
      loading.classList.remove("hidden");
      loading.setAttribute("role","status");loading.setAttribute("aria-live","polite");
      if(loading.querySelector(".reader-failure")){loading.replaceChildren();const text=document.createElement("p");loading.appendChild(text)}
    }
    const interactions=installReaderInteractionController(),touch=installImageFocusTouchCompatibility();
    scope.add(()=>interactions.dispose());scope.add(()=>touch.dispose());
    // BFCache suspension keeps its live reader. Only a real departure tears it down.
    scope.listen(window,"pagehide",event=>{if(!event.persisted&&lifetime===scope)dispose()});
    let session=null;
    try{
      const engine=initializeReaderEngine();
      scope.add(()=>engine.visualPages?.release?.());
      session=await createAuthorizedBookSession({signal:scope.signal});
      if(!session)return null;
      scope.add(()=>session.dispose());
      const preparationFailure=visualPreparationFailure();
      if(preparationFailure)throw preparationFailure;
      interactions.stage("Opening the EPUB…","epub");
      const reader=await startReader(session,{signal:scope.signal});
      scope.add(()=>reader.dispose());
      if(scope.disposed)return null;
      current=reader;finalizeBookSession(session);
      return reader;
    }catch(error){
      const cancelled=scope.disposed;
      scope.dispose();
      if(cancelled)return null;
      recordReaderDiagnostic('reader.startupFailed');
      const loading=document.getElementById("readerLoading"),hasSeries=Boolean(session?.seriesId);
      const returnHref=hasSeries?urls.seriesUrl(session.seriesId):urls.libraryUrl(session?.adult===true);
      failure=showReaderFailure({container:loading,error,phase:session?"open":"authorization",returnHref,returnLabel:hasSeries?"Return to series":"Return to library",retry:()=>void open()});
      return null;
    }
  }
  return{open,dispose,get current(){return current}};
}

export const readerRuntime=createReaderRuntime();
void readerRuntime.open();
