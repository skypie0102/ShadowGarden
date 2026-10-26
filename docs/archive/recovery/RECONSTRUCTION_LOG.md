# ShadowGarden recovery history

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

Historical record of restoration and initial backend implementation. Current
work is tracked in [project documentation](../../README.md) and
[reader maintenance](../plans/READER_MAINTENANCE.md). Dated evidence and original
hashes below remain for traceability.

## 2026-09-23 — evidence intake and project restoration

Source: the supplied `shadowgarden-static-recovered.zip` and original
`recovered-site.zip`, crawled from `shadowgarden-bon.pages.dev`.

**Recovered:** 148 public deployment files; six HTML pages; CSS, browser JavaScript,
EPUB.js/JSZip bundles, favicon; four catalog JSON files; ten cover images;
data-source and version metadata. Original version 2.11.0, commit
`12e27d7468f1a259419d2ed76aec95a289e7af9f`, branch main.
The dynamic public catalog contains one series and five book identifiers; the
main catalog is empty. Those are the archive contents, not proof that the live
storage account contains no other works.

**Routing evidence:** `recovery-info/FUNCTION_ROUTES.md` transcribes 15 deployed
routes. The raw Cloudflare manifest and worker bundle are not in either archive.
`recovery-info/provenance.json` records archive and original file SHA-256 hashes.

**Inferred replacements:** source organized under `public/`; Pages Functions under
`functions/`; shared backend under `server/`; dependency lock, Wrangler config,
build/audit scripts and tests. Backend contracts come from the recovered client.
Original server source has not been recovered and new implementations must not
be described as identical to it.

**Storage decision:** Backblaze B2 is evidenced by `data/source.json` and the admin
workflows. D1 is a NEW reconstruction dependency for transactional catalogs,
snapshots, revocable admin sessions and rate limits; it is not an inferred original
binding. This prevents racing catalog writes from silently overwriting each other.
Recovered catalogs remain a read-only fallback without a configured database.

**Still missing:** original function code, build scripts and Git history; raw
routing manifest; Cloudflare project/account settings and binding identifiers;
secrets; private book-ID-to-B2-key mappings; five EPUB binaries; historical
backups, trash, and security telemetry. Public book IDs cannot be reversed to
private object paths. No access control is bypassed to obtain those files.

**Repository access:** project instruction names
`https://github.com/shdwmnrchbks/ShadowGarden`; authenticated lookup returns 404
and git cannot authenticate. Repository discovery also finds a new empty
`skypie0102/ShadowGarden` with write access. Destination clarification was pending at that checkpoint; see the publication
entry below. No existing remote history has been overwritten.

Implementation and audit results are appended as work completes.

## 2026-10-15 — Continuous image-focus position preservation

- Fixed image-focus return in `reader/image-focus.js` and connected it to the
  active rendition/flow in `reader/app.js`. The overlay now captures the live
  Continuous content anchor and inner-frame scroll offsets before opening.
- Closing with X, desktop double-click, touch return or Escape restores the
  passage through the existing mutation-free Continuous geometry helper. It
  does not call `display()` or `currentLocation()` or reload saved progress.
  Restoration covers focus movement and the next paint; chapter buffering can
  change absolute scroll offsets without losing the visible passage.
- Fixed the cleared asynchronous focus-return target. Pending focus/restoration
  callbacks are invalidated when Reader resets input for navigation or a flow
  switch, and old snapshots cannot move a replacement rendition.
- Added seven regression tests for close controls, nested scrolling, buffering,
  touch compatibility clicks and
  navigation cancellation, plus desktop/mobile browser scenarios using an
  original generated EPUB and the real recovered Reader layout and runtime.
- Local asset audit, all 70 backend/client tests, static build and Functions
  compilation pass. The old focus implementation fails the new position-return
  regressions. All 20 Playwright desktop/mobile cases pass in GitHub CI run
  `38734664627`, including the real EPUB layout, zoom/pan, both close paths,
  repeated image visits and chapter expansion. Chromium ran in CI because its
  download was unavailable locally.
- The owner explicitly authorized GitHub publication, Cloudflare browser checks
  and deployment on 2026-10-15, resolving the earlier automatic approval blocks.
  Local checks were repeated successfully. Cloudflare's standalone browser
  requests did not return a result, so browser verification completed in GitHub
  CI. Published to `skypie0102/ShadowGarden` on `deploy/shadowgarden-bon`;
  production remains the existing `shadowgarden` Pages project.
- The first GitHub browser run passed all desktop scenarios and 18/20 cases.
  Mobile traces exposed an opening-touch compatibility click dismissing the
  overlay, plus a test using mouse input on the touch device. Added a short
  opening-click guard and its client regression; the mobile pan now uses native
  touch events. The complete rerun passed before production deployment.
- Deployed verified source `9daea7f481ae1f19cc3d0640b83b20d424eab794` to the existing
  `shadowgarden` Pages project on 2026-10-15 at 12:31 UTC. Production deployment
  `dfac687d-06fa-4bc5-9f3f-6eae5a9f4a33` serves the original hostname.
- Live browser checks confirm the version commit and byte-identical hashes for
  both changed reader modules. The homepage, reader page, Keeper/public login
  challenges and both current D1 catalogs return 200. The main catalog is empty
  and the adult catalog contains one series. No secrets, bindings, B2 objects or
  catalog records were modified by this reader fix or its verification.

## 2026-09-23 — backend reconstruction

- Implemented all 15 observed routes, with method restrictions, JSON errors,
  same-origin checks and authenticated admin access.
- Added server-side Turnstile action/hostname verification, signed human/admin
  sessions, admin revocation, exact-object book tickets and protected media.
- Reconstructed B2 native API reads/uploads and D1 catalog mutations, backups,
  trash restore, translations, banner selection, taxonomy and cover maintenance.
- Added persistent pseudonymous cooldown telemetry. This is an inferred basic
  policy; the original tripwire scoring rules and telemetry were not recovered.
- Permanent purge and the undocumented recovery POST explicitly return 501.
  Purge controls are disabled; neither operation pretends to have succeeded.
- Patched the recovered admin core for revision guards and immutable upload keys.
  Book replacement preserves public identity and snapshots' original media.
- Added bounded EPUB ZIP validation, upload key reservation and an offline,
  revision-guarded private mapping restore generator.
- Restored build scripts, pinned package lock, a local Wrangler configuration,
  an explicit D1 seed, CI and deployment documentation. Original versions and
  build settings remain evidence-only, distinct from the new configuration.

## 2026-09-23 — audit checkpoint

- Passed asset/syntax/JSON audit: 148 recovered files, 146 byte-identical,
  two documented modifications, 207 literal references and 15 route files.
- Passed all 22 backend tests with real SQLite and mocked provider APIs.
- Verified the private mapping generator's successful and stale revision paths.
- Parsed six HTML documents with no duplicate IDs.
- Built static output and compiled Pages Functions successfully.
- Executed the initial D1 migration and idempotent seed locally. No original
  database or live B2/Cloudflare resource was mutated.
- npm reported no dependency vulnerabilities at this checkpoint. This does not
  audit recovered vendor bundles against their missing original lockfiles.
- Full preview/visual QA is blocked by environment limitations: Wrangler dev's
  network-interface enumeration failed; direct Miniflare probes stalled and were
  stopped; Chromium was unavailable and its download was invalid/truncated.
- Real B2/Turnstile integration and the missing original EPUBs remain unverified.
- Added `docs/guides/API_CONTRACTS.md`, `docs/operations/DEPLOYMENT.md`, `docs/archive/audits/AUDIT.md` and
  `docs/archive/recovery/MISSING_COMPONENTS.md` with explicit recovery boundaries.

## Resume point

This checkpoint is recorded as a new local Git root commit; the original Git
history is not present. A source archive with a Git bundle preserves the checkpoint
while remote publication is blocked. The earlier project instruction named `shdwmnrchbks/ShadowGarden`, which
returned 404 on two authenticated checks. `skypie0102/ShadowGarden` is connected,
empty and writable. The user’s subsequent “continue” authorizes proceeding with
that proposed destination. The next
production step is to restore actual bindings and private media/mappings, then
perform real-browser and provider integration checks before switching traffic.

## 2026-09-23 — publication resumed (UTC)

- Continued with `skypie0102/ShadowGarden` after the user’s response to the
  destination question. Verified it is still empty and the connection has write access.
- The reconstructed source checkpoint is `ce2b14a1c5ebae6c7884d3ddcfe94802b05b372a`.
- Publication uses GitHub’s authenticated Git API because this workspace has no
  shell Git credential helper. Remote commits therefore receive new identities;
  file/blob hashes will be compared to the local tree to verify exact content.
- No original Cloudflare deployment, database, B2 bucket or private book was changed.

## 2026-09-23 — publication verified (UTC)

- Published all 197 project files to `skypie0102/ShadowGarden`, branch `main`.
- Reconstruction commit: `20dd2ec78939f42638e0758f8f510f21675372f4`.
- Remote tree: `4e5be36752df1177242f40a374eb7fa0c7295737`, exactly equal to the
  local publication tree. All ten binary image blob hashes also matched.
- GitHub Actions run `35930710273` passed installation and `npm run check` on
  Ubuntu with Node 24, including all 22 tests, asset audit, static build and
  Pages Functions compilation.
- Local `main` now tracks `origin/main`. The earlier local commit history remains
  on `reconstruction-local-checkpoint` and in the previously saved Git bundle.
- The repository is recovered to this documented checkpoint. Private EPUBs,
  original object mappings, production credentials, browser/live-service QA and
  the unsupported recovery/purge semantics remain outstanding. No production
  Cloudflare deployment or original storage was modified.

## 2026-09-25 — continuation: editor concurrency and runtime verification

- Reconfirmed the published `skypie0102/ShadowGarden` main checkpoint `61b4a35`.
- Recovered evidence is unchanged: 148 public files, one series, five book IDs,
  ten covers, and the route transcription. No new private media/source was found.
- Found and fixed a reconstruction defect: background admin reads could advance
  the revision used by an older open editor. Forms now retain their displayed
  revision, and explicit caller preconditions are no longer overwritten.
- Added three client-to-backend regression cases. All 25 local tests, the asset
  audit, static build, and Pages Functions compilation pass. The newly edited
  library workflow is documented: 145 of 148 recovered files remain identical.
- Added pinned Playwright 1.63.0 and ten desktop/mobile browser cases against
  real HTTPS Pages Functions and a disposable local D1 database. No application
  API response is mocked; signed fixture sessions isolate live Turnstile from
  this test scope. Production credentials/resources are never loaded.
- GitHub Actions now installs Chromium, executes these cases, and retains reports.
  Browser test execution is pending at this commit. Local interface enumeration
  still fails with `uv_interface_addresses`, so the CI runner will resolve that
  environment-specific gap.
- Still missing: original EPUBs/object mappings, credentials, original backend
  sources/history, live provider verification, and undocumented purge/recovery
  semantics. The harness does not invent any of these components.

### First browser run and follow-up corrections

- Run `36122693738` successfully launched Chromium and the real Pages runtime,
  but the ten cases failed. The harness omitted `package.json` in its temporary
  project; Wrangler consequently resolved its compiled worker's configuration
  from the parent project and lost the fixture bindings. The package boundary is
  now copied along with the app. A selector also counted both cover and read links;
  it now selects the five primary read links.
- The mobile case exposed a genuine recovered-client bug: library initialization
  replaced the query string before acknowledgement, dropping the series return
  destination. The gate now captures that destination beforehand and rejects
  external destinations. The test waits for catalog initialization deliberately.
- Documented the fourth recovered script edit; 144/148 original files are now
  byte-identical. Corrected deployment instructions after inspecting the pinned
  Wrangler source: Pages commands do not accept arbitrary config paths.
- The follow-up CI run must verify these corrections; no passing browser result
  is claimed yet. Production resources remain untouched.

### Second browser run

- Run `36123276345` correctly loaded all fixture bindings and passed eight of ten
  browser cases, including desktop/mobile navigation, the corrected adult gate,
  explicit missing-book denial, and trash restoration against real local D1.
- Both admin cases proved stale saves return 409, then timed out on the retry:
  the test filled the reopened form while its recovered dirty-state layer still
  displayed “Loading series…”. The harness now waits for “No changes” before
  editing and accepts the expected conflict alert as soon as it appears.
- This is test synchronization with the existing readiness indicator, without
  forcing disabled buttons or weakening the expected conflict/success checks.

### Browser verification completed and visual evidence added

- Confirmed main at `929c5d59142e2ce049085d0c9d347c3ad5ffe4d1` and inspected
  GitHub Actions run `36123630092`, job `108034635056`. All 25 backend/client
  tests and all ten desktop/mobile browser cases passed; the browser suite
  completed in 19.8 seconds without retries. Asset audit, build and Functions
  compilation also passed.
- The two stale-editor cases now prove both conflict rejection and successful
  save after a fresh load. This closes the interrupted browser-test checkpoint.
- Updated the audit/deployment documentation to remove stale pending-CI claims.
- Added successful-page screenshot attachments for five screens on desktop and
  mobile to make the outstanding visual review possible from CI artifacts.
  Screenshot review is pending at this commit. The harness blocks third-party
  requests, so these captures use fallback fonts and do not verify live services.
- Kept this work in an isolated Git worktree after independent upload-test edits
  appeared in the shared checkout; those edits were left intact.

### Continued catalog identity audit

- Reproduced two more reconstruction defects: an EPUB replacement could reuse
  another book's mapped object; a trash restore could duplicate an identity
  already re-cataloged under a different series. Both returned 200 in failing
  regression tests before the fixes.
- Added server guards returning 409 before mutation. Replacement preserves the
  existing distinct mappings, and both series/volume restore conflicts preserve
  the trash item and catalog revision. No media is deleted or remapped silently.
- All 27 local backend/client tests now pass, including both new regressions;
  the asset audit, static build and Functions compilation also pass.
- Full `npm audit` reports zero vulnerabilities on 2026-09-25. This covers the
  new dependency graph, not the recovered vendor bundles' missing provenance.
- Updated the API contract, deployment guide, audit and missing-components matrix
  to distinguish verified browser workflows from still-missing private resources.
- Recovered evidence remains 148 files (144 byte-identical), 15 function routes,
  five original book IDs and no recovered EPUB bytes/private mappings. Backend
  changes remain inferred replacements, not newly recovered original source.
- Integrated remote checkpoint `3ebea88` before publication, retaining its
  successful-page screenshot captures and audit documentation.

### Screenshot review found a terminal reader-state defect

- Published the render-evidence update as `3ebea88`. Run `36152151140` passed
  all 25 backend/client tests and all ten browser cases, with zero failures,
  retries, flaky cases or skips. Its artifact contains ten screen captures.
- Downloaded artifact `10871678757` and verified its SHA-256 against GitHub's
  digest before inspecting all ten captures. The public library, series cards,
  acknowledgement and Keeper editor render at both tested sizes.
- Reader captures exposed a real defect in the recovered client: asynchronous
  visual preparation overwrote terminal error advice with loading text, while
  the header continued to say the book was opening. Restricted progress writes
  to the original startup paragraph and changed the opening header placeholder
  on failure. Added a browser regression that triggers late preparation after
  authorization failure and checks the complete advice and terminal header.
- Screenshots now start from the top of the page; modal captures use the viewport
  to avoid misleading full-page artifacts from fixed overlays. No application
  layout or acknowledgement behavior was changed for these capture adjustments.
- There are now six documented recovered-script edits and 142/148 byte-identical
  files. The reader fix and refreshed screenshots await the next CI run.
- Integrated the independently published identity guards at `35b323f` before
  publishing this reader fix, retaining both regressions and all audit entries.

## 2026-09-27 — reader verification resumed

- Reconfirmed remote main at `35b323f`; its complete CI run `36152617517` passed.
  The local reader fix was preserved at `20c4e23`, already based on those guards,
  and the combined local backend/client suite had passed all 27 tests.
- Resuming publication and browser verification of that exact reader fix. No
  original private resources have become available since the previous checkpoint.

- Published the reader fix as `6680298`; run `36316012764` passed all 27
  backend/client tests and all ten browser cases (25.3 seconds, no retries).
  The source tree `6ca19a3b6a9c69e9ee235b0a6040ccf9ca9d9cb9` exactly matched
  the local tested tree. Refreshed reader captures confirm that late preparation
  leaves the terminal header and complete recovery advice intact at both sizes.
- One desktop acknowledgement screenshot captured a blank transition frame,
  although the workflow passed. Capture readiness now awaits the actual
  cross-document transition and finite animations before saving screenshots.
  This changes the harness only; application motion behavior is preserved.

### Final browser and visual verification

- Published capture synchronization as `a0b4632`; run `36316245127` passed the
  complete checks, including all 27 backend/client tests and ten browser cases.
  The browser report records zero failures, flaky cases or skips. The remote
  source tree `6e41d375e06e82b84bc6cceb1118676a82ca4ce0` matched locally.
- Verified artifact `10931210518` against GitHub's SHA-256 digest
  `d86611b5a6f8880d60497a8bf8601f473a2951bc1efbbdf96a82d361c595b484`.
  Reviewed all ten screen states: six images matched the preceding reviewed
  run byte-for-byte; four were inspected anew. The desktop acknowledgement
  capture now shows the page correctly, and both reader captures retain the
  repaired error header and advice. No further blocking layout issue was found
  within the five-screen desktop/mobile scope.
- Updated the audit, deployment guide and recovery matrix to record this result
  and separate completed fixture review from original-book/live-provider checks.
  The two original recovery archives remain the evidence source; no private
  EPUBs, original server source or new production credentials were recovered.

## 2026-09-28 — snapshot integrity and usable recovery

- Reproduced malformed-snapshot failures in the replacement backend: maintenance
  could crash while listing one, and a checksummed but invalid document could
  be written to the live catalog before the restore response failed.
- Added shared validation for the reconstructed catalog shape, unique active
  identities, private media coordinates and embedded trash records. Missing
  original private mappings are still allowed as metadata; no keys were invented.
  Invalid snapshots are listed as damaged and rejected before restore, while
  explicit deletion can remove the selected damaged snapshot.
- Kept authenticated history, readiness and the existing snapshot restore action
  available when live data is unreadable. Ordinary catalog access fails with a
  clear error. A valid restore retains revision protection and atomically saves
  the exact damaged record in a safety snapshot. Keeper shows unknown counts and
  unavailable checks instead of reporting an empty or healthy catalog.
- Reproduced false readiness for snapshots containing missing trash-only books.
  Readiness now includes recoverable Trash, validates structure and checksums,
  accepts exact static image assets for recovered covers, and requires B2 for
  EPUBs. It counts all uninspected snapshots as uncertain, including after an
  early match. Damaged live data reports recovery required even with an anchor.
- All seven new regression cases failed against the previous implementation.
  The corrected backend/client suite passes 34 tests, and the asset audit,
  static build and Functions compilation pass locally. The fourteen-case
  desktop/mobile suite now exercises damaged snapshot deletion and restores a
  deliberately damaged catalog in its isolated D1 fixture. CI verification and
  review of the new recovery captures are pending publication.
- Preserved all 148 recovered files; 140 remain byte-identical. History and
  maintenance add two documented script changes; the existing trash adaptation
  now distinguishes unreadable metadata from an empty Trash. No new original
  backend source, EPUBs, private mappings or production bindings were recovered.
  These changes improve the inferred replacement; permanent purge and the
  undocumented recovery POST remain explicitly unavailable.
- Published the implementation as `d2e943c`; the remote Git tree exactly matched
  the local tested tree. Run `36353495881` passed all 34 backend/client tests and
  twelve of fourteen browser cases, including damaged-snapshot management at
  both sizes. The live-recovery cases stopped before fault injection because the
  test helper expected one SQLite file; Wrangler also creates `metadata.sqlite`.
  The helper now inspects candidates read-only and selects the unique database
  containing the disposable session. Application behavior is unchanged by this
  harness correction; the two live-recovery cases still await verification.
- Run `36353672642` at `9222d74` reached live-catalog recovery successfully on
  both screen sizes: the restore returned 200, volume count returned to five and
  backup creation was re-enabled. Both cases then failed on an overly specific
  empty-Trash caption assertion: the recovered flavor script rewrites that text.
  The test now checks the empty count and healthy empty-state element, leaving
  the recovered presentation unchanged.
- Extended the retained-count regression past the history panel's 200-entry
  limit and reproduced another undercount. Readiness now obtains the full count
  and only its newest three candidate documents in one SQLite query, preserving
  a consistent count while avoiding loading all retained snapshot payloads.
- Published the completed recovery checkpoint as `887deb9`. Run `36353932405`
  passed all 34 backend/client tests and all fourteen browser cases in 37.7
  seconds, with no failures, flaky cases or skips. The remote tree
  `211b20e3731ed5d326e79533f937f9894ae657ec` matched the local tested tree.
  Both desktop/mobile recovery cases verified the five-volume catalog and the
  exact damaged safety snapshot after restoration.
- Downloaded artifact `10943312219` and verified its SHA-256
  `afc51dc37f3f09d988f4c6d7e882051f2ba08b43064a61cd7b6ece8baea043fe`.
  Reviewed the four new recovery viewport captures: damaged snapshot status,
  disabled restore controls, unknown counts and recovery advice remain legible
  at both sizes. The report also contains the ten established public/editor
  captures. Updated the audit, API contracts, deployment guide and recovery
  matrix with the verified outcome and unchanged original-resource gaps.

## Remaining operations completed — 2026-09-28

The owner clarified that the five EPUBs were disposable tests and requested that
remaining code issues be resolved. Implemented replacement purge and recovery
contracts instead of waiting for unrecovered original retention policies.

- Added migration 0002 with durable cleanup jobs, atomic reference checks and
  permanent media retirements. Live catalog, all retained snapshots (including
  damaged/old ones), active uploads and bundled assets protect referenced bytes.
- Purge removes selected Trash under an explicit revision guard. B2 cleanup
  processes exact-name versions in bounded, resumable batches, respects provider
  retention and never claims failed deletions succeeded. Keeper exposes progress,
  failure detail and retry controls. No production objects were deleted.
- Recovery POST validates the selected snapshot ID/checksum and live revision,
  then atomically restores metadata with an exact safety copy. Keeper offers the
  validated candidate even when its media is incomplete. Both old 501 stubs are gone.
- Added optional empty initialization without overwriting existing data. The
  recovered demo seed remains available and is used by the isolated browser suite.
- Local checks pass 47 backend/client regressions, asset audit, build and Functions
  compilation. All 148 recovered files remain present, 139 byte-identical with
  nine documented browser-script edits. Browser CI and new visual review follow.

## Completion checkpoint — 2026-09-28

Published implementation `be25028` to `skypie0102/ShadowGarden` main. The remote
source tree `b6b7473c97c36fa493fe8d6c5c239961342e4a74` matches the tested local tree.
Run `36375221866` passed all 47 backend/client tests, the asset audit, build,
Functions compilation and all fourteen desktop/mobile browser cases in 33.8
seconds. No failed, flaky or skipped browser cases remain. The real Pages/D1
fixture verifies purge, continuation, retained covers and snapshot recovery.

Downloaded report artifact `10950078953`; verified SHA-256
`4aeee997db1a8ddc4e5f1335c482a190ab1bab363e14194ffb7f5099fc416d5d`.
Reviewed the four new purge/recovery-action captures at both viewport sizes.
The report contains 18 successful-page captures and expires 2026-10-05 UTC.

The requested reconstruction and remaining code fixes are complete under the
documented replacement contracts. Both previous 501 operations now work. The
five original test EPUBs are explicitly out of scope. All 148 recovered files
remain, 139 byte-identical, with nine documented browser-script adaptations.

Production setup still needs owner-provided Cloudflare/B2/Turnstile resources.
Apply all migrations, including 0002, before deployment; supply scoped B2
list/delete capabilities for explicit cleanup. No production deployment,
remote database mutation or live B2 deletion was performed. The documentation
commit following be25028 records this verified outcome without changing code.

## Existing Cloudflare secret names — 2026-10-01

The owner supplied a Variables and Secrets screenshot containing four `SG_*`
security names and separate B2 read/write key pairs. Values remain encrypted.
Prepared `fix/existing-cloudflare-secrets` from `f8cc6c6` to accept those names
without changing the live deployment or main. Canonical reconstruction names
remain supported with explicit precedence. B2 downloads use the read pair;
uploads and cleanup use the write pair. Partial pairs fail closed; authorization
failures never fall back to the opposite role. Cache tests cover rotation and
changed bucket restrictions.

Local `npm run check` passes all 53 backend/client cases, recovered-asset audit,
static build and Functions compilation. Six new regression tests use isolated
SQLite and mocked providers. No browser assets, routes or migrations changed;
148 recovered files remain, 139 byte-identical with nine documented adaptations.
The compatibility branch's GitHub Actions run supplies the follow-up browser
check; the previous production-reconstruction checkpoint remains recorded above.

Updated the example configuration, deployment guide and API contracts. The
screenshot does not show the replacement's independent `SESSION_SECRET`, B2
bucket name/ID or D1 `DB` binding. Secret lengths and provider permissions are
unverified. Next obtain the non-secret binding inventory and configure an
isolated test deployment before considering a production switch. No account
secrets, remote database state or live storage objects were modified.

## Isolated test database supplied — 2026-10-01

The owner showed the live Production bindings list as empty, then created D1
`shadowgarden-test` with ID `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86`. Its overview
showed zero tables and zero queries. Prepared `deploy/shadowgarden-test` from
compatibility commit `368b6e1` with that database bound as `DB`. This branch has
test-only resource configuration; main and compatibility PR #1 remain separate.

Added Windows initialization steps using tracked Wrangler migrations and the
empty seed, plus the later separate Pages/B2/Turnstile setup. No remote database
operation, Cloudflare deployment, secret change or B2 operation was performed.
The supplied D1 ID is a resource identifier, not a credential. Actual migration
execution and provider integration remain unverified until the owner runs setup.

Validated the exact resource fields, both migrations and the empty-library
verification query in isolated SQLite. The pinned Wrangler Pages Functions
compiler passes with this configuration. No application code changed.

## Test database initialized by owner — 2026-10-02

The owner supplied Wrangler 4.136.3 output identifying the intended D1 UUID and
showing successful remote application of `0001_reconstructed.sql` and
`0002_media_purge.sql`. The subsequent empty seed processed one query and wrote
one row. This confirms test database initialization from owner-provided output;
no independent remote SELECT was performed here.

PowerShell had blocked `npm.ps1` despite Administrator mode. Switching the guide
to `npm.cmd` and `npx.cmd` allowed setup without changing the execution policy.
Updated the test guide with the completed initialization, exact new Pages build
settings, and expected initial credential-configuration state. Test commit
`1811668` already passed all 53 backend/client and 14 browser checks in Actions
run `36844551820`. This follow-up changes documentation only. The new test Pages
project and real B2/Turnstile checks remain next; main and the live project are
unchanged by this work.

## Test Pages and Keeper confirmed; B2 authorization updated — 2026-10-02

The owner deployed `shadowgarden-test.pages.dev`, entered the security secrets,
and successfully retried deployment. Independent HTTP checks confirmed the
empty D1 catalogs, then 200 responses from both challenge endpoints with their
expected actions. The owner reported that Keeper opened normally. Secret values
were never collected. Test B2 upload/read, media signing, backup/restore and
cleanup remain pending separate disposable storage.

While preparing B2 setup, current provider documentation confirmed that
bucket-group application keys require v4 authorization and fail against v2.
Updated the backend to v4, reading endpoints/restrictions from
`apiInfo.storageApi` and verifying the configured bucket against `allowed.buckets`.
Legacy keys are supported by the provider's v4 endpoint. Invalid/missing
authorization data, mismatched buckets and untrusted endpoints fail before
storage operations; existing role separation and cache rotation checks remain.

All 57 local backend/client tests pass, including four new compatibility/error
cases. Existing upload, reader, recovery and purge tests now use v4 provider
fixtures. Asset audit, static build and Pages Functions compilation pass.
Updated deployment/API/audit documentation and the completed test setup status.
No browser assets, schema, test resource identifiers or production configuration
changed. This fix is prepared on the isolated `deploy/shadowgarden-test` branch.

## Existing production takeover prepared — 2026-10-02

The owner explicitly authorized replacing `shadowgarden-bon.pages.dev` and
reusing the existing private B2 bucket, instead of creating another bucket.
Cloudflare access confirmed that the Pages project name is `shadowgarden`, all
eight original encrypted variables remain configured, and its original Git
repository is `shdwmnrchbks/ShadowGarden`. Cloudflare ignored a source-repository
change through the API; automatic production/preview builds from that old
repository are now paused. The previous production deployment is recorded in
`docs/archive/recovery/PRODUCTION_TAKEOVER.md` for rollback.

Read-only D1 queries independently confirmed both migrations and the empty
revision-0 library. Prepared `deploy/shadowgarden-bon` with the real project
name, existing bucket name/ID and initialized D1 binding. This reuses the same
database as the test Pages project, so test writes must now be treated as live
data changes. No B2 files are deleted by this configuration change.

Static build and Pages Functions compilation pass with the production config;
the backend remains the version already covered by 57 backend/client tests and
14 browser tests. Production deployment and live checks follow this preparation.

## Production deployed; B2 runtime failure corrected — 2026-10-02

Deployed commit `26bacb7` into the existing Pages project `shadowgarden` as
production deployment `e9d4306a-a4db-4aed-a4a9-d3b28458dc39`. It serves the original
`shadowgarden-bon.pages.dev` URL. All original secrets were preserved and the
missing independent session secret was generated securely in Cloudflare. Live
checks confirmed the new version, homepage, both challenge endpoints and empty
D1 catalogs. The existing Turnstile widget already allows the original hostname.

Paused the orphaned Workers build configuration after confirming the account has
no Worker scripts. This fixes future unrelated failed build notices while Pages
continues serving normally.

A public, read-only missing-cover probe returned `storage_unavailable`. The
cause was `redirect: 'error'`, rejected by workerd before network access. Replaced
it with manual redirects and explicit rejection of all 3xx responses. A local
Cloudflare runtime reproduced the old 502 with zero provider requests, then
served fixture bytes and rejected a redirect with the fix. All 59 backend/client
tests pass, including two added regression cases covering provider redirects.
No real B2 file was created or deleted during this diagnosis. Corrected
production deployment and live storage verification follow this commit.

## Storage correction deployed after connector interruption — 2026-10-03

The GitHub write never completed. Its eventual error reported that the tool
catalog changed after the call was prepared, despite owner approval. The remote
branch and production site were independently rechecked and still used `26bacb7`.

Deployed the already-tested Functions bundle directly to the existing Pages
project as `f8844be0-ae68-4e72-969d-c0812f03109d`, with `commit_dirty: true` and a
message recording the pending GitHub sync. Cloudflare confirmed production
success at 00:39 UTC. The homepage, both challenge endpoints and D1 catalog pass.
The live B2 missing-cover probe now returns the expected `media_not_found` 404,
confirming provider authorization and read lookup work with the original keys.
No B2 objects were created or deleted. Real Keeper upload, protected reader and
write/delete permissions remain to be verified with the owner's login.

## Keeper login credential compatibility — 2026-10-03

The owner reported that Keeper login failed with "Server security is not
configured." Production had all required secret names and the session/Turnstile
challenge worked; the protected library endpoint failed the administrator-token
configuration gate. This gate reused the signing-key helper and rejected an
existing login token shorter than 32 characters.

The login credential is now checked for nonempty text and still compared exactly
using the independent session HMAC key. Signing-key length requirements,
Turnstile, rate limits, and session validation remain enforced. Missing or blank
login credentials fail during the initial admin challenge and before counting
a login attempt. All 61 backend/client tests pass, including added complete
legacy-token login/session and fail-closed configuration cases. Secret values
were neither inspected nor changed. Production redeployment follows this fix.

## B2 upload endpoint compatibility — 2026-10-03

The owner confirmed login after deployment `12b99509-604b-4566-a0eb-330864686b27`
and reported that uploads still failed. Read-only production checks confirmed
the intended bucket and secret names, an upload reservation after EPUB validation
and the B2 read check, and no catalog insertion.

The storage URL validator incorrectly rejected Backblaze's documented
`pod-*.backblaze.com` upload servers. Reproduced the 502 with fake credentials
in both a regression test and the pinned Cloudflare runtime. Allowed those HTTPS
pods only for provider-issued upload URLs, retaining separate API/download host
checks, exact returned paths/queries, and refusal of redirects and unsafe URLs.
The same runtime then completed the fixture upload. All 63 backend/client tests
pass; upload/catalog fixtures now use realistic pod hosts. Existing B2 secrets,
bucket settings and objects were unchanged. Production deployment and the
owner's authenticated upload retry follow this correction.

## Reader refactor — first milestone verified — 2026-10-15

Created `refactor/reader-foundation` from the deployed reader source and recorded
the phased plan, invariants, ownership map and issue register in
`docs/archive/plans/READER_REFACTOR_ROADMAP.md`. The first milestone replaces six global
`window.ePub` wrappers with explicit ordered extensions and one application
engine API. Initialization is idempotent and rejects unsupported runtime shapes
before installing integration behavior. The recovered vendor bundles are
unchanged; manager compatibility remains inside the integration boundary.

Ten new browser cases exercise the production reader HTML, authorization client,
bootstrap, full extension stack and UI with generated original EPUBs and isolated
network fixtures. These exposed and verified fixes for skipped external SVG
artwork, iframe hash scrolling that undid internal-link navigation, and fragment
CFIs with element/text offset mismatches. Removed duplicate legacy TOC capture
and routed internal links through the app's active navigation owner. Seek,
relayout, resume and lifecycle consolidation remain later milestones.

Source `5d3856ecf7000fa47714a5e38df0445d2e8f74e9` passes all 79 Node tests and
30 desktop/mobile Chromium browser cases in clean GitHub Actions run
`38743863205`, plus the recovered-asset audit, static build and Pages Functions
compilation. Broader browser engines, mid-passage reflow and lifecycle cases are
explicitly tracked rather than claimed as covered. The temporary CI runtime
export used to debug the restricted local environment has been removed.

The milestone is in draft PR #2, targeting `deploy/shadowgarden-bon`. It is not
merged or deployed. No production storage, database, secrets or Cloudflare
settings changed during this refactor. `docs/guides/READER_ARCHITECTURE.md` describes
the current engine boundary and remaining compatibility bridges.

## Reader navigation and position refactor — 2026-10-16

The foundation milestone was merged into `main` through PR #2 as
`b99e76a4198d032b746676fe9cc286ead3793056`; main's CI passed. Continued on
`refactor/reader-navigation`, with main retained as the destination for each
verified milestone.

Navigation now has revision-tagged cancellation, multiple tracked barriers and
an ordered vendor move queue. Chapter/link/footnote navigation, progress seeking,
page turns, startup fallbacks, mode replacement and resume recovery share the
application owner. Rapid page turns accumulate intentionally; a later chapter
selection cancels queued turns. Delayed target resolution, generated-location
refinement, renewal and stale startup fallback cannot replay an older request.

Production-entry checks exposed additional interaction bugs. Removed the legacy
core listeners that swallowed progress input and the 750 ms display suppression
that discarded deliberate Continuous settling. The engine now supplies explicit
buffer settlement. Continuous captures avoid the mutating vendor location call;
mode changes preserve precise CFIs, settings reflow freezes its first live
anchor, and resize recovery retains the last stable viewport across the browser
reflow boundary. Image-return snapshots also check navigation revision. Footnote
markers use history replacement/rotation, and delayed notes respect newer
navigation. Continuous 100% seeks resolve to the last content anchor.

All 111 Node tests (48 reader cases), the asset audit, static build and Pages
Functions compilation pass locally. The expanded 46-case desktop/mobile Chromium
suite passes locally. Source `145d426` is published in PR #3. The first clean
CI run passed 45/46 cases and exposed an overstrict mobile mode assertion:
a centered paragraph was expected instead of the retained tracking-line passage.
The test now samples the actual pre-change visible anchor in each flow; clean
CI then exposed a separate ordering race: a mode request could preempt a
still-settling chapter navigation and capture the old passage. Mode replacement
now finishes the existing positional request before capture; the viewer exposes
an accessible navigation busy state. A same-turn chapter/mode regression
expands the full browser matrix to 48 cases before merge.

The next CI run passed 46/48 and isolated another position-contract bug:
vendor Page mapping starts at text and can omit a visible leading illustration.
Paginated capture now samples visible blocks in reading/column order and retains
a leading visual CFI, while text-first pages keep the live vendor CFI. Two
focused positive/negative tests expand the Node suite to 113 cases (50 reader
cases). All ten targeted desktop/mobile mode cases pass after this correction.
Tests exclude offscreen page-map frames and check clipped parent geometry plus
hit surfaces for translated vendor columns, whose Chromium IntersectionObserver
ratios can incorrectly be zero while the text is visibly rendered.

No backend, production storage, database, secret or deployment configuration was
changed. Production remains on the prior deployed image-focus fix. Uniform
session/controller disposal, interrupted startup, repeated create/destroy and
long-book profiling remain the subsequent roadmap phases.


Final source `a1262eec57ee0b87030a8ce5893245de9183ddd6` passes all 113 Node tests,
all 48 desktop/mobile Chromium browser cases, the asset audit and both builds
locally and in clean GitHub runs `38782520185` and `38782528728`. PR #3 merged
this milestone into `main` as `f20e47e772865e89713ef8c66562da9452420cb0`.
The completion checkpoint updates documentation only. Phase 2 is complete;
Phase 3 begins with uniform session/controller disposal and repeated lifecycle
verification. No Cloudflare production deployment was performed.

## 2026-10-16 — Reader refactor completed and released as v2.12.1

Phases 3 and 4 merged through PRs #4 and #5, establishing session/controller
ownership, cancellable vendor work, shared chapter-source leases, bounded caches
and sanitized diagnostics. The measured source-retention and repeated-artwork
improvements are recorded in `docs/archive/completed/READER_PERFORMANCE.md`.

Phase 5 merged through PR #6, adding the five-configuration browser matrix,
EPUB 2/multilingual/damaged-resource checks and visible release/commit details
in both libraries. Release verification also corrected Firefox measurement-frame
throttling, WebKit visual-cache persistence, late vendor work, layout settlement
and the Continuous scroll callback collision. PR #7 corrected native WebKit
bookmark clicks interrupted by progress updates.

PR #8 merged the owner's mobile image-touch follow-up and v2.12.1 as
`154381761d6bec1fa246166f0ba300f09471d6ab`. Source images and the focused-image
surface now use transparent native touch feedback while preserving keyboard
focus indicators. The full-reader regression checks the declared artwork color,
native feedback and return position; the previous reader fails the touch-feedback assertion.
Both clean GitHub runs `38878393099` and `38878389285` pass all 159 Node tests,
215 browser cases, the audit and both builds.

Production deployment `5658687a-f60a-4a1f-8441-78738c2b04e1` succeeded on
2026-10-16 at 09:18 UTC. Live asset hashes match the merged source. Desktop and
mobile checks confirm `v2.12.1 · 1543817` is visible in the main and NSFW footers;
image zoom/close returns with zero displacement and no page errors. Login
challenge endpoints and both catalogs return 200; unauthenticated admin library
access returns 401. No remote catalog/media or secret changes were performed.
The roadmap marks Phase 5 and the planned refactor complete; the release report
records provider/device limits and both retained rollback deployments.

## 2026-10-16 — Correction: v2.12.1 withdrawn after deployment binding loss

The owner reported book/login failures and deleted books returning. Inspection
confirmed that deployment `5658687a-f60a-4a1f-8441-78738c2b04e1` omitted the D1
binding and both bucket variables. The compile command did not load production
configuration, but the manual upload supplied a Wrangler configuration hash.
The database-free backend then returned recovered catalog entries with HTTP 200.
The previous completion claim and smoke verification were insufficient.

Read-only D1 queries confirmed the original live row at revision 3, updated
`2026-10-03T11:52:50.670Z`, with zero rows written. Production was rolled back to
v2.12.0 deployment `b13cf583-ad91-43e7-ad1f-55dbc9365802`. The saved production
D1/bucket settings were restored, retaining all nine encrypted setting names.
Both live catalogs now match the actual sanitized D1 document exactly. The
retained book requires its ticket; a B2 read probe returns the expected missing
object result; login challenge configuration and unauthorized Keeper denial
respond correctly. Credentialed login/human verification was not exercised.

The packaging check now loads configuration explicitly and rejects missing or
incorrect deployment bindings. Regression coverage includes the incident's
binding-free Worker metadata, wrong database/bucket settings and recovered
HTTP 200 catalogs. A prepared backend correction fails with 503 when the live
DB or its record is missing instead of substituting recovered books. These
changes are not deployed during recovery. No database restore, seed, migration,
B2 object mutation or credential rotation was performed. Phase 5 is reopened;
see `docs/archive/incidents/2026-10-16-pages-bindings.md` for the incident and gates.


## 2026-10-16 — mobile image correction after incident rollback

The owner confirmed database recovery and reported that image dimming remained.
The production rollback restored v2.12.0, which predates the already-merged
native touch-feedback correction. Prepare v2.12.2 with that correction and a
new image stylesheet URL, using the guarded release bundle. Reader refactor
implementation milestones are merged; Phase 5 real production acceptance
remains open. A healthy catalog/configuration check must never be described
as a completed credentialed login or authorized book-open test.

## 2026-10-16 — v2.12.2 merged; production publish blocked

PR #10 merged as `d6527742a2cde9f878a7ae23547734d858d24521`. Both candidate
CI runs and the merged commit pass verification and all five browser profiles.
The merged source exactly matches tested tree
`05e5498b163cd7a3fafdde186c360fec29bccbb6`. The compiled release passes the
binding guard, and both live catalogs match the sanitized read-only D1 record
at revision 3. D1 query metadata reports zero rows written and no database
change. Two changed static assets were staged; the other 152 already existed.

Automatic approval review rejected the production deployment request. A check
of the earlier user publishing authorization did not unblock that review,
which requires fresh explicit approval. No new production deployment was
created: canonical deployment remains `b13cf583-ad91-43e7-ad1f-55dbc9365802`
at v2.12.0. Thus the image-touch fix is merged and tested but is not yet live.
Implementation milestones are complete; Phase 5 still requires the live
deployment/configuration checks, genuine authorized book opening, Keeper login
and physical-mobile acceptance. No credentialed flow is claimed as verified.

## 2026-10-16 — v2.12.2 published after explicit approval

The owner approved publishing and asked not to repeat permission requests.
Production deployment `e8fe494a-87ce-4731-9aa9-0285f449137d` succeeded at
10:29:44 UTC (18:29 Manila) from verified main source
`d6527742a2cde9f878a7ae23547734d858d24521`. The intervening main commit
`f845d20` changes documentation only; runtime/configuration bytes match the
five-profile CI source exactly. The binding-aware package was rechecked before
publishing; no new application change or unrelated test expansion was needed.

Actual deployment and saved project settings match the pre-release baseline:
the original D1 and bucket variables remain correct and all nine encrypted
settings retain their names/types. Read-only D1 comparisons confirm the whole
library row is unchanged at revision 3, with zero rows written and no database
change. Both live catalog documents exactly match the sanitized D1 record.
The live version identifies `v2.12.2 · d652774`. Canonical `/reader` requests
the refreshed image CSS and the served image CSS, focus controller, bookmarks
controller and engine match the tested source hashes. Both challenge endpoints
are configured; unauthenticated Keeper library access returns 401. Browser
inspection confirms the main footer and NSFW footer's runtime version field;
the existing adult gate was left in place.

The dimming correction is now live. v2.12.0 deployment
`b13cf583-ad91-43e7-ad1f-55dbc9365802` remains available for rollback.
No migration, seed, catalog edit, object write or credential change occurred.
Code milestones and automated release checks are complete; Phase 5 remains
open for genuine authorized book opening, Keeper login and physical-mobile
acceptance. Fixture checks are not presented as those credentialed flows.

## 2026-10-17 (Manila) — genuine login/book acceptance and visual anchor follow-up

The owner securely entered the existing Keeper token and completed its human
verification. Actual Keeper access passed: one series, one volume, healthy
catalogs, no trash and three retained snapshots. Its read-only deep B2 check
found all three referenced objects. After the owner's adult-library
acknowledgement and public verification, the real EPUB opened with a 253-page
map. These are genuine production flows, separate from intercepted fixtures.

The actual source/focused images have full opacity and no CSS filter; tap
highlighting is transparent. Initial-position focus return had zero displacement.
A partial-cover focus return moved 281 px to the top once, while subsequent
repeats retained the offset. Investigation found that Continuous semantic anchors
exclude the normalized standalone visual-page wrapper. Prepare v2.12.3 to
recognize it; the new unit regression fails on stale prose CFI without that
change. The browser case isolates partial-cover return from pending flow
replacement and mobile-chrome geometry changes.

Production remains on v2.12.2 pending verified publication of the correction.
Read-only D1 comparison confirmed revision 3 and both sanitized baseline
documents before sign-in. Ordinary authentication writes session/rate records;
no catalog edit, seed, migration, B2 mutation or credential change was performed.
Physical-phone acceptance remains distinct from desktop and emulated profiles.

## 2026-10-17 (Manila) — Android Soul Browser compatibility investigation

The owner identified the affected environment as Android / Soul Browser and
confirmed dimming persists on v2.12.2. The earlier statement that the dimming
correction was live described the tap-feedback code, not a successful phone
acceptance; the symptom remains open as RDR-046.

The anchor-only v2.12.3 candidate passed all 220 browser cases in both CI runs,
including the desktop WebKit rerun. Local follow-up `393cde2` adds the documented
browser-recoloring opt-out only to EPUB/focused images, refreshes the image CSS
URL, and expands forced-dark painting/zoom/return checks for Garden and Paper.
It passes all 166 Node tests, the asset audit, both builds and 44 local
desktop/mobile Chromium integration/image-focus cases. The local browser harness
serves the frontend statically with the existing intercepted fixture responses;
it does not replace the full Pages/D1 CI matrix or physical Soul verification.
Ordinary Chromium automatic darkening did not reproduce the owner's report
before the guard, so the change is compatibility protection, not a proven Soul
diagnosis. Whether Soul's dark theme or screen filter contributes is unknown.

Automatic approval review blocked the source push twice, also after verifying
repository ownership and destination. It demands explicit authorization for this
payload rather than accepting earlier blanket approval. The follow-up remains
committed locally; remote PR #11 still points to `c906358`, and its description
records the investigation. Fresh CI, merge and guarded publication are blocked.
Production remains v2.12.2 with the expected D1/bucket bindings and all nine
encrypted-setting names. Both live catalogs exactly match the verified baseline;
no live catalog, object, credential or deployment setting was changed.

## 2026-10-17 (Manila) — v2.12.3 published; live acceptance remains open

The owner explicitly approved the prepared patch's push, merge and publication,
resolving the earlier approval block. The connected GitHub account transferred
the exact approved tree as `fd512c59e590ac4f1230076877cd5d204aae404c`.
CI run `38970210426` passes all 166 Node tests, audit and both builds, and all
five browser profiles: 224 passed plus six intentional Chromium-only skips.
PR #11 merged as `23970ebfd93147ee11c7d63ff20d11ead8bbf9d7`; its source tree
`d60251394cf240e445a6476803e207ec7ae1afca` matches the tested candidate exactly.

The guarded release uploaded five changed assets and reused 149. Deployment
`edba47e6-43a9-4c5f-abf5-73092d671957` succeeded at 2026-10-16 21:44:31 UTC
(05:44 in Manila). Actual deployment and saved project configuration retain
the original D1/bucket bindings and all nine encrypted-setting names/types.
Read-only post-release checks confirm unchanged revision 3, timestamp and all
three snapshots, with zero rows written. Both catalogs match the D1 baseline;
all five checked reader asset hashes match source, both challenge endpoints are
configured and unauthenticated Keeper access returns 401. Both actual library
footers show `v2.12.3 · 23970eb`. The real EPUB reopened with its 253-page map
using retained public authorization; Keeper's ephemeral token was not retained,
so its earlier successful privileged login was not repeated during this rollout.

Live RDR-045 verification remains unsuccessful overall: the first partially
scrolled cover returned from image top -246 px to 54 px (a 300 px jump). A repeat
held its -245 px offset; a fresh reopen held scrollTop 300 after opening focus
had settled. These results keep the intermittent return open despite the fixed
selector gap and passing fixture regressions. No further source correction was
made without a demonstrated cause. RDR-046 also remains open until Android Soul
Browser phone testing verifies whether the new artwork-color protection helps.
The refactor's implementation milestones are merged; Phase 5 is still open.

Rollback target: correctly bound v2.12.2 deployment
`e8fe494a-87ce-4731-9aa9-0285f449137d`. No seed, migration, catalog edit, B2
object write or credential change was performed.


## 2026-10-17 (Manila) — Soul image-filter reproduction and v2.12.4 candidate

Fresh owner screenshots confirm v2.12.3 did not fix RDR-046. Aligned smooth
artwork areas retain about 70% brightness, while the browser toolbar is unchanged.
A targeted inspection of publicly available decompiled Soul code found
MainUtil.z0 injecting an img -webkit-filter brightness rule into the parent
document. PrefWeb defaults the separate Dark image option to enabled and image
brightness to 70. Source provenance and pinned links are in READER_RELEASE.md.
This is a strong match, not a direct DOM capture from the physical phone.

The new production-reader regression injects the actual rule and keeps a dimmed
parent-image control. It fails on v2.12.3 with focused RGB (129,120,152) instead of
(184,171,217). The v2.12.4 candidate resets only the focused image's prefixed and
unprefixed filter, and advances its CSS cache key. It preserves the original
colors at fit and zoom; full browser/return verification is pending. All 166
Node tests, audit, static build and binding-aware Functions package pass.

Production remains v2.12.3 while the candidate is verified. Read-only baseline
checks confirm revision 3, the same three snapshots, correct D1/bucket settings
and all nine encrypted-setting names/types. RDR-045 and physical Soul acceptance
remain open. No live catalog, object or credential was modified.


## 2026-10-17 (Manila) — v2.12.4 published with reproduced filter regression

PR #12 passed exact-candidate CI run 38974652347: audit, all 166 Node tests,
static build, binding-aware Functions package and 229 browser cases across five
profiles, with six intentional Chromium-only skips. The injected Soul filter
case passes in every profile, preserving colors at fit/zoom and reading-position
return while an ordinary parent-image control stays dim. The existing 44 local
reader cases and both new desktop/mobile cases also pass.

The PR merged as bf1dd7141e59c534ed561b5179dc8fd47ec659d4. Its source tree
731b3e61e52763d4b5c9543f6093266d786550ac exactly matches the tested candidate.
After rebuilding and validating bindings, three changed assets were uploaded
and 151 reused. Production deployment f1bf6889-4e7d-4af6-b3d2-bedb6b517da1
succeeded on 2026-10-16 at 22:25:17 UTC (06:25 in Manila).

Actual deployment and saved project configuration retain the original D1/bucket
settings and all nine encrypted-setting names/types. Read-only verification
confirms unchanged catalog revision 3, timestamp and three snapshots, with zero
rows written and changed_db false. Both public catalogs match that baseline.
Public version metadata identifies v2.12.4, main and the merged source; the
reader requests the v2.12.4 CSS URL and all five checked reader assets match
source bytes. Both challenge endpoints are configured and unauthenticated
Keeper access returns 401. No seed, migration, catalog edit, B2 object write
or credential change occurred.

RDR-046 stays open for the owner's physical Soul confirmation. RDR-045 remains
open independently; no further position code changed in this release. The
rollback target is correctly bound v2.12.3 deployment
edba47e6-43a9-4c5f-abf5-73092d671957.

## 2026-10-17 — Continuous scroll stability audit and v2.12.5 candidate

The owner confirmed that Android / Soul image dimming is solved on v2.12.4,
closing RDR-046, and reported jumping during fast upward scrolling. Work continues
on `audit/continuous-scroll-stability` from `8324e78`. The detailed inventory and
reproductions are in `docs/archive/audits/READER_SCROLL_AUDIT.md`.

Native upward input on the starting source repeatedly moves the visible passage
backward by 855 px. Independent tests reproduce below-viewport prepend resize
compensation, live-view replacement on a 100 px height-only viewport change,
stale resume after wheel or continuing scroll input, nine layout reformats per
location query, and an unresolved display/retained iframe after a pending view
is removed. A slow-load case returns the reader from chapter 16 to chapter 18.
The first synchronous-layout candidate also revealed a 56 px error from choosing
the edge chapter rather than the chapter at the reading tracking line.

The candidate uses synchronous live layout compensation, recognizes native
movement as newer navigation intent, retains live Continuous frames on height
changes, owns partial-view cancellation/cleanup, reconciles local frame heights
through the view API, and retains trailing buffer requests while deferring trim.
All 166 Node tests, the asset audit, static build and binding-aware Functions
package pass. The first eight new cases pass on desktop/mobile Chromium; full
reader integration and five-profile CI are still required before publication.

The existing production deployment is unchanged. Read-only checks still report
D1 revision 3, timestamp 2026-10-03T11:52:50.670Z and three snapshots; the project
retains the expected database, bucket settings and all nine secret-setting
names/types. No catalog, B2 object or credential mutation is part of this work.
RDR-045 real-cover acceptance and physical-phone acceptance of the new scroll
correction remain open.

## 2026-10-17 — v2.12.5 published with verified scroll and lifecycle corrections

The completed audit also reproduced a 320 px jump from late artwork growth
inside the current chapter. Live layout transactions now remember document-local
block geometry, compensate at the current scroll position and reject an anchor
that no longer belongs at the reading line after newer movement. Full integration
exposed focus-owned drift in WebKit and a detached vendor render rejection in
Firefox; both are corrected. Partial-view tests cover pending Section and iframe
loads. The native-resume test follows the actual visible block after five quiet
paints instead of comparing a chapter wrapper after a fixed delay.

Exact-head CI run 39001700811 passes the asset audit, all 166 Node tests, static
build, binding-aware Functions package and 277 browser cases across five
profiles. Eight intentional skips cover six Chromium-only forced-dark cases
and two unsupported native-wheel cases in mobile WebKit. The final local
three-profile reader integration passes 142 cases with two expected skips.
Ten new production-reader regressions use original disposable publications.

PR #13 merged as 8a7e07fc06fdcd38a3fafcaed1f0baff44584d75. Its source tree
1b60f0dae288f75d43d94116db3367a63124b75e exactly matches verified PR head
cd6af43be384c39e326b90a95b46af5f598e75eb. The clean merged source was rebuilt
through the binding guard, with eight assets uploaded and 147 reused. Production
deployment 0ceadeec-4e53-4e20-a841-83c72bde66a2 succeeded on 2026-10-17 at
04:24:41 UTC (12:24 in Manila).

Actual deployment and saved project settings retain the original database,
bucket settings and all nine encrypted-setting names/types. Read-only queries
confirm the exact library document at revision 3, timestamp
2026-10-03T11:52:50.670Z and unchanged IDs/hashes for all three snapshots; zero
rows were written and changed_db is false. Both public catalogs exactly match
the baseline: main has zero series/volumes, adult has one series/volume. No seed,
migration, catalog edit, B2 object write or credential change occurred.

The public version endpoint and both library version targets show v2.12.5 and
8a7e07f on main. All seven changed JavaScript assets, the accepted image-focus
stylesheet and footer loader match source bytes. Both challenge endpoints remain
configured; unauthenticated Keeper access returns 401. No new authenticated
real-book cycle was claimed. Rollback target is correctly bound v2.12.4
deployment f1bf6889-4e7d-4af6-b3d2-bedb6b517da1.

RDR-046 is resolved by the owner's physical Soul confirmation. RDR-045's
intermittent real-cover return and physical-phone acceptance of the new upward
scroll correction remain open, so Phase 5 is not declared complete.
