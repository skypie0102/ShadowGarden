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

The batch prepares package version 2.18.1. The local asset/provenance audit, all
305 Node tests, static build and binding/compatibility-aware Worker packaging pass.
The five-profile browser matrix must pass before merge.

Production remains the separately verified v2.18.0 until an explicit guarded
deployment is recorded here. On 2026-10-21 the connected Cloudflare search and
execution APIs returned internal errors; no fresh production baseline or new
deployment is claimed. This source cleanup requires no catalog, snapshot,
book-object, migration or credential writes.

The next readability batch is Keeper's dense data/maintenance workflows. The
unknown-length/concurrent upload-memory budget and broader Keeper fixture variants
remain separate follow-ups in the [whole-codebase audit](CODEBASE_AUDIT_2026-10.md).
