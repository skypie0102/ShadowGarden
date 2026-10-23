import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createReaderZip } from './browser/reader-production-fixture.mjs';
import * as taxonomy from '../public/assets/js/domain/catalog-taxonomy.js';

const source = readFileSync(new URL('../public/assets/js/admin/epub-inspection.js', import.meta.url), 'utf8');
const xmlEscape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const element = (localName, attrs = {}, textContent = '', children = []) => ({ localName, textContent,
  getAttribute: name => attrs[name] ?? null, getAttributeNS: () => null,
  getElementsByTagName: () => children, querySelector: () => null, querySelectorAll: () => [] });
const documentFor = (nodes, refs = []) => ({ getElementsByTagName: () => nodes, querySelector: () => null,
  querySelectorAll: selector => refs.filter(ref => selector === `${ref.kind}[${ref.attr}]`)
    .map(ref => element(ref.kind, { [ref.attr]: ref.value })) });
const byName = (doc, name) => doc.getElementsByTagName('*').filter(node => node.localName === name);

async function fixture({ path = 'chapter.xhtml', href = path, opfPath = 'book.opf', coverPath = 'cover.jpg',
  coverHref = coverPath, refs = [], assets = [], omitSpine = false, omitContainer = false } = {}) {
  const zip = await createReaderZip(), documents = new Map();
  const container = `<container><rootfiles><rootfile full-path="${xmlEscape(opfPath)}"/></rootfiles></container>`;
  const opf = `<package><metadata><title>Generated inspection fixture</title><language>en</language></metadata><manifest><item id="chapter" href="${xmlEscape(href)}" media-type="application/xhtml+xml"/><item id="cover" href="${xmlEscape(coverHref)}" media-type="image/jpeg" properties="cover-image"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="chapter"/></spine></package>`;
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Fixture</title></head><body>${refs.map(ref => ref.kind === 'img' ? `<img src="${xmlEscape(ref.value)}" alt="Fixture"/>` : `<a href="${xmlEscape(ref.value)}">Fixture link</a>`).join('')}</body></html>`;
  const dir = opfPath.split('/').slice(0, -1).join('/'), at = value => dir ? `${dir}/${value}` : value;
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  if (!omitContainer) zip.file('META-INF/container.xml', container);
  zip.file(opfPath, opf); if (!omitSpine) zip.file(at(path), chapter);
  zip.file(at(coverPath), Uint8Array.of(255, 216, 255)); zip.file(at('nav.xhtml'), '<html/>');
  for (const asset of assets) zip.file(at(asset), 'Generated reference fixture');
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const spineRef = element('itemref', { idref: 'chapter' });
  documents.set(container, documentFor([element('rootfile', { 'full-path': opfPath })]));
  documents.set(opf, documentFor([element('title', {}, 'Generated inspection fixture'), element('language', {}, 'en'),
    element('item', { id: 'chapter', href, 'media-type': 'application/xhtml+xml' }),
    element('item', { id: 'cover', href: coverHref, 'media-type': 'image/jpeg', properties: 'cover-image' }),
    element('item', { id: 'nav', href: 'nav.xhtml', 'media-type': 'application/xhtml+xml', properties: 'nav' }),
    element('spine', {}, '', [spineRef]), spineRef]));
  documents.set(chapter, documentFor([], refs));
  const keeper = { util: {
    fmtSize: String, dirName: value => value.split('/').slice(0, -1).join('/'),
    firstText: (doc, name) => byName(doc, name)[0]?.textContent || '', texts: (doc, name) => byName(doc, name).map(node => node.textContent),
    cleanHtml: value => value, metaByName: () => '', metaByProperty: () => '', inferSeries: () => 'Generated fixture',
    detectVolume: () => 1, mimeExt: () => '.jpg', mimeForExt: () => 'image/jpeg'
  } };
  // Only resolve the origin-relative taxonomy import locally. Inspection runs
  // unchanged against the real pinned JSZip and deterministic XML boundary data.
  // Browser cases independently exercise the actual DOMParser and complete UI.
  const localSource = source.replace('import("/assets/js/domain/catalog-taxonomy.js?v=2.11.0")', 'Promise.resolve(taxonomy)');
  assert.notEqual(localSource, source);
  runInNewContext(localSource, { window: { ShadowGardenKeeper: keeper }, taxonomy,
    DOMParser: class { parseFromString(text) { assert.ok(documents.has(text), `Unexpected XML input: ${text}`); return documents.get(text); } },
    JSZip: { loadAsync: async input => (await createReaderZip()).loadAsync(input) },
    crypto, Blob, Uint8Array, ArrayBuffer, console });
  const file = { name: 'generated-inspection.epub', size: bytes.length,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer };
  return { inspect: keeper.epubInspection.inspect, file, bytes };
}

for (const [label, path, href, opfPath] of [
  ['file name', 'chapter#1.xhtml', 'chapter%231.xhtml', 'book.opf'],
  ['directory name', 'Text#part/chapter.xhtml', 'Text%23part/chapter.xhtml', 'OPS/book.opf'],
  ['Unicode name', '本文#一.xhtml', '%E6%9C%AC%E6%96%87%23%E4%B8%80.xhtml', 'OPS/book.opf']
]) test(`an encoded hash in a spine ${label} resolves to the existing archive entry`, async () => {
  const f = await fixture({ path, href, opfPath }), result = await f.inspect(f.file);
  assert.equal(result.validation.status, 'pass'); assert.equal(result.validation.stats.brokenRefs, 0);
  assert.equal(result.sha256, createHash('sha256').update(f.bytes).digest('hex'));
});

test('an encoded hash in a cover file resolves and preserves its exact bytes', async () => {
  const f = await fixture({ coverPath: 'front#cover.jpg', coverHref: 'front%23cover.jpg' }), result = await f.inspect(f.file);
  assert.equal(result.validation.status, 'pass'); assert.equal(result.validation.checks.cover, 'pass');
  assert.deepEqual(new Uint8Array(await result.coverBlob.arrayBuffer()), Uint8Array.of(255, 216, 255));
});

test('an encoded hash in an internal reference survives real query and fragment delimiters', async () => {
  const f = await fixture({ refs: [{ kind: 'img', attr: 'src', value: 'images/figure%231.jpg?size=1#detail' }], assets: ['images/figure#1.jpg'] });
  const result = await f.inspect(f.file); assert.equal(result.validation.stats.brokenRefs, 0); assert.equal(result.validation.status, 'pass');
});

test('ordinary relative paths, queries and same-document fragments retain their existing handling', async () => {
  const f = await fixture({ href: './Text/../chapter.xhtml', opfPath: 'OPS/book.opf', refs: [
    { kind: 'a', attr: 'href', value: 'chapter.xhtml?edition=1#part%231' }, { kind: 'a', attr: 'href', value: '#local' }
  ] });
  const result = await f.inspect(f.file); assert.equal(result.validation.status, 'pass'); assert.equal(result.validation.stats.brokenRefs, 0);
});

test('a genuinely missing spine document stays blocked', async () => {
  const f = await fixture({ omitSpine: true }), result = await f.inspect(f.file);
  assert.equal(result.validation.status, 'fail'); assert.ok(result.validation.fatal.some(issue => issue.message === 'Spine document is missing or invalid'));
});

test('decoded root traversal stays blocked', async () => {
  const f = await fixture({ href: '%2e%2e/outside.xhtml' }), result = await f.inspect(f.file);
  assert.equal(result.validation.status, 'fail'); assert.ok(result.validation.warnings.some(issue => issue.message === 'Manifest path escapes the EPUB root'));
});

test('an external spine URL stays blocked without fetching its target', async () => {
  const f = await fixture({ href: 'https://example.test/chapter.xhtml' }), result = await f.inspect(f.file);
  assert.equal(result.validation.status, 'fail'); assert.ok(result.validation.fatal.some(issue => issue.message === 'Spine document is missing or invalid'));
});

test('a percent-encoded percent sequence is decoded only once', async () => {
  const f = await fixture({ path: 'chapter%231.xhtml', href: 'chapter%25231.xhtml' }), result = await f.inspect(f.file);
  assert.equal(result.validation.status, 'pass'); assert.equal(result.validation.stats.brokenRefs, 0);
});

test('a missing container retains its explicit failure', async () => {
  const f = await fixture({ omitContainer: true }), result = await f.inspect(f.file);
  assert.equal(result.validation.status, 'fail'); assert.match(result.validation.fatal[0].message, /missing META-INF\/container.xml/);
});

test('the existing file-size limit rejects before reading archive bytes', async () => {
  const f = await fixture(); let reads = 0;
  const result = await f.inspect({ name: 'large.epub', size: 50 * 1024 * 1024 + 1, arrayBuffer() { reads++; throw Error('Should not read'); } });
  assert.equal(result.validation.status, 'fail'); assert.equal(reads, 0); assert.match(result.validation.fatal[0].message, /50 MB/);
});
