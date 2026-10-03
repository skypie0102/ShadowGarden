# Existing production project

The owner authorized replacing the original site on 2026-10-02 and reusing its
existing B2 bucket. The five recovered EPUB entries were disposable tests. This
supersedes the separate-bucket plan in `TEST_DEPLOYMENT.md`.

| Resource | Value |
| --- | --- |
| Public URL | https://shadowgarden-bon.pages.dev/ |
| Cloudflare Pages project name | `shadowgarden` |
| Cloudflare account | `fa95f62f96a0ff3b92a45175d94a48b6` |
| Rebuilt source branch | `skypie0102/ShadowGarden`, `deploy/shadowgarden-bon` |
| Pages production branch | `main` |
| D1 binding | `DB` |
| Existing D1 database | `shadowgarden-test` |
| D1 ID | `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86` |
| Existing private B2 bucket | `shadow-garden-books-01` |
| B2 bucket ID | `ddac6e4567151ba5a20f0011` |
| Previous production deployment | `9b148143-53a4-442a-b863-7ca4dbab09e2` |

The project name differs from the hostname. Deploy to **`shadowgarden`**.
Cloudflare retained its original Git source when an API update was attempted,
so automatic production and preview builds from that old repository are paused.
Use Pages direct deployments to retain the existing hostname and secrets.

The first takeover deployment succeeded at 2026-10-02 08:31 UTC with commit
`26bacb7` and deployment ID `e9d4306a-a4db-4aed-a4a9-d3b28458dc39`. The homepage,
version, login challenge endpoints and both empty catalogs passed live checks.
All eight original secrets remain encrypted; `SESSION_SECRET` was added securely.
The original Turnstile widget already permits the production hostname.

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

The reconstructed backend also needs an independent encrypted `SESSION_SECRET`
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

From a checkout of the rebuilt repository:

```powershell
git fetch origin
git switch deploy/shadowgarden-bon
git pull --ff-only
npm.cmd ci
npm.cmd run build
npx.cmd wrangler pages deploy dist --project-name shadowgarden --branch main
```

Use `--branch main` because it identifies this Pages project's production
environment, even though the source checkout is `deploy/shadowgarden-bon`.
Wrangler compiles the `functions/` directory as part of this deployment. A
dashboard upload of `dist/` alone does not include those Functions.

## Check and roll back

Check the public home page, `/data/version.json`, `/admin-access`, `/human-access`
and both catalog URLs. Then sign into Keeper with the existing administrator
token and test uploading and reading a disposable EPUB. B2 upload/delete
permissions and real Turnstile verification require runtime checks.

The previous production deployment above is retained for rollback through
Cloudflare Pages' deployment menu or rollback API. Rolling back code does not
roll back D1 or B2 writes made after the takeover. Export a Keeper backup before
later catalog changes that you may need to undo.
