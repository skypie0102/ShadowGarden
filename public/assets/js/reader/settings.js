/* Shadow Garden R4 — canonical Reader settings/UI owner. */
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||min));

export const READER_FONT_CHOICES=Object.freeze([
  Object.freeze({value:"default",label:"Default"}),
  Object.freeze({value:"pt-sans",label:"Sans"}),
  Object.freeze({value:"literata",label:"Serif"}),
  Object.freeze({value:"inter",label:"Sans-Serif"})
]);
const READER_FONT_VALUES=new Set(READER_FONT_CHOICES.map(option=>option.value));

function normalizeReaderFont(value){
  if(READER_FONT_VALUES.has(value))return value;
  if(value==="system")return "inter";
  if(value==="classic")return "literata";
  return "default";
}

export const READER_DEFAULTS={theme:"garden",font:"default",fontSize:100,lineHeight:1.6,width:760,flow:"paginated",swipeTurns:true};

export function sanitizeReaderSettings(value){
  const input=value||{};
  return{
    theme:["garden","night","black","paper"].includes(input.theme)?input.theme:READER_DEFAULTS.theme,
    font:normalizeReaderFont(input.font),
    fontSize:clamp(input.fontSize??READER_DEFAULTS.fontSize,75,160),
    lineHeight:clamp(input.lineHeight??READER_DEFAULTS.lineHeight,1.25,2.1),
    width:clamp(input.width??READER_DEFAULTS.width,560,1050),
    flow:["paginated","scrolled-doc"].includes(input.flow)?input.flow:READER_DEFAULTS.flow,
    swipeTurns:input.swipeTurns!==false
  };
}

export function createSettingsController({storage,elements,isAdult=false,onApply,onFlowChange,onReset}={}){
  let settings=sanitizeReaderSettings(storage.loadSettings(READER_DEFAULTS));

  function syncBody(){
    document.body.classList.remove("reader-theme-garden","reader-theme-night","reader-theme-black","reader-theme-paper");
    document.body.classList.add(`reader-theme-${settings.theme}`);
    document.body.classList.toggle("adult-reader",Boolean(isAdult));
    const scrolled=settings.flow==="scrolled-doc";
    document.body.classList.toggle("reader-flow-scrolled",scrolled);document.body.classList.toggle("reader-flow-paginated",!scrolled);
  }
  function syncFontOptions(){
    const select=elements.fontSelect;if(!select)return;
    const current=Array.from(select.options||[],option=>`${option.value}:${option.textContent}`).join("|");
    const desired=READER_FONT_CHOICES.map(option=>`${option.value}:${option.label}`).join("|");
    if(current!==desired){
      const doc=select.ownerDocument||document;
      select.replaceChildren(...READER_FONT_CHOICES.map(choice=>{
        const option=doc.createElement("option");option.value=choice.value;option.textContent=choice.label;return option;
      }));
    }
    select.value=settings.font;
  }
  function syncControls(){
    if(elements.themeSelect)elements.themeSelect.value=settings.theme;
    syncFontOptions();
    if(elements.fontSizeRange)elements.fontSizeRange.value=settings.fontSize;
    if(elements.fontSizeValue)elements.fontSizeValue.textContent=`${settings.fontSize}%`;
    if(elements.lineHeightRange)elements.lineHeightRange.value=settings.lineHeight;
    if(elements.lineHeightValue)elements.lineHeightValue.textContent=String(settings.lineHeight);
    if(elements.widthRange)elements.widthRange.value=settings.width;
    if(elements.widthValue)elements.widthValue.textContent=`${settings.width}px`;
    if(elements.flowSelect)elements.flowSelect.value=settings.flow;
    if(elements.swipeTurnsToggle)elements.swipeTurnsToggle.checked=settings.swipeTurns!==false;
    if(elements.textWidthSetting)elements.textWidthSetting.hidden=settings.flow!=="scrolled-doc";
  }
  function persist(){settings=sanitizeReaderSettings(settings);storage.saveSettings(settings);syncBody();syncControls();return settings}
  function setFlow(flow,{save=true}={}){settings.flow=flow==="scrolled-doc"?"scrolled-doc":"paginated";if(save)persist();else{syncBody();syncControls()}return settings.flow}
  function replace(next,{save=true}={}){settings=sanitizeReaderSettings(next);if(save)persist();else{syncBody();syncControls()}return settings}

  elements.themeSelect?.addEventListener("change",event=>{settings.theme=event.target.value;persist();onApply?.({relayout:false,rebuildPageMap:false})});
  elements.fontSelect?.addEventListener("change",event=>{settings.font=event.target.value;persist();onApply?.({relayout:true,rebuildPageMap:true})});
  elements.fontSizeRange?.addEventListener("input",event=>{settings.fontSize=Number(event.target.value);persist();onApply?.({relayout:true,rebuildPageMap:true})});
  elements.lineHeightRange?.addEventListener("input",event=>{settings.lineHeight=Number(event.target.value);persist();onApply?.({relayout:true,rebuildPageMap:true})});
  elements.widthRange?.addEventListener("input",event=>{settings.width=Number(event.target.value);persist();onApply?.({relayout:settings.flow==="scrolled-doc",rebuildPageMap:true})});
  elements.swipeTurnsToggle?.addEventListener("change",event=>{settings.swipeTurns=event.target.checked;persist()});
  elements.flowSelect?.addEventListener("change",event=>onFlowChange?.(event.target.value));
  elements.resetReader?.addEventListener("click",()=>{const previous=settings.flow;settings={...READER_DEFAULTS};persist();onReset?.(previous)});

  persist();
  return{get:()=>settings,persist,setFlow,replace,sync:()=>{syncBody();syncControls()}};
}
