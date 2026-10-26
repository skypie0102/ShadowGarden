import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readingProgressSummary } from '../public/assets/js/public/reading-progress.js';

test('saved progress combines recorded percentage, pages and chapter without changing the record', () => {
  const progress = { percentage: '0.42', page: '12', totalPages: '200', chapter: '  Chapter 3\nA return  ' };
  const before = structuredClone(progress), summary = readingProgressSummary(progress);
  assert.equal(summary.text, '42% complete · Saved page 12 of 200 · Chapter 3 A return');
  assert.equal(summary.percent, 42);
  assert.deepEqual(progress, before);
});

test('missing or malformed percentages never become a fabricated zero or full completion', () => {
  for (const percentage of [undefined, null, '', ' ', true, false, [], {}, NaN, Infinity, 'invalid']) {
    const summary = readingProgressSummary({ percentage, page: 12, totalPages: 200 });
    assert.equal(summary.text, 'Saved page 12 of 200');
    assert.equal(summary.percent, null);
    assert.equal(summary.fraction, null);
  }
});

test('recorded zero and percentage bounds remain distinct from unknown progress', () => {
  assert.equal(readingProgressSummary({ percentage: 0 }).text, '0% complete');
  assert.equal(readingProgressSummary({ percentage: -0.1 }).percent, 0);
  assert.equal(readingProgressSummary({ percentage: 1.1 }).percent, 100);
  assert.equal(readingProgressSummary({ percentage: 0.995 }).percent, 100);
});

test('page-only records retain their page and reject invalid or contradictory totals', () => {
  assert.equal(readingProgressSummary({ page: 12 }).text, 'Saved page 12');
  assert.equal(readingProgressSummary({ page: 12, totalPages: 10 }).text, 'Saved page 12');
  for (const page of [null, '', false, 0, -1, Infinity, 'invalid'])
    assert.equal(readingProgressSummary({ page, totalPages: 100 }).text, 'Saved reading position');
});

test('unknown progress can describe a stored chapter without inventing page or percentage values', () => {
  assert.equal(readingProgressSummary({ chapter: 'Chapter Twelve' }).text, 'Chapter Twelve');
  assert.equal(readingProgressSummary({ chapter: {} }).text, 'Saved reading position');
  assert.equal(readingProgressSummary(null).text, 'Saved reading position');
});
