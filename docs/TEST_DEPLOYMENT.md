# ShadowGarden isolated test setup

**Historical setup:** on 2026-10-02 the owner chose to reuse the existing
production site and B2 bucket. Follow
[PRODUCTION_TAKEOVER.md](PRODUCTION_TAKEOVER.md) for the current deployment.
The D1 database below is now assigned to production; avoid test writes against it.

This branch builds on the secret compatibility fix in draft PR #1. It is a test
deployment branch, not a production configuration change. Do not merge its test
resource identifiers into a production branch.

## Confirmed inventory

The owner's screenshots on 2026-10-01 show the live Pages project's Production
bindings list is empty and it is still linked to `shdwmnrchbks/ShadowGarden`.
The original B2 bucket is private. Existing secret names are documented in
[DEPLOYMENT.md](DEPLOYMENT.md); their encrypted values and permissions are
unverified. This test setup uses separate resources.

The new D1 database was initially shown with zero tables and zero queries on
2026-10-01. On 2026-10-02, the owner's terminal output confirmed both migrations
and the empty-library seed succeeded against the exact database below. Database
initialization is complete. The owner subsequently deployed the separate Pages
project, configured security and confirmed Keeper login. B2 setup is next.

| Setting | Value |
| --- | --- |
| GitHub repository | `skypie0102/ShadowGarden` |
| Test branch | `deploy/shadowgarden-test` |
| Test Pages project | `shadowgarden-test` |
| Test URL | `https://shadowgarden-test.pages.dev/` |
| D1 binding | `DB` |
| D1 database name | `shadowgarden-test` |
| D1 database ID | `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86` |

The database name and ID come from the owner's D1 overview screenshot. The owner
created and deployed the Pages project above on 2026-10-02.
The committed `wrangler.jsonc` on this branch targets this database. It contains
no credentials or live B2 configuration. Local Wrangler commands remain local
unless a remote operation is explicitly requested.

## Initialize the test database from Windows

Use PowerShell on a PC with Git and Node.js 24 (minimum 22.16). Run each command
separately and stop if one fails. Clone into a new directory; do not replace an
existing checkout. `wrangler login` opens Cloudflare authorization in the browser;
choose the account containing this new database. Authentication stays on the PC.
The Windows examples use `npm.cmd` and `npx.cmd`: PowerShell can block the `.ps1`
wrappers even in an Administrator window. The `.cmd` wrappers work without
changing the execution policy. These initialization steps are already completed
for the database above and are retained for reference.

```powershell
git clone --branch deploy/shadowgarden-test --single-branch https://github.com/skypie0102/ShadowGarden.git ShadowGarden-test
cd ShadowGarden-test
npm.cmd ci
npx.cmd wrangler login
npx.cmd wrangler d1 info shadowgarden-test
```

Confirm the displayed database ID is `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86`.
Then apply the two tracked migrations and initialize an empty library:

```powershell
npx.cmd wrangler d1 migrations apply shadowgarden-test --remote
npx.cmd wrangler d1 execute shadowgarden-test --remote --file recovery-info/empty-seed.sql
npx.cmd wrangler d1 execute shadowgarden-test --remote --command "SELECT revision, json_array_length(document, '$.main') AS main_series, json_array_length(document, '$.adult') AS adult_series FROM library_state WHERE id=1;"
```

Accept Wrangler's migration confirmation for this test database. Both
`0001_reconstructed.sql` and `0002_media_purge.sql` should succeed. The last query
should show revision 0 with zero main/adult series on this new database. The seed
preserves an existing library if rerun; it never deletes or replaces its data.
Wrangler records successful migrations so a later migration run skips them.
No Pages deployment or B2 operation is included in these commands.

## Connect a separate test Pages project after initialization

Open Cloudflare's Workers & Pages page, then Create application > Pages > Connect
to Git. Connect the `skypie0102` GitHub account and choose `ShadowGarden`.
Create a new project using these settings:

| Build setting | Value |
| --- | --- |
| Project name | `shadowgarden-test` |
| Production branch | `deploy/shadowgarden-test` |
| Framework preset | None |
| Root directory | Leave blank (repository root) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Build environment variable | `NODE_VERSION` = `24` |

The build command uses `npm`, without the Windows `.cmd` extension, because
Cloudflare builds run on Linux. The production-branch field refers to this new
test project's deployments; the existing live project retains its own settings.
The branch's standard Wrangler configuration supplies the `DB` binding. If the
proposed Pages project name is unavailable, agree a replacement and update the
branch's `name` before deployment. Do not attach the live custom domain yet.

Select Save and Deploy for the new test project. The initial deployment can check
hosting and the empty D1 catalog before secrets are configured. Keeper login,
Turnstile unlock and B2 uploads require the credentials below and will report
configuration errors until those are set. Supply the resulting `pages.dev` URL
or the build error before configuring and validating those provider flows.

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

The owner initialized the test D1 database on 2026-10-02 using Wrangler 4.136.3.
The supplied output marks `0001_reconstructed.sql` and `0002_media_purge.sql`
successful; the empty seed processed one query and wrote one row. The preceding
database info identified the intended UUID and APAC region. The final SELECT
query above has not been independently run against the remote database.

Test configuration commit `1811668` passed Actions run `36844551820`: 53
backend/client tests, build/Functions compilation and all 14 browser cases. The
following documentation update recorded initialization and fixed the PowerShell
wrapper commands without changing runtime code or resources.

The owner has now deployed `https://shadowgarden-test.pages.dev/`. Independent
HTTP checks confirmed the homepage and both catalog routes, with empty series
and the initialized D1 timestamp `2026-10-02T01:08:53.645Z`. After the owner added
security secrets and redeployed, `/admin-access` and `/human-access` returned
200 with the expected actions and a public site key. The owner then confirmed
Keeper opened normally. This validates test login from the owner's report;
media signing, B2 upload/read and cleanup still need actual storage tests.

Provider documentation revealed that current bucket-group keys require B2 v4
authorization. Updated the backend and provider fixtures to that response
format. All 57 local backend/client tests, asset audit, build and Functions
compilation pass. No secret values were collected or B2 objects changed.

## Connect isolated test storage

1. In Backblaze B2, open Buckets > Create a Bucket. Choose an available test
   name such as `shadowgarden-test-books`, select Private and leave Object Lock
   disabled so disposable cleanup tests can run. Record its exact name and ID.
2. In Application Keys > Add a New Application Key, create two keys. Restrict
   each to this test bucket and the file prefix `shadow-garden/`. Leave Allow
   List All Bucket Names unchecked. Use Read Only for `shadowgarden-test-read`
   and Read and Write for `shadowgarden-test-write`; the latter needs file
   listing/deletion as well as uploads. Save each keyID and applicationKey
   privately when shown. These are application keys scoped to one test bucket.
3. In the `shadowgarden-test` Pages project's Production Variables and Secrets,
   add the six entries below. All six may be stored as Secrets, including the
   bucket name/ID. Keep their values out of Git and chat.

| Cloudflare name | Backblaze value |
| --- | --- |
| `B2_BUCKET_NAME` | New test bucket's exact name |
| `B2_BUCKET_ID` | New test bucket's ID |
| `B2_READ_KEY_ID` | Read key's keyID |
| `B2_READ_APPLICATION_KEY` | Read key's applicationKey |
| `B2_WRITE_KEY_ID` | Write key's keyID |
| `B2_WRITE_APPLICATION_KEY` | Write key's applicationKey |

Save and redeploy the latest `deploy/shadowgarden-test` commit after entering
these values. Upload one small disposable EPUB in Keeper, then open it from
the public test library to exercise both write/read keys and signed media.
The actual upload/reader result remains pending. Backup/restore and explicit
cleanup follow once a real test upload succeeds. Original live storage is
outside this isolated test configuration.

- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Wrangler D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Pages build image and NODE_VERSION](https://developers.cloudflare.com/pages/configuration/build-image/)
- [B2 authorization and key compatibility](https://www.backblaze.com/apidocs/b2-authorize-account)
- [B2 bucket setup](https://www.backblaze.com/docs/cloud-storage-create-and-manage-buckets)
- [B2 application key setup](https://www.backblaze.com/docs/cloud-storage-create-and-manage-app-keys)
