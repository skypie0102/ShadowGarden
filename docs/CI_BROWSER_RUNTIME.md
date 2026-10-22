# Browser CI runtime

The v2.18.3 release encountered an infrastructure blocker: the main mobile WebKit
job spent its entire 30-minute window installing dependencies. Its browser tests
never started. A fresh-runner retry again spent over 20 minutes in installation.
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

All five browser profiles, test cases/assertions, worker settings, test timeouts,
30-minute browser-job budget, startup profiling and artifact retention remain.
Node 24, verification/access jobs, production dependencies and the guarded
existing-project deployment remain. Application code and package versions do not
change in this CI correction. No catalog, snapshot, object or runtime-setting
write is performed by the correction itself.

Local validation checks the YAML structure, runtime guard syntax and exact image
pin. Complete PR/main browser validation and production verification remain
pending. This change removes per-job Ubuntu package downloads; it does not claim
a universal CI speedup or eliminate registry/network failures.
