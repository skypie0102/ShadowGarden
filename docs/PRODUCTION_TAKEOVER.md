# ShadowGarden production operations

**Source update awaiting deployment — 2026-10-21:** v2.18.1, merged source
`ba71f00` from PR #39, formats seven public modules with matching executable
syntax trees. CI passes 305 Node tests and 541 browser cases with the same nine
documented skips. Cloudflare connector internal errors block fresh baseline
capture and guarded publication. Ten public HTTP checks still confirm v2.18.0,
both catalogs and seven previous-release module hashes. See [readability validation](PUBLIC_READABILITY.md)
and [evidence](public-readability-verification.json). This pending source update
does not change the last verified production deployment or rollback below.

**Last verified production release — 2026-10-20:** v2.18.0, deployment
`8c87a0ed-acf5-4083-a305-c9f5988f8da1`, source `8e34ced` from PR #38.
Native Garden Pass modality/focus restoration and parallel/canonical public
imports pass 305 Node tests and 541 browser cases with nine documented skips.
The release verifier passed version, both D1-derived catalogs and seven changed
asset comparisons. Revision 9, the exact document, nine snapshots and actual/saved
settings were unchanged across publication. The retained rollback is v2.17.1,
`39c54372-231f-4a6d-880b-48f1a3710b57`. Fresh public HTTP checks on 2026-10-21
confirm the source and changed assets. The connected Cloudflare API returned
internal errors then, so no new D1/configuration comparison is claimed for that
day. See [public boundaries](PUBLIC_BOUNDARIES.md) and
[sanitized evidence](public-boundaries-verification-2.18.0.json).

**Protected-source release — 2026-10-20:** v2.17.1, deployment
`39c54372-231f-4a6d-880b-48f1a3710b57`, clean application source `01b57f9`.
PR #36 removes the global fetch override and gives the visual scanner an explicit
book-access transport. The pinned main/page-map EPUB.js runtimes keep their XHR
and session-cookie behavior. CI passes 293 Node tests and 502 browser cases
(eight existing skips), including opaque and legacy source loading in every
profile. Both changed modules match the release build, both catalogs match D1,
and both Library footers show v2.17.1. The refreshed baseline is revision 9 with
nine snapshots; the exact document, every snapshot and actual/saved production
configuration are unchanged across this deployment. No database, book-object or
credential writes were needed. The retained rollback is v2.17.0,
`f86f42ef-b710-40f8-bf6a-011c47b875e5`. See [the transport report](PROTECTED_SOURCE_TRANSPORT.md)
and [verification evidence](protected-source-verification-2.17.1.json).

**Browser persistence release — 2026-10-20:** v2.17.0, deployment
`f86f42ef-b710-40f8-bf6a-011c47b875e5`, clean application source `129a1d2`.
The release includes measured upload-memory buffering and grouped browser
persistence from PRs #34/#35. CI passes 285 Node tests and 492 browser cases
(eight existing skips). All seven changed static modules match the release build;
both live catalogs match D1, and both Library footers show v2.17.0. Revision 8,
the exact document, all eight snapshots, actual/saved bindings, compatibility
settings and nine encrypted-setting names/types are unchanged. No database,
book-object or credential writes were needed. The retained rollback is v2.16.0,
`8212de19-5ccb-40bd-9241-14b9427ea565`. See [release evidence](persistence-verification-2.17.0.json).

The connected Cloudflare plugin supplied a valid short-lived upload JWT. Its
runtime's asset requests returned 403, while local requests with a plugin-issued
token succeeded. Local upload of eight changed assets and revalidation of all
164 unique hashes completed the release without another sign-in or permission
change. [The upload procedure](PAGES_UPLOAD_TRANSPORT.md) records the transport
comparison and the guarded multipart deployment. The underlying reason for the
runtime difference is not established.

**Maintenance budget release — 2026-10-19:** v2.16.0, deployment
`8212de19-5ccb-40bd-9241-14b9427ea565`, source `4b2aed1`.
[Maintenance budgets](MAINTENANCE_BUDGETS.md) and
[release evidence](maintenance-release-2.16.0.json) record paginated Keeper
history, bounded readiness, 250 Node tests, 477 browser cases and unchanged
production data/configuration. The retained rollback is v2.15.0 deployment
`710c6175-587f-40ff-899b-94b5c33e5be5`.

The upload-memory and browser persistence increments are deployed together in
v2.17.0 above. See [upload verification](UPLOAD_MEMORY.md) and
[persistence verification](BROWSER_PERSISTENCE.md) for implementation limits.

**Reader gesture release — 2026-10-19:** v2.14.1, deployment
`fab2efb5-42d7-4dce-be2c-42990c9b517a`, clean main source
`7d50991eeaca4f96077da2fa1467f99f4e322917`. Double tap/click now opens and
returns from image focus. All 224 Node tests and 432 browser cases pass across
five profiles, plus six isolated checks against the deployed reader. Exact served
files, revision-8 document/eight snapshots, actual/saved bindings, encrypted-setting
metadata, both catalogs, challenge endpoints and access-denial/B2 probes pass.
See [reader release evidence](reader-release-2.14.1.json). The retained rollback
is v2.14.0 deployment `c91b8b1e-2033-4215-b59c-61edb547749f`.

**Website refactor release — 2026-10-18:** v2.14.0, deployment
`c91b8b1e-2033-4215-b59c-61edb547749f`, clean `main` source
`ff5bb9c700d0e709d9e838791a282946a8c47533`, deployed at 21:51:59 UTC.
The [website release record](WEBSITE_RELEASE.md) and
[evidence](website-release-2.14.0.json) identify the tested/merged tree, all
220 Node tests, 422 browser cases (eight existing skips), live Library controls,
Keeper sign-in layout, midnight Garden Pass and 28 matching served files.
Both retired runtime layers return 404.

Actual and saved D1/bucket/compatibility settings and all nine encrypted-setting
names/types match the refreshed baseline. Revision 8, the exact catalog document
and all eight snapshot identities/checksums are unchanged. Both public catalogs
match D1 exactly. Challenge endpoints return site keys, unauthenticated Keeper
access returns 401, raw EPUB HEAD returns 403 and the missing-cover B2 read returns
404 `media_not_found`. No production catalog, storage, migration or credential
changes were needed.

Physical Android/Soul reset and credential-based live sign-in/book opening are
not claimed as new manual acceptance. The owner's earlier Android/Soul scroll/
focus acceptance remains v2.12.6, and Keeper acceptance remains v2.12.8; see the
[reader release record](READER_RELEASE.md). Current upload/preflight/retry behavior
passes in the real isolated Pages/D1 fixture across all five browser profiles.

## Reusable production verification

The [read-only verifier](PRODUCTION_VERIFIER.md) replaces the temporary catalog/
served-source probes with maintained code. Capture exact D1/configuration through
its self-contained collector using the existing Cloudflare plugin; keep private
baselines ignored. Run `npm run verify:production` against the exact reviewed
release directory and a fresh baseline, with `--before` for preservation checks.
It checks canonical catalog/version URLs and selected served JS/CSS bytes.
`npm run check:functions` now also rejects compatibility-date/flag drift in the
compiled multipart Worker metadata. No browser sign-in is needed for this
connected-plugin workflow. The [2026-10-20 report](production-tooling-verification.json)
passes against v2.17.1 with unchanged revision 9, nine snapshots and settings.
This tooling continuation does not deploy or change the application version.

## Existing resources

The owner authorized replacing the original site on 2026-10-02 and reusing its
existing B2 bucket. The five recovered EPUB entries were disposable tests. This
supersedes the separate-bucket plan in `TEST_DEPLOYMENT.md`.

| Resource | Value |
| --- | --- |
| Public URL | https://shadowgarden-bon.pages.dev/ |
| Cloudflare Pages project name | `shadowgarden` |
| Cloudflare account | `fa95f62f96a0ff3b92a45175d94a48b6` |
| Source branch | `skypie0102/ShadowGarden`, `main` |
| Pages production branch | `main` |
| D1 binding | `DB` |
| Existing D1 database | `shadowgarden-test` |
| D1 ID | `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86` |
| Existing private B2 bucket | `shadow-garden-books-01` |
| B2 bucket ID | `ddac6e4567151ba5a20f0011` |
| Last verified rollback target | v2.17.1, `39c54372-231f-4a6d-880b-48f1a3710b57` |

The project name differs from the hostname. Deploy to **`shadowgarden`**.
Cloudflare retained its original Git source when an API update was attempted,
so automatic production and preview builds from that old repository are paused.
Use Pages direct deployments to retain the existing hostname and secrets.

## Historical integration checks

These dated records retain earlier verification. Current status is above and in
the release record.

The first takeover deployment succeeded at 2026-10-02 08:31 UTC with commit
`26bacb7` and deployment ID `e9d4306a-a4db-4aed-a4a9-d3b28458dc39`. The homepage,
version, login challenge endpoints and both empty catalogs passed live checks.
All eight original secrets remain encrypted; `SESSION_SECRET` was added securely.
The original Turnstile widget already permits the production hostname.

The withdrawn reader deployment used v2.12.1 from `main` source
`154381761d6bec1fa246166f0ba300f09471d6ab`, deployment
`5658687a-f60a-4a1f-8441-78738c2b04e1`, successful 2026-10-16 at 09:18 UTC.
Both clean CI runs pass 159 Node tests and 215 browser cases. Live desktop/mobile
checks confirm exact reader assets, image zoom/return position and visible
`v2.12.1 · 1543817` footers in the main and NSFW libraries. Login challenges and
catalogs respond correctly; unauthenticated admin library access is denied.
Those checks missed the lost bindings and recovered-catalog fallback. The
deployment is no longer live. No migration, seed, catalog/media edit or secret
change occurred; recovery restored the previous deployment/configuration. See
[READER_RELEASE.md](READER_RELEASE.md) for the full matrix, live checks, limits
and retained v2.12.0/pre-refactor rollback targets.

The initial B2 probe exposed an unsupported `redirect: 'error'` fetch option in
workerd. This branch corrects it to manual redirects with explicit refusal of
every 3xx response. The failure and fix were reproduced in the Cloudflare local
runtime, independently of the Node mocks. The correction first went live in
deployment `f8844be0-ae68-4e72-969d-c0812f03109d` on 2026-10-03 at 00:39 UTC.
It was deployed from the tested working tree while the GitHub connector was
stalled, with `commit_dirty: true` recorded in Cloudflare.

The live missing-cover probe now completes B2 authorization and the download
lookup, returning the expected `media_not_found` 404 instead of a storage 502.
This verifies the read connection without creating or deleting a real object.
The homepage, both challenge endpoints and D1 catalog also pass. The owner
confirmed Keeper login works after deployment
`12b99509-604b-4566-a0eb-330864686b27` (source `ab26a01`).

The first authenticated upload on 2026-10-03 passed EPUB validation and the B2
read/existence check, reserving a new object key in D1, but failed before catalog
creation. A separate upload validation bug rejected B2's documented
`pod-*.backblaze.com` upload URLs. The validator now accepts those HTTPS pods
only for the URL returned by `b2_get_upload_url`; API/download hosts remain
restricted to `*.backblazeb2.com`, and redirects are still refused.
The pinned Cloudflare runtime reproduced the old 502 and the corrected upload
using fake credentials and provider responses. All 63 backend/client tests pass.
Retrying an authenticated live upload and opening its EPUB remain necessary to
verify the real write credentials and reader together. No B2 objects were
created or deleted by the diagnostic work.

The old `Workers Builds: shadowgarden-test` integration had no Worker remaining
in the account. Its preview builds and production path triggers are now paused,
preventing further irrelevant failed builds. Historical failed checks remain.

## Configuration

The Continuous reader image-focus fix was deployed on 2026-10-15 at 12:31 UTC
from source `9daea7f481ae1f19cc3d0640b83b20d424eab794`, deployment
`dfac687d-06fa-4bc5-9f3f-6eae5a9f4a33`. Closing the image restores the live
reading position without navigating to saved progress; stale callbacks are
cancelled on navigation and mode changes. An opening-touch compatibility click
cannot immediately dismiss the overlay.

GitHub CI run `38734664627` passed all 70 backend/client tests, the asset audit,
both builds, and all 20 desktop/mobile browser tests. A live Cloudflare browser
check confirmed the deployed commit and exact SHA-256 matches for the two
changed reader modules. The homepage, reader, both login challenge endpoints
and both D1 catalogs return 200. No storage or catalog writes were needed.

`wrangler.jsonc` on this branch is production configuration. It binds the already
initialized D1 database and supplies the existing bucket's non-secret name/ID.
Both migrations and the empty seed were independently verified through D1.
Do not rerun a recovered seed over the live catalog. New library edits are stored
in D1; they do not update the original catalog JSON stored in B2.

Keep all eight original encrypted variables:

- `B2_READ_KEY_ID`, `B2_READ_APPLICATION_KEY`
- `B2_WRITE_KEY_ID`, `B2_WRITE_APPLICATION_KEY`
- `SG_ADMIN_TOKEN`, `SG_MEDIA_SIGNING_SECRET`
- `SG_TURNSTILE_SITE_KEY`, `SG_TURNSTILE_SECRET_KEY`

The backend also needs an independent encrypted `SESSION_SECRET`
with at least 32 characters. Add it once; retain it on subsequent deployments.
The existing SG aliases are supported. Secret values do not belong in Git.

Keeper accepts the original nonempty `SG_ADMIN_TOKEN` exactly as configured,
including an existing token shorter than 32 characters. It is a login credential,
not a signing key. The independent session and media signing secrets retain
their 32-character minimum; Turnstile, rate limits and revocable sessions remain
required. A missing or blank Keeper token still fails closed with a specific
configuration error and does not consume a login attempt.

The database still has its original `shadowgarden-test` name. The test Pages
project also references it, so treat writes from either site as production
writes after the takeover. Future destructive testing requires an isolated
database. Existing B2 files are retained; an empty catalog does not delete them.

## Deploy from Windows PowerShell

From the reviewed source checkout, after its complete CI matrix passes:

```powershell
git fetch origin
git switch main
git pull --ff-only
npm.cmd ci
npm.cmd run check
npx.cmd wrangler pages deploy dist --project-name shadowgarden --branch main
```

`npm run check` builds assets and compiles the binding-aware release package.
It validates actual D1/variable metadata. Do not publish a source-only Functions
bundle or a package whose bindings differ from reviewed `wrangler.jsonc`.

Capture the current catalog revision/document, snapshot IDs/checksums,
actual/saved bindings and encrypted-setting names/types before deployment;
compare them afterward. Keep secret values out of logs and Git.

Use `--branch main` for both the canonical source checkout and this Pages
project's production environment.
Wrangler compiles the `functions/` directory as part of this deployment. A
dashboard upload of `dist/` alone does not include those Functions.

## Check and roll back

Verify canonical/saved configuration against the baseline, including `DB`, bucket
variables and encrypted-setting metadata. Compare public catalogs with the exact
expected database content and snapshot IDs/hashes; HTTP 200 alone is insufficient.
Check version metadata, exact served reader hashes, both visible library footers,
challenge configuration and denial of unauthenticated Keeper access. Record
authenticated/provider checks separately; ordinary maintenance verification does
not require catalog writes or media upload/deletion.

The last verified rollback target above is retained through
Cloudflare Pages' deployment menu or rollback API. Rolling back code does not
roll back D1 or B2 writes made after the takeover. Export a Keeper backup before
later catalog changes that you may need to undo.
