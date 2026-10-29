# Android reader evaluation

Status: preliminary source review, 2026-10-29. No Android reader prototype or
production reader choice has been validated yet. The [Android roadmap](ANDROID_ROADMAP.md)
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
