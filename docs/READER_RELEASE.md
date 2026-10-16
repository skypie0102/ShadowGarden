# Reader 2.12.0 release verification

Phase 5 candidate, 2026-10-16. Verification and deployment are in progress.
Canonical source is `skypie0102/ShadowGarden` on `main`; the candidate is reviewed
on `refactor/reader-release` before merging. No production release is claimed
until the deployment and live checks below are recorded.

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
| Desktop Chromium | Full production reader and reconstruction suite | Pending |
| Pixel 7 Chromium | Full suite with touch/mobile layout | Pending |
| Desktop Firefox | Full production reader and reconstruction suite | Pending |
| Desktop WebKit | Full production reader and reconstruction suite | Pending |
| iPhone 13 WebKit | Full suite with touch/mobile layout | Pending |

Release-specific EPUB fixtures are original technical publications. They cover
EPUB 2 NCX navigation, encoded paths containing a space, nested chapters, ruby,
Latin/Greek/Arabic text and tables, footnotes, bookmarks and saved-position
reopening. A corrupt embedded illustration must fall back to usable prose.
The existing rendering tests cover distant chapter replacement, repeated plates,
cache pruning/reopening and page-map download failure. Phase 4's nine profiles
cover the 80-chapter and repeated/unique illustration fixtures; measured results
and their limits remain in [READER_PERFORMANCE.md](READER_PERFORMANCE.md).

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
   denied unauthenticated admin access and raw protected book access. Exercise
   the actual deployed reader using an original intercepted EPUB in an isolated
   browser context; this changes no live catalog or stored object.
5. Keep deployment `dfac687d-06fa-4bc5-9f3f-6eae5a9f4a33` as the pre-refactor
   rollback target. Cloudflare's Pages rollback endpoint is
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
