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

## Current resume point — 2026-09-28

The archive-based source reconstruction and this browser/visual audit checkpoint
are published on `skypie0102/ShadowGarden` main at `d2e943c`. The recovery
integrity implementation has passed local checks and twelve browser cases;
the fixture lookup correction and remaining verification are in progress.
All 148 recovered files remain present, 140 byte-identical, with eight documented
browser-script edits.
All 15 observed route paths are implemented, with the two unavailable operations
explicitly returning 501.

Further production recovery requires the five original EPUBs and evidence-backed
private object mappings, actual Cloudflare/B2 bindings and credentials, and live
Turnstile/provider checks. Original backend algorithms, history, security policy,
purge/recovery semantics and historical private data remain unrecovered. Keep
the original deployment/storage intact while those resources are restored.
