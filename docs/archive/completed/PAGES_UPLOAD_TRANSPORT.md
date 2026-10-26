# Pages asset upload transport

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

## Observed failure and resolution

On 2026-10-20 the connected Cloudflare plugin could read the existing Pages
project and D1 database and obtain a short-lived upload JWT. The upload-token
endpoint requires Pages Write access. The plugin runtime's native fetch requests
to `/pages/assets/check-missing` and `/pages/assets/upload`, with the documented
Bearer JWT, returned HTTP 403, code 8000013, `Authorization failed`.

A local HTTPS helper using a token issued by the same connected plugin succeeded:
the known-asset lookup returned HTTP 200; eight changed static assets uploaded;
all 164 unique hashes for 165 files were revalidated. No additional sign-in,
account-wide API token, permission change, new project or new storage resource was needed.

This demonstrates a difference between the request execution paths. It does not
establish the underlying reason for the plugin runtime's rejection. A successful
account/project read alone would not prove write access; successful issuance of
the upload token and the completed upload are stronger evidence here.

| Probe | Result |
| --- | --- |
| Existing-plugin upload-token issuance | 200 |
| Plugin runtime asset lookup | 403, code 8000013; ray `a4d446de1f0ba667-SIN`, 2026-10-20 01:33:51 UTC |
| Local helper known-asset lookup | 200, no missing hashes; ray `a4d445b08e6b3d6e-ORD`, 2026-10-20 01:33:03 UTC |
| Local helper complete asset upload | Eight changed assets; all 164 hashes revalidated |
| Account-authenticated plugin deployment API | 200; deployment `f86f42ef-b710-40f8-bf6a-011c47b875e5` |

The local helper consumed the token through hidden terminal input. Tokens and
encrypted setting values were not written to the repository. The token is only
for Pages static assets; it is not a new account-wide API credential.

## Repeatable release flow

Use normal Wrangler Pages deployment when the execution environment already has
appropriate Cloudflare authentication. When only the connected plugin is
authenticated, the following split flow preserves that existing connection:

1. From the tested, clean application source, run the static build and
   `scripts/build-pages-release.mjs`. Validate the compiled Worker using
   `readWorkerMetadata` and `assertReleaseBindings`; compare its compatibility
   date and flags explicitly with `wrangler.jsonc`. Retain the existing project's
   production settings and encrypted names.
2. Capture a fresh D1 revision, exact document checksum, all snapshot identities
   and actual/stored checksums, canonical deployment, actual/saved bindings and
   encrypted-setting names/types. Use the current D1 document to derive both
   expected public catalogs. Do not seed or migrate an already initialized
   catalog during an ordinary code release.
3. Build the static manifest using pinned Wrangler 4.151.1's hash algorithm:
   `blake3(base64(fileBytes) + extensionWithoutDot).hex().slice(0, 32)`.
   Manifest entries are `"/relative/path": "hash"`. Exclude Pages control files
   `_headers`, `_redirects`, `_routes.json`, `_worker.js`, Functions and development
   directories, as Wrangler's Pages validator does. Upload each unique hash once,
   retaining the file's MIME type.
4. Obtain a fresh JWT through the existing plugin:
   `GET /accounts/{account_id}/pages/projects/shadowgarden/upload-token`.
   Pass it privately to a local HTTPS helper; do not print it or place it in Git.
   The local helper uses `Authorization: Bearer <JWT>` and JSON bodies:
   - `POST /pages/assets/check-missing`: `{"hashes":["..."]}`.
   - `POST /pages/assets/upload`: an array of
     `{"base64":true,"key":"hash","metadata":{"contentType":"..."},"value":"base64 bytes"}`.
   - `POST /pages/assets/upsert-hashes`: `{"hashes":["..."]}`.
   Check every response and repeat the missing-hash lookup to verify that the
   complete manifest is available before creating a deployment.
5. Through the account-authenticated plugin, create the existing project's
   deployment with the verified manifest and compiled `_worker.bundle`, plus
   `_headers`, `_routes.json` and Functions routing configuration. Preserve the
   multipart payload byte-for-byte, including CRLF boundaries. Include the clean
   source commit, `branch=main`, `commit_dirty=false`, and the output directory /
   config hash from the compiled build metadata. Never substitute a source-only
   Worker without its compiled bindings.
6. Wait for deployment success and confirm its ID is canonical. Compare both
   public catalogs with D1, changed served files with the build, both Library
   footers, challenge configuration and unauthenticated Keeper denial. Compare
   the exact production document, all snapshots and actual/saved configuration
   with the fresh baseline. Retain the previously verified deployment for rollback.

The pinned CLI's hidden `pages project upload` command still invoked its ordinary
authentication resolver in this environment despite `CF_PAGES_UPLOAD_JWT`, and
stopped before uploading. Do not interpret that helper's login message as a
requirement for the user to sign in again: the direct asset requests above
completed with the existing plugin-issued token.

The combined release is **v2.17.0**, clean source `129a1d2`, deployed at
2026-10-20 01:38:22 UTC. [Verification evidence](../evidence/persistence-verification-2.17.0.json)
records the CI matrix, static hashes, production checks, transport diagnostics
and rollback to v2.16.0. The [production operations guide](../recovery/PRODUCTION_TAKEOVER.md)
identifies the existing account, project, D1 and bucket.
