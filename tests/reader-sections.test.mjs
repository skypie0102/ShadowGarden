import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanSectionHref,sectionHrefMatches,linearSpineItems} from '../public/assets/js/reader/sections.js';

test('section identity ignores literal query/fragment suffixes and decodes nested publication paths',()=>{
  assert.equal(cleanSectionHref('./OEBPS/Text/caf%C3%A9%20one.xhtml?edition=2#heading'),'OEBPS/Text/café one.xhtml');
  assert.equal(cleanSectionHref('/Text/chapter.xhtml#heading?note=1'),'Text/chapter.xhtml');
});

test('section identity decodes once and preserves encoded path punctuation',()=>{
  assert.equal(cleanSectionHref('Text/chapter%23one%3Ftwo.xhtml#heading'),'Text/chapter#one?two.xhtml');
  assert.equal(cleanSectionHref('Text/chapter%2520one.xhtml'),'Text/chapter%20one.xhtml');
  assert.equal(cleanSectionHref('Text/100%broken.xhtml'),'Text/100%broken.xhtml');
});

test('section identity does not resolve relative URLs or normalize publication path case',()=>{
  assert.equal(cleanSectionHref('../Text/Chapter.xhtml'),'../Text/Chapter.xhtml');
  assert.equal(cleanSectionHref('././Text/chapter.xhtml'),'./Text/chapter.xhtml');
  assert.equal(sectionHrefMatches('Text/Chapter.xhtml','Text/chapter.xhtml'),false);
});

test('section matching accepts directory-qualified suffixes only at a path boundary',()=>{
  assert.equal(sectionHrefMatches('./OEBPS/Text/caf%C3%A9.xhtml#one','/Text/café.xhtml?edition=2'),true);
  assert.equal(sectionHrefMatches('Text/café.xhtml','OEBPS/Text/caf%C3%A9.xhtml'),true);
  assert.equal(sectionHrefMatches('chapter.xhtml','chapter.xhtml'),true);
  assert.equal(sectionHrefMatches('notchapter.xhtml','chapter.xhtml'),false);
  assert.equal(sectionHrefMatches('chapter.xhtml.bak','chapter.xhtml'),false);
});

test('empty and fragment-only references cannot identify a section',()=>{
  for(const href of [undefined,null,'','#note','?edition=2','./','/']){
    assert.equal(cleanSectionHref(href),'');
    assert.equal(sectionHrefMatches(href,href),false);
    assert.equal(sectionHrefMatches('chapter.xhtml',href),false);
  }
});

test('linear spine selection preserves section order and identity without trailing auxiliary entries',()=>{
  const first=Object.freeze({href:'chapter1.xhtml',index:3});
  const last=Object.freeze({href:'chapter2.xhtml',index:8,linear:'yes'});
  const auxiliary=Object.freeze({href:'notes.xhtml',index:9,linear:'no'});
  const raw=Object.freeze([null,{index:1},first,last,auxiliary]);
  const items=linearSpineItems({spine:{spineItems:raw}});
  assert.deepEqual(items,[first,last]);
  assert.equal(items[0],first);assert.equal(items[1],last);
  assert.notEqual(items,raw);assert.equal(raw.length,5);
});

test('an entirely non-linear spine retains href-bearing entries as its fallback',()=>{
  const first={href:'appendix.xhtml',linear:'no'},last={href:'notes.xhtml',linear:'no'};
  assert.deepEqual(linearSpineItems({spine:{spineItems:[first,undefined,{href:''},last]}}),[first,last]);
  assert.deepEqual(linearSpineItems(),[]);
  assert.deepEqual(linearSpineItems({spine:{}}),[]);
});
