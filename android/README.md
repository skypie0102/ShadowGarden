# ShadowGarden for Android

The Android app is in development. It offers a read-only Main catalog with cover
thumbnails, basic search, volume-count filters, sorting, volume listings and a saved offline snapshot. Previously
loaded covers may also be available offline until Android clears the disposable
cache. An experimental foreground download action requests Garden Pass in an
app-owned WebView and stores an EPUB privately; live verification has not yet
been accepted. Downloads stop when the app leaves the screen. Saved books are
removed on uninstall and are not included in position backups. The app also has
an early position-only backup and restore screen.
It does not yet read EPUBs, record reading progress, show the Adult
library, or provide Keeper. Until the reader is integrated, this device
will have no newly recorded positions to export. See the [Android roadmap](../docs/plans/ANDROID_ROADMAP.md)
for scope, sequence and acceptance criteria.

See the [storage](../docs/plans/ANDROID_BOOK_STORAGE.md) and
[download](../docs/plans/ANDROID_BOOK_TRANSFER.md) plans for current limits.

## Development

Install Android Studio with a JDK 17 or newer, Android SDK Platform 35 and the
corresponding SDK build tools. Open `android/` as the Android Studio project and
let Gradle sync. Alternatively, configure `ANDROID_HOME` or an untracked
`android/local.properties` containing `sdk.dir`, then from this directory run:

```sh
./gradlew assembleDebug
./gradlew assembleDebugAndroidTest lintDebug testDebugUnitTest
```

The debug APK is generated at `app/build/outputs/apk/debug/app-debug.apk`.
Run it on an emulator or Android device running API 26 or later. The Gradle
wrapper pins and verifies its distribution. Android versioning and release
signing are independent of the website. The first intended distribution is a
direct APK download; the current ID, API 26 minimum and version are development
values. Final release identity, support range, signing and hosting still need
decisions before distribution.

Android automatic system backup is disabled, with extraction rules excluding app
data from cloud backup and device transfer. The early manual backup covers reading
positions only; bookmarks, preferences and other personal data are not included.
Keep signing keys, local SDK paths, Keeper tokens, real book files and personal
backups out of Git.

## Manual emulator smoke test

The emulator smoke test in [Android checks](../.github/workflows/android.yml) is
manual-only; it is not part of normal pull request or push checks. From GitHub,
open **Actions → Android checks → Run workflow**, choose the branch, enable
**Run the emulator smoke test instead of the regular build**, and start it. The
job uses an API 28 emulator and runs the instrumented launch/recreation test and
the experimental offline EPUB.js and Readium harnesses, plus the separate local
HTTPS access test, with `connectedDebugAndroidTest`. Instrumentation reports
are retained for seven days when generated. KVM must be available on the
GitHub-hosted runner; a setup failure does not establish app behavior.
The optional **Also check the live Main catalog and one public cover** setting
installs a network-enabled debug app after the offline tests and makes one
read-only requests to the deployed Main catalog and one available cover. It is off by default and does not
exercise book access, verification or Keeper.

The script also runs a two-stage reader process-recovery experiment on emulators.
It reinstalls the debug app and its test APK on the emulator without clearing
data, saves generated selected-passage and current-page locations, force-stops
`dev.shadowgarden.app`, and restores in a separate instrumentation process. It
also checks test progress records, a generated catalog snapshot and a generated
cached cover across the stop.
The probe removes only its test fixtures, preferences, test database and test
catalog and test cover cache. It is skipped on
physical devices; the ordinary instrumentation suite skips its staged entry.
Backup-screen tests simulate document-picker results and use a private debug-only
document provider; they do not exercise a real file manager or cloud provider.

For a local emulator or attached device, run
`./gradlew -PofflineReaderTests=true connectedDebugAndroidTest`. This property
removes the app's Internet permission for the generated-reader experiments; a
normal debug build has Internet access for the Main catalog. Do not use the
offline test build to assess real catalog networking.
To include the isolated real-handler fixture, use `bash accesslab/run-emulator-tests.sh`
from `android/` with Node 24, `curl` and `adb` available. The fixture is not
started by normal Android builds. Physical-device testing is reserved for milestones that require it, such as
touch behavior, background audio and release acceptance.

The EPUB.js harness is test-only: it creates a small original EPUB in app-private
cache, reads it offline through an isolated WebView, and tests chapter navigation
and CFI restoration after activity recreation. The website's pinned vendor files
are packaged only into the test APK. It does not implement the application reader,
save user progress or prove the website's reader extensions work on Android.

The Readium comparison is a non-exported debug-only test host using the same
generated EPUB. It does not provide an app reader.
An internal [reading-position foundation](../docs/plans/ANDROID_READING_STATE.md)
now stores app-private locations by book, exact EPUB edition and reader format,
but is not yet connected to a reader. The early backup screen can export and
restore positions already in that store; it does not cover the rest of a person's
reading data.
The [reader evaluation](../docs/plans/ANDROID_READER_EVALUATION.md) records the
prototype constraints and results.

The separate [access test module](accesslab/README.md) uses a disposable local
HTTPS fixture and simulated responses to investigate WebView cookies and request
origins. It has its own debug-only Internet permission and test trust anchor;
these do not apply to the ShadowGarden app. Real Garden Pass, Keeper and backend
integration remain unimplemented. See the [access evaluation](../docs/plans/ANDROID_ACCESS_EVALUATION.md).
