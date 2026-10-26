# Recording the original scroll reversal

The historical M5a -56 px result remains unresolved. This workflow seeks a
recorded recurrence; passing probes do not prove that the bug is fixed.

## CI comparison

`Reader scroll investigation` runs on pull requests changing its harness and can
also be started manually from GitHub Actions. Two disposable checkouts compare
the original failing source tree (merge `81da5dd6e52766c5b37c84a9bce2ebfcff732019`)
with the workflow's current source. Each uses its own pinned dependency lock,
Chromium and the existing isolated Pages/D1 test server. No remote database or
production deployment is involved.

Both jobs keep the original suite order and instrument the native upward-scroll
case at its normal position. They then append 30 recorded repetitions in the
same worker/browser. A test failure makes Playwright restart its worker, so later
probes are no longer in that original warm process; the report retains that
failure and its trace. Jobs do not retry a failure or stop after the first one.
The normal five-profile CI remains a separate check without this instrumentation.

Only the disposable checkout's native test is rewritten. A Playwright route
instruments its `continuous-layout.js` response; production source/build files
are not changed. Exact string seams fail closed when the implementation drifts.
Callbacks add timing overhead and may hide or expose a race.

## Recorded evidence

Every native probe saves its passage samples and resize payloads, plus:

- Transaction ID, anchor section, semantic block index, anchor kind, expected top
  and generation when the transaction chooses an anchor.
- Measured post-change top and compensation delta, followed by transaction end.
- Writes to the native container `scrollTop` setter, associated with the active
  transaction. `lastRead` is the last existing getter result, not an extra read
  of the position immediately before the write.

The probe delegates the existing getter/setter and restores the container's
original property shape when recording stops. It adds no geometry reads.
Native wheel input, waits, block-survival predicate, 3 px reversal threshold,
2 px trim tolerance and assertion remain intact. Additional assertions check
that recording actually observes complete anchor transactions. A timeout or
failed assertion also attempts a partial attachment; a crashed page can prevent
that attachment, while Playwright retains its failure trace.

Artifacts `scroll-investigation-original` and `scroll-investigation-current`
retain the JSON/HTML reports, failure traces, source hashes, dependency/runtime
and font information for 14 days. `summary.json` retains every negative sample
below -3 px with nearby samples, transactions and resize callbacks. It separately
counts geometry disagreements, document mismatches and 56 px shrink events.
The summary regression uses the actual archived M5a witness and must retain its
sample 89 / -56 px failure even though that older witness lacks transactions.

## Local use

Use a **separate disposable checkout**. Preparation rewrites that checkout's
native test and adds diagnostic files; it refuses the harness checkout and a
modified tracked native test. From the maintained harness checkout:

```sh
SG_SCROLL_REPETITIONS=30 node scripts/prepare-reader-scroll-diagnostics.mjs /path/to/disposable-checkout
```

From the disposable checkout, install its locked dependencies and Chromium, then:

```sh
npm run build
npx playwright test --config playwright.scroll-diagnostics.config.mjs --project mobile-chromium
```

Summarize with the maintained harness script:

```sh
node scripts/summarize-reader-scroll-diagnostics.mjs \
  /path/to/disposable-checkout/scroll-diagnostic-results/report.json \
  /path/to/disposable-checkout/scroll-diagnostic-results/summary.json
```

Read the [original-artifact investigation](../archive/audits/READER_SCROLL_AUDIT.md#original-failure-artifact-follow-up)
for the recovered trace, corrected font geometry and previous reproduction limits.


## First recorded CI comparison

[Run 39079730631](https://github.com/skypie0102/ShadowGarden/actions/runs/39079730631)
passes on both sources. Permanent summaries, provenance, artifact hashes and
record-integrity checks are in [reader-scroll-recorded-ci.json](../archive/evidence/reader-scroll-recorded-ci.json).

| Measurement | Original source | Current source |
| --- | ---: | ---: |
| Passing suite + probe cases | 92 | 96 |
| Recorded native traces | 31 | 31 |
| Passage samples | 6,406 | 5,067 |
| Complete anchor transactions | 1,261 | 671 |
| Correlated scroll writes | 615 | 310 |
| Repeated 56 px shrink events | 393 | 0 |
| Reversals below -3 px | 0 | 0 |
| Saved-y/snapshot-top gaps above 0.01 px | 0 | 0 |
| Node/frame document mismatches | 0 | 0 |

Both artifacts match their published SHA256 digests. Recomputing summaries from
full reports produces identical results. All chosen anchor sections and semantic
block indices are valid; correction deltas agree with top minus expectedTop,
and correlated scroll-write arithmetic agrees with those deltas. CI uses
Liberation Serif fallback, reproducing the original 1159/1215 px height pair;
current-source samples remain at 1215 px. This is not a performance comparison.

Every recorded transaction uses a semantic block anchor. The view-anchor fallback
is unexercised, making it a concrete gap for a controlled follow-up, not an
established cause of the historical event. Recording is now available in CI;
the original reversal remains open and this run does not justify a resolution claim.
