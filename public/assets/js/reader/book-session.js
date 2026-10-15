import {createReaderScope} from "./lifecycle.js";
/* Shadow Garden R4 — protected Reader book-session boundary. */
import { catalog, identity, preferences, readingState, storage, urls } from "../domain/index.js";

const EPUB_PATH=/^\/media\/shadow-garden\/books\/.+\.epub$/i;


function sourcePathFromTicket(ticket){
  const direct=String(ticket?.sourcePath||"").trim();
  if(EPUB_PATH.test(direct))return direct;
  try{
    const path=new URL(ticket?.url||"",location.href).pathname;
    return EPUB_PATH.test(path)?path:"";
  }catch{return""}
}

function requestedContext(){
  const params=new URLSearchParams(location.search);
  return{
    requested:String(params.get("book")||"").trim(),
    seriesId:String(params.get("series")||"").trim(),
    restartRequested:params.get("restart")==="1"
  };
}

export function syncStoredReaderShell(seriesId=""){
  const settings=storage.readJson("sg-reader-settings",{})||{};
  const theme=["garden","night","black","paper"].includes(settings.theme)?settings.theme:"garden";
  const body=document.body;
  if(!body)return;
  body.classList.remove("reader-theme-garden","reader-theme-night","reader-theme-black","reader-theme-paper","reader-flow-paginated","reader-flow-scrolled");
  body.classList.add(`reader-theme-${theme}`,settings.flow==="scrolled-doc"?"reader-flow-scrolled":"reader-flow-paginated");
  body.classList.toggle("adult-reader",catalog.isAdultSeriesId(seriesId));
}

async function resetReadAgain({requested,seriesId,publicBookId,sourcePath,ticket,signal}){
  const identities=identity.cleanIdentities([requested,publicBookId,ticket?.requestedIdentity,ticket?.identity,sourcePath]);
  let aliases=identities;
  try{
    const shelf=await window.ShadowGardenData?.loadCatalog?.(catalog.isAdultSeriesId(seriesId));
    const entry=catalog.findVolumeEntry(shelf,seriesId,publicBookId||requested,identities);
    if(entry)aliases=readingState.volumeAliases(entry.series.id,entry.volume,entry.index,identities);
  }catch(error){
    console.warn("Read Again catalog lookup skipped",error);
  }
  signal?.throwIfAborted();
  const finishedCleared=readingState.setAliasesFinished(aliases,false);
  const progressCleared=readingState.clearProgressAliases(aliases);
  const stillFinished=readingState.isAnyFinished?.(aliases)===true;
  const stillProgress=aliases.some(alias=>Boolean(readingState.progressForIdentity?.(alias)));
  if(!finishedCleared||!progressCleared||stillFinished||stillProgress){
    throw new Error("Shadow Garden could not reset this volume. Your reading place was left unchanged.");
  }
}

function replacePublicUrl(session){
  try{
    const url=new URL(location.href);
    if(identity.isBookId(session.publicBookId))url.searchParams.set("book",session.publicBookId);
    if(session.restartRequested)url.searchParams.delete("restart");
    history.replaceState(history.state,"",`${url.pathname}${url.search}${url.hash}`);
  }catch{}
}

function installResumeRenewal(session,access,scope){
  if(!session||typeof access?.resolve!=="function")return;
  const reference=session.publicBookId||session.requested||session.sourcePath;
  if(!reference)return;
  let inFlight=null;

  const renew=()=>{
    if(scope.disposed||document.hidden||inFlight)return inFlight;
    // `resolve` reuses a comfortably-live ticket and refreshes one within 45 seconds of expiry.
    // That makes resume checks cheap during ordinary tab switches while recovering immediately
    // after a browser has suspended the normal renewal timer during sleep/backgrounding.
    const task=scope.wait(Promise.resolve().then(()=>access.resolve(reference))).then(ticket=>{
      if(ticket&&!scope.disposed)session.ticket=ticket;
      return ticket;
    }).catch(error=>{
      if(!scope.disposed)console.warn("Reader access resume renewal delayed",error);
      return null;
    }).finally(()=>{
      if(inFlight===task)inFlight=null;
    });
    inFlight=task;
    return task;
  };

  // The application resume controller awaits the same in-flight renewal before it touches
  // EPUB.js again. This keeps access recovery owned by the session boundary while preventing
  // a long-suspended rendition from racing an expired media ticket on pageshow/foregrounding.
  session.renewAccess=renew;
  scope.listen(document,"visibilitychange",()=>{if(!document.hidden)void renew()});
  scope.listen(window,"pageshow",()=>{void renew()});
}

export async function createAuthorizedBookSession({access=window.ShadowGardenBookAccess,signal}={}){
  const scope=createReaderScope();
  if(signal?.aborted)scope.dispose();else scope.listen(signal,"abort",()=>scope.dispose(),{once:true});
  try{
  scope.signal.throwIfAborted();
  const context=requestedContext();
  syncStoredReaderShell(context.seriesId);
  if(!context.requested)throw new Error("No EPUB file was selected.");

  if(identity.isBookId(context.requested)&&catalog.isAdultSeriesId(context.seriesId)&&!preferences.adultAcknowledged()){
    const ret=`${location.pathname}${location.search}${location.hash}`;
    location.replace(urls.adultGateReturnUrl(ret));
    scope.dispose();return null;
  }

  const ticket=access?.initial?await scope.wait(access.initial):null;
  const ticketBookId=String(ticket?.bookId||ticket?.identity||"").trim();
  const publicBookId=identity.isBookId(ticketBookId)?ticketBookId:(identity.isBookId(context.requested)?context.requested:"");
  if(ticket?.identity&&access?.migrateLegacyState)await scope.wait(access.migrateLegacyState([ticket.identity]));
  const sourcePath=sourcePathFromTicket(ticket)||(EPUB_PATH.test(context.requested)?context.requested:"");
  if(!sourcePath)throw new Error("Shadow Garden could not resolve the protected EPUB source.");

  const session={
    dispose:()=>scope.dispose(),signal:scope.signal,
    ...context,
    ticket,
    publicBookId,
    sourcePath,
    storageIdentity:publicBookId||sourcePath,
    adult:catalog.isAdultSeriesId(context.seriesId)
  };

  installResumeRenewal(session,access,scope);
  if(context.restartRequested)await scope.wait(resetReadAgain(session));
  try{await scope.wait(window.__sgVisualPageCache?.prepare?.(publicBookId||context.requested||sourcePath))}
  catch(error){if(scope.disposed)throw error;console.warn("Visual-page preparation handoff skipped",error)}

  return session;
  }catch(error){scope.dispose();throw error}
}

export function finalizeBookSession(session){
  if(session)replacePublicUrl(session);
}
