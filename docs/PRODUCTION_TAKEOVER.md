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
