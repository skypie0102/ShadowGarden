# Android reader evaluation

Status: preliminary source review and reader prototypes, 2026-10-29.
Neither prototype is a production reader and the comparison remains incomplete.
The [Android roadmap](ANDROID_ROADMAP.md)
tracks the required experiments and acceptance criteria.

## Candidates

| | Readium Kotlin Toolkit | Existing website reader in an Android WebView |
| --- | --- | --- |
| Starting point | Android EPUB toolkit with publication and navigator components | Reuse ShadowGarden's existing EPUB.js-based reader and its controllers |
| Evidence | Readium [3.4.0 README](https://github.com/readium/kotlin-toolkit/blob/3.4.0/README.md) reports EPUB 2/3, reflowable pagination/scrolling, text search, image-viewer integration and TTS support. Fixed-layout scrolling is not reported as implemented. | [Reader architecture](../guides/READER_ARCHITECTURE.md), [settings](../guides/READER_SETTINGS.md), [controls](../guides/READER_CONTROLS.md) and [read aloud](../guides/READER_TTS.md) describe the existing website behavior and known device acceptance limits. |
| Integration | Readium 3.4.0 lists Android min SDK 24 and compile SDK 37, above the scaffold's compile SDK 35. Its README says the Kotlin/Gradle requirements in the table apply when using a submodule rather than Maven Central, and requires core-library desugaring. Transitive requirements must be verified with a build before choosing a version. | Requires a safe local-content architecture, Android lifecycle integration and a supported path for existing same-origin Garden Pass, book tickets and Keeper authentication. A WebView wrapper alone does not establish any of those. |
| Location | Uses Readium publication/navigation APIs; relationship to the site's EPUB.js CFI records and Android backup format must be measured rather than assumed. | Existing reader already uses EPUB.js CFIs and has substantial local patches for navigation, scrolling and image focus. A change in EPUB edition can still invalidate a saved location. |
| Licensing | [BSD 3-Clause](https://github.com/readium/kotlin-toolkit/blob/3.4.0/LICENSE); review dependency and optional module licenses separately before shipping. | Check the existing [EPUB.js vendor contract](../guides/READER_VENDOR_CONTRACT.md) and all bundled licenses. |

The user's Android progress is separate from website browser data. Direct
website-to-app CFI migration is not a product requirement; location stability
within Android, including after backup and restore, is. Comparing locations still
helps assess whether reusing the website reader preserves its behavior.

## EPUB.js test harness

`android/app/src/androidTest/` contains an isolated prototype using the site's
pinned EPUB.js and JSZip files in the instrumentation APK only. It generates an
original, two-chapter EPUB in app-private cache, serves only that file and the
two vendor scripts through a synthetic origin, and blocks other intercepted
requests. It disables WebView file/content access and exposes no JavaScript
bridge. The test opens the EPUB, navigates to chapter two, saves its CFI in a
test-only preference, recreates the activity and checks that the same chapter and
CFI are restored. Test data are removed afterward.

The [manual emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/40836852045)
passed both the launch smoke test and this EPUB test on Android 9 / API 28
x86_64 at source `040d165`. The generated book and vendor resources were served
locally by the test harness; the app declares no Internet permission. This run
did not toggle airplane mode or use a real book. An earlier run timed out; the
test page's optional-chaining syntax was removed and diagnostic reporting added
before the successful run. The earlier timeout was not independently diagnosed.

This proves only the measured test scenario on the tested Android WebView. It
does not execute ShadowGarden's reader controllers/extensions, test process
death, establish a secure production WebView architecture, provide a UI for
users or implement personal backup. The remaining matrix below is still needed
before making a reader choice.

## Readium test harness

An experimental Readium 3.0.0 host is included in debug builds only, with an
instrumentation test that uses the same generated EPUB as the EPUB.js test. The
host is not exported and opens only its fixed, test-generated file in private
cache. The debug manifest removes Internet permission for the experiment. Its
saved locator lives in test-only preferences; test data are cleaned up afterward.
The app's release build does not include the Readium dependencies or host.

Version 3.0.0 was selected for this comparison because its documented Android
compile SDK is compatible with the current SDK 35 scaffold. It is not a decision
to ship that version. A production choice must re-evaluate current Readium
versions, transitive licenses, API compatibility and the required SDK upgrade.
The harness intentionally recreates its navigator after activity recreation; it
does not implement a production process-death restoration strategy.

The [manual emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/40846836749)
passed all three instrumented tests on Android 9 / API 28 x86_64 at source
`34f8f44`: the launch smoke test and both EPUB.js and Readium prototypes. For
Readium, the test checks the target app has no Internet permission, observes the
first chapter's text, navigates to the second, verifies its rendered text, saves
the navigator's locator JSON and checks the restored resource and progression
after activity recreation. A local unsigned release build also succeeded; its
DEX files contained no Readium or prototype activity names. This is evidence for
one short EPUB and layout only, not process death, airplane-mode toggling, real
books, backup compatibility or a full reader comparison.

## Extended generated fixture

The instrumentation suite also generates a reflowable EPUB 3 with 12 chapters,
80 short paragraphs per chapter, a 12-entry table of contents and an original
256 × 192 PNG in the last chapter. Both prototypes use the same book. Each test
checks the table-of-contents entry count, opens the final chapter, checks its
marker and that the image decodes, saves a location and recreates the activity.
The tests inspect the chapter document and image loading; they do not verify
that the marker or illustration is visible within the current page viewport.
The EPUB.js test compares its restored CFI; the Readium test compares its saved
resource and progression. The prototypes remain offline with no app Internet
permission, and test files and preferences are removed afterward.

The [manual emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/40866603424)
passed all five instrumented tests on Android 9 / API 28 x86_64 at source
`37c13ff`, including the extended fixture in both prototypes. This evidence does
not cover EPUB 2, image zoom, continuous scrolling, changing font or viewport,
process death, large real-world publications, or untrusted-content security.

## EPUB.js passage and layout experiment

An additional instrumentation case selects a passage in paragraph 40 of the
last chapter of the generated EPUB 3, derives a range CFI, and displays it. It
saves the CFI to test-only preferences, recreates the activity, changes the
reader viewport from 280 × 340 to 220 × 260 CSS pixels and increases the font
size from 100% to 160%, then restores the range. It checks the actual font and
viewport sizes and whether the selected range intersects the reader viewport.
This deliberately uses an explicitly selected passage; it does not yet test
capturing the current page's reading location in ordinary navigation.

The initial [emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/40872894985)
failed the changed-viewport visibility assertion. A
[diagnostic rerun](https://github.com/skypie0102/ShadowGarden/actions/runs/40873516640)
at source `336d961` reproduced this: the CFI resolved to the selected text,
but its rectangle was approximately 1,329 CSS pixels to the right of the
220-pixel viewport. This does not establish the cause or apply to the website's
resume controller.

The harness was then changed to wait 200 ms and redisplay the same CFI if its
first measurement falls outside the viewport. The subsequent [emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/40874280556)
at source `5c553c9` passed all six instrumented tests on Android 9 / API 28.
The conditional retry is a test experiment, not a production-ready fix; the
passing run does not establish whether the retry was needed in that run or
that the delay is reliable. The visibility check measures rectangle overlap,
not screenshot pixels or how much text can be read.

This is a test-only EPUB.js harness, not the website's reader controllers or a
production Android reader; it does not cover process death, rotation, continuous
mode, changed editions, or other books.

## Readium passage and layout experiment

A debug-only Readium 3.0.0 test selects the same paragraph in the generated
EPUB 3 using a locator with a text highlight. It saves that explicit locator,
recreates the activity with a smaller reader container and a larger Readium
font preference, and checks that the paragraph intersects the visible WebView
area. The container changes from 280 × 340 to 220 × 260 Android dp; the
Readium font-size preference changes from 1.0 to 1.6. The test verifies the
actual container dimensions and a computed font-size increase of over 40%, and
polls for the passage to intersect the visible WebView area for up to 45 seconds.
This does not capture the current reading position during ordinary page turns.
The EPUB.js and Readium locators, layout engines and dimension units differ, so
the experiments are comparable scenarios, not interchangeable location formats.

The [manual emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/40877363882)
passed all seven instrumented tests on Android 9 / API 28 x86_64 at source
`09f618c`. The test did not explicitly re-navigate after recreation. An [earlier
run](https://github.com/skypie0102/ShadowGarden/actions/runs/40876400326) failed
because the test incorrectly expected Readium's CSS-based font setting to change
WebView `textZoom`; its diagnostic showed the passage was visible. The revised
test checks computed text size instead. Viewport intersection is not a screenshot
or a guarantee that the whole passage is readable. This experiment does not
prove process-death recovery, actual rotation, continuous mode, changed editions,
real books, or production readiness.

## Readium current-location experiment

The next debug-only experiment starts at the same visible paragraph, waits until
Readium reports a position within chapter 12, saves its `currentLocator`, and
recreates the activity with the smaller viewport and larger font. Unlike the
preceding experiment, it does not save a manually constructed text locator.

The [API 28 emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/40943735717)
at source `3cf2a4d` failed the passage-visibility assertion after recreation.
The chapter and target text were present, but the text was just beyond the right
edge of the 220-pixel viewport. This is one observed case, not proof that
Readium always restores inaccurately: the navigator's saved position may refer to
a different part of the original page than the selected paragraph, and the test
does not establish whether its captured locator had fully settled. The test is
marked `@Ignore` so the known failure does not break the normal emulator suite.
Remove the annotation in an experimental branch to investigate. Measure the
actual saved passage or page start, repeat the scenario and investigate recovery
before relying on this locator for Android progress.

A follow-up diagnostic samples the first visible generated paragraph and waits
for both that paragraph and Readium's reported progression to remain unchanged
for 600 ms before saving. It observes the first paragraph with any text
intersecting the viewport after recreation with the same layout and then with
the smaller viewport and larger text. It logs generated fixture information,
checks that usable samples and the requested layout are present, and does not
assert that the same passage must remain visible.

The [manual emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/40962144629)
at source `78351f7` passed on Android 9 / API 28; the earlier strict test remained
skipped. The first visible paragraph was 39 before capture, 39 after unchanged
recreation, and 39 after the resized, larger-text recreation. Saved progression
was approximately 0.4857; after reflow the navigator reported approximately
0.4835. This suggests the earlier off-screen paragraph 40 was not the start of
the observed page, but does not prove which text character the locator represents
or that no text was skipped. It is one run with synthetic text.

An earlier [diagnostic run](https://github.com/skypie0102/ShadowGarden/actions/runs/40961286935)
observed paragraph 40 before and after unchanged recreation but could not sample
the resized page: the probe incorrectly required paragraph labels to be visible.
The follow-up checks the full text range instead. Other layout and lifecycle
scenarios, real books, and an accurate production capture policy remain open.

## Reader process-recovery experiment

A manual-only, two-stage instrumentation probe saves an explicitly selected
passage in the generated long EPUB for each test reader. It records each test
fixture's SHA-256 and saves an EPUB.js range CFI and Readium text locator in
test-only preferences. The emulator script force-stops the debug app without
clearing its data, then starts a separate instrumentation process. The recovery
stage checks that the process ID changed, the fixtures are unchanged, the app has
no Internet permission, and each selected passage is visible after restoration
at the same font and viewport. The probe is skipped on physical devices and its
own test data are cleaned up.

The [first emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/41184076932)
passed the existing instrumentation suite but could not start the staged probe:
Gradle had removed the instrumentation APK. The script now reinstalls the debug
and test APKs on the emulator without clearing data. Verification of the staged
probe is pending.

This checks explicitly selected test locations,
not automatically captured page position, changed editions, font reflow, a real
book, personal progress persistence or backup. A force-stop and separate process
are not a test of low-memory system eviction or general crash durability.

## Prototype protocol

Use generated or otherwise authorized EPUBs only. Keep both prototypes isolated
from production credentials and catalog writes. Record the versions, Android
API level, emulator/device, fixture identity and results for each case.

1. **Fixtures:** prepare a reflowable text-heavy EPUB, an illustrated book with
   internal links/footnotes, and a longer multi-chapter EPUB. Include both EPUB 2
   and 3 if supported. Do not put real books or personal progress in Git.
2. **Offline and lifecycle:** open a locally stored EPUB with network disabled;
   navigate, save a location, kill/recreate the process, and restore. Vary font
   size and viewport. Verify the same passage, not only a percentage.
3. **Reader parity:** exercise paginated and continuous modes, chapter navigation,
   search, bookmarks, illustration focus/return, notes and external links.
   Document unsupported behavior, device-specific failures and workarounds.
4. **Identity and replacement:** record book identity and edition fingerprint;
   restore against the same and a changed EPUB. A mismatch must not silently
   claim an exact location. Design Android backup from the observed locator format.
5. **Trust boundaries:** test a malformed EPUB and blocked scripts/external
   content. For WebView, explicitly evaluate origin, local-file access, network
   requests, JavaScript bridges and isolation of untrusted publication content.
   Never expose Keeper credentials or private files to EPUB content.
6. **Integration:** separately prototype Garden Pass and short-lived tickets,
   Keeper session lifecycle and online read aloud using the documented origin,
   cookie, verification and rate-limit contracts. Do not bypass verification.
7. **Evidence:** run the repeatable cases in the manual emulator job or another
   documented environment. Reserve the user's phone for behaviors that need
   hardware, particularly real touch/scroll, audio focus and screen-lock playback.

After both candidates have evidence, record a decision with feature gaps,
security and license findings, app size and performance observations, ongoing
maintenance cost and any required backend changes. An emulator smoke test of the
placeholder is not evidence that either EPUB approach works.
