/* Shadow Garden R4 — protected Reader startup. */
import { createAuthorizedBookSession, finalizeBookSession } from "./reader/book-session.js";
import { startReader } from "./reader/app.js";
import { showReaderFailure } from "./reader/error-presentation.js";
import { installEpubLifecyclePatch } from "./reader/epub-lifecycle.js";
import { installReaderInteractionController } from "./reader/interaction-controller.js";
import { urls } from "./domain/index.js";
import "./reader/image-focus-touch-compat.js";

const interactions=installReaderInteractionController();
const invalidPackagePreparation=/central directory|is this a zip file|missing container\.xml|missing package document|corrupt|unexpected end|end of data/i;

function visualPreparationFailure(){
  const message=String(window.__sgVisualPageCache?.summary?.()?.error||"");
  return invalidPackagePreparation.test(message)?new Error("Invalid EPUB archive"):null;
}

(async()=>{
  let session=null;
  try{
    if(!installEpubLifecyclePatch())throw new Error("Unsupported EPUB.js runtime for Reader lifecycle compatibility patch");
    session=await createAuthorizedBookSession();
    if(!session)return;
    const preparationFailure=visualPreparationFailure();
    if(preparationFailure)throw preparationFailure;
    interactions.stage("Opening the EPUB…","epub");
    await startReader(session);
    finalizeBookSession(session);
  }catch(error){
    console.error("Reader book authorization/startup failed",error);
    const loading=document.getElementById("readerLoading");
    const hasSeries=Boolean(session?.seriesId);
    const returnHref=hasSeries?urls.seriesUrl(session.seriesId):urls.libraryUrl(session?.adult===true);
    showReaderFailure({container:loading,error,phase:session?"open":"authorization",returnHref,returnLabel:hasSeries?"Return to series":"Return to library"});
  }
})();
