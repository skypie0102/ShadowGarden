// Original, disposable publication for the protected-download experiment.
// JSZip is the repository's existing pinned test dependency; no content or
// credentials from a real book are included.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';

export async function createFixtureEpub() {
  const module={exports:{}};
  runInNewContext(readFileSync(new URL('../../../public/assets/vendor/jszip.min.js',import.meta.url),'utf8'),{
    module,exports:module.exports,require:createRequire(import.meta.url),Buffer,
    setTimeout,clearTimeout,setImmediate,clearImmediate,Promise,Uint8Array,ArrayBuffer
  });
  const zip=new module.exports();
  zip.file('mimetype','application/epub+zip',{compression:'STORE'});
  zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">android-download-fixture</dc:identifier><dc:title>Private download fixture</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-30T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>');
  zip.file('nav.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">One</a></li></ol></nav></body></html>');
  zip.file('chapter.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Offline fixture</title></head><body><h1>Offline fixture</h1><p id="offline-marker">A generated book remains available offline.</p></body></html>');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
