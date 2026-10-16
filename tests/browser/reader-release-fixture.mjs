import {createReaderEpub,createReaderZip} from './reader-production-fixture.mjs';

export async function createReleaseEpub({damagedArtwork=false}={}){
  const zip=await createReaderZip();
  await zip.loadAsync(await createReaderEpub({chapterCount:6,paragraphCount:9}));
  const first='Text/Chapter 0.xhtml',last='Text/Appendix.xhtml';
  let opf=await zip.file('book.opf').async('string');
  opf=opf.replace('version="3.0"','version="2.0"')
    .replace('<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>',
      '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>')
    .replace('properties="cover-image"','').replace('<spine>','<spine toc="ncx">')
    .replace('href="chapter0.xhtml"','href="Text/Chapter%200.xhtml"')
    .replace('href="chapter4.xhtml"',`href="${last}"`);
  zip.file('book.opf',opf);zip.remove('nav.xhtml');
  const hrefs=['cover.xhtml','Text/Chapter%200.xhtml','chapter1.xhtml','chapter2.xhtml','chapter3.xhtml',last,'chapter5.xhtml'];
  zip.file('toc.ncx',`<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="reader-integration-fixture-v1"/></head><docTitle><text>Release fixture</text></docTitle><navMap>${hrefs.map((href,index)=>`<navPoint id="n${index}" playOrder="${index+1}"><navLabel><text>${index?`Chapter ${index-1}`:'Cover'}</text></navLabel><content src="${href}"/></navPoint>`).join('')}</navMap></ncx>`);
  for(let i=0;i<6;i++){
    let text=await zip.file(`chapter${i}.xhtml`).async('string');
    text=text.replace('chapter4.xhtml#target-4',`${i===0?'../':''}${last}#target-4`);
    if(i===0){
      text=text.replace('src="art.svg"','src="../art.svg"').replace('</h1>',
        '</h1><p id="ruby-example"><ruby>漢字<rt>かんじ</rt></ruby> — café, Ελληνικά, العربية.</p><table id="table-example"><tr><th>Item</th><th>Value</th></tr><tr><td>Release marker</td><td>42</td></tr></table>');
    }
    if(i===4)text=text.replace('src="art.svg"','src="../art.svg"');
    const path=i===0?first:i===4?last:`chapter${i}.xhtml`;
    if(path!==`chapter${i}.xhtml`)zip.remove(`chapter${i}.xhtml`);
    zip.file(path,text);
  }
  if(damagedArtwork)zip.file('art.svg','Corrupt disposable illustration bytes');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}

