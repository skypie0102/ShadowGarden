import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as reading from '../public/assets/js/domain/reading-state.js';
import { volumeActionFor } from '../public/assets/js/public/volume-actions.js';
import * as domain from '../public/assets/js/domain/index.js';
import { renderReadingBanner, recentVolumeCard, seriesCard } from '../public/assets/js/library-renderers.js';
import { seriesMarkup } from '../public/assets/js/series-renderers.js';

function fixture(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map();
  let reads = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem(key) { reads++; return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); }, removeItem(key) { data.delete(key); }
  } });
  t.after(() => previous ? Object.defineProperty(globalThis, 'localStorage', previous) : delete globalThis.localStorage);
  const series = { id: 'reading-journey', title: 'Reading journey fixture', nsfw: true,
    volumes: [1, 2, 3].map(number => ({ number, title: `Technical chapter ${number}`,
      file: `bk_${String(number).padStart(22, 'A')}` })) };
  return { series, data, reads: () => reads,
    progress(index, value) { data.set(`sg-progress:${series.volumes[index].file}`, JSON.stringify(value)); },
    finished(...indices) { data.set(reading.KEY, JSON.stringify(Object.fromEntries(indices.map(index => [series.volumes[index].file, 10 + index])))); }
  };
}

test('unread actions say Start reading and preserve adult routes and stable book identities', t => {
  const { series } = fixture(t);
  const context = reading.seriesReadingContext(series);
  assert.equal(context.preferred.index, 0);
  assert.equal(context.nextIndex, -1);
  const action = volumeActionFor(series, series.volumes[0], 0, context);
  assert.equal(action.label, 'Start reading');
  assert.equal(action.bookId, series.volumes[0].file);
  assert.equal(new URL(action.href, 'https://garden.test').searchParams.get('scope'), 'adult');
});

test('the latest active volume wins and both entry points say Continue reading', t => {
  const f = fixture(t);
  f.progress(0, { page: 4, percentage: 0.1, updatedAt: 10 });
  f.progress(2, { page: 12, percentage: 0.42, updatedAt: 20 });
  const context = reading.seriesReadingContext(f.series), banner = reading.libraryBannerEntry([f.series]);
  assert.equal(context.preferred.index, 2);
  assert.equal(banner.index, 2);
  assert.equal(context.nextIndex, -1);
  assert.equal(volumeActionFor(f.series, banner.volume, banner.index, context).label, 'Continue reading');
});

test('finished first volume selects the same Read next volume in Library and Series', t => {
  const f = fixture(t); f.finished(0);
  const context = reading.seriesReadingContext(f.series), banner = reading.libraryBannerEntry([f.series]);
  assert.equal(context.preferred.index, 1);
  assert.equal(context.nextIndex, 1);
  assert.equal(banner.index, 1);
  assert.equal(volumeActionFor(f.series, f.series.volumes[1], 1, context).label, 'Read next volume');
  assert.equal(volumeActionFor(f.series, f.series.volumes[2], 2, context).label, 'Start reading');
});

test('out-of-order Finished marks cannot make Series disagree with the Library continuation', t => {
  const f = fixture(t); f.finished(1);
  const banner = reading.libraryBannerEntry([f.series]);
  assert.equal(banner.index, 2);
  assert.equal(reading.preferredSeriesEntry(f.series).index, banner.index);
  assert.equal(volumeActionFor(f.series, banner.volume, banner.index).label, 'Read next volume');
});

test('all finished volumes retain Read again without modifying stored progress or completion', t => {
  const f = fixture(t); f.finished(0, 1, 2); f.progress(0, { page: 15, percentage: 1, updatedAt: 20 });
  const before = [...f.data];
  const context = reading.seriesReadingContext(f.series);
  assert.equal(context.nextIndex, -1);
  assert.equal(volumeActionFor(f.series, context.preferred.volume, context.preferred.index, context).label, 'Read again');
  assert.deepEqual([...f.data], before);
});

test('a saved first page remains Start reading rather than claiming an active continuation', t => {
  const f = fixture(t); f.progress(0, { page: 1, percentage: 0, updatedAt: 20 });
  const banner = reading.libraryBannerEntry([f.series], 0);
  assert.equal(banner.mode, 'suggestion');
  assert.equal(volumeActionFor(f.series, banner.volume, banner.index).label, 'Start reading');
});

test('missing EPUBs cannot become hero or banner destinations, including stale progress', t => {
  const f = fixture(t);
  f.series.volumes[0].file = '';
  f.data.set(`sg-progress:series:${f.series.id}:volume:1`, JSON.stringify({ page: 5, percentage: 0.4, updatedAt: 50 }));
  assert.equal(reading.preferredSeriesEntry(f.series).index, 1);
  assert.equal(reading.libraryBannerEntry([f.series], 0).index, 1);
  assert.equal(reading.preferredSeriesEntry({ id: 'empty', volumes: [] }), null);
  assert.equal(reading.preferredSeriesEntry({ id: 'missing', volumes: [{ number: 1 }] }), null);
});

test('one render snapshot reuses reading state across volume actions without repeated storage reads', t => {
  const f = fixture(t); f.finished(0);
  const context = reading.seriesReadingContext(f.series), reads = f.reads();
  for (const entry of context.entries) volumeActionFor(f.series, entry.volume, entry.index, context);
  assert.equal(f.reads(), reads);
});

test('legacy page-only progress without a timestamp remains a continued Library and Series destination', t => {
  const f = fixture(t); f.progress(0, { page: 12, totalPages: 100 });
  const banner = reading.libraryBannerEntry([f.series]);
  assert.equal(banner.mode, 'continue');
  assert.equal(banner.index, reading.preferredSeriesEntry(f.series).index);
});

test('page-only summaries render consistently without fabricated percentages or interpreted chapter markup', t => {
  const f = fixture(t);
  const chapter = 'Chapter <img src=x onerror=alert(1)>';
  f.progress(0, { page: 12, totalPages: 100, chapter, updatedAt: 10 });
  const before = [...f.data], current = reading.libraryBannerEntry([f.series]);
  const panel = { dataset: {}, classList: { remove() {} }, innerHTML: '' };
  renderReadingBanner(panel, null, current, domain);
  const recent = recentVolumeCard({ series: f.series, volume: f.series.volumes[0], volumeIndex: 0 }, 0, domain);
  const series = seriesMarkup(f.series, domain);
  for (const html of [panel.innerHTML, recent, series]) {
    assert.match(html, /Saved page 12 of 100/);
    assert.match(html, /Chapter &lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /0%|NaN|undefined|<img src=x/);
  }
  for (const html of [seriesCard(f.series, 0, domain), series]) assert.doesNotMatch(html, /class="cover-reading-progress"/);
  assert.match(recent, /aria-describedby="recent-volume-progress-0"/);
  assert.deepEqual([...f.data], before);
});

test('missing EPUB cards retain their order and state but expose no reading or download links', t => {
  const f = fixture(t);
  f.series.volumes[0].file = '';
  f.series.volumes[0].bookId = 'bk_A2yCOKedG1g4xXTJJhbEzA';
  f.finished(1);
  const before = [...f.data], html = seriesMarkup(f.series, domain);
  const missing = html.match(/<article[^>]*data-volume-index="0"[\s\S]*?<\/article>/)[0];
  assert.match(missing, /Volume 1 of 3/);
  assert.match(missing, /EPUB unavailable/);
  assert.doesNotMatch(missing, /<a\b|data-volume-action|download/);
  assert.match(html, /href="#series-volume-2"/);
  assert.deepEqual([...f.data], before);
});
