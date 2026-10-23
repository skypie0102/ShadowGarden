# Read-only production verification

`npm run verify:production` checks the existing `shadowgarden` Pages project at
`https://shadowgarden-bon.pages.dev`. It never logs in, deploys, seeds, restores,
uploads, deletes or changes settings. The collector makes a project GET and a D1
query containing only two fixed SELECT statements; it rejects query results
that report writes. The HTTP verifier makes only GET requests with redirects
disabled and a 15-second timeout per request. Version JSON has a 64 KiB
response limit; catalogs/assets retain a 4 MiB limit.

## Capture current production through the connected plugin

The exported `captureProductionBaseline` in
[`scripts/production-baseline.mjs`](../scripts/production-baseline.mjs) is
self-contained. Read that module locally and pass the function's source into the
Cloudflare plugin's execute operation. Invoke it with the plugin request adapter:

```js
async () => {
  // Insert the reviewed captureProductionBaseline declaration here verbatim.
  return captureProductionBaseline(options => cloudflare.request(options), {
    accountId,
    projectName: 'shadowgarden',
    databaseId: '1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86'
  });
}
```

Select account `fa95f62f96a0ff3b92a45175d94a48b6` in the execute operation. No
browser session or additional sign-in is required when the existing connection
is authorized. The collector accepts an injected API request function so an
existing authorized CLI/API transport can also call it; it does not require or
handle a new token.

Save the returned JSON in ignored `private/` or `.wrangler/`. **The baseline
contains the exact private catalog document and must never be committed.**
Encrypted setting values are discarded inside the collector. It retains their
names/types, plaintext configuration, the canonical deployment/source, exact D1
serialization, snapshot identities, stored checksums and independently computed
snapshot checksums.

For a deployment, capture `before.json` immediately before publishing. Capture
`current.json` after the deployment succeeds; select the canonical production
deployment, not a preview. Refresh the latter if it becomes more than 15 minutes
old. Existing state must remain initialized; never seed to make a check pass.

## Verify the reviewed release

Keep the exact reviewed release `dist` directory. Rebuilding it from a later docs
or tooling commit changes its version metadata even when the application is the
same. Supply the full canonical application commit, package version and every
changed served JS/CSS asset. Paths are relative to `dist`, must start with
`assets/`, and cannot escape it through traversal or symlinks.

```sh
npm run verify:production -- \
  --baseline private/current.json \
  --before private/before.json \
  --dist private/reviewed-dist \
  --version 2.17.1 \
  --source 01b57f9f3586839a48c56969799d897bcedf0b64 \
  --file assets/js/book-access.js \
  --file assets/js/reader-visual-cache.js \
  --output private/verification.json
```

`--before` is optional for checking an existing deployment. Without it the report
says `preservationChecked: false`; this cannot establish preservation across a
release. With it, exact D1 serialization/revision/timestamp, all snapshot
identities/checksums and actual/saved configuration must match. A concurrent
owner edit is a failure requiring inspection and a new baseline, not something
to overwrite. The current baseline must still be fresh. The pre-release record
may be older, but cannot be newer than the current record.

The verifier rejects wrong resources, unsuccessful canonical deployments,
malformed/damaged catalogs, mismatched snapshot checksums, actual/saved setting
drift and configuration that differs from `wrangler.jsonc`. The production DB,
plaintext variables, compatibility date and compatibility flag set must match.
`npm run check:functions` independently checks those same settings in the actual
compiled Worker multipart metadata before publishing. Flag order is irrelevant;
missing, extra, malformed or duplicate flags are rejected when they change or
invalidate the configured set. An absent flags list means the empty set.

HTTP verification requires status 200 and the expected content type. It checks:

- `/data/version.json`: exact release version, full source, short source and main branch.
- `/media/shadow-garden/data/catalog.json` and
  `/media/shadow-garden/data/adult-catalog.json`: complete equality with the public
  projection of the structurally validated private D1 document, including its
  update timestamp. Object key order is ignored; array order remains significant.
- Each selected asset: exact bytes and JS/CSS content type against the reviewed
  local release. HTML fallback pages cannot masquerade as successful source.

The automatic deployment path can wait only for a coherent response identifying
the original previous source: at most twelve version GETs and two minutes,
with five-second intervals and each request shortened to the remaining budget.
Other failures remain immediate, and the standalone CLI keeps one-shot version
verification. See [convergence contracts and tests](PRODUCTION_VERSION_CONVERGENCE.md).

Archived `/data/catalog.json` files and `/version.json` are not production probes.
A successful JSON response with the wrong/empty catalog is a failure.

The sanitized output is suitable for a reviewed release record: it includes
deployment/source/version, baseline time, revision, document hash, snapshot count,
checked paths and asset/catalog hashes. It excludes catalog content, private
coordinates and setting values. A nonzero exit status means verification failed.
On hosts using an HTTPS proxy, use the host's supported Node proxy configuration;
this session used Node 24's `--use-env-proxy` option with the same verifier.

## Scope and limitations

Baselines are trusted records collected through the existing authorized API;
they are not signed attestations. The CLI cannot independently prove the origin
of a manually supplied file. Project/D1 capture and HTTP checks are separate
reads, not an atomic transaction or a permanent guarantee against later edits.
Capture again after the HTTP run and compare if preservation through the whole
verification window is required. Snapshot checksum validation does not claim
that every historical catalog is structurally valid or that its media exists.
The collector reads each retained snapshot to hash it; this is an explicit
operational check, not an unbounded public request handler.

This tool checks selected static sources and public catalog/version responses.
It does not check compiled server source bytes, encrypted secret values,
real CAPTCHA/credential flows, B2 writes/deletes, EPUB opening or physical device
acceptance. Use the existing CI and separately scoped live acceptance for those
behaviors. The current production verification record is
[`keeper-upload-presentation-verification.json`](keeper-upload-presentation-verification.json).
The preceding [upload-buffer release](upload-buffer-verification-2.18.8.json)
retains its separate dated evidence.
The preceding [volume-removal release](keeper-volume-removal-verification.json)
retains its separate dated evidence.
The preceding [version-convergence release](production-version-convergence-verification.json)
retains its separate dated evidence.
The original tooling-only validation remains in
[`production-tooling-verification.json`](production-tooling-verification.json).


## Validation — 2026-10-20

[PR #37](https://github.com/skypie0102/ShadowGarden/pull/37) merged as
`75b6eb7e8e1274e267dc398e54787c8fc6045afc`. Its tree
`8493c36347d0bec01d4edd661beadd9ceba28b73` exactly matches tested source
`e1903eaac31edaf2c2fd2742f16156984439f101`.
[CI run 39412104343](https://github.com/skypie0102/ShadowGarden/actions/runs/39412104343)
passed on attempt 1 with no test retries: asset/provenance audit, all 305 Node
tests, static build, binding/compatibility-aware Worker build and the full browser
matrix. The twelve added Node cases cover the verifier and compatibility guards.

| Browser profile | Passed | Existing skips |
| --- | ---: | ---: |
| Desktop Chromium | 102 | 0 |
| Mobile Chromium | 102 | 0 |
| Firefox | 100 | 2 |
| Desktop WebKit | 100 | 2 |
| Mobile WebKit | 98 | 4 |
| Total | 502 | 8 |

The committed live report was generated at 10:59 UTC; the exact committed
collector/verifier was also rerun successfully at 11:03 UTC using the existing
Cloudflare connection and the reviewed v2.17.1 release directory. Both catalogs,
version and the two selected assets match. Exact revision-9 serialization, all
nine snapshot identities/checksums and actual/saved settings match the fresh
before record. Queries report zero database writes. Private baselines remain
ignored. No application, production deployment, catalog, media or credential
change was performed for this tooling increment. Production remains v2.17.1,
deployment `39c54372-231f-4a6d-880b-48f1a3710b57`, application source `01b57f9`.
