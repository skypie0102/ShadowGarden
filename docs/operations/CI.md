# GitHub check selection

The Android scaffold has a separate [Android workflow](../../.github/workflows/android.yml)
that builds and runs lint for Android, backend, API-contract and workflow changes.
Android CI runs local JVM unit tests for the debug-only access protocol sketch.
The app has no real API consumers yet; running the build on backend changes is
not a cross-platform contract test. Those tests are planned as the Android
integrations are built. Its result is a separate status from **CI
checks**; the latter does not enforce the Android workflow. Account for both
statuses in review and branch protection, including path-filtered skipped runs.
The emulator smoke test in [Android checks](../../.github/workflows/android.yml)
runs only when manually dispatched with its emulator option enabled. It checks app launch,
activity recreation, the test-only EPUB.js and Readium offline prototypes, and the
separate local-HTTPS access test on an API 28 emulator. It uploads their reports
when available; it prints only the synthetic reader probe's
filtered log tag and does not replace physical-device acceptance. Normal Android CI compiles the instrumentation APK
but does not boot an emulator.

`ShadowGarden checks` runs once per pull request update and on pushes to `main`.
Feature-branch pushes do not duplicate the PR run. A newer PR update cancels its
older checks; running main releases and production uploads are not cancelled.

Every website or backend application change still runs the asset/provenance audit, all Node tests,
static build and binding-aware Pages Functions compilation. The planner uses the
complete Git diff against the PR base or push's previous commit, including
deletions and both sides of renamed files. Missing history selects full checks.
The verify job's summary records the chosen scope and browser-job count.

| Changes | Browser checks | Publication on main |
| --- | --- | --- |
| Only `README.md` / `docs/**` | Skipped; lightweight successful gate | Skipped |
| Only `android/**`, Android workflows and optional documentation | Skipped; lightweight website gate, separate Android workflow | Skipped |
| Android paths plus CI selection workflow/planner/tests and optional documentation | Planner unit tests and Android workflow; website browsers skipped | Skipped |
| Listed public presentation styles, optionally their selected specs and a version-only release bump | Public layout, discovery, startup, persistence, reconstruction and CSS regressions across all five profiles | Existing guarded deployment |
| Images under `public/assets/icons`, `images` or `img` | Public checks plus Keeper banners and Reader image focus across all five profiles | Existing guarded deployment |
| JavaScript, backend, dependencies, shared styles, HTML, test helpers, workflows or any unrecognized file | Full suite across all five profiles, three shards per profile | Existing guarded deployment |
| Manual / weekly scheduled run | Full suite | Manual on main only; scheduled runs never publish |

The Android selection exception covers only `.github/workflows/ci.yml`,
`scripts/plan-ci.mjs`, and `tests/ci-plan.test.mjs` when Android paths also
change. Their planner tests run without installing website dependencies. CI
selection changes without Android paths and all other workflow or script
changes retain full checks. Reviewers must inspect workflow and deployment
guard changes; browser tests do not themselves execute GitHub Actions.

Mixed changes select website checks based on their website/backend paths. The
production supersession guard also ignores Android-only files, so a newer
Android-only commit does not suppress a previously checked website release.
Manual and scheduled full-regression behavior is unchanged.

The presentation allowlist is deliberately explicit in
[`scripts/plan-ci.mjs`](../../scripts/plan-ci.mjs): `library-layout`, `library-features`,
`library-motion`, `public-components`, `public-artwork`, `series-extra` and
`series-motion`. Shared `site.css`, `reading-status.css`, themes and Reader styles
retain full regression coverage. Package files qualify for focused checks only
when parsed contents are identical after removing the release-version fields;
script, dependency, engine, integrity and other changes force full checks.
An accompanying test change qualifies only if its exact spec is already selected.

Each shard retains one Playwright worker and a separate disposable D1/Pages
server. Database mutation tests are not parallelized inside a shared fixture.
Every selected test runs once; speech, alignment, replacement and Series checks
are no longer rerun before the same full suite. Per-test deadlines, zero retries,
all five browser profiles and the pinned browser image are retained. Each shard
uploads one report (including failures), with project/shard-specific names.
The Library startup profile runs once when its runtime or dependencies change.

Use **CI checks** as the stable required status when configuring branch rules.
It requires successful verification and every selected browser shard. Browser
skips are accepted for documentation and Android-only scope; failures, cancellations and unexpected
skips fail the gate. Individual matrix names now include the shard, so any
existing required matrix statuses must be replaced with this gate. Repository
branch rules are not modified by this change.

The historical 30-repeat original/current Reader scroll investigation is now
manual-only. Normal full CI still includes the scroll regression specs. Full
regression also runs weekly on Monday at 03:17 UTC, or on demand through
**Actions → ShadowGarden checks → Run workflow**. A manual main run retains the
existing guarded release behavior; choose another branch for checks alone.

## Timing baseline and validation

Before this change, the v2.27.1 main run
[`40326287039`](https://github.com/skypie0102/ShadowGarden/actions/runs/40326287039)
took **27m 29s**, with its slowest browser job taking **26m 29s**. PR updates also
started duplicate push runs. The earlier v2.27.0 main run
[`40285848200`](https://github.com/skypie0102/ShadowGarden/actions/runs/40285848200)
took **2h 7m 39s** including a desktop WebKit timeout and a later job rerun.
That interval includes time between attempts, rather than two hours of continuous
test execution.

The Phase 3 Reader [PR run `40530019401`](https://github.com/skypie0102/ShadowGarden/actions/runs/40530019401)
completed full verification and all 15 browser shards in **12m 15s** on 2026-10-27:
545 Node tests and 1,191 browser cases passed, with 9 existing platform skips
and no retries. This is a full Reader change; image-only changes use the focused
selection above. It is one observed run, not a guaranteed duration.

The Phase 4 visual [run `40602099989`](https://github.com/skypie0102/ShadowGarden/actions/runs/40602099989) completed full verification
in **10m 53s**: 545 Node tests, 1,241 browser cases,
9 platform skips and zero retries. All 50 new visual cases pass.

The planner has regression cases for documentation, cover CSS, images, release
metadata, dependency changes, unknown files, missing history, deletes and renamed
runtime files. `npm run check` also validates the unchanged application build and
release bindings. Check durations depend on runner availability and the selected
tests; sharding trades extra container setup for shorter full-suite elapsed time.
