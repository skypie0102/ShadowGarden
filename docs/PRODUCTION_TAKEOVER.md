# ShadowGarden production operations

[Automatic live deployment](AUTO_DEPLOYMENT.md) is **active** as of 2026-10-22.
Checked pushes to current `main` publish to the existing `shadowgarden` project
at `shadowgarden-bon.pages.dev` after access, verification and all five browser
profiles pass. The separate test-project preview remains independent.

**Current production release — 2026-10-24:** v2.18.13, deployment
`828bb91c-d3b1-450d-91db-27b199c9b5af`, source `8d500eb` through
[PR #53](https://github.com/skypie0102/ShadowGarden/pull/53).

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40065545158) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40066899682) both pass
**471 Node tests** and **821 browser cases** across five profiles, with nine
documented platform skips and zero test retries. All five new CSS cases, ten
queue-lifecycle cases and six Library readiness cases pass in every profile.
The separate Chromium Library-startup profile passes on the PR and is excluded
from the 821 cases.

All **95 new same-DOM comparisons** match decoded RGBA pixels and computed-style/
geometry hashes, including the served/restored candidate control. All 21 changed
sheets are loaded across each profile's compared states. Six representative
desktop/mobile captures were visually reviewed. Settled frames and the recorded
default/349/761 widths define this scope; no exhaustive viewport, animation-frame
or resize-transition equivalence is claimed.

The workflow publishes **v2.18.13**, source `8d500eb`, deployment
`828bb91c-d3b1-450d-91db-27b199c9b5af`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
Publication completes in one attempt; the version check uses one request over
204 ms. All **27 production checks** pass: canonical source/version,
both D1-derived catalogs and all 24 changed CSS/JavaScript assets. The exact
revision-9 catalog document, all 9 snapshots and recorded settings remain
unchanged, with zero database writes. The retained v2.18.12 rollback is
`f75b7696-25f3-4ce4-8a3a-4b54846e340e`, source `e531786`.
See [verification evidence](keeper-target-stylesheets-verification.json).

The sanitized report is checked from the successful workflow's logs; GitHub's
production-artifact digest matches the upload log. The local execution
environment became unavailable after PR artifact review, so separate
post-deployment asset GETs and raw production-archive verification were not
completed. The workflow itself performed the 27 live checks; the evidence
records this verification limit.

Trusted-main Actions owns publication on the existing project; native Git
production publication remains disabled.

**Previous production release — 2026-10-24:** v2.18.12, deployment
`f75b7696-25f3-4ce4-8a3a-4b54846e340e`, source `e531786` through
[PR #52](https://github.com/skypie0102/ShadowGarden/pull/52).

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40057285978) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40058525055)
both pass **463 Node tests** and **746 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All four new CSS
cases pass in every profile. The separate Chromium Library-startup profile passes
on the PR and is excluded from the 746 cases.

All **45 same-DOM comparisons** in the PR artifacts match decoded RGBA pixels,
computed-style/geometry hashes and the served/restored candidate control.
Representative desktop/mobile captures were also visually reviewed. Settled-frame
comparisons cover the profile defaults and widths 349/600/761; they do not claim
animation-frame or exhaustive viewport equivalence.

The automatic workflow publishes **v2.18.12**, source `e531786`, deployment
`f75b7696-25f3-4ce4-8a3a-4b54846e340e`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.11 rollback. The version check uses one request
over 205 ms. Canonical source/version, both D1-derived
catalogs and all four changed CSS files pass verification. Independent public
HTTP checks match the same version/source and exact CSS bytes. The exact
revision-9 catalog document, all nine snapshots and recorded settings remain
unchanged, with zero database writes. The retained rollback is
`c1fa8f80-6803-4d80-9d1f-834570a5b1b7`. See
[verification evidence](keeper-css-verification.json).

The artifact matches the logged report and GitHub's archive digest. Trusted-main
Actions owns publication on the existing project; native Git production
publication remains disabled.

**Previous production release — 2026-10-24:** v2.18.11, deployment
`c1fa8f80-6803-4d80-9d1f-834570a5b1b7`, source `34eade0` through
[PR #51](https://github.com/skypie0102/ShadowGarden/pull/51).

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40050677211) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40051762262)
both pass **463 Node tests** and **726 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All six new queue
lifecycle cases pass in every profile. The separate Chromium Library-startup
profile passes on the PR and is excluded from the 726 cases.

The automatic workflow publishes **v2.18.11**, source `34eade0`, deployment
`c1fa8f80-6803-4d80-9d1f-834570a5b1b7`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.10 rollback. The version check uses one request
over 148 ms. Canonical source/version, both D1-derived
catalogs and all three changed queue modules pass verification. Independent
public HTTP checks match the same version/source and exact module bytes. The
exact revision-9 catalog document, all nine snapshots and recorded settings
remain unchanged, with zero database writes. The retained rollback is
`a9acfe26-d51f-4fc6-821e-6b972234cafe`. See
[verification evidence](keeper-queue-lifecycle-verification.json).
The artifact matches the logged report and GitHub's archive digest. Trusted-main
Actions owns publication on the existing project; native Git production
publication remains disabled.

**Previous production release — 2026-10-24:** v2.18.10, deployment
`a9acfe26-d51f-4fc6-821e-6b972234cafe`, source `5ab2822` through
[PR #50](https://github.com/skypie0102/ShadowGarden/pull/50).

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39955586173) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40034070015)
both pass **448 Node tests** and **696 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All three new
inspection cases pass in every profile. The separate Chromium Library-startup
profile passes on the PR and is excluded from the 696 cases.

The automatic workflow publishes **v2.18.10**, source `5ab2822`, deployment
`a9acfe26-d51f-4fc6-821e-6b972234cafe`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.9 rollback. The version check uses one request
over 96 ms. Canonical source/version, both D1-derived
catalogs and the changed inspection module pass verification. Independent public
HTTP checks match the same version/source and exact module bytes. The exact
revision-9 catalog document, all nine snapshots and recorded settings remain
unchanged, with zero database writes. The retained rollback is
`e5178997-51bf-4597-872b-181ba415e04a`. See
[verification evidence](epub-inspection-verification.json).
The artifact matches the logged report and GitHub's archive digest. Trusted-main
Actions owns publication on the existing project; native Git production
publication remains disabled.

**Previous production release — 2026-10-23:** v2.18.9, deployment
`e5178997-51bf-4597-872b-181ba415e04a`, source `7c54e89` through
[PR #49](https://github.com/skypie0102/ShadowGarden/pull/49).

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39949717155) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39951611512)
both pass **436 Node tests** and **681 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All three new
presentation cases pass in every profile. The separate Chromium Library-startup
profile passes on the PR and is excluded from the 681 cases.

The automatic workflow publishes **v2.18.9**, source `7c54e89`, deployment
`e5178997-51bf-4597-872b-181ba415e04a`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.8 rollback. The version check uses one request
over 216 ms. Canonical source/version, both D1-derived
catalogs and both changed presentation modules pass verification. Independent
public HTTP checks match the same version/source and both module hashes.
The exact revision-9 catalog document, all nine snapshots and recorded settings
remain unchanged, with zero database writes. The retained rollback is
`6cd6fd46-9892-43e1-98b0-be14dd9f387a`. See
[verification evidence](keeper-upload-presentation-verification.json).
The artifact matches the logged report and GitHub's archive digest. Trusted-main
Actions owns publication on the existing project; native Git production
publication remains disabled.

**Previous production release — 2026-10-23:** v2.18.8, deployment
`6cd6fd46-9892-43e1-98b0-be14dd9f387a`, source `2f81371` through
[PR #48](https://github.com/skypie0102/ShadowGarden/pull/48).

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39943827702) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39945575580)
both pass **424 Node tests** and **666 browser cases** across five profiles,
with nine documented platform skips and zero test retries. The separate Chromium
Library-startup profile passes on the PR and is excluded from the 666 cases.

The automatic workflow publishes **v2.18.8**, source `2f81371`, deployment
`6cd6fd46-9892-43e1-98b0-be14dd9f387a`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.7 rollback. The version check uses one request
over 165 ms. Canonical source/version, both D1-derived
catalogs and the stable footer module pass verification. Independent public HTTP
checks match the same version/source and footer bytes. The exact revision-9
catalog document, all nine snapshots and recorded settings remain unchanged,
with zero database writes. The retained rollback is
`359ab672-1d56-4439-86f2-ea80d8b0cc75`. See
[verification evidence](upload-buffer-verification-2.18.8.json).
The artifact matches the logged report and GitHub's archive digest. Trusted-main
Actions owns publication on the existing project; native Git production
publication remains disabled.

**Previous production release — 2026-10-23:** v2.18.7, deployment
`359ab672-1d56-4439-86f2-ea80d8b0cc75`, source `85f72c0` through
[PR #47](https://github.com/skypie0102/ShadowGarden/pull/47).

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39935879782) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39937777426)
both pass **412 Node tests** and **666 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All six new removal
cases pass in every profile. The separate Chromium Library-startup profile passes
on the PR and is excluded from the 666 browser cases.

The automatic workflow publishes **v2.18.7**, source `85f72c0`, deployment
`359ab672-1d56-4439-86f2-ea80d8b0cc75`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.6 rollback. The version check uses 2 requests.
Canonical source/version, both D1-derived catalogs and the changed Library
workflow bytes pass verification. Independent public HTTP checks match the same
version/source and asset bytes. The exact revision-9 catalog document, all nine
snapshots and recorded settings remain unchanged, with zero database writes.
The retained rollback is `9ba29d34-3d73-401f-8dd3-d4abb5c15fc4`.
See [verification evidence](keeper-volume-removal-verification.json).
The artifact matches the logged report and GitHub's archive digest. Trusted-main
Actions owns publication on the existing project; native Git production
publication remains disabled.

**Previous production release — 2026-10-23:** v2.18.6, deployment
`9ba29d34-3d73-401f-8dd3-d4abb5c15fc4`, source `e2d3d00` through
[PR #46](https://github.com/skypie0102/ShadowGarden/pull/46).

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39920449667) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39921815223)
both pass **402 Node tests** and **636 browser cases** across five profiles,
with nine documented platform skips and zero test retries. The separate
Chromium Library-startup profile passes on the PR and is excluded from the
636 browser cases.

The automatic workflow publishes **v2.18.6**, source `e2d3d00`, deployment
`9ba29d34-3d73-401f-8dd3-d4abb5c15fc4`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The original pre-publication baseline and rollback are retained in one deployment
attempt. The version check completes in one request (361 ms), recorded in the sanitized report.
Canonical version/source, both D1-derived catalogs and the stable footer module
pass verification. Independent public HTTP checks confirm version/source and the
footer bytes. The exact revision-9 catalog document, all nine snapshots and
recorded settings remain unchanged, with zero database writes. The retained
rollback is v2.18.5, deployment `ee0503a8-826c-46d6-9fc5-3536c70e6b9a`.
See [verification evidence](production-version-convergence-verification.json).
The retained artifact matches the logged report and GitHub's archive digest.
The trusted-main Actions job owns publication on the existing project; native
Git production deployment remains disabled.

**Previous production release — 2026-10-23:** v2.18.5, deployment
`ee0503a8-826c-46d6-9fc5-3536c70e6b9a`, source `cfcbcb4` through
[PR #45](https://github.com/skypie0102/ShadowGarden/pull/45).

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39905484804) and [checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39906804272)
both pass **389 Node tests** and **636 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All eleven new Keeper
cases pass in every profile. The separate Chromium Library-startup profile passes
on the PR and is excluded from the 636 browser cases.

The automatic workflow publishes **v2.18.5**, source `cfcbcb4`, deployment
`ee0503a8-826c-46d6-9fc5-3536c70e6b9a`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The workflow verifies canonical source/version and both D1-derived catalogs.
Independent public HTTP checks confirm the same source/version and all four
changed assets (three JavaScript modules and the Keeper layout stylesheet)
against the reviewed source. The catalog, all nine snapshots and recorded
settings match the pre-release baseline at revision 9, with zero database writes.
The retained rollback is v2.18.4, deployment
`1367c2ab-0daa-4ab0-8083-534d71edd611`.
The retained artifact matches the logged report and GitHub's archive digest.
See [current evidence](keeper-volume-ownership-verification.json).
The trusted-main Actions job owns publication on the existing project; native
Git production deployment remains disabled.

The deployment job needed one retry after an immediate version-probe mismatch;
the passed test jobs were retained. The release guide records both attempts and
the distinction between the retry baseline and the retained v2.18.4 rollback.

**Previous production release — 2026-10-23:** v2.18.4, deployment
`1367c2ab-0daa-4ab0-8083-534d71edd611`, source `9ccfa89` through
[PR #44](https://github.com/skypie0102/ShadowGarden/pull/44). Its main run passes
348 Node tests and 581 browser cases, with nine documented skips and zero test
retries. Both catalogs, nine changed assets and revision-9 data/snapshots/recorded
settings are verified. See [dated evidence](keeper-ui-session-verification.json).

**Previous production release — 2026-10-23:** v2.18.3, deployment
`c327c36c-fe9d-4c48-becd-9199a2f18057`, source `2fa066f` after application
[PR #42](https://github.com/skypie0102/ShadowGarden/pull/42) and CI
[PR #43](https://github.com/skypie0102/ShadowGarden/pull/43). Its main run passes
332 Node tests and 556 browser cases (nine documented skips), verifies both
catalogs/eight changed assets and preserves revision 9, nine snapshots and
settings. See [dated evidence](keeper-core-upload-verification.json).

**Previous production release — 2026-10-22:** v2.18.2, deployment
`85a31e3a-43d3-4044-b7cf-026452b00c1e`, source `c4f697b` from
[PR #41](https://github.com/skypie0102/ShadowGarden/pull/41). Its main run passes
325 Node tests and 551 browser cases after a WebKit infrastructure retry, with
nine documented skips and zero test retries. It verifies both catalogs, seven
changed assets and exact catalog/snapshot/settings preservation. See
[dated verification](keeper-workflow-verification.json).

**Previous production release — 2026-10-22:** v2.18.1, deployment
`2fed005d-bdb3-4a5f-a6c7-6e34ad7f578d`, source `a3f1b95`. The
[activation run 39758249662](https://github.com/skypie0102/ShadowGarden/actions/runs/39758249662)
publishes after the credential correction, retaining 318 passing Node tests and
541 browser cases, with nine documented skips and no test retries. It verifies
both catalogs, all seven public readability assets and exact catalog/snapshot/
settings preservation. See [activation evidence](automatic-deployment-verification.json).
The missing-secret and Pages-authorization failures remain historical attempts.

**Previous production release — 2026-10-20:** v2.18.0, deployment
`8c87a0ed-acf5-4083-a305-c9f5988f8da1`, source `8e34ced` from PR #38.
Native Garden Pass modality/focus restoration and parallel/canonical public
imports pass 305 Node tests and 541 browser cases with nine documented skips.
The release verifier passed version, both D1-derived catalogs and seven changed
asset comparisons. Revision 9, the exact document, nine snapshots and actual/saved
settings were unchanged across publication. The retained rollback is v2.17.1,
`39c54372-231f-4a6d-880b-48f1a3710b57`. Fresh public HTTP checks on 2026-10-21
confirm the source and changed assets. The connected Cloudflare API returned
internal errors then, so no new D1/configuration comparison is claimed for that
day. See [public boundaries](PUBLIC_BOUNDARIES.md) and
[sanitized evidence](public-boundaries-verification-2.18.0.json).

**Protected-source release — 2026-10-20:** v2.17.1, deployment
`39c54372-231f-4a6d-880b-48f1a3710b57`, clean application source `01b57f9`.
PR #36 removes the global fetch override and gives the visual scanner an explicit
book-access transport. The pinned main/page-map EPUB.js runtimes keep their XHR
and session-cookie behavior. CI passes 293 Node tests and 502 browser cases
(eight existing skips), including opaque and legacy source loading in every
profile. Both changed modules match the release build, both catalogs match D1,
and both Library footers show v2.17.1. The refreshed baseline is revision 9 with
nine snapshots; the exact document, every snapshot and actual/saved production
configuration are unchanged across this deployment. No database, book-object or
credential writes were needed. The retained rollback is v2.17.0,
`f86f42ef-b710-40f8-bf6a-011c47b875e5`. See [the transport report](PROTECTED_SOURCE_TRANSPORT.md)
and [verification evidence](protected-source-verification-2.17.1.json).

**Browser persistence release — 2026-10-20:** v2.17.0, deployment
`f86f42ef-b710-40f8-bf6a-011c47b875e5`, clean application source `129a1d2`.
The release includes measured upload-memory buffering and grouped browser
persistence from PRs #34/#35. CI passes 285 Node tests and 492 browser cases
(eight existing skips). All seven changed static modules match the release build;
both live catalogs match D1, and both Library footers show v2.17.0. Revision 8,
the exact document, all eight snapshots, actual/saved bindings, compatibility
settings and nine encrypted-setting names/types are unchanged. No database,
book-object or credential writes were needed. The retained rollback is v2.16.0,
`8212de19-5ccb-40bd-9241-14b9427ea565`. See [release evidence](persistence-verification-2.17.0.json).

The connected Cloudflare plugin supplied a valid short-lived upload JWT. Its
runtime's asset requests returned 403, while local requests with a plugin-issued
token succeeded. Local upload of eight changed assets and revalidation of all
164 unique hashes completed the release without another sign-in or permission
change. [The upload procedure](PAGES_UPLOAD_TRANSPORT.md) records the transport
comparison and the guarded multipart deployment. The underlying reason for the
runtime difference is not established.

**Maintenance budget release — 2026-10-19:** v2.16.0, deployment
`8212de19-5ccb-40bd-9241-14b9427ea565`, source `4b2aed1`.
[Maintenance budgets](MAINTENANCE_BUDGETS.md) and
[release evidence](maintenance-release-2.16.0.json) record paginated Keeper
history, bounded readiness, 250 Node tests, 477 browser cases and unchanged
production data/configuration. The retained rollback is v2.15.0 deployment
`710c6175-587f-40ff-899b-94b5c33e5be5`.

The upload-memory and browser persistence increments are deployed together in
v2.17.0 above. See [upload verification](UPLOAD_MEMORY.md) and
[persistence verification](BROWSER_PERSISTENCE.md) for implementation limits.

**Reader gesture release — 2026-10-19:** v2.14.1, deployment
`fab2efb5-42d7-4dce-be2c-42990c9b517a`, clean main source
`7d50991eeaca4f96077da2fa1467f99f4e322917`. Double tap/click now opens and
returns from image focus. All 224 Node tests and 432 browser cases pass across
five profiles, plus six isolated checks against the deployed reader. Exact served
files, revision-8 document/eight snapshots, actual/saved bindings, encrypted-setting
metadata, both catalogs, challenge endpoints and access-denial/B2 probes pass.
See [reader release evidence](reader-release-2.14.1.json). The retained rollback
is v2.14.0 deployment `c91b8b1e-2033-4215-b59c-61edb547749f`.

**Website refactor release — 2026-10-18:** v2.14.0, deployment
`c91b8b1e-2033-4215-b59c-61edb547749f`, clean `main` source
`ff5bb9c700d0e709d9e838791a282946a8c47533`, deployed at 21:51:59 UTC.
The [website release record](WEBSITE_RELEASE.md) and
[evidence](website-release-2.14.0.json) identify the tested/merged tree, all
220 Node tests, 422 browser cases (eight existing skips), live Library controls,
Keeper sign-in layout, midnight Garden Pass and 28 matching served files.
Both retired runtime layers return 404.

Actual and saved D1/bucket/compatibility settings and all nine encrypted-setting
names/types match the refreshed baseline. Revision 8, the exact catalog document
and all eight snapshot identities/checksums are unchanged. Both public catalogs
match D1 exactly. Challenge endpoints return site keys, unauthenticated Keeper
access returns 401, raw EPUB HEAD returns 403 and the missing-cover B2 read returns
404 `media_not_found`. No production catalog, storage, migration or credential
changes were needed.

Physical Android/Soul reset and credential-based live sign-in/book opening are
not claimed as new manual acceptance. The owner's earlier Android/Soul scroll/
focus acceptance remains v2.12.6, and Keeper acceptance remains v2.12.8; see the
[reader release record](READER_RELEASE.md). Current upload/preflight/retry behavior
passes in the real isolated Pages/D1 fixture across all five browser profiles.

## Reusable production verification

The [read-only verifier](PRODUCTION_VERIFIER.md) replaces the temporary catalog/
served-source probes with maintained code. Capture exact D1/configuration through
its self-contained collector using the existing Cloudflare plugin; keep private
baselines ignored. Run `npm run verify:production` against the exact reviewed
release directory and a fresh baseline, with `--before` for preservation checks.
It checks canonical catalog/version URLs and selected served JS/CSS bytes.
`npm run check:functions` now also rejects compatibility-date/flag drift in the
compiled multipart Worker metadata. No browser sign-in is needed for this
connected-plugin workflow. The [2026-10-20 report](production-tooling-verification.json)
passes against v2.17.1 with unchanged revision 9, nine snapshots and settings.
This tooling continuation does not deploy or change the application version.

## Existing resources

The owner authorized replacing the original site on 2026-10-02 and reusing its
existing B2 bucket. The five recovered EPUB entries were disposable tests. This
supersedes the separate-bucket plan in `TEST_DEPLOYMENT.md`.

| Resource | Value |
| --- | --- |
| Public URL | https://shadowgarden-bon.pages.dev/ |
| Cloudflare Pages project name | `shadowgarden` |
| Cloudflare account | `fa95f62f96a0ff3b92a45175d94a48b6` |
| Source branch | `skypie0102/ShadowGarden`, `main` |
| Pages production branch | `main` |
| D1 binding | `DB` |
| Existing D1 database | `shadowgarden-test` |
| D1 ID | `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86` |
| Existing private B2 bucket | `shadow-garden-books-01` |
| B2 bucket ID | `ddac6e4567151ba5a20f0011` |
| Last verified rollback target | v2.17.1, `39c54372-231f-4a6d-880b-48f1a3710b57` |

The project name differs from the hostname. Deploy to **`shadowgarden`**.
Cloudflare retained its original Git source when an API update was attempted,
so automatic production and preview builds from that old repository are paused.
Use Pages direct deployments to retain the existing hostname and secrets.

## Historical integration checks

These dated records retain earlier verification. Current status is above and in
the release record.

The first takeover deployment succeeded at 2026-10-02 08:31 UTC with commit
`26bacb7` and deployment ID `e9d4306a-a4db-4aed-a4a9-d3b28458dc39`. The homepage,
version, login challenge endpoints and both empty catalogs passed live checks.
All eight original secrets remain encrypted; `SESSION_SECRET` was added securely.
The original Turnstile widget already permits the production hostname.

The withdrawn reader deployment used v2.12.1 from `main` source
`154381761d6bec1fa246166f0ba300f09471d6ab`, deployment
`5658687a-f60a-4a1f-8441-78738c2b04e1`, successful 2026-10-16 at 09:18 UTC.
Both clean CI runs pass 159 Node tests and 215 browser cases. Live desktop/mobile
checks confirm exact reader assets, image zoom/return position and visible
`v2.12.1 · 1543817` footers in the main and NSFW libraries. Login challenges and
catalogs respond correctly; unauthenticated admin library access is denied.
Those checks missed the lost bindings and recovered-catalog fallback. The
deployment is no longer live. No migration, seed, catalog/media edit or secret
change occurred; recovery restored the previous deployment/configuration. See
[READER_RELEASE.md](READER_RELEASE.md) for the full matrix, live checks, limits
and retained v2.12.0/pre-refactor rollback targets.

The initial B2 probe exposed an unsupported `redirect: 'error'` fetch option in
workerd. This branch corrects it to manual redirects with explicit refusal of
every 3xx response. The failure and fix were reproduced in the Cloudflare local
runtime, independently of the Node mocks. The correction first went live in
deployment `f8844be0-ae68-4e72-969d-c0812f03109d` on 2026-10-03 at 00:39 UTC.
It was deployed from the tested working tree while the GitHub connector was
stalled, with `commit_dirty: true` recorded in Cloudflare.

The live missing-cover probe now completes B2 authorization and the download
lookup, returning the expected `media_not_found` 404 instead of a storage 502.
This verifies the read connection without creating or deleting a real object.
The homepage, both challenge endpoints and D1 catalog also pass. The owner
confirmed Keeper login works after deployment
`12b99509-604b-4566-a0eb-330864686b27` (source `ab26a01`).

The first authenticated upload on 2026-10-03 passed EPUB validation and the B2
read/existence check, reserving a new object key in D1, but failed before catalog
creation. A separate upload validation bug rejected B2's documented
`pod-*.backblaze.com` upload URLs. The validator now accepts those HTTPS pods
only for the URL returned by `b2_get_upload_url`; API/download hosts remain
restricted to `*.backblazeb2.com`, and redirects are still refused.
The pinned Cloudflare runtime reproduced the old 502 and the corrected upload
using fake credentials and provider responses. All 63 backend/client tests pass.
Retrying an authenticated live upload and opening its EPUB remain necessary to
verify the real write credentials and reader together. No B2 objects were
created or deleted by the diagnostic work.

The old `Workers Builds: shadowgarden-test` integration had no Worker remaining
in the account. Its preview builds and production path triggers are now paused,
preventing further irrelevant failed builds. Historical failed checks remain.

## Configuration

The Continuous reader image-focus fix was deployed on 2026-10-15 at 12:31 UTC
from source `9daea7f481ae1f19cc3d0640b83b20d424eab794`, deployment
`dfac687d-06fa-4bc5-9f3f-6eae5a9f4a33`. Closing the image restores the live
reading position without navigating to saved progress; stale callbacks are
cancelled on navigation and mode changes. An opening-touch compatibility click
cannot immediately dismiss the overlay.

GitHub CI run `38734664627` passed all 70 backend/client tests, the asset audit,
both builds, and all 20 desktop/mobile browser tests. A live Cloudflare browser
check confirmed the deployed commit and exact SHA-256 matches for the two
changed reader modules. The homepage, reader, both login challenge endpoints
and both D1 catalogs return 200. No storage or catalog writes were needed.

`wrangler.jsonc` on this branch is production configuration. It binds the already
initialized D1 database and supplies the existing bucket's non-secret name/ID.
Both migrations and the empty seed were independently verified through D1.
Do not rerun a recovered seed over the live catalog. New library edits are stored
in D1; they do not update the original catalog JSON stored in B2.

Keep all eight original encrypted variables:

- `B2_READ_KEY_ID`, `B2_READ_APPLICATION_KEY`
- `B2_WRITE_KEY_ID`, `B2_WRITE_APPLICATION_KEY`
- `SG_ADMIN_TOKEN`, `SG_MEDIA_SIGNING_SECRET`
- `SG_TURNSTILE_SITE_KEY`, `SG_TURNSTILE_SECRET_KEY`

The backend also needs an independent encrypted `SESSION_SECRET`
with at least 32 characters. Add it once; retain it on subsequent deployments.
The existing SG aliases are supported. Secret values do not belong in Git.

Keeper accepts the original nonempty `SG_ADMIN_TOKEN` exactly as configured,
including an existing token shorter than 32 characters. It is a login credential,
not a signing key. The independent session and media signing secrets retain
their 32-character minimum; Turnstile, rate limits and revocable sessions remain
required. A missing or blank Keeper token still fails closed with a specific
configuration error and does not consume a login attempt.

The database still has its original `shadowgarden-test` name. The test Pages
project also references it, so treat writes from either site as production
writes after the takeover. Future destructive testing requires an isolated
database. Existing B2 files are retained; an empty catalog does not delete them.

## Deploy from Windows PowerShell

From the reviewed source checkout, after its complete CI matrix passes:

```powershell
git fetch origin
git switch main
git pull --ff-only
npm.cmd ci
npm.cmd run check
npx.cmd wrangler pages deploy dist --project-name shadowgarden --branch main
```

`npm run check` builds assets and compiles the binding-aware release package.
It validates actual D1/variable metadata. Do not publish a source-only Functions
bundle or a package whose bindings differ from reviewed `wrangler.jsonc`.

Capture the current catalog revision/document, snapshot IDs/checksums,
actual/saved bindings and encrypted-setting names/types before deployment;
compare them afterward. Keep secret values out of logs and Git.

Use `--branch main` for both the canonical source checkout and this Pages
project's production environment.
Wrangler compiles the `functions/` directory as part of this deployment. A
dashboard upload of `dist/` alone does not include those Functions.

## Check and roll back

Verify canonical/saved configuration against the baseline, including `DB`, bucket
variables and encrypted-setting metadata. Compare public catalogs with the exact
expected database content and snapshot IDs/hashes; HTTP 200 alone is insufficient.
Check version metadata, exact served reader hashes, both visible library footers,
challenge configuration and denial of unauthenticated Keeper access. Record
authenticated/provider checks separately; ordinary maintenance verification does
not require catalog writes or media upload/deletion.

The last verified rollback target above is retained through
Cloudflare Pages' deployment menu or rollback API. Rolling back code does not
roll back D1 or B2 writes made after the takeover. Export a Keeper backup before
later catalog changes that you may need to undo.
