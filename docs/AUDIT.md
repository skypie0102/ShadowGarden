# Reconstruction audit — updated 2026-10-03

## Existing Keeper credential compatibility — 2026-10-03

The owner reported `security_not_configured` when logging into production.
Read-only checks showed a working session/Turnstile challenge and configured
`SG_ADMIN_TOKEN`, while the protected library endpoint failed the admin-token
configuration gate. The reconstruction had applied its 32-character HMAC key
minimum to the existing login credential even though an independent session
key signs the comparison.

Separated credential validation from signing-key validation. Keeper preserves
the exact nonempty stored token, including existing shorter credentials. Empty,
whitespace-only and non-string values still fail closed; canonical overrides
remain explicit. Session/media signing keys retain their length checks. The
admin challenge now validates credential presence, and configuration errors
are rejected before counting failed login attempts.

All 61 backend/client tests pass. Added full login/session checks for an existing
shorter token, wrong-token and failed-Turnstile rejection, and invalid-credential
configuration checks. No stored secret was read, changed or rotated.

## Production takeover and storage runtime correction — 2026-10-02

The owner authorized taking over `shadowgarden-bon.pages.dev` using its existing
secrets and B2 bucket. Production deployment `e9d4306a-a4db-4aed-a4a9-d3b28458dc39`
served commit `26bacb7`. Live HTTP checks verified the homepage, version, both
Turnstile challenge endpoints and empty D1 catalogs. All eight original secrets
were retained; an independent `SESSION_SECRET`, D1 binding and bucket variables
were added. See `PRODUCTION_TAKEOVER.md` for the exact resources and rollback.

A real storage probe exposed a runtime compatibility bug: workerd rejects
`redirect: 'error'` before contacting B2. Node fetch mocks had not exposed this.
The pinned Cloudflare runtime reproduced the old 502 with zero provider calls.
The fix uses `manual` and explicitly rejects every 3xx response without following
the destination. The same runtime then served fixture media and refused a 307.
All 59 backend/client tests pass, including authorization and file-operation
redirect guards. On 2026-10-03, corrected production deployment
`f8844be0-ae68-4e72-969d-c0812f03109d` passed the live read-only B2 probe: provider
authorization and a missing-object lookup now return the expected 404. Actual
EPUB upload/read and real write/delete permissions still require Keeper checks.

The orphaned Workers build configuration was confirmed to reference a deleted
Worker. Its previews are disabled and production builds exclude all paths;
Pages deployment configuration is independent of this cleanup.

## Test deployment and B2 authorization compatibility — 2026-10-02

The isolated Pages project now serves the initialized empty D1 catalogs.
After the owner configured security and redeployed, independent HTTP checks
confirmed both challenge endpoints return 200. The owner confirmed Keeper
login opens normally. Actual B2 upload/read, media signing and cleanup remain
pending the separate test bucket and credentials.

Changed B2 authorization from v2 to v4 so current bucket-group keys work along
with legacy keys. Nested provider endpoints and returned bucket restrictions
are validated before storage operations. Malformed authorization fails closed;
the split credentials, rotation checks and exact-version cleanup remain intact.
All 57 local backend/client tests, asset audit, build and Functions compilation
pass. Four additional cases cover bucket groups/unrestricted responses,
bucket mismatches, malformed responses and untrusted nested endpoints. Existing
upload, reader, recovery and cleanup fixtures now use the documented v4 shape.
No browser assets, database schema, live project settings or B2 objects changed.

## Existing deployment configuration compatibility — 2026-10-01

The owner supplied the eight encrypted variable names already configured in
Cloudflare. Added aliases for the four `SG_*` security settings and separate B2
read/write credential selection. Reads never retry with write credentials,
partial role pairs fail closed, canonical overrides remain explicit, and cached
B2 authorization rechecks bucket restrictions and credential rotation.

Local `npm run check` passes all 53 backend/client tests, the recovered-asset
audit, static build and Pages Functions compilation. Six new regression tests
cover actual login/book-access handlers, precedence/strength checks, split B2
operations, partial pairs, rotation/bucket changes and denied read authorization.
No browser assets or schema changed. The previous verified fourteen browser
cases are recorded below; the compatibility branch's Actions run checks them
again before adoption.

This change is prepared on `fix/existing-cloudflare-secrets`, separately from
main and the live deployment. No Cloudflare settings, secret values, remote
database records or B2 objects were changed. The screenshot does not establish
the presence of `SESSION_SECRET`, bucket identifiers or `DB`, nor the secret
lengths, B2 permissions or live provider compatibility. Follow the deployment
guide with separate test resources before switching production traffic.

## Scope and outcome

The recovered static site was preserved and all 15 observed function routes
were reconstructed. This is a tested reconstruction checkpoint, **not proof of
production equivalence or complete private-data recovery**.

| Check | Result |
| --- | --- |
| Archive integrity/provenance | SHA-256 recorded for both source archives and all 148 recovered public files |
| Retained public files | 148/148 present; 139/148 byte-identical; 9 intentional browser script edits |
| Syntax, JSON, literal static dependencies | Passed; 207 checked literal references resolve |
| Route coverage | 15/15 recorded function paths exist; client endpoint literals covered |
| Catalog evidence | Main empty; one adult series, five unique book IDs, ten cover files |
| HTML structural inspection | Six documents parsed; no duplicate IDs |
| Automated backend/client tests | 47/47 passed locally and in run 36375221866; real SQLite, isolated sessions, mocked B2/Turnstile |
| Private mapping migration generator | Successful restore and stale rerun verified against SQLite |
| Static build | Passed; `dist/` contains public assets, no server/private files |
| Pages Functions compilation | Passed with pinned Wrangler 4.136.3 |
| Local D1 migration and seed | Passed under Wrangler; no remote database touched |
| Dependency audit | `npm audit`: zero reported vulnerabilities on 2026-09-25, including the new Playwright dependency graph |
| Real-browser workflow checks | 14/14 passed in run 36375221866 at be25028; zero failed, flaky or skipped cases |
| Manual visual review | Established public/recovery views plus four new purge/recovery-control captures reviewed; latest run 36375221866; scope below |
| Original EPUB rendering | Out of scope: owner confirmed disposable test data; original files are not a recovery gate |
| Pages/D1 runtime | HTTPS Pages Functions and local D1 verified in CI; this workspace's preview still fails on interface enumeration |
| Live provider integration | Isolated Pages/D1 and owner-reported Keeper login confirmed; B2/media flows pending |
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
6. Permanent purge now uses a documented replacement contract: selected Trash
   removal, durable cleanup, reference protection, exact B2 version deletion and
   visible continuation/errors. No deletion is reported complete without verification.
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
12. Terminal reader error overwritten by loading updates: visual review found
    that background preparation replaced the failure advice with a progress
    message and left the header claiming the volume was opening. Progress now
    updates only the startup paragraph; terminal failures replace placeholder
    header text. The browser case exercises a late preparation after failure.
13. Structurally damaged snapshots: a matching checksum previously allowed
    invalid catalog shapes to be stored before the restore response crashed.
    Snapshots now pass structure/identity validation before restore. Damaged
    records are marked in history, cannot be restored, and can be explicitly
    deleted without affecting other data. New regression cases failed before
    the correction and pass afterwards.
14. Recovery blocked by damaged live data: maintenance previously assumed the
    live document could be parsed and traversed. It now keeps authenticated
    history and revision-guarded restore usable, while ordinary reads/writes
    fail explicitly. Unknown counts and disabled operations are shown in Keeper;
    restore preserves the exact damaged serialization in a safety snapshot.
15. False or incomplete readiness: trash-only books were omitted; static
    recovered covers were treated as absent unless also in B2; uninspected
    candidates after an early match were undercounted. Readiness now checks
    active and trash references, accepts only image asset responses for covers,
    requires B2 for EPUBs, and reports every uninspected candidate as uncertain.
    Retained totals include history beyond the panel's 200-item display limit;
    only the newest three candidate payloads are loaded for readiness. A damaged
    live record always reports recovery required.

## Important remaining limits

- All backend source is new. Original algorithms, bindings, retention rules,
  protection policies and runtime behavior have not been reproduced exactly.
- Five original books are disposable test data, confirmed by the owner; they
  are outside the reconstruction completion criteria.
- D1 is a new authoritative metadata store; it does not update legacy B2 catalog
  JSON. A deployment must explicitly initialize and bind a new database.
- Purge and recovery use new documented semantics. Only explicit Trash jobs
  delete media; orphan uploads are not automatically swept. Retained snapshots
  intentionally keep referenced media until explicitly removed.
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

`public/assets/js/admin/trash-workflow.js`: enable guarded purge, display durable
cleanup progress/errors and retry controls; show unreadable Trash honestly.

`public/assets/js/admin/recovery-readiness-workflow.js`: select a validated recovery
candidate, preserve its displayed revision/checksum and restore with explicit
metadata-only scope and a safety backup.

`public/assets/js/admin/history-workflow.js`: show damaged snapshot status,
disable invalid restores and backup creation from unreadable live data, and
refresh maintenance state after a successful snapshot restore.

`public/assets/js/admin/maintenance-workflow.js`: show unavailable taxonomy and
cover checks when live data is unreadable; preserve access to Catalog History
and refresh health after Trash changes.

`public/assets/js/reader-visual-cache.js`: limit loading messages to the startup
paragraph, leaving nested terminal-error advice untouched.

`public/assets/js/reader/error-presentation.js`: replace the opening placeholder
in the header with a terminal failure label; preserve real book titles.

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

Two subsequent collision regression tests bring the suite to 27. Runs
`36152617517`, `36316012764` and `36316245127` passed the full backend/client
suite and all ten browser cases. The CI workflow runs both suites on every push.

## Visual review completed 2026-09-27

Reviewed the ten captures in [run 36316245127](https://github.com/skypie0102/ShadowGarden/actions/runs/36316245127),
commit `a0b46328e8ad5580bd0d336738d6e810ec8a0281`. The source tree
`6e41d375e06e82b84bc6cceb1118676a82ca4ce0` exactly matched the local tree.
Desktop uses a 1280×720 CSS-pixel viewport; mobile uses Playwright's Pixel 7
profile at 412×839 CSS pixels and device scale 2.625. Six captures were
byte-identical to the already-reviewed reader-fix run; four were inspected anew.

| Screen | Desktop and mobile findings |
| --- | --- |
| Empty main library | Navigation, filters, counts and empty-state copy render as recovered |
| Adult acknowledgement | Notice and both navigation choices fit the viewport; the blank transition capture is resolved |
| Recovered series | Banner, metadata, five cover cards and primary read links render; mobile uses two card columns |
| Missing-book reader | Terminal header, full recovery advice and retry/return controls remain visible after late preparation |
| Keeper series editor | Inputs and footer actions fit the dialog; clean-state disabled save is expected and the workflow verifies later saves |

The screenshot harness waits for cross-document transitions and finite
animations, then captures the rendered page. It does not change application
motion behavior. Modal evidence uses viewport captures; library/series evidence
uses full-page captures. These checks found no additional blocking layout issue
in the reviewed states. They do not establish fidelity to an unrecovered
original screenshot baseline or validate every reader/admin screen.

Artifact `10931210518` (`browser-report`) was downloaded and its SHA-256
`d86611b5a6f8880d60497a8bf8601f473a2951bc1efbbdf96a82d361c595b484`
verified before review. GitHub reports expiry on 2026-10-04; later CI runs
regenerate the same evidence types. Original EPUB rendering, production fonts,
live Turnstile and real B2/D1 integration remain outside this fixture review.

## Recovery verification completed 2026-09-28

[Run 36353932405](https://github.com/skypie0102/ShadowGarden/actions/runs/36353932405)
at [887deb9](https://github.com/skypie0102/ShadowGarden/commit/887deb930e81a3bfab4699714d08876663dd80ec)
passed all 34 backend/client tests and fourteen browser cases in 37.7 seconds.
The report records fourteen expected results, no unexpected failures, flaky
cases or skips. The remote source tree `211b20e3731ed5d326e79533f937f9894ae657ec`
matched the local tree exactly.

The two added workflows run at both screen sizes. They verify that damaged
snapshots remain visible, cannot be restored, and can be individually deleted;
then deliberately damage the isolated fixture's live catalog and restore a
valid snapshot through the real Keeper interface. The tests verify unknown
counts, unavailable checks, recovery-required status, successful restore,
re-enabled controls, all five recovered volumes and an exact damaged safety copy.
Fault injection selects only the harness-created database containing its fixture
session; no app endpoint bypasses catalog validation.

Reviewed the four new viewport captures. Damaged snapshot labels, disabled
restore controls, available delete controls, unknown counts and catalog-recovery
advice are legible on desktop and mobile. This extends the previous five-screen
review; it does not establish an original screenshot baseline or verify every
maintenance state. Provider requests remain fixtures, and real EPUBs are absent.

Artifact `10943312219` contains fourteen successful-page captures. Its downloaded
SHA-256 is `afc51dc37f3f09d988f4c6d7e882051f2ba08b43064a61cd7b6ece8baea043fe`,
matching GitHub's digest. GitHub reports expiry on 2026-10-04 UTC.


## Purge and recovery completion verified 2026-09-28

[Run 36375221866](https://github.com/skypie0102/ShadowGarden/actions/runs/36375221866)
at [be25028](https://github.com/skypie0102/ShadowGarden/commit/be25028ca67f39db45f4dfa97a45901b3f9bf9de)
passed all 47 backend/client tests, the audit, static build, Functions compilation
and all fourteen desktop/mobile cases in 33.8 seconds. Browser results have no
unexpected failures, flaky cases or skips. Remote source tree
`b6b7473c97c36fa493fe8d6c5c239961342e4a74` matched the tested local tree.

The purge workflow removed a real fixture Trash entry, resumed bounded cleanup
through Keeper, retained all ten bundled covers, and restored the five-volume
fixture from a retained snapshot. The recovery workflow restored a damaged live
catalog through the new recovery POST and verified its exact safety copy. Both
migrations ran in real local D1 under Pages in CI. Mock-provider regressions
cover older B2 versions, neighbouring keys, partial failure, Object Lock, stale
requests, references in old/damaged snapshots, in-flight uploads, concurrent
adoption, request budgets and abandoned job leases. No live B2 deletion occurred.

Reviewed four new desktop/mobile viewport captures of completed cleanup and the
recovery action. Counts and explanatory text remain readable; controls fit both
viewports, with mobile actions stacked. Report artifact `10950078953` contains
18 successful-page captures. Its downloaded SHA-256
`4aeee997db1a8ddc4e5f1335c482a190ab1bab363e14194ffb7f5099fc416d5d`
matched GitHub's digest; expiry is 2026-10-05 UTC.

The five original EPUBs are disposable test data per the owner and are no longer
a completion gate. Reconstruction code is complete under the documented
replacement contracts. Production deployment requires migration 0002, configured
secrets/bindings and a B2 key with the required capabilities. Live provider
integration remains a deployment check, not a claim made by fixture tests.
