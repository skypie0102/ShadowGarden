# ShadowGarden reconstruction log

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
- Added `docs/API_CONTRACTS.md`, `docs/DEPLOYMENT.md`, `docs/AUDIT.md` and
  `docs/MISSING_COMPONENTS.md` with explicit recovery boundaries.

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
`docs/PRODUCTION_TAKEOVER.md` for rollback.

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
