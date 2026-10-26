# Reader performance measurements

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

Measured 2026-10-16 (Asia/Manila), using three cold runs and cached reopens per generated publication. Baseline: `8c247ce571bf62184f96665b1939867936d34a71`. Candidate: `9b59c5ce5e207e539c9c3b939010707ceb6b012b`, public source tree `8cbfea2bd6de2145a360f8b88b391f656fdb7ea6`.

The production reader HTML, authorization client, vendor runtime and complete engine run against original generated EPUBs in the disposable Pages/D1 harness. Profiles use desktop Chromium revision 1243, Playwright 1.63.0, Node 24.19.0, Linux and a 1280×720 viewport. The long fixture has 80 prose chapters, with 48 paragraphs before and after each inline illustration. The other fixtures have 40 chapters, half standalone plates, using either one repeated SVG or distinct SVG assets. Each book also has a cover.

## Results

Timings below are medians in milliseconds, measured from navigation. Startup waits for the loading screen to close; map-ready waits for the final canonical map. Harness polling and shared-runtime variation are included. Conversion counts measure actual canvas encoding calls.

| Fixture | Startup before → after | Map-ready before → after | Conversions before → after |
| --- | ---: | ---: | ---: |
| long-prose | 1292 → 1252 | 8386 → 8369 | 1 → 1 |
| repeated-plates | 1653 → 704 | 5600 → 4725 | 21 → 1 |
| unique-plates | 1721 → 1659 | 5690 → 5627 | 21 → 21 |

| Fixture | Peak map sources before → after | Peak reader sources before → after | Unchanged canonical pages |
| --- | ---: | ---: | ---: |
| long-prose | 81 → 2 | 33–34 → 10 | 1761 |
| repeated-plates | 41 → 2 | 33 → 10 | 261 |
| unique-plates | 41 → 2 | 33 → 10 | 261 |

The repeated-asset fixture's median startup falls by 57%. Unique artwork still performs 21 conversions, preserving every distinct image. Every cached reopen in the nine candidate runs performs zero new conversions. The sampled reader uses at most nine live views and retains five after the final distant jump.

## Ownership and cache bounds

Live views and temporary source readers hold explicit leases. Pending loads are shared through content-hook completion; the final release unloads the parsed source. View clearing/replacement is covered as well as idle trimming. The isolated map releases replaced sources and uses a spine index plus a small retained-source set. Scan-local image reuse preserves each page’s own alt text, index and geometry.

Disposable cache maintenance keeps 24 page maps, four layouts per publication, with an 8 MiB JSON-payload budget; visual preparation keeps eight publications with a 64 MiB Blob-payload budget. Both expire records after 30 days and remove old versions and damaged entries. Oversized results remain usable without persistence. The database names, versions, stores and keys remain compatible. Progress and bookmarks are unchanged.

## Reproduction and limits

```sh
npx playwright install --with-deps chromium
npm run profile:reader -- --repeat-each=3
```

[Raw runs and summaries](../evidence/reader-performance-results.json) retain numeric fixture data and source identities. Each profile also attaches its JSON to the Playwright report. Ordinary browser tests assert source bounds, visible page metadata, cache reuse/pruning and failure recovery; they do not impose timing thresholds.

These are generated-publication measurements on one shared desktop runtime. Timing differences outside the repeated-asset case are not treated as established speed improvements. Source counts are not a heap profile: the current archive, map records and normalized artwork still scale with actual publication content. Cache budgets describe logical payload rather than physical browser storage. Other browser engines, release-book inspection and production verification remain Phase 5 work.
