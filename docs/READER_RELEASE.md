# Reader v2.12.2 — mobile image patch

Prepared on 2026-10-16 from the merged reader and incident safeguards. The
v2.12.0 rollback removed the image touch-feedback correction from production,
so the owner still observed dimming after recovery. This patch restores the
transparent native tap feedback on EPUB images and the focused-image surface,
and changes the stylesheet URL to ensure the new release is fetched.

The release includes binding-aware packaging and explicit 503 responses for
missing live D1 state. Before deployment, require the configured D1 identity,
bucket variables and encrypted-setting names to match the restored project.
After deployment, inspect both the actual deployment and saved configuration,
then compare both real catalogs with the read-only D1 baseline. No migration,
seed, catalog edit, B2 write or credential change belongs to this release.

Reader engine, navigation, lifecycle and rendering work is merged. **Phase 5
remains open** until genuine authorized book opening and Keeper login, plus the
reported mobile interaction, have been accepted on the live site. Fixture
browser results are separate from those checks. The prior incident and its
withdrawn rollout are documented below.

---

# Reader 2.12.1 release verification

**Withdrawn after a production configuration incident.** Production is restored
to v2.12.0 deployment `b13cf583-ad91-43e7-ad1f-55dbc9365802`. The v2.12.1
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
