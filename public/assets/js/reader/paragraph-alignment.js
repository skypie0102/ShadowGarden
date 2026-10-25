// Reader-owned paragraph declarations; Default restores the publication's values.
const overrides=new Set(["left","justify","right"]);
const originals=new WeakMap();
const properties=["text-align","text-align-last"];

export function normalizeParagraphAlignment(value){
  return overrides.has(value)?value:"default";
}

export function applyParagraphAlignment(contents,value){
  const alignment=normalizeParagraphAlignment(value);
  for(const paragraph of contents?.document?.querySelectorAll("p")||[]){
    const original=originals.get(paragraph);
    if(alignment==="default"){
      if(!original)continue;
      for(const [property,saved,priority] of original.values){
        if(saved)paragraph.style.setProperty(property,saved,priority);
        else paragraph.style.removeProperty(property);
      }
      if(!original.hadStyle&&!paragraph.style.length)paragraph.removeAttribute("style");
      originals.delete(paragraph);
      continue;
    }
    // Artwork-only paragraphs retain their publication/visual-page positioning.
    if(!paragraph.textContent?.trim())continue;
    if(!original)originals.set(paragraph,{
      hadStyle:paragraph.hasAttribute("style"),
      values:properties.map(property=>[property,paragraph.style.getPropertyValue(property),paragraph.style.getPropertyPriority(property)])
    });
    paragraph.style.setProperty("text-align",alignment,"important");
    paragraph.style.setProperty("text-align-last","auto","important");
  }
}
