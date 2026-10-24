import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const baseline = readFileSync(new URL('./fixtures/library-readiness-2.18.12.js', import.meta.url), 'utf8');
const expectedSha = 'a93fc3162b749cb3e84ab0bfce905cc8ae76b1eac89cf5ae51949cbad0b8c8c2';
if (createHash('sha256').update(baseline).digest('hex') !== expectedSha) throw Error('Damaged dated Library controller');

for (const adult of [false, true]) for (const outcome of ['populated', 'empty', 'failure'])
test(`${adult ? 'Adult' : 'Main'} library clears busy and loading placeholders after ${outcome}`, async ({ page }) => {
  let useBaseline = true, release;
  let waiting = new Promise(resolve => { release = resolve; });
  await page.addInitScript(() => localStorage.setItem('sg-adult-ack', '1'));
  await page.route('**/assets/js/library.js*', route => useBaseline
    ? route.fulfill({ contentType: 'text/javascript', body: baseline }) : route.continue());
  await page.route(`**/media/shadow-garden/data/${adult ? 'adult-catalog' : 'catalog'}.json`, async route => {
    await waiting;
    await route.fulfill(outcome === 'failure'
      ? { status: 503, json: { error: 'Disposable catalog outage' } }
      : { json: { series: outcome === 'empty' ? [] : [{ id: 'ready-fixture', title: 'Ready technical fixture', volumes: [] }] } });
  });
  const path = adult ? '/nsfw' : '/';
  const resultReady = async () => {
    if (outcome === 'failure') await expect(page.locator('#resultCount')).toHaveText('Could not load catalog');
    else if (outcome === 'empty') await expect(page.locator('#emptyState')).toBeVisible();
    else await expect(page.locator('#catalogGrid .series-card')).toHaveCount(1);
  };
  // Execute the real dated controller as an independent failing-behavior
  // control, then the served candidate with an independently held response.
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy', 'true');
  release(); await resultReady();
  await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy', 'true');
  useBaseline = false; waiting = new Promise(resolve => { release = resolve; });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy', 'true');
  release(); await resultReady();
  await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#catalogGrid .catalog-skeleton-card')).toHaveCount(0);
  await expect(page.locator('#catalogGrid .series-card')).toHaveCount(outcome === 'populated' ? 1 : 0);
});
