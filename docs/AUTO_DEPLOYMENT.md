# Automatic live deployment

## Activation state

Automatic live deployment was activated on 2026-10-22. The [successful activation run 39758249662](https://github.com/skypie0102/ShadowGarden/actions/runs/39758249662)
(attempt 2) passes both Pages/D1 credential checks and the guarded production job,
retaining successful verification and all five browser profiles. The activation
release was **v2.18.1**, source `a3f1b958ba4249f4766446b2206ec1cf048ebbf4`, deployment
`2fed005d-bdb3-4a5f-a6c7-6e34ad7f578d`.

The workflow was introduced through [PR #40](https://github.com/skypie0102/ShadowGarden/pull/40).
Its first empty-secret attempt and the subsequent Pages HTTP 403 are historical.
The configured token's Pages authorization was corrected; the same run's failed
access check and dependent production job were retried. Successful 318-Node and
541-browser results were retained, with nine documented platform skips and no
test retries. The credential value was not printed or copied into the repository.

[Sanitized verification evidence](automatic-deployment-verification.json) records
the successful run, exact release source, served-file comparisons, preserved
production state and the retained v2.18.0 rollback.

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
   and reviewed served JS/CSS bytes. A coherent public version for the captured
   previous source may wait within bounded read-only polling; the original
   baseline, asset selection and rollback identity are retained. The report
   records version-check attempts/time and the previous deployment/source.
   See [served-version convergence](PRODUCTION_VERSION_CONVERGENCE.md) for
   exact retry conditions and failure limits.

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

## Activation verification and credential maintenance

Thirteen operational regression cases cover trusted-main admission, token routing,
read-only request confinement, malformed/failed API responses, live-project and
branch identity, changed-asset selection, canonical-deployment waits, failed uploads,
preservation failures and wrong served bytes. They use disposable responses and
do not access the live account or catalog.

Run 39758249662 passes 318 Node tests and 541 browser cases across five profiles,
with nine documented skips and no test retries. After the Pages permission was
corrected, workflow attempt 2 retained those successful checks and reran the
failed access check plus dependent production job. Both resource reads pass;
the binding-aware package, pinned Wrangler upload, canonical-deployment wait
and post-release verifier all complete successfully.

The live verifier checks source/version, both D1-derived catalogs and exact
bytes of all seven changed JavaScript assets. The exact catalog document,
all nine snapshot documents/checksums and saved/runtime settings are unchanged.
Revision 9 is retained, with zero database writes. Independent public HTTP checks
also confirm v2.18.1/source `a3f1b95` and all seven reviewed Git blob identities.
The sanitized `production-verification` artifact is retained by Actions for 30
days; the repository evidence preserves its report beyond that artifact lifetime.

Future checked pushes to `main` publish automatically. To start a manual checked
release, use **Actions → ShadowGarden checks → Run workflow**, selecting `main`.
If replacing an expired/revoked token, update the existing repository Actions
secret in **Settings → Secrets and variables → Actions**. Keep two permission
rows on the existing account: **Cloudflare Pages Edit** and **D1 Read**. Editing
permissions on the same token retains its value; a replacement token requires
updating the GitHub secret. Keep token values out of chat and Git.

The early access job identifies the rejected resource before publication.
After correcting authorization, retry failed jobs once the current run finishes
or start a fresh checked main run. Do not treat an access check alone as a live
release: the production baseline, upload, canonical-source and preservation
checks must also complete successfully.
