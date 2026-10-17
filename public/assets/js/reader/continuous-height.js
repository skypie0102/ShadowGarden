// A Continuous iframe must fit its content, including body padding and overflow.
// documentElement.scrollHeight has the iframe viewport as a lower bound, so it
// cannot measure a genuine shrink. Range.bottom alone omits trailing body space.
const measurements=new WeakMap();

function intrinsicHeight(contents,textHeight){
  const doc=contents.document,body=doc?.body,rect=body?.getBoundingClientRect?.();
  if(!rect)return Math.max(doc?.documentElement?.scrollHeight||0,body?.scrollHeight||0);
  const scroll=Number(doc.defaultView?.scrollY)||0;
  const text=Number(textHeight.call(contents));
  return Math.max(0,Math.round(Math.max(
    Number.isFinite(text)?text+scroll:0,
    rect.bottom+scroll,
    rect.top+scroll+(Number(body.scrollHeight)||0)
  )));
}

export function ownContinuousContentHeight(contents){
  if(!contents||measurements.has(contents)||typeof contents.textHeight!=='function')return;
  const textHeight=contents.textHeight;
  measurements.set(contents,textHeight);
  contents.textHeight=function(){return intrinsicHeight(this,textHeight)};
}

export function continuousContentHeight(contents){
  const textHeight=measurements.get(contents);
  if(textHeight)return intrinsicHeight(contents,textHeight);
  // Other vendor layouts retain the compatibility adapter's existing contract.
  const doc=contents?.document;
  return Math.max(doc?.documentElement?.scrollHeight||0,doc?.body?.scrollHeight||0);
}
