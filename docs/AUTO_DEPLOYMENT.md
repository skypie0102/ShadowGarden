# Automatic live deployment

## Activation state

Merged on 2026-10-21 through [PR #40](https://github.com/skypie0102/ShadowGarden/pull/40)
as `aed4f065e9c901a759350d908d5f3b0a66ac982f`. Main pushes now start the checked
live-deployment workflow. Publication is **blocked by a missing repository Actions
secret**, `CLOUDFLARE_API_TOKEN`. Production remains v2.18.0; the successful main
build in the `shadowgarden-test` project is a separate preview.

The [first main run](https://github.com/skypie0102/ShadowGarden/actions/runs/39593282242)
passed the asset audit, all 318 Node tests, all 541 browser cases (nine documented
skips), static build and binding/compatibility-aware Functions package. The
production job then stopped with:

> Set the production CLOUDFLARE_API_TOKEN Actions secret before deployment.

[Sanitized verification evidence](automatic-deployment-verification.json) records
the checked source/tree, profile counts, preflight failure and current live version.

The Actions environment showed that secret empty. This guard runs before baseline
HTTP requests or Wrangler publication, so the failed attempt made no Cloudflare,
catalog, snapshot, book-object, migration or credential writes.

The existing production Pages project is **`shadowgarden`**, in account
`fa95f62f96a0ff3b92a45175d94a48b6`. Its original Git integration retained the
unavailable old repository. The maintained source is
`skypie0102/ShadowGarden`, branch `main`. The automatic workflow publishes directly
to the existing live project, retaining its hostname, DB binding, B2 bucket and
encrypted settings.

## Trigger and checks

`.github/workflows/ci.yml` adds **Deploy live ShadowGarden** after the verification
job and all five browser jobs succeed. It runs only for this repository's `main`
pushes or an explicit main workflow retry. PRs and other branches cannot run the
production job. Existing `[skip ci]` documentation commits do not start a new run.

The production job serializes releases without cancelling an upload in progress.
It fetches current main and skips a superseded application revision. Changes only
under `docs/` or to `README.md` do not supersede an already checked application
revision. This permits follow-up release notes while the checked code is publishing.

The job installs the exact lockfile, builds static assets and checks the compiled
Functions binding/compatibility metadata. `scripts/deploy-production.mjs` then:

1. Requires a clean checkout of the workflow commit and the fixed live account,
   project, main branch and existing D1 database.
2. Captures and validates a fresh production baseline with the maintained
   collector. Only the existing project GET and fixed catalog/snapshot SELECT
   batch are allowed by its API adapter.
3. Selects added/modified JS/CSS assets against the actual previous production
   commit, or a stable footer module for a backend-only change. A batch over
   100 changed assets requires explicit release review.
4. Publishes through the repository's pinned Wrangler using
   `pages deploy dist --project-name shadowgarden --branch main`, attaching the
   checked commit and clean-source metadata. No migration or seed command runs.
5. Waits for the checked source to become successful canonical production.
6. Captures production again and runs the maintained verifier: exact document,
   snapshot/configuration preservation, both D1-derived catalogs, version/source
   and reviewed served JS/CSS bytes. The previous deployment ID is retained in
   the verification result for rollback.

Only the sanitized `.wrangler/production-verification.json` report is uploaded as
a CI artifact. Hidden-file inclusion is enabled only for that exact report path;
neither private baseline path is selected. Exact private baselines remain in ignored runner files. Credential
values and catalog/snapshot documents are not printed or uploaded.

## Deployment credential

The production job needs the repository Actions secret **`CLOUDFLARE_API_TOKEN`**.
The account ID is public configuration, set explicitly in the workflow. Use a
token restricted to the existing Cloudflare account with:

- **Cloudflare Pages — Edit** for publishing to the existing Pages project.
- **D1 — Read** for the fixed pre/post-release SELECT comparisons.

No B2 key, Keeper token, Turnstile secret or session-signing secret is copied to
GitHub. The live project's existing runtime secrets remain at Cloudflare.
Missing/invalid credentials fail before a production write. The deployment token
is passed only to the trusted main job's publication step.

Current official references: [Pages CI deployment](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/),
[Git integration with direct deployments](https://developers.cloudflare.com/pages/configuration/git-integration/)
and [D1 query permissions](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
The D1 query API accepts D1 Read; the collector still validates zero rows written
and exact expected results.

## Verification and remaining setup

Thirteen operational regression cases cover trusted-main admission, token routing,
read-only request confinement, malformed/failed API responses, live-project and
branch identity, changed-asset selection, canonical-deployment waits, failed uploads,
preservation failures and wrong served bytes. They use disposable responses and
do not access the live account or catalog.

The local and CI provenance audit, all 318 Node tests, static build and binding-aware
Functions package pass. PR CI run 39549548617 also passes all 541 browser cases
with nine skips and no retries. The tested/merged tree is
`4835efb361d7c636f514cc24f367750da76e943c`. The main run separately passes the
same checks before its credential preflight stops publication.

Cloudflare connector calls currently return `MCP error -32603: Internal error`,
including a runtime request with no API calls. The browser fallback reaches a
Cloudflare sign-in page; the secure sign-in request was interrupted and no
successful authenticated dashboard state was observed. The GitHub browser was
also signed out, and its connected plugin does not expose Actions secret setup.

To finish activation, configure the scoped token above in this repository's
**Settings → Secrets and variables → Actions** as `CLOUDFLARE_API_TOKEN`, then use
**Actions → ShadowGarden checks → Run workflow**, selecting `main`. This starts
a fresh checked run using the configured credential. Do not paste the token into
chat or put it in Git. Automatic publication is not considered verified until the
production job completes its baseline, publish and served-source checks.
