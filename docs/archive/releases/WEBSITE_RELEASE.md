# Website release record

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

## v2.14.0 — website ownership refactor

Deployed 2026-10-18 at 21:51:59 UTC from clean main source
`ff5bb9c700d0e709d9e838791a282946a8c47533`, deployment
`c91b8b1e-2033-4215-b59c-61edb547749f`.
[PR #30](https://github.com/skypie0102/ShadowGarden/pull/30) completes the website
ownership sweep described in the [architecture guide](../../guides/WEBSITE_ARCHITECTURE.md).

Templates/workflows now own their final text and confirmations. The global body
text observer and native alert/confirm overrides are gone. Theme tokens and
backgrounds have their own stylesheet; verification styles are static. Library
URL/filter state and local EPUB inspection have explicit modules. Keeper upload
queue/status/view events replace DOM-inferred model changes. The engine publishes
terminal status after its transaction/final render, replacing the polling shim;
original picker/button nodes remain stable. Redundant filter injection is removed.

The shared widget loader also fixes a reproduced retry defect: a failed script
left a dead element behind and hung the next attempt. It now removes failed
scripts/listeners before retry. The regression fails on the old loader and passes
on the correction. Reader layout, scroll/focus algorithms, backend APIs,
authorization policy, identities and persistence formats are unchanged.

[PR CI 39168727522](https://github.com/skypie0102/ShadowGarden/actions/runs/39168727522)
and [push CI 39168723400](https://github.com/skypie0102/ShadowGarden/actions/runs/39168723400)
pass on the final source, first attempt: audit, all 220 Node tests, both builds,
422 browser cases and eight existing platform skips. Profile passes are 86 desktop
Chromium, 86 mobile Chromium, 84 Firefox, 84 desktop WebKit and 82 mobile WebKit.
Tested head `ccbfe76222acfdef03c0b81b0cf1155f55173c95` and the merged release share
tree `66d8b41968e4022940adeb6a481cd3e2e023ac25`.

The three new browser cases cover Library history/filters/direct copy/native
dialog identity/both palettes; stable upload controls, valid/invalid preflight,
queue removal, upload failure/retry/completion; and failed script recovery. They
pass locally in desktop/mobile Chromium and in all five CI profiles. Local CLI
startup uses a workspace-only adaptation for restricted interface enumeration;
no repository browser configuration, assertion or retry setting is weakened.

Production verification confirms 28 exact served-file hashes, the ordinary root
HTML, v2.14.0 metadata, both public catalogs matching D1, unchanged revision 8 and
all eight snapshot identities/checksums. Actual/saved configuration and nine
encrypted-setting names/types match the refreshed baseline. Challenge endpoints,
unauthenticated Keeper denial, raw EPUB denial and the missing-cover B2 read pass.
Both retired JS layers return 404. The initial file probe ran before deployment
became canonical and saw the prior root; checks were repeated after success.

Cloud Chromium verifies the real Library search, empty message and Reset;
footer `v2.14.0 · ff5bb9c`; one main series/volume; shared theme loading; identical
Keeper sign-in card styles; and the midnight Garden Pass with the real widget
on an actual book-opening route. No CAPTCHA was completed and no credential
sign-in was repeated. Prior physical-device acceptance remains scoped to its
original releases. Detailed [evidence](../evidence/website-release-2.14.0.json) distinguishes
these live UI checks from isolated authenticated upload/retry coverage.

## v2.13.0 — device defaults and Garden Pass ownership

Deployed 2026-10-18 at 21:16:49 UTC from clean main source
`5389ebebcfa31e5f8a00c5a69b77e6e2c79b4620`, deployment
`749d732f-c40c-4782-9074-fff9c4eaf8be`.
[PR #29](https://github.com/skypie0102/ShadowGarden/pull/29) fixes mobile reset
and the main dialog theme, and begins the website refactor by separating dialog
presentation from protected access policy. The [roadmap](../plans/WEBSITE_REFACTOR_ROADMAP.md)
tracks the remaining website increments.

Reader initialization, invalid/missing stored flow and reset share one device
policy: Continuous on mobile, Pages on desktop. Explicit stored choices persist
until reset. The failing-before mobile reset test now passes.

Garden Pass is a lazy-loaded dialog module with a static stylesheet. The main
context uses midnight purple; the adult context retains rose. Final dialog copy
is authored directly; six global text rewrites are removed. Verification transport,
ticket retry/cache and identity migration remain in their existing policy owner.

[CI run 39166281683](https://github.com/skypie0102/ShadowGarden/actions/runs/39166281683)
and the PR matrix pass on the first attempt: audit, all 217 Node tests, both builds
and 407 browser cases, with eight pre-existing platform skips. The tested head
`9de5744cc13494bd6777e19c5deb35dfb6818b3b` and merged release have the same tree
`575ad40fe897e970778158e009b1718173622f3e`. The four added browser cases run in all
five profiles: device reset/reload, main palette/cancel, adult palette/cancel and
shared challenge/rejected verification retry/successful ticket resumption.

Production verification confirms fourteen exact served-file hashes, release
metadata, both public catalogs matching D1, revision 8, the unchanged exact
catalog document and eight retained snapshot identities/checksums. Saved and
actual database/bucket/compatibility configuration and nine encrypted-setting
names/types match the baseline. Human and Keeper challenges respond with site
keys, unauthenticated Keeper access returns 401, raw EPUB HEAD returns 403 and a
missing B2 cover returns 404 `media_not_found`.

A cloud Chromium browser reproduces the old green gate and then verifies the
new midnight gate on the same actual book-opening route. It also verifies the
loaded main volume count of one and footer `v2.13.0 · 5389ebe`. No CAPTCHA was
completed; authenticated real-book opening and new physical Android/Soul reset
acceptance are not claimed. Existing physical scroll/focus and Keeper acceptance
remain tied to v2.12.6 and v2.12.8 respectively.

The Linux workspace's local Pages browser runner fails on restricted network
interface enumeration (`uv_interface_addresses`). CI runs the unmodified real
Pages/D1 fixture successfully. No assertions, browser profiles or retries were
weakened. Detailed [machine-readable evidence](../evidence/website-release-2.13.0.json)
separates automated, live source/configuration and rendered UI checks.
