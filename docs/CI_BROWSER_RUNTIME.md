# Browser CI runtime

The v2.18.3 release encountered an infrastructure blocker: the main mobile WebKit
job spent its entire 30-minute window installing dependencies. Its browser tests
never started. A fresh-runner retry again exhausted its 30-minute window in installation.
The captured log contains long waits and retries against Ubuntu's Azure archive.
The other four main profiles and all five PR profiles passed.

Browser jobs now use the official Playwright image, matching the repository's
exact `@playwright/test` **1.63.0** pin:

```
mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
```

The Microsoft registry returned this manifest digest on 2026-10-23 (Asia/Manila).
The image contains browsers and OS libraries; `npm ci` still installs the
repository's pinned JavaScript dependencies. Each job checks the package version
and executable availability before running its tests. Future Playwright upgrades
must update the package pin, image version/digest and alignment guard together.

The job uses user 1001, process initialization and shared IPC, following the
[official CI example](https://playwright.dev/docs/ci#via-containers) and
[Docker guidance](https://playwright.dev/docs/docker). The optional runtime export
reads the image's `/ms-playwright` directory and retains the existing archive
layout. No app data is included in that opt-in export.

All five browser profiles, test cases, worker settings, test timeouts,
30-minute browser-job budget, startup profiling and artifact retention remain.
Node 24, verification/access jobs, production dependencies and the guarded
existing-project deployment remain. Application code and package versions do not
change in this CI correction. No catalog, snapshot, object or runtime-setting
write is performed by the correction itself.

The first container runs reached browser tests within 32–46 seconds. Desktop
WebKit then exposed a visibility-helper error in the existing mode-switch case:
the next anchor was `#art-4`, and the settled screenshot retained that illustration.
The trace shows its deliberate parent image-activation surface covering the
iframe. The helper previously accepted only a direct iframe hit, so it reported
an obstruction after that surface appeared. Both independent push/PR runs failed
at the same case; neither was retried to obtain a pass.

The helper now also accepts the deliberate image surface only when the exact
requested target is an `IMG` under that point in the correct iframe and that
iframe is directly beneath the surface. Text, clipping and unrelated overlays
retain their original checks. No reader implementation or test timeout changes.

Local validation checks browser-test syntax, the YAML structure, runtime guard
syntax and exact image pin. The [runtime PR](https://github.com/skypie0102/ShadowGarden/actions/runs/39844638581) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39846590733) both pass 332 Node tests and 556 browser
cases, with nine documented platform skips and zero test retries. All five
profiles pass the runtime alignment/executable guard and the explicit-Skip
regression. The separate PR startup profile passes too.

The guarded main workflow publishes v2.18.3, source `2fa066f`, deployment
`c327c36c-fe9d-4c48-becd-9199a2f18057`. Version/source, both catalogs and all eight changed
assets verify live. Exact catalog/snapshot/settings preservation passes, with
zero database writes. See [release evidence](keeper-core-upload-verification.json).

This change removes per-job Ubuntu package downloads; it does not claim a universal
CI speedup or eliminate registry/network failures.
