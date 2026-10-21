# Automatic live deployment

## Activation state

Prepared on 2026-10-21. The production job is not active until this workflow is
merged and its deployment credential is configured. Production is still v2.18.0;
the successful main build in the `shadowgarden-test` project is a preview and
does not update `shadowgarden-bon.pages.dev`.

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
a CI artifact. Exact private baselines remain in ignored runner files. Credential
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

The local provenance audit, all 318 Node tests, static build and binding-aware
Functions package pass. The pull request's browser matrix remains required before
activation.

Cloudflare connector calls currently return `MCP error -32603: Internal error`,
including a runtime request with no API calls. The browser fallback reaches a
Cloudflare sign-in page. Activation therefore requires secure dashboard sign-in
and configuration of the scoped deployment credential, followed by a real checked
main deployment and verification. Until that succeeds, this document does not
claim automatic production deployment is operational.
