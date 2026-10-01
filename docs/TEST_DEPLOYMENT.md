# ShadowGarden isolated test setup

This branch builds on the secret compatibility fix in draft PR #1. It is a test
deployment branch, not a production configuration change. Do not merge its test
resource identifiers into a production branch.

## Confirmed inventory

The owner's screenshots on 2026-10-01 show the live Pages project's Production
bindings list is empty and it is still linked to `shdwmnrchbks/ShadowGarden`.
The original B2 bucket is private. Existing secret names are documented in
[DEPLOYMENT.md](DEPLOYMENT.md); their encrypted values and permissions are
unverified. This test setup uses separate resources.

The new D1 database was shown with zero tables and zero queries:

| Setting | Value |
| --- | --- |
| GitHub repository | `skypie0102/ShadowGarden` |
| Test branch | `deploy/shadowgarden-test` |
| Proposed test Pages project | `shadowgarden-test` |
| D1 binding | `DB` |
| D1 database name | `shadowgarden-test` |
| D1 database ID | `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86` |

The database name and ID come from the owner's D1 overview screenshot. The Pages
project name is proposed; that project has not been created or deployed here.
The committed `wrangler.jsonc` on this branch targets this database. It contains
no credentials or live B2 configuration. Local Wrangler commands remain local
unless a remote operation is explicitly requested.

## Initialize the test database from Windows

Use PowerShell on a PC with Git and Node.js 24 (minimum 22.16). Run each command
separately and stop if one fails. Clone into a new directory; do not replace an
existing checkout. `wrangler login` opens Cloudflare authorization in the browser;
choose the account containing this new database. Authentication stays on the PC.

```powershell
git clone --branch deploy/shadowgarden-test --single-branch https://github.com/skypie0102/ShadowGarden.git ShadowGarden-test
cd ShadowGarden-test
npm ci
npx wrangler login
npx wrangler d1 info shadowgarden-test
```

Confirm the displayed database ID is `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86`.
Then apply the two tracked migrations and initialize an empty library:

```powershell
npx wrangler d1 migrations apply shadowgarden-test --remote
npx wrangler d1 execute shadowgarden-test --remote --file recovery-info/empty-seed.sql
npx wrangler d1 execute shadowgarden-test --remote --command "SELECT revision, json_array_length(document, '$.main') AS main_series, json_array_length(document, '$.adult') AS adult_series FROM library_state WHERE id=1;"
```

Accept Wrangler's migration confirmation for this test database. Both
`0001_reconstructed.sql` and `0002_media_purge.sql` should succeed. The last query
should show revision 0 with zero main/adult series on this new database. The seed
preserves an existing library if rerun; it never deletes or replaces its data.
Wrangler records successful migrations so a later migration run skips them.
No Pages deployment or B2 operation is included in these commands.

## Connect a separate test Pages project after initialization

Create a new Pages project for `skypie0102/ShadowGarden` with the test branch as
its production branch. This means production for the separate test project; the
existing live Pages project continues using its own configuration. Use framework
preset None, repository root, `npm run build`, output `dist`, and Node.js 24.
The branch's standard Wrangler configuration supplies the `DB` binding. If the
proposed Pages project name is unavailable, agree a replacement and update the
branch's `name` before deployment. Do not attach the live custom domain yet.

Configure the test project's credentials independently: the supported `SG_*`
names, an independent random `SESSION_SECRET` (at least 32 characters), and B2
read/write pairs scoped to a disposable test bucket, with its own bucket name/ID.
Turnstile must permit the actual test hostname. Do not point destructive cleanup
tests at the live B2 bucket. Secrets are entered through Cloudflare, never Git.
See [DEPLOYMENT.md](DEPLOYMENT.md) for required capabilities and precedence.

After deployment, verify the test project's binding points to the database above,
then check real login, upload, reading, backup, restore and cleanup with authorized
disposable media. Code tests cannot validate actual provider credentials. A later
production switch needs a separately reviewed production config and explicit
deployment direction.

## Status and references

Prepared from the owner's screenshots; this preparation did not execute remote
migrations, initialize the database, create a Pages project, change Cloudflare
settings, or call B2. Database initialization is the next owner-side action.
The new config is checked with the pinned Wrangler compiler; the branch's Actions
workflow runs the established backend/client and isolated browser tests.

- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Wrangler D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
