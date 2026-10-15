import {readFile} from 'node:fs/promises';

// Real recovered Reader markup, styles, EPUB.js, lifecycle/core and focus modules.
// The EPUB is generated in memory from original technical fixture content. No
// production books, storage credentials, catalog mutations or access bypass.
export async function fixtureHTML(){
  const html=(await readFile(new URL('../../public/reader.html',import.meta.url),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
  return html.replace('</body>',`<script src="/assets/vendor/jszip.min.js"></script>
<script src="/assets/vendor/epub.min.js"></script>
<script type="module">
import {createContinuousCoreExtension} from '/assets/js/reader-continuous-core.js';
import {installEpubLifecyclePatch} from '/assets/js/reader/epub-lifecycle.js';
import {createRendition} from '/assets/js/reader/rendition.js';
import {createImageFocusController} from '/assets/js/reader/image-focus.js';
import {installReaderInteractionController} from '/assets/js/reader/interaction-controller.js';
try{
  document.body.className='reader-theme-garden reader-flow-scrolled';
  installReaderInteractionController();installEpubLifecyclePatch();
  const zip=new JSZip(),chapters=Array.from({length:15},(_,index)=>index);
  zip.file('mimetype','application/epub+zip');
  zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('book.opf','<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">focus-fixture</dc:identifier><dc:title>Image focus regression fixture</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-15T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="art" href="art.svg" media-type="image/svg+xml"/>'+chapters.map(i=>'<item id="c'+i+'" href="chapter'+i+'.xhtml" media-type="application/xhtml+xml"/>').join('')+'</manifest><spine>'+chapters.map(i=>'<itemref idref="c'+i+'"/>').join('')+'</spine></package>');
  zip.file('nav.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol>'+chapters.map(i=>'<li><a href="chapter'+i+'.xhtml">Chapter '+i+'</a></li>').join('')+'</ol></nav></body></html>');
  zip.file('art.svg','<svg xmlns="http://www.w3.org/2000/svg" width="280" height="180"><rect width="280" height="180" fill="#4a426f"/><circle cx="140" cy="90" r="55" fill="#b8abd9"/></svg>');
  for(const i of chapters){
    const prose=Array.from({length:24},(_,p)=>'<p>Chapter '+i+', passage '+p+'. This is original technical fixture text for checking the same visible reading position before and after inspecting an illustration.</p>').join('');
    zip.file('chapter'+i+'.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter '+i+'</title><style>body{margin:20px;font:18px/1.6 sans-serif}figure{margin:24px 0}img{width:280px;height:180px;max-width:100%}</style></head><body><h1>Chapter '+i+'</h1>'+prose+'<figure><img id="art-'+i+'" src="art.svg" alt="Fixture illustration"/></figure>'+prose+'</body></html>');
  }
  let rendition;
  const flow=()=>document.body.classList.contains('reader-flow-scrolled')?'scrolled-doc':'paginated';
  const focus=createImageFocusController({overlay:document.querySelector('#imageFocus'),viewport:document.querySelector('#imageFocusViewport'),image:document.querySelector('#imageFocusImage'),closeButton:document.querySelector('#imageFocusClose'),getRendition:()=>rendition,getFlow:flow});
  const book=createContinuousCoreExtension().attachBook(ePub(await zip.generateAsync({type:'arraybuffer'})));await book.ready;
  await createRendition({book,flow:'scrolled-doc',target:'chapter7.xhtml',onCreate:value=>{rendition=value},wire:value=>focus.attachRendition(value)});
  window.focusFixture={rendition,focus};
  document.querySelector('#readerLoading').classList.add('hidden');
}catch(error){window.focusFixtureError=error.message||String(error)}
</script></body>`);
}

