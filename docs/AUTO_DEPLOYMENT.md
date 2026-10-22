# Automatic live deployment

## Activation state

Merged on 2026-10-21 through [PR #40](https://github.com/skypie0102/ShadowGarden/pull/40)
as `aed4f06`. The repository Actions credential was configured on 2026-10-22.
Its D1 access works, but the live Pages project read returns **HTTP 403, error
10000: Authentication error**. Publication remains blocked by Pages authorization;
production remains **v2.18.0**, source `8e34ced`.

[Activation run 39755380834](https://github.com/skypie0102/ShadowGarden/actions/runs/39755380834)
on clean source `d8776e1` passes 318 Node tests and 541 browser cases, with nine
documented skips and no retries. Its production job sees the saved token but
stops during the read-only baseline, before Wrangler publication.

The [early credential-check run](https://github.com/skypie0102/ShadowGarden/actions/runs/39758249662) then tests each resource separately:

| Resource | Result |
|---|---|
| Existing Pages project GET | HTTP 403, Cloudflare error 10000 |
| D1 catalog revision SELECT | Success; no rows written |

The first main run's empty-secret failure is historical and resolved. Retrying
that older workflow correctly skipped its superseded source; the fresh main run
above exercised the configured credential. [Sanitized evidence](automatic-deployment-verification.json)
records the exact checked source, profile counts and current authorization blocker.

The existing production Pages project is **`shadowgarden`**, in account
`fa95f62f96a0ff3b92a45175d94a48b6`. Its original Git integration retained the
unavailable old repository. The maintained source is
`skypie0102/ShadowGarden`, branch `main`. The automatic workflow publishes directly
to the existing live project, retaining its hostname, DB binding, B2 bucket and
encrypted settings.

## Trigger and checks

`.github/workflows/ci.yml` adds **Deploy live ShadowGarden** after the verification
job, all five browser jobs and the main-only **Check production access** job succeed.
The early access job issues only the fixed project GET and catalog-revision SELECT;
it prints sanitized status/error details without token values, project settings or
catalog documents. The full guarded production baseline remains required. It runs only for this repository's `main`
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

## Verification and remaining authorization

Thirteen operational regression cases cover trusted-main admission, token routing,
read-only request confinement, malformed/failed API responses, live-project and
branch identity, changed-asset selection, canonical-deployment waits, failed uploads,
preservation failures and wrong served bytes. They use disposable responses and
do not access the live account or catalog.

Fresh activation run 39755380834 passes the asset/build/binding checks, all 318
Node tests and all 541 browser cases, with nine documented skips and no retries.
The subsequent early-check workflow change has valid YAML and embedded JavaScript
syntax; its verification job also passes 318 Node tests. Its read-only check
identifies Pages access as denied while D1 SELECT succeeds. The five browser jobs
for this workflow-only follow-up were still running at the evidence checkpoint;
no success is claimed for that unfinished run.

The connected Cloudflare plugin's read requests recovered on 2026-10-22 and
confirm the existing v2.18.0 deployment. The Actions job uses its own saved token;
its Pages authorization failure is distinct from the earlier connector errors.

To finish activation, edit the Cloudflare token used by repository Actions so it
has two permission rows: **Account → Cloudflare Pages → Edit** and
**Account → D1 → Read**, including account `fa95f62f96a0ff3b92a45175d94a48b6`.
Editing permissions on the same token retains its value. If creating a replacement
token, update the existing `CLOUDFLARE_API_TOKEN` repository Actions secret with
that new value. Do not put token values in chat or Git.

Retry the failed access/production jobs after the current check run finishes, or
use **Actions → ShadowGarden checks → Run workflow**, selecting `main`. Automatic
publication is not considered activated until the production job passes its
baseline, upload, canonical-source and preservation checks.
