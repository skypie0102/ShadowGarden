# Reconstruction audit — updated 2026-09-25

## Scope and outcome

The recovered static site was preserved and all 15 observed function routes
were reconstructed. This is a tested reconstruction checkpoint, **not proof of
production equivalence or complete private-data recovery**.

| Check | Result |
| --- | --- |
| Archive integrity/provenance | SHA-256 recorded for both source archives and all 148 recovered public files |
| Retained public files | 148/148 present; 144/148 byte-identical; 4 intentional browser script edits |
| Syntax, JSON, literal static dependencies | Passed; 207 checked literal references resolve |
| Route coverage | 15/15 recorded function paths exist; client endpoint literals covered |
| Catalog evidence | Main empty; one adult series, five unique book IDs, ten cover files |
| HTML structural inspection | Six documents parsed; no duplicate IDs |
| Automated backend/client tests | 27/27 pass locally; the preceding 25 also passed GitHub Actions; real SQLite, isolated sessions, mocked B2/Turnstile |
| Private mapping migration generator | Successful restore and stale rerun verified against SQLite |
| Static build | Passed; `dist/` contains public assets, no server/private files |
| Pages Functions compilation | Passed with pinned Wrangler 4.136.3 |
| Local D1 migration and seed | Passed under Wrangler; no remote database touched |
| Dependency audit | `npm audit`: zero reported vulnerabilities on 2026-09-25, including the new Playwright dependency graph |
| Real-browser workflow checks | 10/10 pass in GitHub Actions: desktop Chromium and mobile Chromium |
| Manual visual review and actual-book rendering | Successful-page captures retained for review; visual sign-off and original EPUB rendering remain unverified |
| Pages/D1 runtime | HTTPS Pages Functions and local D1 verified in CI; this workspace's preview still fails on interface enumeration |
| Live Cloudflare/B2/Turnstile integration | Unverified: original bindings, credentials and private data unavailable |
| Remote Git commit/push | Reconstruction and browser fixes published to skypie0102/ShadowGarden main; remote Git trees checked against local source |

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
8. Stale editor revision: a background banner/history/status read previously
   advanced the shared client revision, letting old forms submit with a newer
   precondition. Editor requests now retain the revision of the displayed data;
   successful edits advance that form's revision. Caller-supplied `If-Match`
   headers are preserved. Three client-to-backend regression tests pass.
9. Adult-gate return navigation: browser testing exposed a recovered client race.
   Catalog initialization rewrites the URL, discarding the requested series
   before the acknowledgement click. The gate now captures the destination
   before initialization and permits only same-origin paths. The browser case
   explicitly waits for catalog initialization before acknowledging.
10. EPUB mapping collision: replacing one volume with an object mapped to another
    identity could make valid reader tickets unusable. Catalog writes now reject
    that alias with 409 without changing metadata or snapshots.
11. Trash identity collision: restoring a trashed series or volume could introduce
    a book ID already active under a different series. Restores now check both
    libraries and reject conflicting identities without consuming the trash item.
    Both collision regressions failed before the guards and pass afterwards.

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
EPUB uploads to fresh object keys and rewrite the catalog upload payload. Open
editors retain their own revision across background reads.

`public/assets/js/admin/library-workflow.js`: retain the loaded library revision
and bind it to the series editor when opening a form.

`public/assets/js/library.js`: preserve the adult-gate return destination across
filter URL rewrites and reject external return destinations.

`public/assets/js/admin/trash-workflow.js`: disable permanent purge controls and
explain its unavailability.

`recovery-info/_recovery-log.tsv` was normalized to deployment URL/path fields;
the original workstation directory strings were removed from the committed log.
Original archive hashes preserve evidence identity. The historical recovery
report's “missing literal references” are retained as evidence; most are variable
names misidentified by the crawler. The new audit checks actual imports and
HTML/CSS asset references instead.

## GitHub verification

[Reconstruction commit](https://github.com/skypie0102/ShadowGarden/commit/20dd2ec78939f42638e0758f8f510f21675372f4)
and [successful CI run](https://github.com/skypie0102/ShadowGarden/actions/runs/35930710273).

Git tree `4e5be36752df1177242f40a374eb7fa0c7295737` matched the local
publication tree exactly. All 197 project files, including ten binary images,
were verified through Git hashes. The following documentation commit records
this outcome without changing application behavior.

## Browser verification scope added 2026-09-25

The pinned Playwright suite executes five workflows on desktop Chromium and
mobile Chromium. Its server harness copies the reconstructed app into a temporary
directory, initializes a separate local D1 database, and starts real HTTPS Pages
Functions with fixture credentials. Application API responses are not mocked.
Third-party browser requests are excluded. Authentication uses a normally signed,
D1-backed fixture session; this does not verify live Turnstile. The suite checks
the missing-book error rather than claiming actual EPUB reading was restored.
Run [36123630092](https://github.com/skypie0102/ShadowGarden/actions/runs/36123630092)
at commit `929c5d59142e2ce049085d0c9d347c3ad5ffe4d1` passed all ten cases
in 19.8 seconds, plus all 25 backend/client tests, the asset audit, static build
and Functions compilation. The previous eight-of-ten result is superseded by
this run. Both stale-editor cases now verify the 409 conflict and successful
save after reload without retries or forced clicks.

Successful runs now attach screenshots of the empty main library, adult
acknowledgement, recovered series, missing-book reader and Keeper series editor
on both screen sizes. These are render evidence, not pixel-baseline assertions.
Fonts and other third-party requests remain excluded by the isolated harness;
live-provider and original-EPUB checks remain separate.

Two subsequent collision regression tests bring the current local suite to 27.
The CI workflow runs both suites on every push.
