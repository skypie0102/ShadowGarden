# Reader releases

**Current Reader behavior baseline:** v2.27.0. Site release v2.27.1 updates
[mobile Library reading covers](library-reading-cover-release-2.27.1.json). Ongoing
[maintenance](READER_MAINTENANCE.md) is tracked separately from deployments.

## Reader v2.27.0 — continuous media playback for background narration

**Live:** deployment `8991bd15-0a0c-4d8a-8387-cd7de88ed7c2`, source `20c7fc001b43427c63d92ed8e1cfb638f42f35f5`,
verified at 2026-10-26T09:34:28.457Z. Supported MPEG Media Source engines append narration to
one native audio timeline across passage/chapter boundaries. Media time selects
the spoken passage. The same four-passage synthesis queue supplies the rolling
decoder buffer; every append evicts consumed audio while retaining one second
of prior audio, including after slow synthesis. Unsupported engines use clips
without explicit pause/remove/load at natural boundaries. Media Session preserves
playing intent through preparation. Optional Audio Session uses playback and
restores its prior type at Exit/completion/error/disposal. Future preparation
errors finish appended audio, then Retry targets the unread passage.

Candidate and main pass 510 Node tests, 1,031 full browser cases and all 125
focused speech checks with 9 existing skips and zero Playwright retries. One
desktop WebKit workflow job was rerun after its 30-minute timeout at case 189;
no test failure preceded the timeout. The checked and merged application trees
match. The previous live source fails stable-source reproduction; eight direct
live desktop/mobile Chromium cases pass after deployment. They use original
EPUBs, native MP3 decoding and mocked catalog/book access/TTS. No production book
text or synthesis requests are used. Hidden-page checks freeze animation frames;
media controls, Pause/Resume offsets, manual skips, future-failure Retry and Exit
cleanup pass. Served assets, version/default voice, rejection guards and immediate
catalog/snapshot/configuration preservation pass with zero DB writes. These are
browser checks, not physical device screen-lock acceptance. Websites cannot
override browser/OS suspension, forced closure, audio-focus interruptions or
device power restrictions. [PR #75](https://github.com/skypie0102/ShadowGarden/pull/75) ·
[Guide](READER_TTS.md) · [Evidence](reader-speech-background-release-2.27.0.json).

## Reader v2.26.2 — themed SVG playback controls

**Live:** deployment `466a601d-23d9-456d-b49c-ec68c20d5984`, source `c6060f4af43eacbb6123b04e210fd31f2ae0452e`,
verified at 2026-10-26T05:26:04.472Z. Font-based playback glyphs are replaced by matching
currentColor SVGs in both control surfaces. Play has a triangle, Pause has two
bars, Previous/Next use skip shapes with end bars, and Exit uses an X. The options
close button uses the same X style. Rendering changes labels/state while keeping
SVG nodes intact across Play/Pause/Resume/Retry. Accessible names and tooltips
describe the current action. Order, 44px targets and responsive layout remain.
The icons follow all four Reader palettes and Adult rose.

Candidate and main pass 504 Node tests, 1,016 full browser cases and all 110
focused speech checks, with 9 existing skips and zero retries. The exact merged
application tree matches the candidate. The background-tab fixture waits for
visible follow and relocation to finish before freezing frames, retaining its
hidden-position and final-passage assertions. Eight local visual cases and eight
direct live Reader checks pass on desktop/mobile Chromium with original EPUBs
and mocked audio. Playing/paused/drawer controls and 320px/393px/1280px layouts
are reviewed across Garden/Night/Paper/Black and Adult rose. Served assets,
version/Brian metadata, request guards and preservation pass with zero database
writes. Physical Android/Soul acceptance remains separate.
[PR #73](https://github.com/skypie0102/ShadowGarden/pull/73) ·
[Guide](READER_TTS.md) · [Evidence](reader-speech-svg-release-2.26.2.json).

## Reader v2.26.1 — decorative separator speech fix

**Live:** deployment `92a7ad18-4567-40ed-8316-6abc29222138`, source `29bdf47a4120266db06dd3afac36b2fa9279616c`,
verified at 2026-10-26T03:44:15.253Z. The source omits ornament-only passages and
chapters from playback and preloading. Common inline fleurons/star ornaments,
incompatible XML characters and discretionary word breaks are cleaned by a
shared synthesis-only helper used by browser requests and the provider adapter.
All scripts' letters/numbers and meaningful punctuation/units/currency/math in
readable prose remain. Original text, markup and CFI ranges remain intact.
The endpoint rejects unspeakable text before authorization/rate-limit writes or
provider connections. Readable provider/network failures retain Retry behavior.

Candidate and main pass 504 Node tests, 1,016 full browser cases and all 110
focused speech checks across five profiles, with 9 existing skips and zero Playwright
retries. Main's desktop WebKit workflow job was rerun once after a background-tab
tracking assertion saw 1 rather than its captured 0; narration had reached the
later chapter. The rerun passes. The exact merged tree matches the candidate.
The previous source reproduces the stop at `❦` with a rejecting fixture provider.
Four direct live checks pass across desktop/mobile Chromium, covering both flows,
preload, a decorative chapter, inline ornaments and original ranges/markup.
Fixtures use disposable original EPUBs and mocked synthesis. Actual production's
symbol-only 400 guard, voice/request guards, served assets and preservation pass
with zero database writes. Physical Android/Soul acceptance remains separate.
[PR #71](https://github.com/skypie0102/ShadowGarden/pull/71) ·
[Guide](READER_TTS.md) · [Evidence](reader-speech-text-release-2.26.1.json).

## Reader v2.26.0 — independent browsing and floating controls

**Live:** deployment `30b73dd6-7ecf-406a-be65-e1a796a9c521`, source `a453fb39586391cbd5f333983b5691b156352b8b`,
verified at 2026-10-26T00:50:48.507Z. Browsing suspends screen-following while speech and
the four-passage preload buffer continue across passages and chapters. The status
button returns to the spoken passage and enables following without restarting
audio, including paused/preparing states. Wheel/swipe page turns retain speech;
explicit page buttons, TOC and seek actions retain their stop behavior.
The parent viewport observes manual movement when WebKit suppresses callbacks
inside script-disabled EPUB frames, distinguishing owned navigation/animation
and anchor-preserving buffer changes. The EPUB sandbox remains intact.

The bar is ordered status/return, Previous, Play/Pause, Next, Stop, settings cog.
Narrow screens place status above five icon controls; all targets are at least
44px and keyboard order follows the visual order. Candidate and main pass 501
Node tests, 1,006 full browser cases and all 100 focused speech checks across five
profiles, with nine existing skips and zero retries. The exact merged tree matches
the verified candidate. Eight direct live checks pass with disposable original
EPUBs and mocked audio; 320px/1280px toolbar captures are reviewed. Production
assets, voice/request guards and preservation pass with zero database writes.
Physical Android/Soul acceptance remains separate.
[PR #69](https://github.com/skypie0102/ShadowGarden/pull/69) ·
[Guide](READER_TTS.md) · [Evidence](reader-speech-browsing-release-2.26.0.json).

## Reader v2.25.0 — Brian default and speech preloading

**Live:** deployment `739637fd-2de4-4af4-bd46-4e1e861362eb`, source `e5fcf059903d0e63011954402967c6ff9b6488fa`,
verified at 2026-10-25T15:48:59.582Z. [PR #67](https://github.com/skypie0102/ShadowGarden/pull/67)
sets BrianMultilingual · Male as the default in the Reader, HTML fallback and API
metadata. Saved English selections remain intact. A session-owned buffer prepares
four future passages across linear chapters, skipping illustration-only sections,
with at most two background synthesis requests. Consumption reuses ready or
in-flight audio and refills from the retained source. Pause/Resume and speed
changes retain the buffer. Previous, Read from here, voice changes, Stop and
disposal cancel and clear it; speculative failures retry only when reached.

Candidate and main pass 501 Node tests, 991 full browser cases and all
85 focused speech cases, with 9 existing skips and zero retries. The exact
merged application tree matches the candidate. The prior live release fails the
four-passage buffer check; two direct live Reader checks pass after deployment.
Production preserves the catalog, snapshots and configuration with zero database
writes. Version, changed assets, live default voice and request guards pass.
The browser checks use disposable original EPUBs and mocked synthesis; they do
not claim new live generated Brian audio or Android/Soul hardware acceptance.
Network startup and a depleted buffer can still show Preparing speech.
[Guide](READER_TTS.md) · [Structured evidence](reader-speech-buffer-release-2.25.0.json).

## Reader v2.24.0 — English voices and smooth playback controls

**Live:** deployment `7215e3c8-29dc-4bb4-afda-83bb33f7ef2c`, source `32af1ceb4f125afcf12517a87e76c3c426368ffd`,
verified at 2026-10-25T13:22:19.994Z. [PR #65](https://github.com/skypie0102/ShadowGarden/pull/65)
limits the voice picker to English regions and normalizes saved non-English voices
to Emma. The floating bar is Play/Pause, Previous, settings, Next, Stop and retains
44px controls on 320px screens. Following an already rendered passage in the current
chapter performs one eased movement rather than a top-then-center navigation.
Pause, Stop, manual input, newer navigation and disposal cancel remaining frames.
Reduced motion uses immediate positioning. Speech owns its chapter boundary;
chapter/page changes retain authoritative navigation and hidden-tab return behavior.

Candidate and main validation pass 495 Node tests and 981 browser cases, with nine
existing platform skips and zero retries. All 75 focused cases pass, including real
intermediate scroll positions, cancellation, voice persistence, all reader themes,
native audio and background rendering. Five candidate captures were reviewed.
The merged application tree matches the tested candidate. Production preserves the
catalog, snapshots and configuration; all 7 version/catalog/asset checks and live
speech metadata/request guards pass. Physical Android/Soul acceptance is separate.
[Guide](READER_TTS.md) · [Structured evidence](reader-speech-controls-release-2.24.0.json).

## Reader v2.23.0 — centered, themed narration

**Live:** deployment `c4ca9a98-4f32-4be7-993e-96b58a31e036`, source `4de24e0b6f923f704e8341e0000027003fc940d5`,
verified at 2026-10-25T09:01:09.275Z. [PR #63](https://github.com/skypie0102/ShadowGarden/pull/63)
centers the spoken range in Pages and Continuous, including the book boundaries,
and highlights it using Garden, Night, Black, Paper and Adult accent colors.
Start/Resume closes options; reopening them keeps them open across automatic
passage changes. Original-text chunk CFIs advance through long paragraphs.
Custom Highlight and the SVG fallback preserve EPUB markup and canonical page
measurement. Temporary viewport spacing is released on Stop, disabling following
and rendition disposal. Audio progression stays independent of rendering.

Candidate and main checks pass 494 Node tests and 961 browser cases, with nine
existing platform skips and zero retries. All 55 focused TTS cases pass; eight
candidate captures were reviewed. The merged application tree matches the tested
candidate. The book-start centering check fails before the boundary correction
and passes afterward. Production preserves the immediate catalog, snapshots and
configuration; all 9 version/catalog/asset checks, voice metadata and request
guards pass. Six further mobile Chromium fixture checks pass against the deployed
reader. Physical Android/Soul acceptance is separate.
[Read aloud guide](READER_TTS.md) · [Structured evidence](reader-speech-position-release-2.23.0.json).

## Reader v2.22.1 — Edge TTS read aloud

**Live:** deployment `7fc9fbb0-c512-4f2e-b6b8-202c6243b43d`, source `4fb189af2cb50f01cd58562fd40a4a9254882265`,
verified at 2026-10-25T04:40:27.888Z. [PR #62](https://github.com/skypie0102/ShadowGarden/pull/62)
adds the themed speech drawer and compact playback bar, online voice selection,
speed, pause/resume, passage controls and optional following across chapters.
Voice/speed/follow settings persist separately from EPUB layout settings.
Actual user navigation/input owns cancellation; delayed relocations cannot stop
the next chapter's speech. Audio requests, blobs and Media Session actions have
explicit reader lifetimes. The API applies Garden Pass, origin and bounded-input
guards without changing catalog, book storage or deployment bindings.
v2.22.1 corrects the omitted Pages invocation route from the initial v2.22.0
publish. Function coverage auditing and live TTS checks now gate deployment.

Final release verification passes 494 Node tests and 931 browser cases, with
9 existing skips and zero retries. All 25 focused cases pass; five captures
were reviewed. Native decoding is separate from deterministic media state tests.
Live Edge and Cloudflare probes returned valid 24 kHz mono MP3. Production
preservation, served assets, voice metadata and rejection guards pass. Physical
Android/Soul testing remains a separate acceptance step.
[Read aloud guide](READER_TTS.md) · [Structured evidence](reader-edge-tts-release-2.22.1.json).

## Reader v2.21.0 — paragraph alignment

**Live:** deployment `ef337f69-167b-4dd1-8e2a-9bd6b18924bb`, source `293090c128e0b4680885f68245f4d47e5801feaf`,
verified at 2026-10-25T00:43:15.637Z. [PR #61](https://github.com/skypie0102/ShadowGarden/pull/61)
adds Default, Left, Justify and Right to Reading settings. Default preserves
EPUB alignment and restores the original declarations after an override.
The preference persists and resets to Default. Both reading flows, newly loaded
chapters and canonical page-number measurement use the selected choice.

The PR and main release pass 477 Node tests and 906 browser cases, with
9 existing platform skips and zero retries. Ten focused checks cover authored
stylesheet/inline-important/inherited alignment, Default restoration, persistence,
reset, chapter/flow changes and canonical measurement. Five captures were reviewed.
All 9 production checks pass; the immediate catalog, snapshots and configuration
baseline is preserved with zero DB writes. Interaction tests use a disposable EPUB;
physical Android/Soul acceptance from older releases remains historical.
[Structured release evidence](reader-paragraph-alignment-release-2.21.0.json).

## Reader v2.14.1 — deliberate image activation

**Live:** deployment `fab2efb5-42d7-4dce-be2c-42990c9b517a` succeeded on 2026-10-19 at 04:19:16 UTC,
from clean main source `7d50991eeaca4f96077da2fa1467f99f4e322917`, tree `9fef342281ffee0765010cee653346b0ea03d8da`.
[PR #31](https://github.com/skypie0102/ShadowGarden/pull/31) requires double tap
on touch devices and double click with a mouse to open or dismiss image focus.
Single input remains inert; the explicit X close button and Escape remain available.
The mobile hint now says double-tap to return.

The image controller owns touch transport for each EPUB document and WebKit parent
hit surface. It replaces competing single-pointer, click and global touch-fallback
opening paths; one physical tap enters the recognizer once. A pair requires the
same image, nearby points and at most 350 ms. Scrolls, movement, multi-touch,
cancelled touches and long presses clear the pair. Native reading scroll/pinch,
focused-image zoom/pan, artwork colors and reading-position restoration remain.

The two activation controls fail on the original implementation and pass on the
correction. Audit, 224 Node tests, static build and the binding-aware Functions
package pass. [CI 39197714084](https://github.com/skypie0102/ShadowGarden/actions/runs/39197714084)
passes all five profiles on the tested tree: 432 browser passes and eight existing
platform skips. Local desktop/mobile Chromium also pass 50 targeted cases. The
new full-reader cases exercise single input, separated input and double activation
in both Continuous and Pages. Repeated return, image-only covers, zoom/pan and
color regressions retain their position/appearance assertions.

Production checks compare exact served reader files and version metadata, both
public catalog hashes, the revision-8 D1 document and eight snapshots, actual/saved
bindings and encrypted-setting metadata. No catalog, object, credential or database
migration is performed. All six live desktop/mobile Chromium cases pass against the deployed reader with an original disposable EPUB: single/separated input, double activation in both flows, and zoom/X return. Only fixture responses are intercepted inside those browser contexts.

Physical Android/Soul acceptance from v2.12.6 is historical; this release's touch
checks use browser device emulation. Real-book authorization/CAPTCHA is not repeated.
The retained rollback is v2.14.0 deployment `c91b8b1e-2033-4215-b59c-61edb547749f`.
[Structured verification evidence](reader-release-2.14.1.json).

## Reader v2.12.8 — app callback lifetime

**Live:** deployment `9493cc7c-1b23-4bfd-b55d-19109e638d98` succeeded on
2026-10-18 at 14:00:14 UTC (22:00 in Manila), from clean `main` source
`7d3dbed875d3d327f6f3ee8fdd32523eddc7f8ba`, tree
`a9004d17650aefc5d7828920640495a40f2d5445`.
[Verification evidence](reader-release-2.12.8.json) records identities and limits.

[PR #28](https://github.com/skypie0102/ShadowGarden/pull/28) applies the reader
scope to four reproduced late failure callbacks: startup TOC loading, page-map
refresh, startup correction of page-only saved progress and flow recovery.
Disposed recovery cannot bring back its error screen. Active provider failures,
including `AbortError`, retain the same diagnostics, fallbacks and recovery UI.
The [maintenance record](READER_MAINTENANCE.md) retains the failing-before controls.
Navigation order, persistence, accepted scrolling and image-focus CSS are unchanged.

The exact release commit passes the audit, **211 Node tests**, static build,
binding-aware Functions package and **387 browser cases** in
[CI run 39124003245](https://github.com/skypie0102/ShadowGarden/actions/runs/39124003245)
on its first attempt. Both Chromium profiles pass 79 cases; Firefox and desktop
WebKit pass 77 each with two existing skips; mobile WebKit passes 75 with four
existing skips. All five new app cases pass in every profile.

All 292 tracked files match the release Git blobs. The pinned Wrangler package
compiles with the binding guard. Only the app module and generated version
payload differ among 160 static assets. Two changed assets were staged before
the pause; all 160 were revalidated before publishing, with no additional upload.
Actual and saved D1, B2 bucket, compatibility settings and all nine encrypted
setting names/types match the refreshed baseline.

The resumed release captures the current revision-8 catalog after the pause:
timestamp `2026-10-18T13:54:43.265Z`, exact document hash and all eight snapshot
identities/checksums match before and after deployment. Both public catalogs
match that D1 content, with one series/one volume in each library. Read-only
verification queries report zero rows written and `changed_db: false`.

Live metadata identifies `v2.12.8 · 7d3dbed` on `main`. All nine checked
reader/entry/footer/CSS asset hashes match source. Both challenge endpoints
provide site keys; unauthenticated Keeper access returns 401, a known raw EPUB
returns 403 without its ticket, and the missing B2 cover probe returns the expected
`media_not_found` 404.

The built-in browser was unavailable at deployment. Rendered footer inspection, credentialed
Keeper sign-in and authorized real-book reopening were not repeated. Both library
HTML version targets and their shared loader match the tested source, and the
live version payload is correct. The owner's v2.12.6 Android/Soul acceptance and
earlier genuine authorization checks retain their documented scopes. No
migration, seed, catalog edit, B2 object write or credential change occurred.

The documented M1–M5 reader maintenance increments are now deployed. Retained
media retry/fallback policy and the causally unattributed historical stress trace
keep their existing limits; this release makes no broader bug-free claim.

Rollback target: verified v2.12.7 deployment
`288e4790-003b-46ef-bb0a-d1bb37377413`.

### Post-release browser verification — 2026-10-18

At 22:45 Manila, an isolated Chromium test browser loads the live site normally.
Both rendered library footers visibly show `v2.12.8 · 7d3dbed`; the adult footer
also retains its Adult Section label. The main library loads its real catalog
and cover, and has no uncaught page errors during this check. This completes
the painted-footer check that was unavailable through the built-in browser.

Keeper's live login form is reached, but this fresh browser session has no Keeper
token. Following an actual library book link reaches the Garden Pass/Turnstile
gate. No challenge is bypassed, no credential is submitted, and no authorized
EPUB opening is claimed. At that point, credentialed Keeper sign-in and real-book
opening remained pending their normal authentication gates.
[Browser evidence](reader-release-2.12.8.json) records the exact visible footer
labels, browser method and remaining limits. No application or server setting
changes accompany this verification.

### Owner Keeper acceptance — 2026-10-18

At 23:20 Manila, the owner reports: “I manually checked the Keeper. It's fine.”
This records Keeper acceptance for the current v2.12.8 deployment. The isolated
browser's earlier fresh-session result remains historical evidence; an automated
credentialed Keeper sign-in was not repeated. Authenticated opening of a real
EPUB remains the outstanding release check. The
[machine-readable release record](reader-release-2.12.8.json) retains this owner
report separately from automated and browser verification.

## Reader v2.12.7 — bookmark failure lifetime

**Live:** deployment `288e4790-003b-46ef-bb0a-d1bb37377413` succeeded on
2026-10-18 at 11:03:12 UTC (19:03 in Manila), from clean `main` source
`3c0ec3b3711051e298b9682dd1421b4985e7207a`, tree
`ac3969ef517007c8e98f1d1dfc331f94aa4f9a36`.
[Verification evidence](reader-release-2.12.7.json) records identities and limits.

[PR #27](https://github.com/skypie0102/ShadowGarden/pull/27) guards the bookmark
handler's diagnostic and failure toast with its root controller lifetime.
Delayed lookup/navigation rejection stays quiet after closure; active failures,
including an `AbortError`, remain visible. A list refresh keeps a live bookmark
intent. Navigation order, persistence, scrolling and focus behavior are unchanged.

The exact release commit passes the audit, **211 Node tests**, static build,
binding-aware Functions package and **362 browser cases** in
[CI run 39100645437](https://github.com/skypie0102/ShadowGarden/actions/runs/39100645437)
on its first attempt. Both Chromium profiles pass 74 cases; Firefox and desktop
WebKit pass 72 each with two existing skips; mobile WebKit passes 70 with four
existing skips. The complete matrix retains the same eight platform skips.

The pinned Wrangler package compiled the release with the binding guard.
All 200 checked source/build-input files match the release's Git blobs.
Two static assets were uploaded and 158 reused. Actual and saved configuration
match the fresh baseline: original D1, B2 bucket, compatibility settings and all
nine encrypted-setting names/types. Read-only pre/post queries match the exact
revision-7 document, timestamp `2026-10-17T04:40:11.572Z` and all seven snapshot
identities/checksums, with zero rows written and `changed_db: false`.
Both public catalogs match sanitized D1 content exactly.

Live metadata identifies `v2.12.7 · 3c0ec3b` on `main`. All nine checked
reader/entry/footer/CSS asset hashes match source. Both challenge endpoints
provide site keys; unauthenticated Keeper access returns 401, the known raw EPUB
returns 403 without a ticket, and a nonexistent B2 cover returns the expected
`media_not_found` 404.

The live browser surface was unavailable for this rollout. Rendered footer
inspection, credentialed Keeper sign-in and authorized real-book reopening were
not repeated. Both library HTML version targets and their shared loader match
the tested source, and the live version payload is correct; this is source/
endpoint verification, separate from a new live painted-UI check. The v2.12.6
phone report and earlier genuine authorization/provider checks retain their
documented scopes. No migration, seed, catalog edit, B2 object write or credential
change occurred.

Rollback target: accepted v2.12.6 deployment
`7e9cb704-e2bb-4e42-955e-384bb2b4bbe2`.

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
