# Reconstruction audit — 2026-09-23

## Scope and outcome

The recovered static site was preserved and all 15 observed function routes
were reconstructed. This is a tested reconstruction checkpoint, **not proof of
production equivalence or complete private-data recovery**.

| Check | Result |
| --- | --- |
| Archive integrity/provenance | SHA-256 recorded for both source archives and all 148 recovered public files |
| Retained public files | 148/148 present; 146/148 byte-identical; 2 intentional admin script edits |
| Syntax, JSON, literal static dependencies | Passed; 207 checked literal references resolve |
| Route coverage | 15/15 recorded function paths exist; client endpoint literals covered |
| Catalog evidence | Main empty; one adult series, five unique book IDs, ten cover files |
| HTML structural inspection | Six documents parsed; no duplicate IDs |
| Automated backend tests | 22/22 pass; real SQLite, isolated sessions, mocked B2/Turnstile |
| Private mapping migration generator | Successful restore and stale rerun verified against SQLite |
| Static build | Passed; `dist/` contains public assets, no server/private files |
| Pages Functions compilation | Passed with pinned Wrangler 4.136.3 |
| Local D1 migration and seed | Passed under Wrangler; no remote database touched |
| Dependency audit | `npm audit`: zero reported vulnerabilities on 2026-09-23 |
| Real-browser visual checks | Unverified: Chromium absent; its download returned invalid/truncated data |
| Full local preview | Wrangler dev failed on `uv_interface_addresses`; direct Miniflare probes did not initialize and were stopped |
| Live Cloudflare/B2/Turnstile integration | Unverified: original bindings, credentials and private data unavailable |
| Remote Git commit/push | New destination resolved as skypie0102/ShadowGarden; publication in progress |

## Defects found and fixed during reconstruction

1. Snapshot checksum fidelity: the original stored JSON serialization is retained
   when checksumming snapshots, avoiding a false corruption report after reading
   whitespace-formatted seed JSON. Tested.
2. Banner API fidelity: the recovered client expects `current`, not just
   `bannerBookId`, in the choice payload. Both are returned. Tested.
3. Destructive replacement risk: the recovered uploader reused an existing EPUB
   key. It now uploads to a fresh opaque key; catalog replacement preserves the
   public book ID, while old snapshots keep their old object mapping. Tested.
4. Concurrent catalog writes: a revision-guarded D1 transaction snapshots the
   old state and updates the new state; losing writers receive HTTP 409. Tested.
5. Concurrent object uploads: D1 reserves object keys before upload; a reused key
   is rejected. Existing B2 objects are not deliberately overwritten.
6. Unsupported purge UI: controls are explicitly disabled and the endpoint
   returns 501. The reconstructed app never reports an unperformed deletion.
7. Public/protected storage boundary: private EPUB requests cannot reach the
   static fallback; public catalogs strip private paths and upload bookkeeping.
   Tested, including invalid tickets, raw paths and retired book identities.

## Important remaining limits

- All backend source is new. Original algorithms, bindings, retention rules,
  protection policies and runtime behavior have not been reproduced exactly.
- Five original books still lack both binaries and private B2 mappings.
- D1 is a new authoritative metadata store; it does not update legacy B2 catalog
  JSON. A deployment must explicitly initialize and bind a new database.
- Permanent purge and the undocumented recovery mutation remain unavailable.
  No cleanup runs silently, and upload reservations/orphan objects may accumulate.
- Abuse Watch implements basic persistent rate limits, not the original scoring
  and tripwire system. Operational event retention and limits are new policy.
- Readiness checks are bounded and can report uncertain for large libraries.
- EPUB validation covers ZIP structure/signatures/size limits; semantic EPUB
  correctness and real-book reader behavior still require EPUBCheck/browser QA.
- Vendor bundles were recovered, not rebuilt from original dependency manifests.
  Their original source maps, lockfiles and complete provenance are missing;
  npm's zero-vulnerability result covers the new dependency graph only.
- High-volume/load testing, real 50 MB upload memory behavior, production rate
  limits and cross-device reader behavior were not verified in this environment.

## Intentional edits to recovered files

`public/assets/js/admin/core.js`: record catalog revisions, send `If-Match`, map
EPUB uploads to fresh object keys and rewrite the catalog upload payload.

`public/assets/js/admin/trash-workflow.js`: disable permanent purge controls and
explain its unavailability.

`recovery-info/_recovery-log.tsv` was normalized to deployment URL/path fields;
the original workstation directory strings were removed from the committed log.
Original archive hashes preserve evidence identity. The historical recovery
report's “missing literal references” are retained as evidence; most are variable
names misidentified by the crawler. The new audit checks actual imports and
HTML/CSS asset references instead.
