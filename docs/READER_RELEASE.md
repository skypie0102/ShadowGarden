# Reader releases

**Current production baseline:** v2.12.6. Ongoing
[maintenance](READER_MAINTENANCE.md) is tracked separately from deployments.

## Reader v2.12.6 — maintenance and scroll follow-up

**Live:** deployment `7e9cb704-e2bb-4e42-955e-384bb2b4bbe2` succeeded on
2026-10-18 at 04:23:05 UTC (12:23 in Manila), from clean `main` source
`a5c5347e9204e2362eec704a6e9e2e14b2fb2c07`. Its source tree is
`f8fcc70e8578073ce77c5019e209c49fa6d1e69b`.
[Verification evidence](reader-release-2.12.6.json) retains the deployed file
hashes, configuration metadata, catalog identities and check boundaries.

This release publishes maintenance increments M1–M4, M5a/M5b and M5c1, the shared
Continuous intrinsic-height correction, and [PR #26](https://github.com/skypie0102/ShadowGarden/pull/26)'s
chapter-boundary anchor and pending-native-movement fixes (RDR-054/055). The
[maintenance record](READER_MAINTENANCE.md) explains each increment and its
failing-before evidence. The accepted Soul image-focus CSS remains at v2.12.4;
its served bytes match source.

The exact release commit passes the audit, all **204 Node tests**, static build,
binding-aware Functions packaging and **352 browser cases** in
[CI run 39096737028](https://github.com/skypie0102/ShadowGarden/actions/runs/39096737028).
All six jobs succeed on their first attempt; eight existing platform skips remain.

| Profile | Passed | Skipped |
| --- | ---: | ---: |
| Desktop Chromium | 72 | 0 |
| Mobile Chromium | 72 | 0 |
| Firefox | 70 | 2 |
| Desktop WebKit | 70 | 2 |
| Mobile WebKit | 68 | 4 |

Read-only production verification confirms the following:

- Version metadata identifies v2.12.6, `main` and `a5c5347`; both visible
  library footers show `v2.12.6 · a5c5347`.
- All **26 checked public files** match the release's Git blob hashes exactly:
  21 changed reader JavaScript files, the accepted image-focus stylesheet, the
  footer loader and all three reader/main/adult HTML entry points.
- Actual deployment and saved project settings retain D1
  `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86`, the original B2 bucket name/ID,
  compatibility settings and all nine encrypted-setting names/types.
- D1 remains at revision **7**, timestamp `2026-10-17T04:40:11.572Z`, with
  all seven retained snapshot identities/checksums. The queries report zero
  rows written and `changed_db: false`. This follows the matching baseline
  comparison completed immediately after deployment.
- Both live `/media/shadow-garden/data/*catalog.json` responses exactly match
  sanitized D1 content: main has zero series/volumes; adult has one series/volume.
  Static `/data/*catalog.json` files are placeholders, not the live catalog APIs.
- Both challenge endpoints provide configured site keys. Unauthenticated Keeper
  access returns 401; the known raw EPUB without its ticket returns 403. A
  nonexistent B2 cover returns the expected 404 rather than a storage error.
- The real, unintercepted EPUB opens through retained public authorization and
  displays its existing saved location with a 385-page map under that browser's
  current settings. The reader tab reports no captured warnings or errors.

This verification does not repeat credentialed Keeper sign-in, B2 upload/write
tests, or the specific intermittent first-open partial-cover cycle. An authorized
book may reuse its existing local cache; reopening alone does not prove a fresh
EPUB download. No migration, seed, catalog edit, B2 object write or credential
change is part of the release.

**Phone acceptance — 2026-10-18 (Asia/Manila):** the owner manually checked fast
upward scrolling and image-focus return on Android/Soul in **v2.12.6** and reports
that both work correctly. This completes the requested device acceptance gate
for these two behaviors. It follows the earlier v2.12.5 ordinary-use acceptance.

RDR-045's earlier intermittent first-open partial-cover observations remain
regression evidence; this report confirms image-focus return on the owner's
phone without claiming a separately isolated replay of that exact historical
cycle. The historical M5a single reversal remains causally unattributed. The
demonstrated sizing, boundary and stale-resume mechanisms are fixed; those
evidence limits do not leave the requested v2.12.6 phone checks pending.

Rollback target: the correctly bound v2.12.5 deployment
`0ceadeec-4e53-4e20-a841-83c72bde66a2`.

## Reader v2.12.5 — Continuous scroll stability

**Live:** deployment `0ceadeec-4e53-4e20-a841-83c72bde66a2` succeeded at
2026-10-17 04:24:41 UTC (12:24 in Manila). [PR #13](https://github.com/skypie0102/ShadowGarden/pull/13)
merged as `8a7e07fc06fdcd38a3fafcaed1f0baff44584d75`. Its source tree
`1b60f0dae288f75d43d94116db3367a63124b75e` exactly matches the tested PR head
`cd6af43be384c39e326b90a95b46af5f598e75eb`.

The owner confirmed that v2.12.4 solved Android / Soul image dimming, then
reported intermittent jumping during fast upward scrolling. The audit starts
from `8324e78dad81031a370e28ab26abd54a655e47d6`.
See [READER_SCROLL_AUDIT.md](READER_SCROLL_AUDIT.md) for the complete inventory,
reproductions and distinctions between demonstrated faults and prevention work.

The release removes stale asynchronous prepend restoration, replaces unconditional
vendor resize compensation with synchronous reading-line layout transactions,
and keeps live Continuous chapters through height-only viewport changes. New
native movement cancels older resume/settlement, including scroll continuation
without a new wheel/touch event. Owned programmatic moves keep their bookkeeping
so those compensations do not cancel deliberate navigation.

Partially rendered views now own their display wait, iframe callbacks and final
cleanup; removal cannot leave an uncancellable display or a late rendered event.
The adapter reconciles manager-local frame heights through the view API, and
location queries no longer reformat every buffered view. Buffer requests retain
a trailing pass, and idle trimming waits for buffering to finish.

The starting v2.12.4 source fails the generated-publication upward-scroll case
with repeated 855 px backward movements. Separate regressions reproduce the
below-viewport resize shift, disconnected chapter after a height-only resize,
stale resume after wheel/continuing scrolling, and removed-view display leak.
The initial layout candidate also exposed a distinct 56 px edge-chapter anchor
error, corrected by following the same tracking line as reading-position capture.

Further audit reproduced a separate 320 px jump when artwork grows above the
passage within its current chapter. The release remembers document-local
block geometry and compensates its layout change at the current scroll position,
without replaying an old screen coordinate. It also checks that the old block
still belongs at the tracking line, so newer movement into the image wins.
Focus-owned drift remains excluded from passive user-movement detection; real
input still cancels older work. The pinned IframeView render sequence is owned
directly so partial-startup cancellation also settles in Firefox.

The asset audit, all **166 Node tests**, static build and binding-aware Functions
package pass in [CI run 39001700811](https://github.com/skypie0102/ShadowGarden/actions/runs/39001700811).
All five browser profiles pass **277 cases**, with eight intentional platform
skips. The release adds ten production-reader regressions.

| Profile | Passed | Skipped |
| --- | ---: | ---: |
| Desktop Chromium | 57 | 0 |
| Mobile Chromium | 57 | 0 |
| Firefox | 55 | 2 |
| Desktop WebKit | 55 | 2 |
| Mobile WebKit | 53 | 4 |

Six skips are the existing Chromium-only automatic-darkening override. Two are
native wheel cases unsupported by Playwright's mobile WebKit adapter; its
scroll-continuation, resize, late-layout, slow-load and removal cases still run.
The final local three-profile reader integration run passes 142 cases with two
expected dark-mode skips. The native resume regression waits for five quiet
paints and compares the actual visible block, retaining its two-pixel tolerance.

The clean merged source was rebuilt through the binding guard. Eight assets
were uploaded and 147 reused. Actual deployment and saved project configuration
retain the original D1 binding, bucket settings and all nine encrypted-setting
names/types. Read-only post-deployment queries confirm unchanged D1 revision 3,
timestamp `2026-10-03T11:52:50.670Z`, the exact library document and all three
snapshot IDs/hashes, with zero rows written and `changed_db: false`. Both public
catalogs exactly match the database baseline: main has no series or volumes;
adult has one series and one volume. No seed, migration, catalog edit, B2 object
write or credential change occurred.

The live version endpoint and both library version targets identify v2.12.5 and
source `8a7e07f` on `main`. All seven changed JavaScript assets, the accepted Soul
image-focus stylesheet and the footer loader match source bytes. The reader
retains the accepted v2.12.4 image-focus CSS URL. Both challenge endpoints are
configured and unauthenticated Keeper access returns 401. These public checks
do not repeat the earlier authenticated real-book acceptance.

Rollback target: the correctly bound v2.12.4 deployment
`f1bf6889-4e7d-4af6-b3d2-bedb6b517da1`.

**Phone acceptance — 2026-10-17:** after testing v2.12.5 on Android/Soul, the owner
reported: “Tested the reader, works great so far, no more jumping and dimming.”
Ordinary-use acceptance of the scrolling and brightness corrections has passed.
RDR-045's earlier intermittent first-open partial-cover cycle remains specifically
tracked; that exact reproduction was not independently repeated by the general
phone report. See the [code review](READER_CODE_REVIEW.md) and
[maintenance roadmap](READER_MAINTENANCE.md) for ongoing simplification.

---

# Reader v2.12.4 — focused-image filter correction

**Live:** deployment `f1bf6889-4e7d-4af6-b3d2-bedb6b517da1` succeeded at
2026-10-16 22:25:17 UTC (2026-10-17 06:25 in Manila). [PR #12](https://github.com/skypie0102/ShadowGarden/pull/12)
merged as `bf1dd7141e59c534ed561b5179dc8fd47ec659d4`. Its source tree
`731b3e61e52763d4b5c9543f6093266d786550ac` exactly matches the tested candidate.

The owner supplied fresh Android / Soul Browser screenshots showing
that the v2.12.3 color-scheme opt-out did not resolve RDR-046. The large pink area
changes from RGB (227, 0, 81) to (159, 0, 58); aligned smooth regions retain about
70% of their channel values. Browser chrome remains unchanged.

Investigation found a concrete matching mechanism in the publicly available
decompiled Soul source, rather than Chromium's automatic-darkening emulation:
[MainUtil.z0](https://git.kaki87.net/VibedByKaKi/soul-browser/src/commit/6a5016ab8b5aadeb8ff915fa70aaf46ce8abbe5f/sources/java/com/mycompany/app/main/MainUtil.java)
injects a parent-document `img` brightness filter under style ID `sb_dark_style`.
[PrefWeb](https://git.kaki87.net/VibedByKaKi/soul-browser/src/commit/6a5016ab8b5aadeb8ff915fa70aaf46ce8abbe5f/sources/java/com/mycompany/app/pref/PrefWeb.java)
defaults `mThemeImg` to true and `mImgBright` to 70. The source is a third-party
decompilation of Soul v1.4.85 with subsequent modifications, not an official
SoulSoft source release or a DOM capture from the owner's phone. The matching
filter and screenshot ratios strongly support this diagnosis; phone acceptance
is still separate.

The focused image now explicitly resets both `-webkit-filter` and `filter` to
`none !important`, scoped to that image. The stylesheet URL advances to v2.12.4.
The book image stays in its EPUB iframe, while the focused copy lives in the
parent document where the injected rule applies. No brightness compensation,
image-byte transformation, backdrop change or reader-theme change is involved.

A production-reader paint regression injects Soul's actual 70% rule. An ordinary
parent image proves the filter is active; the focused copy must retain its
declared source color at fit and zoom and return to its reading position. On
v2.12.3 the focused pixel is (129, 120, 152) instead of (184, 171, 217), failing
by 55 red levels. This reproduces the mechanism missing from previous tests.

The asset audit, all 166 Node tests, static build and binding-aware Functions
package pass locally and in [CI run 38974652347](https://github.com/skypie0102/ShadowGarden/actions/runs/38974652347).
All five browser profiles pass **229 cases**, with six intentional skips for
the Chromium-only automatic-darkening override. The new injected-filter case
passes in each profile. The existing 44 local reader cases and both new
desktop/mobile Chromium cases also pass.

The clean merged source was rebuilt with the binding-aware package guard. Three
changed assets were uploaded and 151 reused. Actual deployment and saved project
configuration retain the original D1 binding, bucket settings and all nine
encrypted-setting names/types. Read-only post-deployment checks confirm unchanged
catalog revision 3, timestamp `2026-10-03T11:52:50.670Z` and all three snapshots;
both queries report zero rows written and `changed_db: false`. Both public
catalogs exactly match that database baseline. No seed, migration, catalog edit,
B2 object write or credential change occurred.

The public version endpoint identifies v2.12.4, `main`, and the merged source
above. The served reader requests `reader-image-focus.css?v=2.12.4`, and all five
checked reader asset hashes match source, including the new filter reset. Both
challenge endpoints are configured; unauthenticated Keeper access returns 401.
The owner subsequently confirmed "dimming solved" on 2026-10-17, resolving
RDR-046. The separate intermittent real-cover return RDR-045 remains open.

Rollback target: the correctly bound v2.12.3 deployment
`edba47e6-43a9-4c5f-abf5-73092d671957`.

---

# Reader v2.12.3 — image-only anchors and artwork color protection

**Live:** deployment `edba47e6-43a9-4c5f-abf5-73092d671957`, successful at
2026-10-16 21:44:31 UTC (2026-10-17 05:44 in Manila). [PR #11](https://github.com/skypie0102/ShadowGarden/pull/11)
merged to `main` as `23970ebfd93147ee11c7d63ff20d11ead8bbf9d7`. The owner
explicitly approved this patch's push, merge and publication. The release's
source tree exactly matches tested PR tree `d60251394cf240e445a6476803e207ec7ae1afca`.
**Phase 5 remains open:** the intermittent real-cover return and Android Soul
Browser dimming still require resolution/physical-device acceptance.

## Earlier genuine production acceptance — v2.12.2

- The owner supplied the existing Keeper token through secure browser sign-in
  and completed the human check. Keeper opened the actual one-series,
  one-volume catalog. Maintenance reports healthy catalogs, no trash and three
  retained snapshots; its read-only deep B2 check found all three referenced
  objects, with none missing.
- The owner completed the adult-library acknowledgement and public human
  verification. The real, unintercepted EPUB opened with its 253-page map.
  These checks establish genuine authorization and provider access; they do not
  depend on the disposable fixture responses.
- The real source image and focused image have opacity 1 and no CSS filter;
  source and overlay tap highlighting is transparent. A focus return from the
  cover's initial position had zero displacement. A partially scrolled cover
  returned 281 px to the top on one attempt; subsequent live repeats held the
  offset. That observation remains a regression to address, not a release pass.
- Read-only D1 verification before the sign-in confirmed catalog revision 3,
  timestamp `2026-10-03T11:52:50.670Z`, and exact agreement with the verified
  sanitized main/adult baseline. Login performs its ordinary session and rate
  bookkeeping; no catalog edit, migration, media write or credential change was
  made during these checks.

The Continuous anchor selector excluded the normalized standalone visual-page
wrapper. On such a page the reader could retain stale prose progress or fall
back to a browser caret range instead of a concrete image-page block. The
release recognizes that wrapper, preserving the existing prose selection and
navigation-cancellation rules. A unit regression fails on the old stale-CFI
behavior; an integration case exercises focus return from a partially scrolled
cover after settled startup. The anchor-only candidate `c906358` passed all 166
Node tests and all 220 browser cases in both push and PR CI, including the
previously intermittent desktop WebKit rerun. The complete artwork follow-up
subsequently passed the fresh matrix below and is now published. The real-cover
return still needs investigation as recorded in the current acceptance results.

## Android / Soul Browser follow-up

The owner confirmed that focused images still dim on Android in **Soul Browser**
with v2.12.2. A desktop cloud check and mobile Chromium emulation do not reproduce
that report. Chromium's automatic-darkening override also preserves the fixture
artwork with both Garden and Paper themes before this follow-up. This means
native tap highlighting was not sufficient to resolve the physical-phone report,
and neither passing pixels nor computed opacity/filter values close that issue.

The release adds `color-scheme: only light` to EPUB images and the focused
image, scoped away from reader text and controls. This is the documented
[Chromium element-level opt-out](https://developer.chrome.com/blog/auto-dark-theme/#per-element-opt-out)
from browser color overrides, not a demonstrated diagnosis of Soul's behavior.
The stylesheet URL advances to v2.12.3. New desktop/mobile Chromium checks use
the real automatic-darkening override, compare painted artwork with its declared
color in Garden/Paper at fit and zoom, and verify focus-return position.

[Soul's publisher](https://play.google.com/store/apps/details?id=com.mycompany.app.soulbrowser)
lists a dark theme and screen filter. Whether either setting contributes to this
report is unconfirmed. A native app screen filter may operate beyond webpage
CSS; the standards opt-out cannot guarantee overriding it. Physical Soul testing
is still required, including a comparison with those effects disabled if present.
The release must not be described as a confirmed fix for Soul until the owner
verifies it on the phone.

### Verification and deployment acceptance

After explicit approval, the prepared local source was transferred through the
connected GitHub account as `fd512c59e590ac4f1230076877cd5d204aae404c`; its
tree exactly matches the locally tested source. [Fresh CI](https://github.com/skypie0102/ShadowGarden/actions/runs/38970210426)
passes all 166 Node tests, the asset audit, static build, binding-aware Functions
package and all five browser profiles: **224 passed**, plus six intentional skips
for the Chromium-only automatic-darkening override. Desktop/mobile Chromium each
pass 46 cases; Firefox and desktop/mobile WebKit each pass 44 with two skips.
The earlier 44-case local frontend run is separate from this Pages/D1 CI evidence.

The merged tree matches that tested tree exactly. Its rebuilt release bundle
passed the D1/bucket checks before upload. Five changed static assets were
uploaded; the other 149 were already present. The production deployment and saved
project configuration both retain D1 `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86`,
the original bucket name/ID and all nine encrypted-setting names/types.

Post-publication read-only comparison confirms unchanged catalog revision 3,
timestamp `2026-10-03T11:52:50.670Z`, and all three retained snapshots; the query
reports zero rows written and `changed_db: false`. Both live catalog documents
exactly match the verified D1 baseline (main: zero series/volumes; adult: one
series/volume). No seed, migration, catalog edit, B2 object write or credential
change occurred. Both challenge endpoints are configured; unauthenticated Keeper
access returns 401. The earlier ephemeral Keeper tab token was not retained, so
this rollout did not repeat the previously successful privileged sign-in.

The served reader requests `reader-image-focus.css?v=2.12.3`; all five checked
reader asset hashes match the merged source. Both actual library footers show
`v2.12.3 · 23970eb`. The real EPUB reopened successfully using the browser's
retained public authorization and displayed its 253-page map. Original/focused
artwork has the scoped `light only` color scheme, opacity 1 and no CSS filter.

**RDR-045 remains open.** On the first live partial-cover cycle, the image top
moved from -246 px to 54 px after focus closed: a 300 px jump to the top. A repeat
held its -245 px image offset, and a fresh reopen held manager scrollTop 300 after
the opening focus callback had settled. The wrapper selector gap is corrected,
but these results do not establish a complete fix for the intermittent live
return. Its precise cause needs a failing reproduction before another change.
Physical Android/Soul dimming verification (RDR-046) also remains open.

The immediately preceding, correctly bound v2.12.2 deployment
`e8fe494a-87ce-4731-9aa9-0285f449137d` is the rollback target.

---

# Reader v2.12.2 — mobile image patch

Merged on 2026-10-16 through [PR #10](https://github.com/skypie0102/ShadowGarden/pull/10)
as `d6527742a2cde9f878a7ae23547734d858d24521`. The release and incident
safeguards pass the complete five-profile browser matrix and verification job
in [merged-commit CI](https://github.com/skypie0102/ShadowGarden/actions/runs/38886017934).
Its source tree exactly matches the tested PR tree
`05e5498b163cd7a3fafdde186c360fec29bccbb6`.

**Live:** production deployment `e8fe494a-87ce-4731-9aa9-0285f449137d`
succeeded on 2026-10-16 at 10:29:44 UTC (18:29 in Manila), using the exact
verified source above. The owner explicitly approved publishing after the
earlier automatic approval rejection.

The actual deployment and saved project configuration both match the original
D1/bucket settings and retain all nine encrypted-setting names/types. The D1
row is unchanged at revision 3; the read-only checks report zero rows written
and `changed_db: false`. Both live catalogs match that sanitized D1 baseline
exactly. The served version identifies `v2.12.2 · d652774`; canonical
`/reader` requests the refreshed image stylesheet, and all four reader asset
hashes listed below match the tested source. Both challenge endpoints are
configured, and unauthenticated Keeper library access returns 401. Browser
inspection confirms the main footer and the NSFW footer's runtime version
field identify this release; the NSFW age gate was left in place.

The correctly bound v2.12.0 deployment
`b13cf583-ad91-43e7-ad1f-55dbc9365802` remains the rollback target.

The v2.12.0 rollback removed the image touch-feedback correction from production,
so the owner still observed dimming after recovery. This patch restores the
transparent native tap feedback on EPUB images and the focused-image surface,
and changes the stylesheet URL to ensure the new release is fetched.

The release includes binding-aware packaging and explicit 503 responses for
missing live D1 state. Packaging and actual deployment checks pass. No
migration, seed, catalog edit, B2 write or credential change was performed.

Reader engine, navigation, lifecycle and rendering work is merged. Genuine
authorized book opening and Keeper login were subsequently verified as recorded
above. **Phase 5 remains open** for the image-only position correction and
physical-mobile acceptance. The prior incident and withdrawn rollout are
documented below.

---

# Reader 2.12.1 release verification

**Withdrawn after a production configuration incident.** Incident recovery
restored v2.12.0 deployment `b13cf583-ad91-43e7-ad1f-55dbc9365802`; the
current v2.12.2 deployment is recorded above. The v2.12.1
package omitted the database and bucket bindings. Earlier checks below passed
without proving actual catalog identity or credentialed access, so the prior
release-complete conclusion was wrong. Phase 5 is reopened. See the
[incident report](incidents/2026-10-16-pages-bindings.md) for recovery evidence
and the corrected acceptance gates.

Phase 5 was merged through [PR #6](https://github.com/skypie0102/ShadowGarden/pull/6)
as `235308a7e1716fa744cee8aaf7c1d53c1c9eef3e`. Cloudflare deployed v2.12.0
successfully on 2026-10-16 at 04:25 UTC, deployment
`b13cf583-ad91-43e7-ad1f-55dbc9365802`. Canonical source remains
`skypie0102/ShadowGarden` on `main`.

The v2.12.1 follow-up removes native tap highlighting from EPUB image targets
and the focused-image overlay. Both could paint touch feedback over artwork;
the WebKit parent hit surface was already transparent. The full-reader
regression checks the original and rendered image colors, transparent native
touch feedback and position after closing. It detects the nontransparent
highlight on the previous release. Keyboard focus indicators remain available.
This patch changes the image-focus stylesheet deliberately; the reconstruction
audit records that deviation. This follow-up remains merged but its deployment
has been rolled back. The historical CI and initial smoke results follow below;
they must not be interpreted as successful current production acceptance.

## Release scope

This release includes the engine, navigation, lifecycle, source-retention,
visual-cache and diagnostics milestones merged in PRs #2–#5. The footer shows
the release number and source commit in both libraries, including mobile.
Public JS/CSS revalidate so an old module cache cannot hide an update indefinitely.
Stored book IDs, progress, bookmarks and settings retain their existing formats.

The expanded matrix exposed Firefox throttling in the hidden/offscreen map
iframe. Keeping that isolated iframe transparent within the viewport fixes the
32-chapter map timeout and restores the expected seek-to-cover progress. The
frame remains behind the page, non-interactive and excluded from accessibility.

Release checks also exposed vendor render/source continuations after teardown.
The view/rendition owner now cancels late render events, and Section hooks survive
only until their pending load/read leases settle. The regression fails against
the previous implementation; repeated desktop/mobile WebKit checks pass after
the fix. The map's private runtime receives the same lifecycle integration.

WebKit rejects even a plain Blob IndexedDB write in the tested runtime. Prepared
visual cache format 3 therefore stores shared ArrayBuffer bytes and rebuilds
shared Blobs when read. Buffer bytes count toward the existing cache budget;
old disposable formats are pruned. Progress, bookmarks and settings keep their
existing schemas and identities.

The location generator also uses the book's lifetime: its sequential owner keeps
vendor CFI parsing/pacing but cancels before late work can touch destroyed arrays.
Unit checks cover closure during source loading and pacing, plus normal/shared
generation of linear chapters.

The mode matrix also reproduced a CFI landing one page early: vendor positioning
ran before new-view column styles settled. Startup and application navigation now
await the owned content/layout phase and correct that same CFI once. Render
revisions limit the correction to newly rendered paginated views; a newer request
cancels stale correction. The unit regression and cross-engine passage tests
verify both positioning order and cancellation.

Continuous scroll reporting no longer shares its callback identity with the
vendor's boolean `scrolled` flag. Its owned reporter survives vendor scroll calls
and still respects teardown/suppression; deterministic unit/browser checks force
the collision explicitly.

A post-merge repeat exposed a native WebKit click race: routine position updates
replaced the bookmark icon's identical text node between mouse down and up.
WebKit then cancelled the click before the bookmark handler ran. The button now
preserves its text node when the icon is unchanged. A deterministic full-reader
regression refreshes progress while the bookmark button is pressed; it fails in
both WebKit profiles against the old implementation.

## Verification matrix

| Configuration | Scope | Status |
| --- | --- | --- |
| Desktop Chromium | Full production reader and reconstruction suite | v2.12.1: 43 cases pass |
| Pixel 7 Chromium | Full suite with touch/mobile layout | v2.12.1: 43 cases pass |
| Desktop Firefox | Full production reader and reconstruction suite | v2.12.1: 43 cases pass |
| Desktop WebKit | Full production reader and reconstruction suite | v2.12.1: 43 cases pass |
| iPhone 13 WebKit | Full suite with touch/mobile layout | v2.12.1: 43 cases pass |

The v2.12.1 candidate passed all 159 Node tests and 215 browser cases, the asset
audit and both builds in [PR CI](https://github.com/skypie0102/ShadowGarden/actions/runs/38878393099)
and [push CI](https://github.com/skypie0102/ShadowGarden/actions/runs/38878389285).
The Git tree `660cc08962ee77dbbebf734e0c2998821c8e30e1` matches the local
source and merged release exactly. Local verification also includes the entire
84-case Chromium suite before bookmark integration, the four combined
bookmark/image regressions and both final color-reference checks.

The image color check uses the generated fixture's declared SVG fill as its
independent reference. WebKit's canvas SVG sampling returned the background
color while the actual screenshot correctly displayed the center circle;
canvas SVG rasterization is therefore not used as the expected pixel value.

The v2.12.0 candidate passed all 159 Node tests and 205 browser cases, the asset
audit and both builds in clean [push CI](https://github.com/skypie0102/ShadowGarden/actions/runs/38849575414)
and [pull-request CI](https://github.com/skypie0102/ShadowGarden/actions/runs/38849580179).
All three final long/repeated/unique-illustration profiles passed with unchanged
page totals, a live source peak of 10 and zero cached-reopen image conversions.

Release-specific EPUB fixtures are original technical publications. They cover
EPUB 2 NCX navigation, encoded paths containing a space, nested chapters, ruby,
Latin/Greek/Arabic text and tables, footnotes, bookmarks and saved-position
reopening. A corrupt embedded illustration must fall back to usable prose.
The existing rendering tests cover distant chapter replacement, repeated plates,
cache pruning/reopening and page-map download failure. Phase 4's nine profiles
cover the 80-chapter and repeated/unique illustration fixtures; measured results
and their limits remain in [READER_PERFORMANCE.md](READER_PERFORMANCE.md).

## Withdrawn production rollout and insufficient smoke checks

[PR #7](https://github.com/skypie0102/ShadowGarden/pull/7) merged the bookmark
correction, and [PR #8](https://github.com/skypie0102/ShadowGarden/pull/8) merged
the image-touch fix and v2.12.1 as `154381761d6bec1fa246166f0ba300f09471d6ab`.
Pages deployment `5658687a-f60a-4a1f-8441-78738c2b04e1` reported success on
2026-10-16 at 09:18:03 UTC. Its canonical production branch is `main`, its
working-tree marker was clean, and its built metadata identified that exact SHA.
It nevertheless omitted the D1/bucket bindings and is now withdrawn. The
following checks failed to detect that configuration failure.

Live Chromium checks at desktop and Pixel 7 sizes verify both library footers
show `v2.12.1 · 1543817`, are visible and cause no horizontal overflow. The
actual deployed reader opens an original intercepted EPUB, zooms its image and
closes focus with zero vertical displacement on both profiles. Native image
feedback is transparent, and neither session reports a page error.

Both login challenge endpoints and both catalogs return 200. Unauthenticated
`GET /admin-api/library` returns 401, and a nonexistent raw EPUB probe returns
404. This probe does not establish real provider access; ticket enforcement is
covered by the isolated suite, with provider limits retained below.

All four checked assets match the merged source exactly:

| Asset under `public/` | Served SHA-256 |
| --- | --- |
| `assets/css/reader-image-focus.css` | `0824b36d4e4aee3651cd54fec51b1fbe26caf1a3fa9c4ac4b64143e252ea8f36` |
| `assets/js/reader/image-focus.js` | `b4455bb69dd1cf94ca5b0c733506512183afbd720812d46816bafab3a69b9eb2` |
| `assets/js/reader/bookmarks-controller.js` | `6fa8f7dcc6fb824ab1647569d714424f2fc4423ee1762a915ec284b6e4245f39` |
| `assets/js/reader/engine.js` | `c53d8d37dea992a1ec77ee9d447eea34c342ed6cc775a76c78fef01449bd7d3b` |

## Deployment and rollback

1. Require the Node suite, asset audit, both builds and complete browser matrix
   on the exact source tree being merged.
2. Deploy that merged source to Pages project `shadowgarden`, production branch
   `main`, retaining hostname `shadowgarden-bon.pages.dev` and its existing
   configuration. No migration, seed, catalog edit, B2 operation or secret update
   is needed for the reader release.
3. Build `/data/version.json` with the deployed Git SHA, branch `main` and build
   timestamp. Compile and include Pages Functions as well as the static manifest.
4. Confirm the canonical production deployment, served metadata, exact reader
   asset hashes, both footer labels, login challenge endpoints, both catalogs,
   denied unauthenticated admin access and an unknown raw book request. Exercise
   the actual deployed reader using an original intercepted EPUB in an isolated
   browser context; this changes no live catalog or stored object.
5. Keep v2.12.0 deployment `b13cf583-ad91-43e7-ad1f-55dbc9365802` as the patch
   rollback target. The pre-refactor deployment
   `dfac687d-06fa-4bc5-9f3f-6eae5a9f4a33` is also retained. Cloudflare's Pages
   rollback endpoint for v2.12.0 is
   `POST /accounts/fa95f62f96a0ff3b92a45175d94a48b6/pages/projects/shadowgarden/deployments/b13cf583-ad91-43e7-ad1f-55dbc9365802/rollback`.
   For the pre-refactor source, use
   `POST /accounts/fa95f62f96a0ff3b92a45175d94a48b6/pages/projects/shadowgarden/deployments/dfac687d-06fa-4bc5-9f3f-6eae5a9f4a33/rollback`.
   A code rollback does not reverse browser progress or remote catalog/media
   edits. This release performs no remote catalog/media edits.

## Limits

Playwright device profiles emulate viewport and touch behavior; they do not
replace a physical iOS/Android check. Its WebKit build is not a certification of
every Safari version. Original fixtures cover varied structures, not all EPUBs.
Fixed-layout, heavily scripted and malformed publications retain vendor limits.
Browser tests intercept authorization and publication bytes only inside isolated
test contexts; real Turnstile credentials and real B2 upload/write permission
are separate provider checks, not proven by those fixtures. Existing production
secrets, storage and authorization stay in place.
