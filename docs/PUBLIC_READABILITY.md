# Public controller readability — v2.18.1

This audit batch expands dense statements in seven public modules so that state,
event handlers, async cleanup and error paths can be reviewed directly. It follows
the functional v2.18.0 [public-boundary release](PUBLIC_BOUNDARIES.md).

| Module | Review boundary |
| --- | --- |
| `library.js` | Filter state, controls, batched rendering and age-gate setup |
| `data-source.js` | Source configuration, shared catalog requests and retries |
| `library-mobile-filter.js` | Responsive filter placement and persisted collapse state |
| `nav-pinned.js` | Shelf context, pinned links and storage refresh |
| `series.js` | Resolved scope, page events and loading/error ownership |
| `public/garden-pass.js` | Native dialog, verification callbacks and focus cleanup |
| `public/turnstile.js` | Shared widget-script loading and failure cleanup |

Across these modules, lines exceeding 180 columns decrease from 24 to five.
Library's longest line decreases from 587 to 227 columns. Remaining long lines
are literal markup/copy; their exact values are retained. Source readability is
the outcome of this increment; it makes no new performance claim.

## Equivalence check

[Machine-readable evidence](public-readability-equivalence.json) records the
baseline `60c97df83a5cfb487800393a147d2be5fc4169a1`, each before/after source
SHA-256, normalized AST/comment checksums and source shape.

Prettier 3.6.2 is used as a temporary development tool, with its Babel parser.
For every file, the original and formatted Babel syntax trees compare equal after
removing source-position, raw-spelling/parenthesis metadata and attached comments.
Executable nodes, operators, literal values and import URLs are included in the
comparison. Ordered comment text is checked separately with whitespace normalized.
Property quoting is preserved so even quoted numeric property keys keep the same
syntax node type. Embedded-language formatting is disabled to preserve template
literal markup exactly.

The report records all formatter options. The temporary formatter package and
comparison helper stay outside the application/package dependency graph. This
one-time source comparison supports this formatting batch; it is not a proof
about arbitrary future transformations. Existing runtime tests remain the
behavioral validation.

## Validation and release state

[PR #39](https://github.com/skypie0102/ShadowGarden/pull/39) merged this batch as
`ba71f00db7aa6a6a2af45a03676107a1d8f1c621`, preparing package version 2.18.1.
The merged tree `5bad162d9d0b106e130cff8cc0c54c6475c198e1` exactly matches
tested head `bb4a0971000166ae718a298c12c8578d0a22f4e1` and the profile checkout.
[CI run 39542225261](https://github.com/skypie0102/ShadowGarden/actions/runs/39542225261)
passes on attempt 1 with no test retries:

- Asset/provenance audit, all 305 Node tests, static build and binding/compatibility-aware Worker packaging.
- 541 browser passes across the five profiles, with the same nine documented
  skips as v2.18.0, including its controlled Firefox frame-traversal limitation.
- A separate 24-sample startup profile: all baseline/current samples retain
  26 script requests and zero duplicate paths. No new timing improvement is claimed.

[Sanitized verification](public-readability-verification.json) records per-profile
counts, source identities, public checks and the deployment blocker.

Production remains the separately verified v2.18.0 until an explicit guarded
deployment is recorded here. On 2026-10-21 the connected Cloudflare search and
execution APIs returned internal errors, including a runtime request with no
Cloudflare API calls. No fresh production baseline or new deployment is claimed.
Public HTTP checks at 04:10 UTC (12:10 Asia/Manila) confirm v2.18.0/`8e34ced`,
both catalogs and all seven matching previous-release modules. No catalog,
snapshot, book-object, migration or credential writes were performed.

The next readability batch is Keeper's dense data/maintenance workflows. The
unknown-length/concurrent upload-memory budget and broader Keeper fixture variants
remain separate follow-ups in the [whole-codebase audit](CODEBASE_AUDIT_2026-10.md).

### Deployment follow-up — 2026-10-22

Fresh main run 39755380834 passes 318 Node tests and all 541 browser cases, with
nine documented skips and no retries. The Actions credential is now configured;
the read-only resource check confirms D1 access but Pages project access returns
HTTP 403 / Cloudflare error 10000. No publication occurred and production remains
v2.18.0. [Automatic deployment status](AUTO_DEPLOYMENT.md) and
[current evidence](automatic-deployment-verification.json) identify the remaining
Pages authorization blocker separately from the historical connector failure.
