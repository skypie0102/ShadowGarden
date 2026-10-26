# 2026-10-16 — Pages deployment lost its database and bucket bindings

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

Status: production restored to v2.12.0 deployment
`b13cf583-ad91-43e7-ad1f-55dbc9365802`, source
`235308a7e1716fa744cee8aaf7c1d53c1c9eef3e`. The v2.12.1 deployment
`5658687a-f60a-4a1f-8441-78738c2b04e1` is withdrawn. No new production
deployment was made during the recovery.

Subsequent verified release: v2.12.2 is now live as deployment
`e8fe494a-87ce-4731-9aa9-0285f449137d`, source
`d6527742a2cde9f878a7ae23547734d858d24521`, successful 2026-10-16 at
10:29 UTC. Its actual/saved bindings retain the original D1/bucket settings
and all nine encrypted-setting names. D1 revision 3 and both live catalogs are
unchanged. The guarded package and deployed reader assets pass. See the
[current release](../releases/READER_RELEASE.md) for verification and remaining manual
acceptance; the v2.12.1 deployment remains withdrawn.

## Impact and cause

The owner reported books failing to open, deleted entries reappearing and Keeper
login failing. The release assembled a Worker bundle using `wrangler pages
functions build` without both `--project-directory` and `--build-metadata-path`.
In pinned Wrangler 4.136.3, configuration is read only when both are supplied.
The resulting bundle contained `main_module` but no deployment bindings.

The manual deployment nevertheless supplied a Wrangler configuration hash. The
resulting production deployment and saved project configuration lost `DB`,
`B2_BUCKET_NAME` and `B2_BUCKET_ID`. The encrypted settings remained present.
This was a deployment packaging error, not a database migration or catalog edit.

The backend then returned the recovered September catalog when `env.DB` was
missing. This produced HTTP 200 with old entries instead of an explicit outage.
Keeper's challenge endpoint could still return 200 because its encrypted secrets
were present; the subsequent login requires the missing database. The reader
integration tests substituted authorization/publication responses and therefore
did not establish that real production book access or login worked.

The earlier completion report was incorrect. Matching source hashes, visible
version labels, HTTP 200 catalogs and mock-authorized reading did not verify the
production bindings or actual catalog identity.

## Recovery and confirmed data state

- Read-only D1 queries found the original row still at revision 3, last updated
  `2026-10-03T11:52:50.670Z`; the snapshot history was unchanged. Query metadata
  reported zero rows written and `changed_db: false`.
- Rolled production back to the previous deployment after verifying its `DB`
  binding pointed to `1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86`.
- Restored that binding and the two non-secret bucket settings in the saved
  production configuration. All nine encrypted setting names/types were retained;
  no secret value was changed or logged.
- Compared both live catalog responses against the actual sanitized D1 document;
  both matched exactly. The recovered five-volume list disappeared, and the
  current one-volume catalog returned.
- A request for the retained book without a ticket returns 403
  `book_ticket_required`. A nonexistent-cover probe reaches the B2 read path and
  returns the expected 404 `media_not_found`, rather than a configuration error.
- Both login challenge endpoints return their configured actions and site keys;
  unauthenticated Keeper library access returns 401. A real credentialed login
  and completed human verification were not exercised by the recovery checks.

No D1 restore, seed, migration, catalog mutation, B2 upload/delete or credential
rotation was performed. Production stays on the restored deployment.

## Prevention changes prepared in the repository

`scripts/build-pages-release.mjs` supplies both required configuration flags and
validates the resulting multipart bundle. `npm run check:functions` now runs this
packaging check, rather than checking source compilation alone.

`scripts/pages-release-guard.mjs` rejects missing/wrong/duplicate bindings and
placeholder databases. It also validates the actual deployment's D1/bucket
settings and compares catalog documents against a verified baseline. The
regressions cover the incident's binding-free bundle and recovered HTTP 200
catalog, not just an ordinary successful compile.

The prepared backend change returns 503 when D1 is missing or uninitialized;
it no longer substitutes recovered books as the live catalog. This backend
change is not deployed during incident recovery.

## Required release acceptance

1. Read the current project and canonical deployment; retain exact database
   identity, non-secret bucket settings and encrypted setting names. Capture the
   actual live catalog baseline and compare it to D1 before release.
2. Run `npm run check`. Prefer native `wrangler pages deploy` with the reviewed
   configuration. If a connector must transport the release, use the guarded
   bundle and its generated metadata, not a source-only compilation.
3. Inspect the resulting deployment and saved project configuration. Require the
   expected D1 binding and bucket settings; a successful deployment status is
   insufficient.
4. Compare both live catalogs with the verified D1 state. A difference requires
   investigation of current D1 state; never seed or restore data to make a smoke
   test pass.
5. Verify the existing book and Keeper flows with genuine authorization/human
   verification before declaring the production release complete. Keep the
   distinction from intercepted fixture checks explicit.

Phase 5 production release verification is reopened. The code milestones remain
merged; v2.12.1 must not be presented as the current live release.
