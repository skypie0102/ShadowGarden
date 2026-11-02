# Android app roadmap

This is the current development cycle for the ShadowGarden repository. The
Android app lives in `android/` alongside the existing website and backend; the
website's operational and security contracts remain in force. The prior
[UI/UX roadmap](../archive/plans/UI_UX_ROADMAP.md) is archived and its remaining
device and evidence limits are tracked in [follow-ups](FOLLOW_UPS.md).

## Product decisions

- Include reader-facing website features and Keeper in the Android app. Keep
  website-compatible catalog, book-access and administrative behavior.
- Reading progress is local to Android and independent of browser data. No reader
  account, website progress migration or cross-device sync is required. Provide
  explicit Android progress export and restore. Keeper catalog backups are a
  different feature from personal reading-data backups.
- Download EPUBs for offline reading. Protect stored files and preserve reading
  data when a download is removed. Define handling for replaced EPUB editions.
- Keep Android builds, versions, signing and releases independent of the website.
- The first distribution channel is a direct APK download. Release identity,
  signing key custody and download hosting remain decisions before publication.

## Status and delivery order

| Phase | Status | Outcome |
| --- | --- | --- |
| 0. Scaffold and discovery | In progress | Buildable Android shell, current roadmap and a feature inventory |
| 1. Reader and access prototypes | In discovery | Compare approaches, then prove offline locations and protected access |
| 2. Library and offline reader | In progress | Reader-facing library, protected downloads, EPUB reader and local state; early Main catalog browsing available |
| 3. Progress backup and restore | In progress | Portable, validated Android reading-data export and restore; early position-only flow available |
| 4. Keeper | Planned | All website Keeper workflows usable and protected on Android |
| 5. Parity and release | Planned | Complete feature parity, accessibility, device acceptance and release preparation |

The app is an early scaffold with a read-only Main catalog and a position-only backup screen. A roadmap item is complete only after its
acceptance evidence is recorded; source changes, CI, real-device verification
and production acceptance are distinct.

## Phase 0 — Scaffold and discovery

- [x] Establish a Gradle/Kotlin/Compose Android project and independently versioned app shell.
- [x] Establish this roadmap and archive the previous UI/UX plan.
- [x] Verify the debug build and lint with Android SDK 35 and JDK 17; subsequent protocol tests run in the local JVM.
- [x] Launch the scaffold and verify activity recreation on an emulator.
- [ ] Verify the scaffold and later relevant milestones on a physical device; record device/OS and results separately.
- [x] Add a manual-only emulator workflow for a launch/recreation smoke test; routine Android CI compiles the test without starting an emulator.
- [x] Inventory Library, Reader and Keeper workflows with proposed Android screens and acceptance cases: [parity inventory](ANDROID_PARITY_INVENTORY.md).
- [x] Select direct APK download for initial distribution. Use API 26 as the provisional development minimum.
- [ ] Decide final application ID, supported minimum Android version, release signing/key custody and APK hosting before publishing; do not treat the scaffold ID as a release commitment.
- [x] Select Android-aware CI without weakening website checks or publishing for Android-only changes. Backend changes also run the Android build; actual cross-platform contract tests remain future work once consumers exist.

The separate Git-connected `shadowgarden-test` Pages project has build-watch
exclusions for `android/*`, `docs/*`, `README.md` and
`.github/workflows/android.yml`. This avoids automatic test previews for pushes
containing only those paths while still allowing a preview when a push also
changes a watched website path. These settings live in Cloudflare, not in the
repository workflows. Cloudflare can bypass path matching for empty or very
large pushes; the production project's deployment settings are separate.

Scaffold verification on 2026-10-28: `assembleDebug` and `lintDebug` passed
with JDK 17 and SDK 35; `testDebugUnitTest` had no sources at that time. No Android device
was attached to the development environment. Its 4.9 GiB filesystem and lack of
KVM prevented emulator acceptance: installing API 35 and API 28 system images
both failed for insufficient disk space. Device and emulator launch remain
unverified at that point and must not be inferred from the successful APK build.
On 2026-10-29 the manual [emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/40833427129)
at source `3c192da` passed one instrumented launch and activity-recreation test
on an Android 9 / API 28 x86_64 emulator. This is not reader or physical-device
acceptance. The user's phone is reserved for milestones where physical-device
behavior is essential.

## Phase 1 — Reader and protected access prototypes

- [ ] Compare a native EPUB toolkit (including licensing) with the existing reader in a secure Android shell. The [preliminary evaluation](ANDROID_READER_EVALUATION.md) records candidates and a prototype protocol; a choice requires evidence.
- [x] Validate the isolated EPUB.js test harness on the manual emulator: generated local EPUB, chapter navigation and CFI restoration after activity recreation. The [evidence](ANDROID_READER_EVALUATION.md#epubjs-test-harness) is not a production reader or process-death test.
- [x] Validate the Readium debug-only prototype on the same generated EPUB, including rendering, chapter navigation and locator restoration after activity recreation. See [test evidence](ANDROID_READER_EVALUATION.md#readium-test-harness).
- [x] Run both prototypes against a generated 12-chapter EPUB with a table of contents and embedded illustration, checking final-chapter restoration after activity recreation. See [test evidence](ANDROID_READER_EVALUATION.md#extended-generated-fixture).
- [x] Restore explicitly selected passages in both test readers after force-stop and a new app process, using unchanged generated EPUBs and the same layout. See [test evidence](ANDROID_READER_EVALUATION.md#reader-process-recovery-experiment); changed editions and production recovery remain open.
- [x] Compare automatically captured current-page locations in both prototypes after force-stop at the same layout, using the first visible generated paragraph as the check. See [test evidence](ANDROID_READER_EVALUATION.md#current-page-location-after-process-termination); exact characters, layout changes and production progress remain open.
- [x] Observe both captured locations after force-stop with a smaller viewport and larger text on the generated fixture. See [reflow evidence](ANDROID_READER_EVALUATION.md#current-page-reflow-after-process-termination); exact characters, other books and production recovery remain open.
- [x] Establish and verify an initial [app-private position store and edition identity](ANDROID_READING_STATE.md), including mismatches, stale writes and process-stop persistence. Broader reader and device acceptance remain open.
- [x] Establish a position-only backup interchange foundation with bounded validation and a complete local snapshot; the [format](ANDROID_READING_STATE.md#experimental-position-interchange) is not a user-facing backup or restore.
- [x] Establish a position-only restore preview and atomic merge foundation, including stale previews and rollback; user confirmation and the complete backup experience remain open.
- [x] Provide an early position-only document-picker export and restore screen with conflict review and confirmation; [emulator evidence](ANDROID_READING_STATE.md#verification) uses simulated picker results. Complete personal-data backup remains open.
- [ ] Test representative real-world text-heavy, illustrated and long EPUBs, Pages and Continuous modes, search, table-of-contents navigation, bookmarks, image zoom and lifecycle recovery.
- [ ] Validate reading-location capture and restoration, including EPUB CFIs, font/viewport changes, process death and changed editions. An [EPUB.js layout experiment](ANDROID_READER_EVALUATION.md#epubjs-passage-and-layout-experiment) exposed an initial wrong-page restore and tested a conditional retry; a [Readium experiment](ANDROID_READER_EVALUATION.md#readium-passage-and-layout-experiment) restored the selected passage after a similar change. A [current-location experiment](ANDROID_READER_EVALUATION.md#readium-current-location-experiment) found an earlier visible passage outside the viewport after reflow; a follow-up observed the first visible paragraph remained the same in one synthetic case. The strict test remains disabled pending investigation. The experimental reader now captures positions; reliable recovery across layouts and books remains open. Do not assume different reader engines interpret locations identically.
- [x] Exercise a debug-only access-flow sketch with local JVM tests and fake responses; see the [access evaluation](ANDROID_ACCESS_EVALUATION.md).
- [x] Exercise same-origin HTTPS, HttpOnly cookies, ticket renewal and Keeper session/logout in a separate Android WebView lab with a fake local server. See [access evidence](ANDROID_ACCESS_EVALUATION.md#local-https-webview-experiment); real server verification is not covered.
- [x] Exercise Android WebView against the real access and media handlers on loopback with an in-memory database and mocked Siteverify and storage. See [access evidence](ANDROID_ACCESS_EVALUATION.md#real-handler-fixture-experiment); live verification and cloud infrastructure remain untested.
- [x] Prototype a protected generated EPUB download into private test storage, preserve it on rejected or size-limited transfers, and display its extracted chapter with WebView networking blocked after activity recreation. See [access evidence](ANDROID_ACCESS_EVALUATION.md#private-download-and-offline-view-experiment); production downloads, full-reader offline acceptance and process death remain open.
- [x] Compare cookie-only WebView and native requests, scoped controls and activity recreation against the local real handlers. [API 28 evidence](ANDROID_ACCESS_EVALUATION.md#book-cookie-diagnostics) found browser access but no native cookie lookup, including for a readable control; the cause and production behavior remain open.
- [x] Compare SameSite controls, lookup URL variants and a native-set cookie on the API 28 emulator. [Evidence](ANDROID_ACCESS_EVALUATION.md#book-cookie-diagnostics) associates missing native lookups with explicit Strict and Lax controls in WebView 66; the cause and other versions remain open.
- [ ] Prove Garden Pass verification, short-lived book tickets and download renewal on Android with the existing same-origin/session requirements; preserve server-side checks. The [access experiments](ANDROID_ACCESS_EVALUATION.md) include local HTTPS and actual handlers with mocked services; live verification and production integration remain untested. Document any backend change and test it without production credentials.
- [ ] Prototype Keeper's verification and authenticated session, including lock/logout and session expiry. The [access experiments](ANDROID_ACCESS_EVALUATION.md) include real-handler fixture sessions; production Android integration and race-safe lock remain outstanding. Never embed Keeper secrets in the APK.

Acceptance: a documented reader/access decision and repeatable emulator and
physical-device evidence with authorized test content. Failed verification or
network access must not prevent reading an already downloaded book.

## Phase 2 — Library and offline reader

- [x] Keep the last validated Main catalog available after an offline process restart, with stale-data and save-failure feedback. See [emulator evidence](ANDROID_MAIN_CATALOG.md).
- [x] Show bounded public Main cover thumbnails with safe-path validation and a placeholder. See [emulator evidence](ANDROID_MAIN_CATALOG.md).
- [x] Keep previously loaded Main thumbnails in a bounded disposable offline cache. See [emulator evidence](ANDROID_MAIN_CATALOG.md); physical-device and low-storage acceptance remain open.
- [x] Add Main volume-count filters and title, author and volume-count sorts for live and saved listings. See [emulator evidence](ANDROID_MAIN_CATALOG.md); other filters remain open.
- [x] Save Main volume-count filter and sort preferences locally, with failure feedback and retry. Search remains session-only; see [catalog details](ANDROID_MAIN_CATALOG.md). Broader preference backup remains open.
- [x] Establish a private book-byte storage foundation with bounded, replace-safe writes and edition fingerprints. See [storage design and emulator evidence](ANDROID_BOOK_STORAGE.md); broader download and reader acceptance remain open.
- [x] Check bounded EPUB ZIP structure before replacing a stored book. See [emulator evidence](ANDROID_BOOK_STORAGE.md); full validation and reader acceptance remain open.
- [x] Stream a signed book response into checked private storage. See [transfer design and emulator evidence](ANDROID_BOOK_TRANSFER.md); live ticket issuance, renewal, background work and reader acceptance remain open.
- [x] Add a WebView ticket requester around the website's existing access flow. See [synthetic emulator evidence](ANDROID_BOOK_TRANSFER.md); live verification and lifecycle acceptance remain open.
- [x] Provide an experimental foreground Main-volume download screen. See [emulator evidence](ANDROID_BOOK_TRANSFER.md); live verification, full reader integration, storage management and physical-device acceptance remain open.
- [x] Open a saved EPUB in an experimental offline reader with page and contents controls. See [emulator evidence](ANDROID_OFFLINE_READER.md); real-book and physical-device acceptance remain open.
- [x] Save and restore experimental EPUB.js reading positions locally for an exact edition, with existing position-only backup and stale-write protection. See [reader details](ANDROID_OFFLINE_READER.md); reflow, real-book and physical-device acceptance remain open.
- [x] Allow a listed Main volume's downloaded EPUB to be removed after confirmation while retaining its reading position; protect a replacement edition from a stale confirmation. See [storage details](ANDROID_BOOK_STORAGE.md); bulk removal remains open.
- [x] List and open downloaded EPUBs even when the catalog is unavailable or no longer contains their IDs. See [storage details](ANDROID_BOOK_STORAGE.md); unmatched titles remain open.
- [x] Remove a downloaded EPUB from the offline shelf, including a book missing from the catalog, while retaining its position and guarding against stale confirmation. See [storage details](ANDROID_BOOK_STORAGE.md); bulk removal and unavailable files remain open.
- [ ] Implement main and age-gated libraries, series and volume details, search, filters, sorting, pins, recently added and reading-state actions. An early [read-only Main catalog](ANDROID_MAIN_CATALOG.md) provides cover thumbnails, title/author/volume-title search, volume-count filters, basic sorting, volume listings and a saved offline snapshot; the remaining features are open.
- [ ] Implement background-capable downloads, progress, retry/cancel, ticket expiry handling, integrity checks and private storage. Provide storage management and removal without deleting reading state.
- [ ] Implement offline reading, table of contents, in-book search, bookmarks, paginated/continuous layouts, typography, themes, image focus and accessible navigation.
- [ ] Persist location, bookmarks, finished state, pins and preferences locally. Show save failures and retain data across app restarts; no website sync.
- [ ] Reconcile removed or replaced catalog books and editions without silently treating an old location as valid.

Acceptance: download with valid access, read and resume in airplane mode after
process termination, remove and re-download without losing progress, and recover
from interrupted transfers and expired verification. Test on representative
Android versions, screen sizes and physical hardware.

## Phase 3 — Personal progress backup

- [ ] Define and document a versioned format containing book/edition identity, location, bookmarks, reading status, pins and applicable preferences. Do not include Keeper credentials or browser storage.
- [ ] Export via Android's system file picker to a user-selected destination; report failures and explain that EPUB files are not included in the initial progress backup.
- [ ] Validate version, size and records before restore; preview contents, define merge/replace behavior and confirm before overwriting existing data. Preserve the current state on failed restore.
- [ ] Preserve data for unavailable or changed books and make mismatches visible rather than silently discarding it.
- [ ] Test exports and restores across devices, interrupted and malformed files, duplicate entries and changed editions. Explain uninstall and user-controlled backup retention.

Acceptance: restore a backup on another Android device, re-download a matching
book and resume its saved position; invalid input cannot silently corrupt the
existing library. The website remains unaffected.

## Phase 4 — Keeper

- [ ] Provide Keeper entry, verification, authentication, lock/logout and session expiration handling using the established server contract.
- [ ] Adapt uploads, EPUB inspection, cover selection, destination and duplicate choices, upload progress, failures, retries and queues.
- [ ] Adapt catalog and series/volume editing, file replacement, translation credits, banners and taxonomy.
- [ ] Adapt catalog health, snapshots and backups, Trash, purge, recovery readiness, restore, abuse controls and maintenance.
- [ ] Retain revision preconditions, confirmation steps, cancellation, server validation and safe handling of stale sessions and conflicting edits. Keep secrets out of logs, backups and app packages.

Acceptance: exercise all Keeper workflows against isolated test infrastructure,
including failure, conflict, cancellation and recovery cases. Validate usable
layouts and file selection on phones and tablets; record live protected-flow
acceptance separately with authorized credentials and test content.

## Phase 5 — Parity and release

- [ ] Finish the reader-facing parity checklist, including read aloud, Android audio focus and media controls. Evaluate Android offline speech separately; current website Edge TTS is online.
- [ ] Test screen readers, contrast, scalable text, large touch targets, reduced motion, rotation, background/foreground and low-storage behavior.
- [ ] Review age-gate behavior, content rights, privacy, dependency licenses and distribution requirements for the selected release channel.
- [ ] Prepare Android CI, versioning, signed release and rollback instructions; do not bundle credentials or production content.
- [ ] Record emulator and physical-device results, including locked-screen audio; retain the existing website test and deployment process.

Potential later features include highlights and notes, reading reminders, a
continue-reading shortcut, Wi-Fi-only downloads and optional offline speech.
Prioritize them after the parity and reliability requirements above.
