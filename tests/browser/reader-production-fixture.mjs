import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {bookId} from './fixture.mjs';

// Original technical publication. Only network responses are substituted: the
// production reader HTML, startup, vendor runtime and feature modules all run.
export const readerBookId=bookId;
export const readerSeriesId='reader-integration-fixture';
export const readerBookPath='/media/shadow-garden/books/reader-integration-fixture.epub';
export const readerTitle='Reader integration fixture';

export async function createReaderEpub(){
  const module={exports:{}};
  runInNewContext(await readFile(new URL('../../public/assets/vendor/jszip.min.js',import.meta.url),'utf8'),{
    module,exports:module.exports,require:createRequire(import.meta.url),Buffer,
    setTimeout,clearTimeout,setImmediate,clearImmediate,Promise,Uint8Array,ArrayBuffer
  });
  const zip=new module.exports(),chapters=Array.from({length:9},(_,index)=>index);
  zip.file('mimetype','application/epub+zip');
  zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('book.opf',`<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">reader-integration-fixture-v1</dc:identifier><dc:title>${readerTitle}</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-15T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="art" href="art.svg" properties="cover-image" media-type="image/svg+xml"/><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>${chapters.map(i=>`<item id="c${i}" href="chapter${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine><itemref idref="cover"/>${chapters.map(i=>`<itemref idref="c${i}"/>`).join('')}</spine></package>`);
  zip.file('nav.xhtml',`<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="cover.xhtml">Cover</a></li>${chapters.map(i=>`<li><a href="chapter${i}.xhtml">Chapter ${i}</a></li>`).join('')}</ol></nav></body></html>`);
  zip.file('art.svg','<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#4a426f"/><circle cx="300" cy="450" r="160" fill="#b8abd9"/></svg>');
  zip.file('cover.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cover</title></head><body><img src="art.svg" alt="Original fixture cover"/></body></html>');
  for(const i of chapters){
    const paragraphs=group=>Array.from({length:12},(_,p)=>`<p id="passage-${i}-${group}-${p}">Chapter ${i}, passage ${p}. Original technical fixture prose checks visible reading position, navigation and layout changes in the production reader.</p>`).join('');
    zip.file(`chapter${i}.xhtml`,`<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Chapter ${i}</title><style>body{margin:20px}figure{margin:24px 0}img{width:240px;height:360px;max-width:100%}</style></head><body><h1 id="target-${i}">Chapter ${i}</h1><p><a id="jump-${i}" href="chapter4.xhtml#target-4">Visit chapter four</a> <a id="note-link-${i}" href="#note-${i}" epub:type="noteref" role="doc-noteref">[1]</a></p>${paragraphs('before')}<figure><img id="art-${i}" src="art.svg" alt="Chapter ${i} illustration"/></figure>${paragraphs('after')}<aside id="note-${i}" epub:type="footnote" role="doc-footnote"><p>Original fixture footnote for chapter ${i}.</p></aside></body></html>`);
  }
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}

export async function installReaderFixture(page,{flow='scrolled-doc'}={}){
  const epub=await createReaderEpub();
  await page.addInitScript(({flow})=>{
    if(!localStorage.getItem('sg-reader-settings'))localStorage.setItem('sg-reader-settings',JSON.stringify({flow,theme:'garden',font:'default',fontSize:100,lineHeight:1.6,width:760,swipeTurns:true}));
  },{flow});
  await page.route('**/book-access',route=>route.fulfill({json:{ok:true,bookId:readerBookId,url:readerBookPath+'?sig=disposable-reader-fixture',expiresAt:Math.floor(Date.now()/1000)+3600,ttlSeconds:3600}}));
  await page.route('**/media/shadow-garden/books/reader-integration-fixture.epub*',route=>route.fulfill({contentType:'application/epub+zip',body:epub}));
  const catalog={series:[{id:readerSeriesId,title:readerTitle,author:'Technical fixture',status:'Complete',volumes:[{bookId:readerBookId,file:readerBookId,title:readerTitle,number:1}]}]};
  await page.route('**/media/shadow-garden/data/catalog.json',route=>route.fulfill({json:catalog}));
}

export const readerURL=`/reader.html?book=${readerBookId}&series=${readerSeriesId}`;
